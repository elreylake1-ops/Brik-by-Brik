export const PHASE2_ANALYSIS_SOURCE = ["PHASE_2_ENGINE"] as const

export type Phase2AnalysisSource = typeof PHASE2_ANALYSIS_SOURCE[number]

export const FINAL_DEAL_CLASSIFICATIONS = [
  "HOT",
  "WARM",
  "MARGINAL",
  "NO_DEAL",
  "REVIEW_REQUIRED",
] as const

export type FinalDealClassification = typeof FINAL_DEAL_CLASSIFICATIONS[number]

export const GOVERNANCE_STATES = ["PASS", "REVIEW_REQUIRED", "BLOCKED"] as const

export type GovernanceState = typeof GOVERNANCE_STATES[number]

export const DECISION_GATE_STATUSES = ["PASS", "FAIL", "REVIEW"] as const

export type DecisionGateStatus = typeof DECISION_GATE_STATUSES[number]

export const RISK_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "FATAL"] as const

export type RiskSeverity = typeof RISK_SEVERITIES[number]

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW", "MISSING"] as const

export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number]

export const EVIDENCE_STATUSES = ["VERIFIED", "ESTIMATED", "ASSUMED", "MISSING"] as const

export type EvidenceStatus = typeof EVIDENCE_STATUSES[number]

export const NEXT_ACTION_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const

export type NextActionPriority = typeof NEXT_ACTION_PRIORITIES[number]

export const DEAL_HEAT_BANDS = ["HOT", "WARM", "MARGINAL", "COLD"] as const

export type DealHeatBand = typeof DEAL_HEAT_BANDS[number]

export const PHASE2_STRATEGIES = [
  "BRRR",
  "FLIP",
  "BUY_TO_LET",
  "NO_DEAL",
  "MANUAL_REVIEW",
] as const

export type Phase2Strategy = typeof PHASE2_STRATEGIES[number]

export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type Phase2AnalysisMetadata = {
  analysisId: string
  engineVersion: string
  createdAt: string
  deterministic: boolean
  source: Phase2AnalysisSource
  scenarioId?: string
  notes?: string[]
}

export type DealHeatScoreOutput = {
  score: number
  band: DealHeatBand
  positiveSignals: string[]
  negativeSignals: string[]
  deductions: string[]
  explanation: string
}

export type RiskFlagOutput = {
  code: string
  label: string
  severity: RiskSeverity
  explanation: string
  source: string
}

export type RiskRadarOutput = {
  overallRisk: RiskSeverity
  riskFlags: RiskFlagOutput[]
  fatalRisks: string[]
  reviewRisks: string[]
  explanation: string
}

export type StrategyRejectionReason = {
  strategy: Phase2Strategy
  reason: string
}

export type StrategyMatchOutput = {
  recommendedStrategy: Phase2Strategy
  viableStrategies: Phase2Strategy[]
  rejectedStrategies: StrategyRejectionReason[]
  explanation: string
}

export type GovernanceOutput = {
  state: GovernanceState
  finalClassification: FinalDealClassification
  scoreBeforeGovernance: number | null
  classificationBeforeGovernance: FinalDealClassification | null
  governanceOverrideApplied: boolean
  fatalRisk: boolean
  fatalReasons: string[]
  blockedBy: string[]
  reviewRequired: boolean
  reviewReasons: string[]
  explanation: string
}

export type InvestorSummaryOutput = {
  headline: string
  summary: string
  decision: string
  keyReasons: string[]
  keyRisks: string[]
  recommendedNextStep: string
  investorWarnings: string[]
}

export type DecisionGateOutput = {
  gateId: string
  label: string
  status: DecisionGateStatus
  severity: RiskSeverity
  explanation: string
  triggeredBy: string[]
  requiredAction?: string
}

export type EvidenceFieldStatusOutput = {
  field: string
  status: EvidenceStatus
  explanation: string
  requiredForOffer: boolean
}

export type EvidenceStatusOutput = {
  overallStatus: EvidenceStatus
  fields: EvidenceFieldStatusOutput[]
  missingCriticalEvidence: string[]
  assumedFields: string[]
  verifiedFields: string[]
}

export type DataConfidenceOutput = {
  overallConfidence: ConfidenceLevel
  listingConfidence: ConfidenceLevel
  refurbConfidence: ConfidenceLevel
  gdvConfidence: ConfidenceLevel
  legalConfidence: ConfidenceLevel
  financeConfidence: ConfidenceLevel
  explanation: string
  confidenceWarnings: string[]
}

export type NextActionOutput = {
  id: string
  priority: NextActionPriority
  action: string
  owner: string
  reason: string
  blocksOfferSubmission: boolean
}

export type AssumptionLogEntry = {
  id: string
  field: string
  assumedValue: JsonValue
  reason: string
  impact: string
  confidence: ConfidenceLevel
}

export type ManualOverrideTrace = {
  id: string
  field: string
  originalValue: JsonValue
  overrideValue: JsonValue
  reason?: string
  impact: string
  createdAt?: string
}

export type KnownLimitationOutput = {
  code: string
  limitation: string
  impact: string
  recommendedRefinement: string
}

export type Phase2AnalysisOutput = {
  metadata: Phase2AnalysisMetadata
  dealHeatScore: DealHeatScoreOutput
  riskRadar: RiskRadarOutput
  strategyMatch: StrategyMatchOutput
  governance: GovernanceOutput
  investorSummary: InvestorSummaryOutput
  decisionGates: DecisionGateOutput[]
  evidenceStatus: EvidenceStatusOutput
  dataConfidence: DataConfidenceOutput
  nextActions: NextActionOutput[]
  assumptions: AssumptionLogEntry[]
  overrides: ManualOverrideTrace[]
  limitations: KnownLimitationOutput[]
}
