import type { Trade, GeneratedRefurbTask } from "@/types/refurb"
import type { PricingCompleteness, RefurbCostResult } from "@/types/scope"

export function isTaskUnpriced(task: GeneratedRefurbTask): boolean {
  if (task.isUnpriced === true) return true
  if (task.id.endsWith("-unsupported")) return true
  return task.warnings.some(
    (w) =>
      w.includes("has no task templates") ||
      w.toLowerCase().includes("cost not included") ||
      w.toLowerCase().includes("unpriced")
  )
}

export function calculateRefurbCost(tasks: GeneratedRefurbTask[]): RefurbCostResult {
  let totalRefurbCost = 0
  let labourCost = 0
  let materialCost = 0

  const roomBreakdown: Record<string, number> = {}
  const tradeBreakdown: Partial<Record<Trade, number>> = {}

  for (const task of tasks) {
    totalRefurbCost += task.totalCost
    labourCost += task.labourCost
    materialCost += task.materialCost * task.quantity

    roomBreakdown[task.room] = (roomBreakdown[task.room] ?? 0) + task.totalCost
    tradeBreakdown[task.trade] = (tradeBreakdown[task.trade] ?? 0) + task.totalCost
  }

  const unpricedTasks = tasks.filter(isTaskUnpriced)
  const pricedTasks = tasks.filter((t) => !isTaskUnpriced(t))
  const hasUnpricedItems = unpricedTasks.length > 0

  let pricingCompleteness: PricingCompleteness = "FULLY_PRICED"
  if (hasUnpricedItems && pricedTasks.length === 0) {
    pricingCompleteness = "UNPRICED"
  } else if (hasUnpricedItems) {
    pricingCompleteness = "PARTIALLY_PRICED"
  }

  const confidenceFlags = [...new Set(tasks.flatMap((t) => t.warnings))]

  return {
    totalRefurbCost,
    labourCost,
    materialCost,
    roomBreakdown,
    tradeBreakdown,
    taskList: tasks,
    confidenceFlags,
    pricingCompleteness,
    hasUnpricedItems,
    unpricedItemsCount: unpricedTasks.length,
    unpricedTaskNames: unpricedTasks.map((t) => t.taskName),
    isProvisional: hasUnpricedItems,
  }
}
