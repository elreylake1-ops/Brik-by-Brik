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
