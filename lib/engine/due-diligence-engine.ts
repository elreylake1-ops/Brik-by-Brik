import type {
  CapitalProtectionStatus,
  DealClassification,
  DueDiligenceDecision,
  DueDiligenceInput,
  DueDiligenceResult,
  GDVRange,
  ProfitScenario,
  StrategyRecommendation,
  UIColour,
} from "@/types/due-diligence"

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function buildGdvRange(input: DueDiligenceInput): { gdvRange: GDVRange; assumptions: string[] } {
  const assumptions: string[] = []

  const downside =
    input.gdvDownside ?? (() => {
      assumptions.push("Downside GDV defaulted to 90% of realistic GDV.")
      return roundCurrency(input.gdvRealistic * 0.9)
    })()

  const strong =
    input.gdvStrong ?? (() => {
      assumptions.push("Strong GDV defaulted to 110% of realistic GDV.")
      return roundCurrency(input.gdvRealistic * 1.1)
    })()

  return {
    gdvRange: {
      downside,
      realistic: roundCurrency(input.gdvRealistic),
      strong,
    },
    assumptions,
  }
}

function getCapitalProtectionStatus(capitalUsedPercent: number): CapitalProtectionStatus {
  if (capitalUsedPercent < 0.8) return "SAFE"
  if (capitalUsedPercent <= 0.85) return "CAUTION"
  if (capitalUsedPercent <= 0.9) return "HIGH_RISK"
  return "NO_DEAL"
}

function getDealClassification(
  profitMarginRealistic: number,
  capitalUsedPercent: number
): DealClassification {
  if (profitMarginRealistic >= 0.2 && capitalUsedPercent <= 0.85) return "STRONG_DEAL"
  if (profitMarginRealistic >= 0.15 && capitalUsedPercent <= 0.9) return "MARGINAL"
  return "NO_DEAL"
}

function getStrategyRecommendation(classification: DealClassification): StrategyRecommendation {
  if (classification === "STRONG_DEAL") return "BRRR_OR_FLIP"
  if (classification === "MARGINAL") return "FLIP_ONLY_OR_RENEGOTIATE"
  return "NO_DEAL"
}

function getProfitColour(profitMargin: number): UIColour {
  if (profitMargin >= 0.2) return "green"
  if (profitMargin >= 0.15) return "amber"
  return "red"
}

function getCapitalProtectionColour(capitalUsedPercent: number): UIColour {
  if (capitalUsedPercent < 0.8) return "green"
  if (capitalUsedPercent <= 0.85) return "amber"
  return "red"
}

function getDealClassificationColour(classification: DealClassification): UIColour {
  if (classification === "STRONG_DEAL") return "green"
  if (classification === "MARGINAL") return "amber"
  return "red"
}

function buildProfitScenario(
  scenario: ProfitScenario["scenario"],
  gdv: number,
  totalCost: number
): ProfitScenario {
  const profit = gdv - totalCost

  return {
    scenario,
    gdv,
    totalCost,
    profit: roundCurrency(profit),
    profitMargin: profit / gdv,
  }
}

function buildRiskFlags(
  profitMarginRealistic: number,
  capitalUsedPercent: number,
  totalFinanceCost: number,
  gdvRealistic: number,
  refurbCost: number,
  purchasePrice: number,
  profitDownside: number
): string[] {
  const flags: string[] = []

  if (profitMarginRealistic < 0.15) flags.push("Low profit margin")
  if (capitalUsedPercent > 0.85) flags.push("Capital overexposure")
  if (totalFinanceCost / gdvRealistic > 0.1) flags.push("High finance cost")
  if (refurbCost / purchasePrice > 0.25) flags.push("High refurb exposure")
  if (profitDownside < 0) flags.push("Downside GDV creates a loss")

  return flags
}

function buildDecision(
  capitalProtectionStatus: CapitalProtectionStatus,
  dealClassification: DealClassification,
  strategyRecommendation: StrategyRecommendation,
  capitalUsedPercent: number,
  profitMarginRealistic: number,
  riskFlags: string[]
): DueDiligenceDecision {
  const reasons = [
    `Capital protection status: ${capitalProtectionStatus}.`,
    `Realistic profit margin: ${(profitMarginRealistic * 100).toFixed(2)}%.`,
    `Capital used: ${(capitalUsedPercent * 100).toFixed(2)}% of realistic GDV.`,
    ...riskFlags,
  ]

  return {
    capitalProtectionStatus,
    dealClassification,
    strategyRecommendation,
    uiColour: getDealClassificationColour(dealClassification),
    summary: `${dealClassification} with ${strategyRecommendation}.`,
    reasons,
    riskFlags,
  }
}

export function calculateDueDiligence(input: DueDiligenceInput): DueDiligenceResult {
  const { gdvRange, assumptions } = buildGdvRange(input)

  const interest = roundCurrency(
    input.purchasePrice * input.bridgeInterestRateAnnual * (input.bridgeTermMonths / 12)
  )
  const arrangementFee = roundCurrency(input.purchasePrice * input.arrangementFeePercent)
  const exitFee = roundCurrency(input.purchasePrice * input.exitFeePercent)
  const totalFinanceCost = roundCurrency(interest + arrangementFee + exitFee)

  const totalCost = roundCurrency(
    input.purchasePrice +
    input.refurbCost +
    input.stampDuty +
    input.legalCosts +
    input.saleCosts +
    totalFinanceCost
  )

  const downsideScenario = buildProfitScenario("downside", gdvRange.downside, totalCost)
  const realisticScenario = buildProfitScenario("realistic", gdvRange.realistic, totalCost)
  const strongScenario = buildProfitScenario("strong", gdvRange.strong, totalCost)

  const capitalUsedPercent = totalCost / input.gdvRealistic

  const capitalProtectionStatus = getCapitalProtectionStatus(capitalUsedPercent)
  const dealClassification = getDealClassification(realisticScenario.profitMargin, capitalUsedPercent)
  const strategyRecommendation = getStrategyRecommendation(dealClassification)

  const riskFlags = buildRiskFlags(
    realisticScenario.profitMargin,
    capitalUsedPercent,
    totalFinanceCost,
    input.gdvRealistic,
    input.refurbCost,
    input.purchasePrice,
    downsideScenario.profit
  )

  return {
    inputs: input,
    gdvRange,
    finance: {
      interest,
      arrangementFee,
      exitFee,
      totalFinanceCost,
    },
    dealSummary: {
      totalCost,
      capitalUsedPercent,
      profitDownside: downsideScenario.profit,
      profitRealistic: realisticScenario.profit,
      profitStrong: strongScenario.profit,
      profitMarginDownside: downsideScenario.profitMargin,
      profitMarginRealistic: realisticScenario.profitMargin,
      profitMarginStrong: strongScenario.profitMargin,
    },
    profitScenarios: [downsideScenario, realisticScenario, strongScenario],
    trueMAO: {
      at15Percent:
        roundCurrency(
          input.gdvRealistic * 0.85 -
            input.refurbCost -
            input.stampDuty -
            input.legalCosts -
            input.saleCosts -
            totalFinanceCost
        ),
      at20Percent:
        roundCurrency(
          input.gdvRealistic * 0.8 -
            input.refurbCost -
            input.stampDuty -
            input.legalCosts -
            input.saleCosts -
            totalFinanceCost
        ),
      at25Percent:
        roundCurrency(
          input.gdvRealistic * 0.75 -
            input.refurbCost -
            input.stampDuty -
            input.legalCosts -
            input.saleCosts -
            totalFinanceCost
        ),
    },
    decision: buildDecision(
      capitalProtectionStatus,
      dealClassification,
      strategyRecommendation,
      capitalUsedPercent,
      realisticScenario.profitMargin,
      riskFlags
    ),
    uiColours: {
      profit: getProfitColour(realisticScenario.profitMargin),
      capitalProtection: getCapitalProtectionColour(capitalUsedPercent),
      dealClassification: getDealClassificationColour(dealClassification),
    },
    assumptions,
    warnings: riskFlags,
  }
}
