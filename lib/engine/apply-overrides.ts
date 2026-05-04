import { MATERIAL_BASELINES } from "@/lib/data/material-baselines"
import type { CostOverride, OverrideApplied, OverrideApplicationResult } from "@/types/overrides"
import type { GeneratedRefurbTask, Trade } from "@/types/refurb"

function recomputeTask(task: GeneratedRefurbTask): GeneratedRefurbTask {
  const labourCost = task.labourDays * task.dayRate * task.quantity
  const totalCost = labourCost + task.materialCost * task.quantity
  return {
    ...task,
    labourCost,
    totalCost,
  }
}

function asNumber(value: number | boolean): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asBoolean(value: number | boolean): boolean | null {
  return typeof value === "boolean" ? value : null
}

function matchesTask(task: GeneratedRefurbTask, override: CostOverride): boolean {
  if (override.targetTaskId && task.id !== override.targetTaskId) {
    return false
  }

  if (override.targetTrade && task.trade !== override.targetTrade) {
    return false
  }

  return true
}

export function applyCostOverrides(
  sourceTasks: GeneratedRefurbTask[],
  overrides: CostOverride[] = []
): OverrideApplicationResult {
  const tasks = sourceTasks.map((task) => ({
    ...task,
    assumptionsUsed: [...task.assumptionsUsed],
    warnings: [...task.warnings],
  }))

  const applied: OverrideApplied[] = []
  const warnings: string[] = []
  const assumptions: string[] = []
  const includeMap = new Map<string, boolean>(tasks.map((task) => [task.id, true]))

  for (const override of overrides) {
    if (override.type === "task_exclude" || override.type === "task_include") {
      const includeValue = asBoolean(override.value)
      if (includeValue === null) {
        warnings.push(`Override '${override.id}' ignored: ${override.type} requires boolean value.`)
        continue
      }

      if (!override.targetTaskId) {
        warnings.push(`Override '${override.id}' ignored: ${override.type} requires targetTaskId.`)
        continue
      }

      if (!includeMap.has(override.targetTaskId)) {
        warnings.push(`Override '${override.id}' ignored: task '${override.targetTaskId}' not found.`)
        continue
      }

      const previous = includeMap.get(override.targetTaskId) ?? true
      const next = override.type === "task_exclude" ? !includeValue : includeValue
      includeMap.set(override.targetTaskId, next)

      applied.push({
        overrideId: override.id,
        type: override.type,
        target: override.targetTaskId,
        previousValue: previous,
        newValue: next,
        reason: override.reason,
      })

      assumptions.push(
        `Override ${override.id}: ${override.type} set task '${override.targetTaskId}' active=${next}.`
      )
      continue
    }

    if (override.type === "material_price") {
      const price = asNumber(override.value)
      if (price === null || price < 0) {
        warnings.push(`Override '${override.id}' ignored: material_price requires numeric value >= 0.`)
        continue
      }

      let matched = 0

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i]
        if (!matchesTask(task, override)) {
          continue
        }

        if (override.targetMaterialItem) {
          const materialRef = task.materialItems?.find(
            (item) => item.materialId === override.targetMaterialItem
          )
          if (!materialRef) {
            continue
          }

          const baselineMaterial = MATERIAL_BASELINES.find(
            (item) => item.id === override.targetMaterialItem
          )
          if (!baselineMaterial) {
            warnings.push(
              `Override '${override.id}' ignored for task '${task.id}': material '${override.targetMaterialItem}' missing baseline.`
            )
            continue
          }

          const qty = materialRef.quantity ?? 1
          const delta = (price - baselineMaterial.selectedPrice) * qty
          const previousMaterialCost = task.materialCost
          const nextMaterialCost = Math.max(0, previousMaterialCost + delta)

          tasks[i] = recomputeTask({
            ...task,
            materialCost: nextMaterialCost,
            assumptionsUsed: [
              ...task.assumptionsUsed,
              `Override ${override.id}: material '${override.targetMaterialItem}' price changed from ${baselineMaterial.selectedPrice} to ${price}.`,
            ],
          })

          applied.push({
            overrideId: override.id,
            type: override.type,
            target: `${task.id}:${override.targetMaterialItem}`,
            previousValue: baselineMaterial.selectedPrice,
            newValue: price,
            reason: override.reason,
          })

          assumptions.push(
            `Override ${override.id}: adjusted material cost for '${task.id}' using material '${override.targetMaterialItem}'.`
          )
          matched++
          continue
        }

        if (!override.targetTaskId) {
          warnings.push(
            `Override '${override.id}' ignored: material_price requires targetTaskId when targetMaterialItem is not provided.`
          )
          continue
        }

        const previousMaterialCost = task.materialCost
        tasks[i] = recomputeTask({
          ...task,
          materialCost: price,
          assumptionsUsed: [
            ...task.assumptionsUsed,
            `Override ${override.id}: task material cost changed from ${previousMaterialCost} to ${price}.`,
          ],
        })

        applied.push({
          overrideId: override.id,
          type: override.type,
          target: task.id,
          previousValue: previousMaterialCost,
          newValue: price,
          reason: override.reason,
        })
        assumptions.push(`Override ${override.id}: set task '${task.id}' material cost to ${price}.`)
        matched++
      }

      if (matched === 0) {
        warnings.push(`Override '${override.id}' did not match any tasks.`)
      }
      continue
    }

    const numericValue = asNumber(override.value)
    if (numericValue === null || numericValue < 0) {
      warnings.push(
        `Override '${override.id}' ignored: ${override.type} requires numeric value >= 0.`
      )
      continue
    }

    let matched = 0
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      if (!matchesTask(task, override)) {
        continue
      }

      if (override.type === "labour_day_rate") {
        const previous = task.dayRate
        tasks[i] = recomputeTask({
          ...task,
          dayRate: numericValue,
          assumptionsUsed: [
            ...task.assumptionsUsed,
            `Override ${override.id}: labour day rate changed from ${previous} to ${numericValue}.`,
          ],
        })

        applied.push({
          overrideId: override.id,
          type: override.type,
          target: override.targetTaskId ? task.id : (override.targetTrade as Trade),
          previousValue: previous,
          newValue: numericValue,
          reason: override.reason,
        })
        assumptions.push(`Override ${override.id}: applied labour day rate ${numericValue} to '${task.id}'.`)
        matched++
        continue
      }

      if (override.type === "labour_days") {
        const previous = task.labourDays
        tasks[i] = recomputeTask({
          ...task,
          labourDays: numericValue,
          assumptionsUsed: [
            ...task.assumptionsUsed,
            `Override ${override.id}: labour days changed from ${previous} to ${numericValue}.`,
          ],
        })

        applied.push({
          overrideId: override.id,
          type: override.type,
          target: override.targetTaskId ? task.id : (override.targetTrade as Trade),
          previousValue: previous,
          newValue: numericValue,
          reason: override.reason,
        })
        assumptions.push(`Override ${override.id}: applied labour days ${numericValue} to '${task.id}'.`)
        matched++
      }
    }

    if (matched === 0) {
      warnings.push(`Override '${override.id}' did not match any tasks.`)
    }
  }

  const filteredTasks = tasks.filter((task) => includeMap.get(task.id) !== false)

  return {
    tasks: filteredTasks,
    applied,
    warnings,
    assumptions,
  }
}
