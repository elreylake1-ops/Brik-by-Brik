import type { DealClassification, DueDiligenceInput, StrategyRecommendation } from "@/types/due-diligence"

export const PHASE2_GOVERNANCE_STATES = ["PASS", "MANUAL_REVIEW", "BLOCK"] as const

export type Phase2GovernanceState = typeof PHASE2_GOVERNANCE_STATES[number]

export const PHASE2_GDV_EVIDENCE_STRENGTHS = ["STRONG", "MODERATE", "WEAK", "MISSING"] as const

export type Phase2GdvEvidenceStrength = typeof PHASE2_GDV_EVIDENCE_STRENGTHS[number]

export const PHASE2_COMPARABLE_COVERAGE = ["FULL", "LIMITED", "NONE"] as const

export type Phase2ComparableCoverage = typeof PHASE2_COMPARABLE_COVERAGE[number]

export const PHASE2_REFURB_CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const

export type Phase2RefurbConfidenceLevel = typeof PHASE2_REFURB_CONFIDENCE_LEVELS[number]

export const PHASE2_STRUCTURAL_RISK_LEVELS = ["NONE", "MODERATE", "FATAL"] as const

export type Phase2StructuralRiskLevel = typeof PHASE2_STRUCTURAL_RISK_LEVELS[number]

export const CURRENT_ENGINE_RISK_FLAGS = [
  "Low profit margin",
  "Capital overexposure",
  "High finance cost",
  "High refurb exposure",
  "Downside GDV creates a loss",
] as const

export type CurrentEngineRiskFlag = typeof CURRENT_ENGINE_RISK_FLAGS[number]

export const PHASE2_RISK_FLAGS = [
  ...CURRENT_ENGINE_RISK_FLAGS,
  "Weak GDV evidence",
  "False urgency / HOT deal unsupported",
  "Structural / fatal risk",
  "Missing evidence",
  "Manual review required",
  "Missing comparables",
  "Unrealistic GDV assumption",
  "Long bridge term",
] as const

export type Phase2RiskFlag = typeof PHASE2_RISK_FLAGS[number]

export const PHASE2_NEXT_ACTIONS = [
  "PROCEED",
  "PROCEED_WITH_CAUTION",
  "RENEGOTIATE",
  "REQUEST_EVIDENCE",
  "REQUEST_COMPARABLES",
  "VERIFY_GDV",
  "TIGHTEN_FINANCE_ASSUMPTIONS",
  "COMMISSION_SURVEY",
  "REJECT",
] as const

export type Phase2NextAction = typeof PHASE2_NEXT_ACTIONS[number]

export type Phase2ScenarioInput = {
  dueDiligence: DueDiligenceInput
  governanceSignals: {
    gdvEvidenceStrength: Phase2GdvEvidenceStrength
    comparableCount: number
    comparableCoverage: Phase2ComparableCoverage
    refurbEstimateConfidence: Phase2RefurbConfidenceLevel
    structuralRiskLevel: Phase2StructuralRiskLevel
    hotDealClaimed: boolean
    manualReviewTriggers: string[]
  }
}

export type Phase2ScenarioFixture = {
  scenarioId: string
  name: string
  description: string
  input: Phase2ScenarioInput
  // These lock the current numeric engine outputs to prevent scoring drift.
  expectedClassification: DealClassification
  // This is the future governance/control result that may override scoring in Phase 2C.
  expectedGovernanceState: Phase2GovernanceState
  expectedRiskFlags: Phase2RiskFlag[]
  expectedNextAction: Phase2NextAction
  // This is the pre-governance strategy outcome from the current engine.
  expectedStrategyOutcome: StrategyRecommendation
  expectedReviewRequired: boolean
  notes: string[]
}
