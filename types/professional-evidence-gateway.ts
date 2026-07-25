// Phase 5A-2A professional evidence gateway contracts are type definitions only.
// This file does not add runtime enforcement, persistence logic, API wiring, UI usage,
// repository access, database access, or production behavior.

export const PROFESSIONAL_GATE_AREAS = [
  "SOLICITOR_REVIEW",
  "LEASEHOLD_ADVICE",
  "BROKER_LENDER_CONFIRMATION",
  "BUILDER_QUOTE_CONFIRMATION",
  "SURVEYOR_REPORT",
  "SOLD_COMPARABLE_REVIEW",
] as const

export type ProfessionalGateArea = typeof PROFESSIONAL_GATE_AREAS[number]

export const PROFESSIONAL_GATE_STATUSES = [
  "NOT_STARTED",
  "REQUESTED",
  "RECEIVED",
  "UNDER_REVIEW",
  "CONFIRMED",
  "ADVERSE",
  "EXPIRED",
  "NOT_REQUIRED",
] as const

export type ProfessionalGateStatus = typeof PROFESSIONAL_GATE_STATUSES[number]

export const PROFESSIONAL_READINESS_STATUSES = [
  "NOT_READY",
  "PARTIALLY_READY",
  "READY_FOR_REVIEW",
  "PROFESSIONALLY_CONFIRMED",
  "BLOCKED",
] as const

export type ProfessionalReadiness = typeof PROFESSIONAL_READINESS_STATUSES[number]

export const PROFESSIONAL_READINESS_PRESENTATION_STATES = [
  "READY_FOR_REVIEW",
  "PROFESSIONALLY_CONFIRMED",
  "WEAK_OR_NON_CONFIRMING",
  "MISSING",
  "ADVERSE",
  "EXPIRED",
  "MANUAL_REVIEW_REQUIRED",
] as const

export type ProfessionalReadinessPresentationState =
  typeof PROFESSIONAL_READINESS_PRESENTATION_STATES[number]

export const FINAL_DECISION_LOCK_STATUSES = [
  "LOCKED",
  "UNLOCKED_FOR_REVIEW",
  "BLOCKED_BY_HARD_GATE",
  "BLOCKED_BY_PROFESSIONAL_EVIDENCE",
  "MANUAL_REVIEW_REQUIRED",
] as const

export type FinalDecisionLockStatus = typeof FINAL_DECISION_LOCK_STATUSES[number]

export const PROFESSIONAL_EVIDENCE_REVIEW_SOURCES = [
  "OPERATOR_NOTE",
  "SOLICITOR",
  "BROKER",
  "LENDER",
  "BUILDER",
  "SURVEYOR",
  "LAND_REGISTRY",
  "RIGHTMOVE_SOLD_DATA",
  "AGENT",
  "OTHER",
] as const

export type ProfessionalEvidenceReviewSource =
  typeof PROFESSIONAL_EVIDENCE_REVIEW_SOURCES[number]

export const PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS = {
  professionalGateStatus: "NOT_STARTED",
  professionalReadiness: "NOT_READY",
  finalDecisionLockStatus: "LOCKED",
} as const

export type ProfessionalEvidenceGatewayRecord = {
  readonly savedDealId: string
  readonly linkedEvidenceCommandEvidenceId: string | null
  readonly linkedInvestorShieldGate: string
  readonly professionalGateArea: ProfessionalGateArea
  readonly professionalGateStatus: ProfessionalGateStatus
  readonly professionalReadiness: ProfessionalReadiness
  readonly reviewSource: ProfessionalEvidenceReviewSource
  readonly reviewState: string
  readonly blockerImpact: string
  readonly evidenceStrength: string
  readonly requiredEvidenceSummary: string
  readonly professionalConfirmationSummary: string
  readonly recommendedNextAction: string
  readonly expiryOrReviewDate: string | null
  readonly finalDecisionLockStatus: FinalDecisionLockStatus
  readonly lockReason: string
  readonly linkedEvidenceIds: readonly string[]
}

export type ProfessionalEvidenceGatewayGate = {
  readonly savedDealId: string
  readonly professionalGateArea: ProfessionalGateArea
  readonly linkedInvestorShieldGate: string
  readonly professionalGateStatus: ProfessionalGateStatus
  readonly professionalReadiness: ProfessionalReadiness
  readonly reviewSource: ProfessionalEvidenceReviewSource
  readonly reviewState: string
  readonly blockerImpact: string
  readonly evidenceStrength: string
  readonly requiredEvidenceSummary: string
  readonly professionalConfirmationSummary: string
  readonly recommendedNextAction: string
  readonly expiryOrReviewDate: string | null
  readonly linkedEvidenceCommandEvidenceId: string | null
  readonly linkedEvidenceIds: readonly string[]
}

export type ProfessionalEvidenceGatewaySection = {
  readonly savedDealId: string
  readonly sectionKey: string
  readonly sectionTitle: string
  readonly sectionSummary: string
  readonly gates: readonly ProfessionalEvidenceGatewayGate[]
  readonly readiness: ProfessionalReadiness
  readonly finalDecisionLockStatus: FinalDecisionLockStatus
}

export type ProfessionalEvidenceGatewayDecisionLock = {
  readonly savedDealId: string
  readonly finalDecisionLockStatus: FinalDecisionLockStatus
  readonly lockReason: string
  readonly linkedGateAreas: readonly ProfessionalGateArea[]
  readonly linkedEvidenceIds: readonly string[]
}

export type ProfessionalReadinessPresentation = {
  readonly state: ProfessionalReadinessPresentationState
  readonly displayLabel: string
  readonly supportingSummary: string
  readonly authorityNotice: string
}

export type ProfessionalEvidenceGatewayViewModel = {
  readonly savedDealId: string
  readonly gates: readonly ProfessionalEvidenceGatewayGate[]
  readonly sections: readonly ProfessionalEvidenceGatewaySection[]
  readonly decisionLock: ProfessionalEvidenceGatewayDecisionLock
  readonly readinessPresentation: ProfessionalReadinessPresentation
  readonly professionalGateStatus: ProfessionalGateStatus
  readonly professionalReadiness: ProfessionalReadiness
  readonly reviewSource: ProfessionalEvidenceReviewSource
  readonly requiredEvidenceSummary: string
  readonly professionalConfirmationSummary: string
  readonly recommendedNextAction: string
  readonly linkedEvidenceCommandEvidenceId: string | null
}
