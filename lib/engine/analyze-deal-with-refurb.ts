import { analyzeDeal } from "@/lib/calculations"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { calculateTimeline } from "@/lib/engine/timeline-engine"
import type { DealInputs, DealResult } from "@/types/deal"
import type { RefurbScopeInput, RefurbCostResult } from "@/types/scope"
import type { RefurbTimeline } from "@/types/refurb"

export type DealWithRefurbResult = {
  deal: DealResult
  refurbSource: "manual" | "generated"
  refurb?: RefurbCostResult
  timeline?: RefurbTimeline
  warnings: string[]
}

export function analyzeDealWithRefurb(
  inputs: DealInputs,
  refurbScope?: RefurbScopeInput
): DealWithRefurbResult {
  if (refurbScope !== undefined) {
    const tasks = generateTasksFromScope(refurbScope)
    const refurb = calculateRefurbCost(tasks)
    const timeline = calculateTimeline(tasks)

    const dealInputs: DealInputs = {
      ...inputs,
      refurbCost: refurb.totalRefurbCost,
    }

    return {
      deal: analyzeDeal(dealInputs),
      refurbSource: "generated",
      refurb,
      timeline,
      warnings: refurb.confidenceFlags,
    }
  }

  return {
    deal: analyzeDeal(inputs),
    refurbSource: "manual",
    warnings: [],
  }
}
