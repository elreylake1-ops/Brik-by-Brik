import { analyzeDeal } from "@/lib/calculations"
import { applyCostOverrides } from "@/lib/engine/apply-overrides"
import { calculateDueDiligence } from "@/lib/engine/due-diligence-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { calculateTimeline } from "@/lib/engine/timeline-engine"
import type { DealInputs, DealResult } from "@/types/deal"
import type { DueDiligenceInput, DueDiligenceResult } from "@/types/due-diligence"
import type { OverrideApplied, CostOverride } from "@/types/overrides"
import type { RefurbScopeInput, RefurbCostResult } from "@/types/scope"
import type { RefurbTimeline } from "@/types/refurb"

export type DealVerdictStatus = "GO" | "CONDITIONAL" | "NO-GO" | "ANALYSIS ONLY"

export type DealVerdict = {
  status: DealVerdictStatus
  reason: string
  checks: string[]
}

export type DealConfidence = {
  score: number
  band: "HIGH" | "MEDIUM" | "LOW"
  factors: string[]
}

export type DealWithRefurbResult = {
  deal: DealResult
  refurbSource: "manual" | "generated"
  refurb?: RefurbCostResult
  timeline?: RefurbTimeline
  dueDiligence?: DueDiligenceResult
  warnings: string[]
  overridesApplied: OverrideApplied[]
  assumptionsReport: string[]
  verdict: DealVerdict
  confidence: DealConfidence
}

function buildAssumptionsReport(
  tasksAssumptions: string[],
  timelineAssumptions: string[],
  overrideAssumptions: string[]
): string[] {
  return [...new Set([...tasksAssumptions, ...timelineAssumptions, ...overrideAssumptions])]
}

function formatCheck(label: string, pass: boolean, detail: string): string {
  return `${pass ? "PASS" : "FAIL"}: ${label} - ${detail}`
}

function calculateVerdict(inputs: DealInputs, deal: DealResult): DealVerdict {
  if (inputs.purchasePrice <= 0 || inputs.gdv <= 0) {
    return {
      status: "ANALYSIS ONLY",
      reason: "Purchase price or GDV missing/zero. Verdict is informational until core inputs are provided.",
      checks: [
        formatCheck("Purchase Price provided", inputs.purchasePrice > 0, `Purchase Price=${inputs.purchasePrice}`),
        formatCheck("GDV provided", inputs.gdv > 0, `GDV=${inputs.gdv}`),
      ],
    }
  }

  const withinMao20 = inputs.purchasePrice <= deal.trueMao.twentyPercent
  const withinMao15 = inputs.purchasePrice <= deal.trueMao.fifteenPercent
  const positiveProfit = deal.profit > 0
  const positiveMargin = deal.profitMargin > 0

  let status: DealVerdictStatus = "NO-GO"
  let reason = "Purchase exceeds MAO bands and/or projected profit is non-positive."

  if (positiveProfit && withinMao20) {
    status = "GO"
    reason = "Projected profit is positive and purchase is within 20% target MAO."
  } else if (positiveProfit && withinMao15) {
    status = "CONDITIONAL"
    reason = "Projected profit is positive and purchase is within 15% MAO, but outside 20% target band."
  }

  return {
    status,
    reason,
    checks: [
      formatCheck("Purchase <= MAO 20%", withinMao20, `Purchase=${inputs.purchasePrice}, MAO20=${deal.trueMao.twentyPercent}`),
      formatCheck("Purchase <= MAO 15%", withinMao15, `Purchase=${inputs.purchasePrice}, MAO15=${deal.trueMao.fifteenPercent}`),
      formatCheck("Projected profit positive", positiveProfit, `Profit=${deal.profit}`),
      formatCheck("Projected profit margin positive", positiveMargin, `Margin=${deal.profitMargin}`),
    ],
  }
}

function calculateConfidence(
  inputs: DealInputs,
  refurbSource: "manual" | "generated",
  warnings: string[],
  overridesApplied: OverrideApplied[]
): DealConfidence {
  let score = 100
  const factors: string[] = []

  if (warnings.length > 0) {
    score -= warnings.length * 12
    factors.push(`${warnings.length} warning(s) reduced confidence.`)
  }

  if (overridesApplied.length > 0) {
    score -= overridesApplied.length * 4
    factors.push(`${overridesApplied.length} override(s) applied; assumptions changed from baseline.`)
  }

  if (refurbSource === "manual") {
    score -= 8
    factors.push("Manual refurb input path used; task-level detail not available.")
  }

  if (inputs.purchasePrice <= 0 || inputs.gdv <= 0) {
    score -= 25
    factors.push("Core deal inputs incomplete (purchase price or GDV <= 0).")
  }

  score = Math.max(0, Math.min(100, score))

  let band: DealConfidence["band"] = "LOW"
  if (score >= 80) band = "HIGH"
  else if (score >= 55) band = "MEDIUM"

  return { score, band, factors }
}

function buildDueDiligenceInput(
  inputs: DealInputs,
  refurbCost: number
): DueDiligenceInput | undefined {
  if (inputs.purchasePrice <= 0 || inputs.gdv <= 0) {
    return undefined
  }

  return {
    purchasePrice: inputs.purchasePrice,
    gdvRealistic: inputs.gdv,
    refurbCost,
    stampDuty: inputs.stampDuty,
    legalCosts: inputs.legalCosts,
    saleCosts: inputs.saleCosts,
    bridgeTermMonths: inputs.bridgeTermMonths,
    bridgeInterestRateAnnual: 0.15,
    arrangementFeePercent: 0.02,
    exitFeePercent: 0.01,
  }
}

function buildDueDiligence(
  inputs: DealInputs,
  refurbCost: number
): DueDiligenceResult | undefined {
  const dueDiligenceInput = buildDueDiligenceInput(inputs, refurbCost)

  if (!dueDiligenceInput) {
    return undefined
  }

  return calculateDueDiligence(dueDiligenceInput)
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

    const deal = analyzeDeal(dealInputs)
    const dueDiligence = buildDueDiligence(inputs, refurb.totalRefurbCost)
    const verdict = calculateVerdict(inputs, deal)
    const confidence = calculateConfidence(inputs, "generated", warnings, overrideResult.applied)

    return {
      deal,
      refurbSource: "generated",
      refurb,
      timeline,
      dueDiligence,
      warnings,
      overridesApplied: overrideResult.applied,
      assumptionsReport,
      verdict,
      confidence,
    }
  }

  const deal = analyzeDeal(inputs)
  const warnings: string[] = []
  const overridesApplied: OverrideApplied[] = []
  const dueDiligence = buildDueDiligence(inputs, inputs.refurbCost)
  const verdict = calculateVerdict(inputs, deal)
  const confidence = calculateConfidence(inputs, "manual", warnings, overridesApplied)

  return {
    deal,
    refurbSource: "manual",
    dueDiligence,
    warnings,
    overridesApplied,
    assumptionsReport: [],
    verdict,
    confidence,
  }
}
