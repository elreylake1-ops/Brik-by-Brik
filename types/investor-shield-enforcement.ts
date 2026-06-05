import type {
  EvidenceItem,
  InvestorShieldCheck,
  InvestorShieldGateKey,
  InvestorShieldSeverity,
  InvestorShieldSource,
  InvestorShieldSubGateKey,
  ManualOverride,
  RiskFlag,
} from "@/types/investor-shield"

// Phase 4C-1 Investor Shield enforcement contracts are type definitions only.
// This file does not add evaluator logic, repository reads, saved-deal wiring,
// runtime enforcement, task creation, API behavior, or UI behavior.
// Investor Shield may increase caution or block progression, but it must never
// soften deterministic NO-GO, capital protection, True MAO, or governance risk.
// AI advisory evidence cannot satisfy hard evidence gates on its own.

export const INVESTOR_SHIELD_OVERALL_STATUSES = [
  "CLEAR",
  "CAUTION",
  "BLOCKED",
] as const

export type InvestorShieldOverallStatus = typeof INVESTOR_SHIELD_OVERALL_STATUSES[number]

export const INVESTOR_SHIELD_PROGRESSION_DECISIONS = [
  "CAN_PROGRESS",
  "NEEDS_REVIEW",
  "BLOCKED",
] as const

export type InvestorShieldProgressionDecision =
  typeof INVESTOR_SHIELD_PROGRESSION_DECISIONS[number]

export const INVESTOR_SHIELD_BLOCKING_REASONS = [
  "REQUIRED_GATE_MISSING",
  "BLOCKER_GATE_FAILED",
  "FATAL_RISK_FLAG",
  "MANUAL_OVERRIDE_REQUIRED",
  "ADVISORY_ONLY_EVIDENCE_INSUFFICIENT",
  "REFURB_CERTAINTY_INSUFFICIENT",
  "DETERMINISTIC_REJECT_DOMINATES",
] as const

export type InvestorShieldBlockingReason = typeof INVESTOR_SHIELD_BLOCKING_REASONS[number]

export const INVESTOR_SHIELD_TASK_RECOMMENDATION_TYPES = [
  "REQUEST_EVIDENCE",
  "REVIEW_GATE",
  "OBTAIN_BUILDER_QUOTE",
  "OBTAIN_BUILDER_CONTRACT",
  "REQUEST_SPECIALIST_SURVEY",
  "REVIEW_SOLICITOR_FEEDBACK",
  "VERIFY_RENTAL_DEMAND",
  "REVIEW_LENDER_CRITERIA",
] as const

export type InvestorShieldTaskRecommendationType =
  typeof INVESTOR_SHIELD_TASK_RECOMMENDATION_TYPES[number]

export type InvestorShieldEvidenceSufficiency = {
  gateKey: InvestorShieldGateKey
  subGateKey?: InvestorShieldSubGateKey
  sufficient: boolean
  advisoryOnlyEvidenceUsed: boolean
  missingEvidenceTypes: readonly string[]
}

export type InvestorShieldGateEvaluationSummary = {
  gateKey: InvestorShieldGateKey
  status: InvestorShieldOverallStatus
  severity: InvestorShieldSeverity
  blocking: boolean
  caution: boolean
  missingEvidence: boolean
  blockingReasons: readonly InvestorShieldBlockingReason[]
}

export type InvestorShieldManualOverrideRequirement = {
  gateKey: InvestorShieldGateKey
  required: boolean
  reason?: string
}

export type InvestorShieldEvaluationInput = {
  dealId: string
  checks: readonly InvestorShieldCheck[]
  evidenceItems: readonly EvidenceItem[]
  riskFlags: readonly RiskFlag[]
  manualOverrides: readonly ManualOverride[]
  deterministicDealStatus?: string
  evaluatedAt?: string
}

export type InvestorShieldTaskRecommendation = {
  gateKey: InvestorShieldGateKey
  subGateKey?: InvestorShieldSubGateKey
  type: InvestorShieldTaskRecommendationType
  title: string
  reason: string
  severity: InvestorShieldSeverity
  source: InvestorShieldSource
  idempotencyKey: string
}

export type InvestorShieldEnforcementResult = {
  dealId: string
  overallStatus: InvestorShieldOverallStatus
  progressionDecision: InvestorShieldProgressionDecision
  canProgress: boolean
  blockingGateKeys: readonly InvestorShieldGateKey[]
  cautionGateKeys: readonly InvestorShieldGateKey[]
  missingEvidenceGateKeys: readonly InvestorShieldGateKey[]
  manualOverrideRequired: boolean
  advisoryOnlyEvidenceWarnings: readonly string[]
  taskRecommendations: readonly InvestorShieldTaskRecommendation[]
  blockingReasons: readonly InvestorShieldBlockingReason[]
  deterministicDominanceNote?: string
  evaluatedAt?: string
}
