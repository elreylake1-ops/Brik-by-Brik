// Official Phase 1C contract types. Pure logic layer only.

export type DueDiligenceInput = {
  purchasePrice: number
  gdvRealistic: number
  gdvDownside?: number
  gdvStrong?: number
  refurbCost: number
  stampDuty: number
  legalCosts: number
  saleCosts: number
  bridgeTermMonths: number
  bridgeInterestRateAnnual: number
  arrangementFeePercent: number
  exitFeePercent: number
}

export type GDVRange = {
  downside: number
  realistic: number
  strong: number
}

export type ProfitScenario = {
  scenario: "downside" | "realistic" | "strong"
  gdv: number
  totalCost: number
  profit: number
  profitMargin: number
}

export type CapitalProtectionStatus = "SAFE" | "CAUTION" | "HIGH_RISK" | "NO_DEAL"

export type DealClassification = "STRONG_DEAL" | "MARGINAL" | "NO_DEAL"

export type StrategyRecommendation = "BRRR_OR_FLIP" | "FLIP_ONLY_OR_RENEGOTIATE" | "NO_DEAL"

export type UIColour = "green" | "amber" | "red"

export type DueDiligenceFinance = {
  interest: number
  arrangementFee: number
  exitFee: number
  totalFinanceCost: number
}

export type DueDiligenceDealSummary = {
  totalCost: number
  capitalUsedPercent: number
  profitDownside: number
  profitRealistic: number
  profitStrong: number
  profitMarginDownside: number
  profitMarginRealistic: number
  profitMarginStrong: number
}

export type DueDiligenceTrueMAO = {
  at15Percent: number
  at20Percent: number
  at25Percent: number
}

export type DueDiligenceUIColours = {
  profit: UIColour
  capitalProtection: UIColour
  dealClassification: UIColour
}

export type DueDiligenceDecision = {
  capitalProtectionStatus: CapitalProtectionStatus
  dealClassification: DealClassification
  strategyRecommendation: StrategyRecommendation
  uiColour: UIColour
  summary: string
  reasons: string[]
  riskFlags: string[]
}

export type DueDiligenceResult = {
  inputs: DueDiligenceInput
  gdvRange: GDVRange
  finance: DueDiligenceFinance
  dealSummary: DueDiligenceDealSummary
  profitScenarios: ProfitScenario[]
  trueMAO: DueDiligenceTrueMAO
  decision: DueDiligenceDecision
  uiColours: DueDiligenceUIColours
  assumptions: string[]
  warnings: string[]
}
