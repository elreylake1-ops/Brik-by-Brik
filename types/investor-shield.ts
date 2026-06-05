// Phase 4B-1 Investor Shield contracts are type definitions only.
// This file does not add runtime enforcement, persistence logic, API wiring, UI usage,
// default gate definitions, or AI/media processing behavior.
// `dealId` remains string-based to stay TEXT-compatible with saved_deals.id.

export const INVESTOR_SHIELD_GATE_KEYS = [
  "SOLD_COMPS",
  "TITLE",
  "LEASEHOLD",
  "PLANNING_BUILDING_CONTROL",
  "REFURB_CERTAINTY",
  "BUILDER_PROPOSAL_CONTRACT",
  "DAMP_STRUCTURAL",
  "LENDER_CRITERIA",
  "RENTAL_DEMAND",
  "SOLICITOR_FEEDBACK",
] as const

export type InvestorShieldGateKey = typeof INVESTOR_SHIELD_GATE_KEYS[number]

export const INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS = [
  "MEDIA_EVIDENCE_PACK",
  "ROOM_MEASUREMENT_SCHEDULE",
  "AI_VISUAL_REVIEW_ADVISORY",
  "BUILDER_QUOTE_EVIDENCE",
  "SPECIALIST_SURVEY_EVIDENCE",
] as const

export type InvestorShieldRefurbSubGateKey =
  typeof INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS[number]

export type InvestorShieldSubGateKey = InvestorShieldRefurbSubGateKey

export const INVESTOR_SHIELD_STATUSES = [
  "NOT_STARTED",
  "REQUIRED",
  "IN_PROGRESS",
  "SATISFIED",
  "WEAK",
  "FAILED",
  "WAIVED",
] as const

export type InvestorShieldStatus = typeof INVESTOR_SHIELD_STATUSES[number]

export const INVESTOR_SHIELD_SEVERITIES = ["INFO", "CAUTION", "BLOCKER", "FATAL"] as const

export type InvestorShieldSeverity = typeof INVESTOR_SHIELD_SEVERITIES[number]

export const INVESTOR_SHIELD_CONFIDENCE_LEVELS = [
  "HIGH",
  "MEDIUM",
  "LOW",
  "UNKNOWN",
] as const

export type InvestorShieldConfidence = typeof INVESTOR_SHIELD_CONFIDENCE_LEVELS[number]

export const INVESTOR_SHIELD_EVIDENCE_TYPES = [
  "SOLD_COMPARABLE",
  "TITLE_DOCUMENT",
  "LEASE_DOCUMENT",
  "PLANNING_DOCUMENT",
  "BUILDING_CONTROL_DOCUMENT",
  "REFURB_PHOTO",
  "REFURB_VIDEO",
  "ROOM_MEASUREMENT",
  "BUILDER_QUOTE",
  "BUILDER_PROPOSAL",
  "BUILDER_CONTRACT",
  "SPECIALIST_SURVEY",
  "LENDER_CRITERIA",
  "RENTAL_EVIDENCE",
  "SOLICITOR_FEEDBACK",
  "MANUAL_NOTE",
  "OTHER",
] as const

export type InvestorShieldEvidenceType = typeof INVESTOR_SHIELD_EVIDENCE_TYPES[number]

export const INVESTOR_SHIELD_SOURCES = [
  "user_supplied",
  "document",
  "media",
  "professional",
  "ai_advisory",
  "system_default",
] as const

export type InvestorShieldSource = typeof INVESTOR_SHIELD_SOURCES[number]

export type InvestorShieldGateDefinition = {
  key: InvestorShieldGateKey
  label: string
  description: string
  required: boolean
  defaultSeverity: InvestorShieldSeverity
  subGates?: readonly InvestorShieldSubGateKey[]
  evidenceTypes: readonly InvestorShieldEvidenceType[]
  advisoryOnly?: boolean
}

export type InvestorShieldCheck = {
  id?: string
  dealId: string
  gateKey: InvestorShieldGateKey
  subGateKey?: InvestorShieldSubGateKey
  status: InvestorShieldStatus
  severity: InvestorShieldSeverity
  confidence: InvestorShieldConfidence
  requiredEvidence: readonly InvestorShieldEvidenceType[]
  summary?: string
  advisoryOnly?: boolean
  createdAt?: string
  updatedAt?: string
}

export type EvidenceItem = {
  id?: string
  dealId: string
  gateKey: InvestorShieldGateKey
  subGateKey?: InvestorShieldSubGateKey
  evidenceType: InvestorShieldEvidenceType
  source: InvestorShieldSource
  confidence: InvestorShieldConfidence
  label: string
  notes?: string
  fileUrl?: string
  advisoryOnly?: boolean
  createdAt?: string
}

export type RiskFlag = {
  id?: string
  dealId: string
  gateKey?: InvestorShieldGateKey
  severity: InvestorShieldSeverity
  message: string
  source: InvestorShieldSource
  advisoryOnly?: boolean
  createdAt?: string
}

export type ManualOverride = {
  id?: string
  dealId: string
  gateKey: InvestorShieldGateKey
  reason: string
  approvedBy?: string
  advisoryOnly?: boolean
  createdAt?: string
}

export type BuilderProposal = {
  id?: string
  dealId: string
  builderName?: string
  quotedAmount?: number
  scopeSummary?: string
  status: InvestorShieldStatus
  advisoryOnly?: boolean
  createdAt?: string
}

export type BuilderContractCheck = {
  id?: string
  dealId: string
  builderProposalId?: string
  status: InvestorShieldStatus
  hasSignedContract: boolean
  hasPaymentSchedule: boolean
  hasScopeOfWorks: boolean
  hasStartDate: boolean
  hasInsuranceEvidence: boolean
  notes?: string
  advisoryOnly?: boolean
  createdAt?: string
}
