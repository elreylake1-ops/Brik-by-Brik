import { analyzeDeal } from "@/lib/calculations"
import { applyCostOverrides } from "@/lib/engine/apply-overrides"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { calculateTimeline } from "@/lib/engine/timeline-engine"
import type { DealInputs, DealResult } from "@/types/deal"
import type { OverrideApplied, CostOverride } from "@/types/overrides"
import type { RefurbScopeInput, RefurbCostResult } from "@/types/scope"
import type { RefurbTimeline } from "@/types/refurb"

export type DealWithRefurbResult = {
  deal: DealResult
  refurbSource: "manual" | "generated"
  refurb?: RefurbCostResult
  timeline?: RefurbTimeline
  warnings: string[]
  overridesApplied: OverrideApplied[]
  assumptionsReport: string[]
}

function buildAssumptionsReport(
  tasksAssumptions: string[],
  timelineAssumptions: string[],
  overrideAssumptions: string[]
): string[] {
  return [...new Set([...tasksAssumptions, ...timelineAssumptions, ...overrideAssumptions])]
}

export function analyzeDealWithRefurb(
  inputs: DealInputs,
  refurbScope?: RefurbScopeInput,
  overrides: CostOverride[] = []
): DealWithRefurbResult {
  if (refurbScope !== undefined) {
    const baseTasks = generateTasksFromScope(refurbScope)
    const overrideResult = applyCostOverrides(baseTasks, overrides)

    const refurb = calculateRefurbCost(overrideResult.tasks)
    const timeline = calculateTimeline(overrideResult.tasks)

    const tasksAssumptions = overrideResult.tasks.flatMap((task) => task.assumptionsUsed)

    const assumptionsReport = buildAssumptionsReport(
      tasksAssumptions,
      timeline.assumptions,
      overrideResult.assumptions
    )

    const warnings = [
      ...new Set([
        ...refurb.confidenceFlags,
        ...timeline.warnings,
        ...overrideResult.warnings,
      ]),
    ]

    const dealInputs: DealInputs = {
      ...inputs,
      refurbCost: refurb.totalRefurbCost,
    }

    return {
      deal: analyzeDeal(dealInputs),
      refurbSource: "generated",
      refurb,
      timeline,
      warnings,
      overridesApplied: overrideResult.applied,
      assumptionsReport,
    }
  }

  return {
    deal: analyzeDeal(inputs),
    refurbSource: "manual",
    warnings: [],
    overridesApplied: [],
    assumptionsReport: [],
  }
}
