import { MATERIAL_BASELINES } from "@/lib/data/material-baselines"
import { PHASE_1B_TASK_LIBRARY } from "@/lib/data/task-cost-library"
import { TRADE_RATES } from "@/lib/data/trade-rates"
import type { Trade } from "@/types/refurb"

export type CostDataValidationResult = {
  errors: string[]
  warnings: string[]
  isValid: boolean
}

export function validateCostDataLayer(): CostDataValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const materialIds = new Set(MATERIAL_BASELINES.map((m) => m.id))
  const trades = new Set(Object.keys(TRADE_RATES) as Trade[])

  for (const tradeRate of Object.values(TRADE_RATES)) {
    if (!tradeRate.notes.trim()) {
      errors.push(`Trade rate '${tradeRate.trade}' must include notes.`)
    }

    if (tradeRate.isActive && tradeRate.defaultDayRate <= 0) {
      errors.push(`Active trade '${tradeRate.trade}' has invalid defaultDayRate: ${tradeRate.defaultDayRate}.`)
    }

    if (tradeRate.dayRateLow > tradeRate.dayRateMid || tradeRate.dayRateMid > tradeRate.dayRateHigh) {
      errors.push(`Trade '${tradeRate.trade}' has inconsistent day-rate band ordering (low <= mid <= high expected).`)
    }
  }

  for (const material of MATERIAL_BASELINES) {
    if (!material.notes.trim()) {
      errors.push(`Material '${material.id}' must include notes.`)
    }

    if (material.selectedPrice < 0) {
      errors.push(`Material '${material.id}' has negative selectedPrice: ${material.selectedPrice}.`)
    }

    if (material.lowPrice > material.midPrice || material.midPrice > material.highPrice) {
      errors.push(`Material '${material.id}' has inconsistent price band ordering (low <= mid <= high expected).`)
    }

    if (material.selectedPrice < material.lowPrice || material.selectedPrice > material.highPrice) {
      warnings.push(
        `Material '${material.id}' selectedPrice (${material.selectedPrice}) sits outside [low, high] band (${material.lowPrice}-${material.highPrice}).`
      )
    }
  }

  for (const task of PHASE_1B_TASK_LIBRARY) {
    if (!task.scalingRule) {
      errors.push(`Task '${task.id}' is missing scalingRule.`)
    }

    if (!task.riskNotes.trim()) {
      errors.push(`Task '${task.id}' is missing riskNotes. Assumptions must be visible.`)
    }

    if (!trades.has(task.tradeRequired)) {
      errors.push(`Task '${task.id}' references unknown trade '${task.tradeRequired}'.`)
    }

    const tradeRate = TRADE_RATES[task.tradeRequired]
    if (!tradeRate || !tradeRate.isActive) {
      errors.push(`Task '${task.id}' references inactive or missing trade '${task.tradeRequired}'.`)
    }

    for (const materialRef of task.materialItems) {
      if (!materialIds.has(materialRef.materialId)) {
        errors.push(
          `Task '${task.id}' references unknown material '${materialRef.materialId}'.`
        )
      }
    }

    if (task.materialCost > 0 && task.materialItems.length === 0) {
      warnings.push(
        `Task '${task.id}' has materialCost > 0 but no materialItems references. Keep under review.`
      )
    }
  }

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
  }
}

export function assertCostDataLayerValid(): void {
  const result = validateCostDataLayer()
  if (!result.isValid) {
    throw new Error(`Cost data validation failed:\n${result.errors.join("\n")}`)
  }
}
