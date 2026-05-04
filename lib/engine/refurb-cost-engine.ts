import type { Trade, GeneratedRefurbTask } from "@/types/refurb"
import type { RefurbCostResult } from "@/types/scope"

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

  const confidenceFlags = [...new Set(tasks.flatMap((t) => t.warnings))]

  return {
    totalRefurbCost,
    labourCost,
    materialCost,
    roomBreakdown,
    tradeBreakdown,
    taskList: tasks,
    confidenceFlags,
  }
}
