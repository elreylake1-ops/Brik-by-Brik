import type { RiskFlagOutput } from "@/types/phase2"
import type { FatalRiskResult, GovernanceDerivedMetrics, Phase2GovernanceInput } from "@/types/phase2-governance"

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function estimateFinanceCost(input: Phase2GovernanceInput): number | null {
  if (typeof input.financeCost === "number" && Number.isFinite(input.financeCost)) {
    return roundCurrency(input.financeCost)
  }

  if (typeof input.bridgeTermMonths === "number" && Number.isFinite(input.bridgeTermMonths)) {
    const interest = input.purchasePrice * 0.15 * (input.bridgeTermMonths / 12)
    const arrangementFee = input.purchasePrice * 0.02
    const exitFee = input.purchasePrice * 0.01
    return roundCurrency(interest + arrangementFee + exitFee)
  }

  return null
}

function buildMetrics(input: Phase2GovernanceInput): GovernanceDerivedMetrics {
  const financeCost = estimateFinanceCost(input)
  const totalInvestmentBasis =
    financeCost === null ? null : roundCurrency(input.purchasePrice + input.refurbCost + financeCost)
  const downsideGdv = input.gdvDownside ?? roundCurrency(input.gdvRealistic * 0.9)
  const strongGdv = input.gdvStrong ?? roundCurrency(input.gdvRealistic * 1.1)
  const realisticProfit =
    totalInvestmentBasis === null ? null : roundCurrency(input.gdvRealistic - totalInvestmentBasis)
  const downsideProfit =
    totalInvestmentBasis === null ? null : roundCurrency(downsideGdv - totalInvestmentBasis)
  const strongProfit =
    totalInvestmentBasis === null ? null : roundCurrency(strongGdv - totalInvestmentBasis)
  const capitalRatio =
    totalInvestmentBasis === null || input.gdvRealistic <= 0
      ? null
      : totalInvestmentBasis / input.gdvRealistic
  const downsideThreshold = input.gdvRealistic > 0 ? Math.max(5000, input.gdvRealistic * 0.03) : null
  const refurbExposure =
    input.purchasePrice <= 0 ? null : input.refurbCost / input.purchasePrice

  return {
    financeCost,
    totalInvestmentBasis,
    realisticProfit,
    downsideProfit,
    strongProfit,
    capitalRatio,
    downsideThreshold,
    refurbExposure,
  }
}

function makeFatalFlag(code: string, label: string, explanation: string, source: string): RiskFlagOutput {
  return {
    code,
    label,
    severity: "FATAL",
    explanation,
    source,
  }
}

export function evaluateDealFatalRisk(input: Phase2GovernanceInput): FatalRiskResult {
  const metrics = buildMetrics(input)
  const fatalReasons: string[] = []
  const fatalFlags: RiskFlagOutput[] = []

  if (input.hasStructuralRisk) {
    fatalReasons.push("Structural survey indicates fatal risk.")
    fatalFlags.push(
      makeFatalFlag(
        "STRUCTURAL_FATAL",
        "Fatal structural risk",
        "Structural issue blocks safe progression.",
        "survey"
      )
    )
  }

  if (input.hasLegalTitleRisk) {
    fatalReasons.push("Legal or title risk blocks safe acquisition.")
    fatalFlags.push(
      makeFatalFlag(
        "LEGAL_TITLE_FATAL",
        "Fatal legal/title risk",
        "Legal/title issue prevents safe progression.",
        "legal"
      )
    )
  }

  if (input.hasPlanningRisk) {
    fatalReasons.push("Planning risk blocks intended exit or works.")
    fatalFlags.push(
      makeFatalFlag(
        "PLANNING_FATAL",
        "Fatal planning risk",
        "Planning issue prevents safe execution.",
        "planning"
      )
    )
  }

  if (input.hasRefinanceRisk && input.loanToValue !== undefined && input.loanToValue > 0.9) {
    fatalReasons.push("Refinance risk is severe at current leverage.")
    fatalFlags.push(
      makeFatalFlag(
        "REFINANCE_FATAL",
        "Fatal refinance risk",
        "Refinance path fails under current leverage assumptions.",
        "finance"
      )
    )
  }

  if (metrics.realisticProfit !== null && metrics.realisticProfit < 0) {
    fatalReasons.push("Realistic GDV produces negative profit.")
    fatalFlags.push(
      makeFatalFlag(
        "NEGATIVE_REALISTIC_PROFIT",
        "Negative realistic profit",
        "Realistic-case profit is below zero.",
        "profit"
      )
    )
  }

  if (
    metrics.downsideProfit !== null &&
    metrics.downsideThreshold !== null &&
    metrics.downsideProfit <= -metrics.downsideThreshold
  ) {
    fatalReasons.push("Downside GDV creates loss beyond safe threshold.")
    fatalFlags.push(
      makeFatalFlag(
        "DOWNSIDE_FATAL_LOSS",
        "Fatal downside loss",
        "Downside case breaches safe loss threshold.",
        "profit"
      )
    )
  }

  return {
    fatalRisk: fatalReasons.length > 0,
    fatalReasons: [...new Set(fatalReasons)],
    fatalFlags,
    metrics,
  }
}
