export const INVESTOR_SHIELD_UI_GATE_KEYS = [
  "SOLD_COMPS",
  "TITLE",
  "LEASEHOLD",
  "PLANNING_BUILDING_CONTROL",
  "REFURB_CERTAINTY",
  "BUILDER_PROPOSAL_CONTRACT",
  "DAMP_STRUCTURAL",
  "LENDER_CRITERIA",
  "RENTAL_DEMAND",
  "SOLICITOR_REVIEW",
] as const

export type InvestorShieldUiGateKey = typeof INVESTOR_SHIELD_UI_GATE_KEYS[number]

export const INVESTOR_SHIELD_UI_GATE_TYPES = ["required", "advisory"] as const
export type InvestorShieldGateTypeDisplay = typeof INVESTOR_SHIELD_UI_GATE_TYPES[number]

export const INVESTOR_SHIELD_UI_GATE_STATUSES = [
  "not_started",
  "missing_evidence",
  "weak_evidence",
  "failed",
  "satisfied",
  "waived",
  "manual_review_required",
  "advisory_only",
  "blocked",
] as const

export type GateStatusDisplay = typeof INVESTOR_SHIELD_UI_GATE_STATUSES[number]

export const INVESTOR_SHIELD_UI_EVIDENCE_STATUSES = [
  "not_provided",
  "weak",
  "sufficient",
  "failed",
  "waived",
  "advisory_only",
  "not_applicable",
] as const

export type EvidenceStatusDisplay = typeof INVESTOR_SHIELD_UI_EVIDENCE_STATUSES[number]

export type InvestorShieldUiSummaryDisplay = {
  headline: string
  subheadline: string
  overallStatus: "clear" | "caution" | "blocked"
  canProgress: boolean
  blockingGateCount: number
  cautionGateCount: number
  message: string
}

// Advisory signals remain separate and cannot satisfy hard gates.
export type AdvisorySignalDisplay = {
  signalKey: string
  label: string
  source: string
  confidenceLabel: string
  warningText: string
  advisoryOnly: true
  cannotSatisfyHardGate: true
}

// Waiver must remain visually distinct from satisfied evidence.
export type WaiverDisplay = {
  isWaived: boolean
  reason?: string
  waivedBy?: string
  waivedAt?: string
  warningText?: string
}

// Manual review does not clear a gate.
export type ManualReviewDisplay = {
  required: boolean
  reason: string
  causedBy: readonly string[]
  doesNotClearGate: true
}

// Deterministic governance must remain visually dominant.
export type DeterministicGovernanceDisplay = {
  classification: string
  governanceState: string
  capitalProtectionState: string
  trueMaoStatus?: string
  isDominant: true
  warningText?: string
}

export type ProtectedMovementDisplay = {
  currentPipelineState: string
  attemptedPipelineState?: string
  movementAllowed: boolean
  blockedReason?: string
  blockingGateKeys: readonly InvestorShieldUiGateKey[]
  pipelineMutationPrevented: boolean
  explanation: string
}

export type TaskRecommendationDisplay = {
  taskKey: string
  gateKey: InvestorShieldUiGateKey
  title: string
  description: string
  status: string
  duplicateSafe: boolean
  actionType: string
}

export type InvestorShieldGateDisplay = {
  gateKey: InvestorShieldUiGateKey
  label: string
  gateType: InvestorShieldGateTypeDisplay
  status: GateStatusDisplay
  evidenceStatus: EvidenceStatusDisplay
  isBlocking: boolean
  missingEvidenceWarnings: readonly string[]
  taskRecommendationIds: readonly string[]
  waiver: WaiverDisplay
  manualReviewRequired: boolean
  displayPriority: number
  helperText: string
}

export type InvestorShieldUiMetadataDisplay = {
  modelVersion: string
  sourceRoute: string
  loadedAt?: string
  readOnly: true
}

export type InvestorShieldUiViewModel = {
  dealId: string
  summary: InvestorShieldUiSummaryDisplay
  deterministicGovernance: DeterministicGovernanceDisplay
  gates: readonly InvestorShieldGateDisplay[]
  advisorySignals: readonly AdvisorySignalDisplay[]
  protectedMovement: ProtectedMovementDisplay
  taskRecommendations: readonly TaskRecommendationDisplay[]
  manualReview: ManualReviewDisplay
  waiverSummary: WaiverDisplay
  metadata: InvestorShieldUiMetadataDisplay
}
