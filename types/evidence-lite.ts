import type { InvestorShieldGateKey } from "@/types/investor-shield"

// Phase 4E-1 Evidence Lite contracts are type definitions only.
// These types describe text-note evidence metadata and do not satisfy Investor Shield gates,
// change deterministic governance, or add runtime persistence/API behavior.

export const EVIDENCE_LITE_STATUSES = [
  "MISSING",
  "RECORDED",
  "REVIEWED",
  "VERIFIED",
  "REJECTED",
] as const

export type EvidenceLiteStatus = typeof EVIDENCE_LITE_STATUSES[number]

export const EVIDENCE_LITE_GATES = [
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

export type EvidenceLiteGateKey = typeof EVIDENCE_LITE_GATES[number]

export const EVIDENCE_LITE_EVIDENCE_TYPES = [
  "SOLD_COMP",
  "TITLE_REVIEW",
  "LEASEHOLD_REVIEW",
  "PLANNING_BUILDING_CONTROL",
  "REFURB_NOTE",
  "BUILDER_QUOTE",
  "SURVEY_NOTE",
  "LENDER_NOTE",
  "RENTAL_DEMAND",
  "SOLICITOR_REVIEW",
  "OTHER",
] as const

export type EvidenceLiteEvidenceType = typeof EVIDENCE_LITE_EVIDENCE_TYPES[number]

export type EvidenceLiteRecord = {
  id: string
  dealId: string
  evidenceType: EvidenceLiteEvidenceType
  linkedGate: EvidenceLiteGateKey
  title: string
  note: string
  status: EvidenceLiteStatus
  reviewed: boolean
  reviewerNote: string | null
  createdAt: string
  updatedAt: string
}

export type CreateEvidenceLiteInput = {
  dealId?: unknown
  evidenceType?: unknown
  linkedGate?: unknown
  title?: unknown
  note?: unknown
  status?: unknown
  reviewed?: unknown
}

export type NormalizedCreateEvidenceLiteInput = {
  dealId: string
  evidenceType: EvidenceLiteEvidenceType
  linkedGate: EvidenceLiteGateKey
  title: string
  note: string
  status: EvidenceLiteStatus
  reviewed: boolean
}

export type UpdateEvidenceLiteInput = {
  evidenceType?: unknown
  linkedGate?: unknown
  title?: unknown
  note?: unknown
  status?: unknown
  reviewed?: unknown
  id?: unknown
  dealId?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

export type NormalizedUpdateEvidenceLiteInput = {
  evidenceType?: EvidenceLiteEvidenceType
  linkedGate?: EvidenceLiteGateKey
  title?: string
  note?: string
  status?: EvidenceLiteStatus
  reviewed?: boolean
}

export type EvidenceLiteValidationError = {
  field: string
  message: string
}

export type EvidenceLiteValidationResult<T> = {
  valid: boolean
  value?: T
  errors: readonly EvidenceLiteValidationError[]
  warnings: readonly string[]
}

export const EVIDENCE_COMMAND_TYPES = [
  "SOLD_COMPARABLE",
  "TITLE_LEGAL",
  "LEASEHOLD",
  "PLANNING_BUILDING_CONTROL",
  "REFURB",
  "BUILDER_QUOTE",
  "DAMP_STRUCTURAL",
  "LENDER_BROKER",
  "RENTAL_DEMAND",
  "SOLICITOR_REVIEW",
  "AGENT_RESPONSE",
  "PHOTO_EVIDENCE",
  "VIDEO_EVIDENCE",
  "SURVEYOR_EVIDENCE",
  "OFFER_NEGOTIATION_EVIDENCE",
  "OTHER",
] as const

export type EvidenceCommandType = typeof EVIDENCE_COMMAND_TYPES[number]

export const EVIDENCE_COMMAND_TYPE_LABELS: Record<EvidenceCommandType, string> = {
  SOLD_COMPARABLE: "Sold comparable",
  TITLE_LEGAL: "Title / legal",
  LEASEHOLD: "Leasehold",
  PLANNING_BUILDING_CONTROL: "Planning / building control",
  REFURB: "Refurb",
  BUILDER_QUOTE: "Builder quote",
  DAMP_STRUCTURAL: "Damp / structural",
  LENDER_BROKER: "Lender / broker",
  RENTAL_DEMAND: "Rental demand",
  SOLICITOR_REVIEW: "Solicitor review",
  AGENT_RESPONSE: "Agent response",
  PHOTO_EVIDENCE: "Photo evidence",
  VIDEO_EVIDENCE: "Video evidence",
  SURVEYOR_EVIDENCE: "Surveyor evidence",
  OFFER_NEGOTIATION_EVIDENCE: "Offer / negotiation evidence",
  OTHER: "Other",
}

export const EVIDENCE_COMMAND_STATUSES = [
  "MISSING",
  "REQUESTED",
  "RECEIVED",
  "REVIEWED",
  "SUFFICIENT",
  "INSUFFICIENT",
  "REJECTED",
  "EXPIRED",
] as const

export type EvidenceCommandStatus = typeof EVIDENCE_COMMAND_STATUSES[number]

export const EVIDENCE_COMMAND_STATUS_LABELS: Record<EvidenceCommandStatus, string> = {
  MISSING: "Missing",
  REQUESTED: "Requested",
  RECEIVED: "Received",
  REVIEWED: "Reviewed",
  SUFFICIENT: "Sufficient",
  INSUFFICIENT: "Insufficient",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
}

export const EVIDENCE_COMMAND_STRENGTHS = ["WEAK", "MODERATE", "STRONG"] as const

export type EvidenceCommandStrength = typeof EVIDENCE_COMMAND_STRENGTHS[number]

export const EVIDENCE_COMMAND_STRENGTH_LABELS: Record<EvidenceCommandStrength, string> = {
  WEAK: "Weak",
  MODERATE: "Moderate",
  STRONG: "Strong",
}

export const EVIDENCE_COMMAND_REVIEW_STATES = [
  "NOT_REVIEWED",
  "REVIEWED_BY_OPERATOR",
  "PROFESSIONAL_REVIEW_REQUIRED",
  "PROFESSIONAL_CONFIRMED",
] as const

export type EvidenceCommandReviewState = typeof EVIDENCE_COMMAND_REVIEW_STATES[number]

export const EVIDENCE_COMMAND_REVIEW_STATE_LABELS: Record<EvidenceCommandReviewState, string> = {
  NOT_REVIEWED: "Not reviewed",
  REVIEWED_BY_OPERATOR: "Reviewed by operator",
  PROFESSIONAL_REVIEW_REQUIRED: "Professional review required",
  PROFESSIONAL_CONFIRMED: "Professional confirmed",
}

export const EVIDENCE_COMMAND_BLOCKER_IMPACTS = [
  "DOES_NOT_BLOCK",
  "CAUTION_ONLY",
  "BLOCKS_PROGRESSION",
  "REQUIRES_MANUAL_REVIEW",
] as const

export type EvidenceCommandBlockerImpact = typeof EVIDENCE_COMMAND_BLOCKER_IMPACTS[number]

export const EVIDENCE_COMMAND_BLOCKER_IMPACT_LABELS: Record<EvidenceCommandBlockerImpact, string> =
  {
    DOES_NOT_BLOCK: "Does not block",
    CAUTION_ONLY: "Caution only",
    BLOCKS_PROGRESSION: "Blocks progression",
    REQUIRES_MANUAL_REVIEW: "Requires manual review",
  }

export const EVIDENCE_COMMAND_PROFESSIONAL_GATES = [
  "NONE",
  "SOLICITOR_TITLE_REVIEW",
  "BROKER_CONFIRMATION",
  "SURVEYOR_REPORT",
  "BUILDER_QUOTE",
  "PLANNING_BUILDING_CONTROL_CONFIRMATION",
  "ACTUAL_SOLD_COMPARABLE_REVIEW",
  "LENDER_BROKER_CONFIRMATION",
  "SPECIALIST_REPORT",
] as const

export type EvidenceCommandProfessionalGate = typeof EVIDENCE_COMMAND_PROFESSIONAL_GATES[number]

export const EVIDENCE_COMMAND_PROFESSIONAL_GATE_LABELS: Record<
  EvidenceCommandProfessionalGate,
  string
> = {
  NONE: "None",
  SOLICITOR_TITLE_REVIEW: "Solicitor title review",
  BROKER_CONFIRMATION: "Broker confirmation",
  SURVEYOR_REPORT: "Surveyor report",
  BUILDER_QUOTE: "Builder quote",
  PLANNING_BUILDING_CONTROL_CONFIRMATION: "Planning / building control confirmation",
  ACTUAL_SOLD_COMPARABLE_REVIEW: "Actual sold comparable review",
  LENDER_BROKER_CONFIRMATION: "Lender / broker confirmation",
  SPECIALIST_REPORT: "Specialist report",
}

export const EVIDENCE_COMMAND_DEFAULTS = {
  evidenceStatus: "MISSING",
  evidenceStrength: "WEAK",
  reviewState: "NOT_REVIEWED",
  blockerImpact: "DOES_NOT_BLOCK",
  linkedProfessionalGate: "NONE",
} as const

export type EvidenceCommandInput = {
  evidenceType?: unknown
  linkedInvestorShieldGate?: unknown
  linkedProfessionalGate?: unknown
  title?: unknown
  evidenceSummary?: unknown
  evidenceStatus?: unknown
  evidenceStrength?: unknown
  reviewState?: unknown
  blockerImpact?: unknown
  recommendedNextAction?: unknown
  expiryOrUpdateDate?: unknown
  source?: unknown
  mobileCaptureNote?: unknown
}

export type NormalizedEvidenceCommandInput = {
  evidenceType: EvidenceCommandType
  linkedInvestorShieldGate: InvestorShieldGateKey
  linkedProfessionalGate: EvidenceCommandProfessionalGate
  title: string
  evidenceSummary: string
  evidenceStatus: EvidenceCommandStatus
  evidenceStrength: EvidenceCommandStrength
  reviewState: EvidenceCommandReviewState
  blockerImpact: EvidenceCommandBlockerImpact
  recommendedNextAction: string | null
  expiryOrUpdateDate: string | null
  source: string | null
  mobileCaptureNote: string | null
}

export type EvidenceCommandValidationResult =
  EvidenceLiteValidationResult<NormalizedEvidenceCommandInput>
