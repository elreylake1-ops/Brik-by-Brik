import { randomUUID } from "node:crypto"
import { query } from "@/lib/db/postgres"
import {
  EVIDENCE_COMMAND_BLOCKER_IMPACTS,
  EVIDENCE_COMMAND_DEFAULTS,
  EVIDENCE_COMMAND_PROFESSIONAL_GATES,
  EVIDENCE_COMMAND_REVIEW_STATES,
  EVIDENCE_COMMAND_STATUSES,
  EVIDENCE_COMMAND_STRENGTHS,
  EVIDENCE_COMMAND_TYPES,
  EVIDENCE_LITE_EVIDENCE_TYPES,
  EVIDENCE_LITE_GATES,
  EVIDENCE_LITE_STATUSES,
  type EvidenceCommandBlockerImpact,
  type EvidenceCommandProfessionalGate,
  type EvidenceCommandReviewState,
  type EvidenceCommandStatus,
  type EvidenceCommandStrength,
  type EvidenceCommandType,
  type EvidenceLiteRecord,
  type EvidenceLiteEvidenceType,
  type EvidenceLiteGateKey,
  type EvidenceLiteStatus,
  type NormalizedCreateEvidenceLiteInput,
  type NormalizedEvidenceCommandInput,
  type NormalizedUpdateEvidenceLiteInput,
} from "@/types/evidence-lite"
import { INVESTOR_SHIELD_GATE_KEYS, type InvestorShieldGateKey } from "@/types/investor-shield"

const EVIDENCE_LITE_FIELDS =
  "id, deal_id, evidence_type, linked_gate, linked_investor_shield_gate, evidence_command_type, title, note, evidence_summary, status, evidence_status, evidence_strength, review_state, blocker_impact, linked_professional_gate, recommended_next_action, expiry_or_update_date, source, mobile_capture_note, reviewed, reviewer_note, created_at, updated_at"

type EvidenceLiteDbRow = {
  id: string
  deal_id: string
  evidence_type: string
  linked_gate: string
  linked_investor_shield_gate: string | null
  evidence_command_type: string | null
  title: string
  note: string
  evidence_summary: string | null
  status: string
  evidence_status: string | null
  evidence_strength: string | null
  review_state: string | null
  blocker_impact: string | null
  linked_professional_gate: string | null
  recommended_next_action: string | null
  expiry_or_update_date: string | null
  source: string | null
  mobile_capture_note: string | null
  reviewed: boolean
  reviewer_note: string | null
  created_at: string
  updated_at: string
}

type EvidenceLiteRepositoryRecord = EvidenceLiteRecord & {
  linkedInvestorShieldGate: InvestorShieldGateKey
  evidenceCommandType: EvidenceCommandType
  evidenceSummary: string
  evidenceStatus: EvidenceCommandStatus
  evidenceStrength: EvidenceCommandStrength
  reviewState: EvidenceCommandReviewState
  blockerImpact: EvidenceCommandBlockerImpact
  linkedProfessionalGate: EvidenceCommandProfessionalGate
  recommendedNextAction: string | null
  expiryOrUpdateDate: string | null
  source: string | null
  mobileCaptureNote: string | null
}

type EvidenceLiteCreateInput =
  | NormalizedCreateEvidenceLiteInput
  | (NormalizedEvidenceCommandInput & { dealId: string })

type EvidenceLiteUpdateInput =
  | NormalizedUpdateEvidenceLiteInput
  | Partial<NormalizedEvidenceCommandInput>

const EVIDENCE_LITE_EVIDENCE_TYPE_SET = new Set<string>(EVIDENCE_LITE_EVIDENCE_TYPES)
const EVIDENCE_LITE_GATE_SET = new Set<string>(EVIDENCE_LITE_GATES)
const EVIDENCE_LITE_STATUS_SET = new Set<string>(EVIDENCE_LITE_STATUSES)
const EVIDENCE_COMMAND_TYPE_SET = new Set<string>(EVIDENCE_COMMAND_TYPES)
const EVIDENCE_COMMAND_STATUS_SET = new Set<string>(EVIDENCE_COMMAND_STATUSES)
const EVIDENCE_COMMAND_STRENGTH_SET = new Set<string>(EVIDENCE_COMMAND_STRENGTHS)
const EVIDENCE_COMMAND_REVIEW_STATE_SET = new Set<string>(EVIDENCE_COMMAND_REVIEW_STATES)
const EVIDENCE_COMMAND_BLOCKER_IMPACT_SET = new Set<string>(EVIDENCE_COMMAND_BLOCKER_IMPACTS)
const EVIDENCE_COMMAND_PROFESSIONAL_GATE_SET = new Set<string>(EVIDENCE_COMMAND_PROFESSIONAL_GATES)
const INVESTOR_SHIELD_GATE_SET = new Set<string>(INVESTOR_SHIELD_GATE_KEYS)
const COMMAND_MUTATION_FIELDS = new Set([
  "linkedInvestorShieldGate",
  "linkedProfessionalGate",
  "evidenceSummary",
  "evidenceStatus",
  "evidenceStrength",
  "reviewState",
  "blockerImpact",
  "recommendedNextAction",
  "expiryOrUpdateDate",
  "source",
  "mobileCaptureNote",
])
function generateEvidenceLiteId(): string {
  return `evidence_${randomUUID()}`
}

function assertCanonicalEvidenceLiteValue(
  field: "evidence_type" | "linked_gate" | "status",
  value: string
): void {
  if (field === "linked_gate" && value === "SOLICITOR_FEEDBACK") {
    throw new Error("Legacy solicitor feedback value must not be stored: linked_gate")
  }

  if (field === "linked_gate" && value === "GENERAL") {
    throw new Error("Invalid Evidence Lite value must not be stored: linked_gate")
  }

  if (field === "evidence_type" && !EVIDENCE_LITE_EVIDENCE_TYPE_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Lite evidence_type: ${value}`)
  }

  if (field === "linked_gate" && !EVIDENCE_LITE_GATE_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Lite linked_gate: ${value}`)
  }

  if (field === "status" && !EVIDENCE_LITE_STATUS_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Lite status: ${value}`)
  }

  if (value === "SOLICITOR_FEEDBACK") {
    throw new Error(`Legacy solicitor feedback value must not be stored: ${field}`)
  }

  if (value === "GENERAL") {
    throw new Error(`Invalid Evidence Lite value must not be stored: ${field}`)
  }
}

function assertCanonicalEvidenceCommandValue(
  field:
    | "linked_investor_shield_gate"
    | "evidence_command_type"
    | "evidence_status"
    | "evidence_strength"
    | "review_state"
    | "blocker_impact"
    | "linked_professional_gate",
  value: string
): void {
  const normalizedValue = value === "SOLICITOR_FEEDBACK" ? "SOLICITOR_REVIEW" : value

  if (field === "linked_investor_shield_gate" && !INVESTOR_SHIELD_GATE_SET.has(normalizedValue)) {
    throw new Error(`Invalid stored Evidence Command linked_investor_shield_gate: ${value}`)
  }

  if (field === "evidence_command_type" && !EVIDENCE_COMMAND_TYPE_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Command evidence_command_type: ${value}`)
  }

  if (field === "evidence_status" && !EVIDENCE_COMMAND_STATUS_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Command evidence_status: ${value}`)
  }

  if (field === "evidence_strength" && !EVIDENCE_COMMAND_STRENGTH_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Command evidence_strength: ${value}`)
  }

  if (field === "review_state" && !EVIDENCE_COMMAND_REVIEW_STATE_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Command review_state: ${value}`)
  }

  if (field === "blocker_impact" && !EVIDENCE_COMMAND_BLOCKER_IMPACT_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Command blocker_impact: ${value}`)
  }

  if (field === "linked_professional_gate" && !EVIDENCE_COMMAND_PROFESSIONAL_GATE_SET.has(value)) {
    throw new Error(`Invalid stored Evidence Command linked_professional_gate: ${value}`)
  }
}

function mapLegacyEvidenceTypeToCommandType(value: EvidenceLiteEvidenceType): EvidenceCommandType {
  switch (value) {
    case "SOLD_COMP":
      return "SOLD_COMPARABLE"
    case "TITLE_REVIEW":
      return "TITLE_LEGAL"
    case "LEASEHOLD_REVIEW":
      return "LEASEHOLD"
    case "PLANNING_BUILDING_CONTROL":
      return "PLANNING_BUILDING_CONTROL"
    case "REFURB_NOTE":
      return "REFURB"
    case "BUILDER_QUOTE":
      return "BUILDER_QUOTE"
    case "SURVEY_NOTE":
      return "SURVEYOR_EVIDENCE"
    case "LENDER_NOTE":
      return "LENDER_BROKER"
    case "RENTAL_DEMAND":
      return "RENTAL_DEMAND"
    case "SOLICITOR_REVIEW":
      return "SOLICITOR_REVIEW"
    case "OTHER":
      return "OTHER"
  }
}

function mapCommandEvidenceTypeToLegacyType(value: EvidenceCommandType): EvidenceLiteEvidenceType {
  switch (value) {
    case "SOLD_COMPARABLE":
      return "SOLD_COMP"
    case "TITLE_LEGAL":
      return "TITLE_REVIEW"
    case "LEASEHOLD":
      return "LEASEHOLD_REVIEW"
    case "PLANNING_BUILDING_CONTROL":
      return "PLANNING_BUILDING_CONTROL"
    case "REFURB":
      return "REFURB_NOTE"
    case "BUILDER_QUOTE":
      return "BUILDER_QUOTE"
    case "DAMP_STRUCTURAL":
      return "SURVEY_NOTE"
    case "LENDER_BROKER":
      return "LENDER_NOTE"
    case "RENTAL_DEMAND":
      return "RENTAL_DEMAND"
    case "SOLICITOR_REVIEW":
      return "SOLICITOR_REVIEW"
    case "AGENT_RESPONSE":
    case "PHOTO_EVIDENCE":
    case "VIDEO_EVIDENCE":
    case "OFFER_NEGOTIATION_EVIDENCE":
    case "OTHER":
      return "OTHER"
    case "SURVEYOR_EVIDENCE":
      return "SURVEY_NOTE"
  }
}

function mapLegacyGateToInvestorShieldGate(value: string): InvestorShieldGateKey {
  if (value === "SOLICITOR_FEEDBACK") {
    return "SOLICITOR_REVIEW"
  }

  return value as InvestorShieldGateKey
}

function mapInvestorShieldGateToLegacyGate(value: InvestorShieldGateKey): EvidenceLiteGateKey {
  return value as EvidenceLiteGateKey
}

function mapLegacyStatusToEvidenceStatus(value: EvidenceLiteStatus): EvidenceCommandStatus {
  switch (value) {
    case "MISSING":
      return "MISSING"
    case "RECORDED":
      return "RECEIVED"
    case "REVIEWED":
      return "REVIEWED"
    case "VERIFIED":
      return "SUFFICIENT"
    case "REJECTED":
      return "REJECTED"
  }
}

function mapEvidenceStatusToLegacyStatus(value: EvidenceCommandStatus): EvidenceLiteStatus {
  switch (value) {
    case "MISSING":
    case "REQUESTED":
      return "MISSING"
    case "RECEIVED":
      return "RECORDED"
    case "REVIEWED":
      return "REVIEWED"
    case "SUFFICIENT":
      return "VERIFIED"
    case "INSUFFICIENT":
    case "REJECTED":
    case "EXPIRED":
      return "REJECTED"
  }
}

function mapReviewStateToReviewed(reviewState: EvidenceCommandReviewState): boolean {
  return reviewState !== "NOT_REVIEWED"
}

function isCommandMutationInput(input: Record<string, unknown>): boolean {
  if (input.evidenceType !== undefined && typeof input.evidenceType === "string") {
    const trimmed = input.evidenceType.trim()
    if (!EVIDENCE_LITE_EVIDENCE_TYPE_SET.has(trimmed) && EVIDENCE_COMMAND_TYPE_SET.has(trimmed)) {
      return true
    }
  }

  for (const field of COMMAND_MUTATION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      return true
    }
  }

  return false
}

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeOptionalDateLike(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  return trimmed
}

function readRequiredText(payload: Record<string, unknown>, field: string): string {
  const value = payload[field]
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`)
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }

  return trimmed
}

function readLegacyCreatePayload(input: Record<string, unknown>): {
  evidenceType: EvidenceLiteEvidenceType
  linkedGate: EvidenceLiteGateKey
  title: string
  note: string
  status: EvidenceLiteStatus
  reviewed: boolean
  evidenceCommandType: EvidenceCommandType
  linkedInvestorShieldGate: InvestorShieldGateKey
  evidenceSummary: string
  evidenceStatus: EvidenceCommandStatus
  evidenceStrength: EvidenceCommandStrength
  reviewState: EvidenceCommandReviewState
  blockerImpact: EvidenceCommandBlockerImpact
  linkedProfessionalGate: EvidenceCommandProfessionalGate
  recommendedNextAction: string | null
  expiryOrUpdateDate: string | null
  source: string | null
  mobileCaptureNote: string | null
} {
  const evidenceType = readRequiredText(input, "evidenceType")
  if (!EVIDENCE_LITE_EVIDENCE_TYPE_SET.has(evidenceType)) {
    throw new Error(`evidenceType must be one of: ${EVIDENCE_LITE_EVIDENCE_TYPES.join(", ")}`)
  }

  const linkedGate = readRequiredText(input, "linkedGate")
  if (!EVIDENCE_LITE_GATE_SET.has(linkedGate)) {
    throw new Error(`linkedGate must be one of: ${EVIDENCE_LITE_GATES.join(", ")}`)
  }

  const title = readRequiredText(input, "title")
  const note = readRequiredText(input, "note")

  const status = readRequiredText(input, "status")
  if (!EVIDENCE_LITE_STATUS_SET.has(status)) {
    throw new Error(`status must be one of: ${EVIDENCE_LITE_STATUSES.join(", ")}`)
  }

  const reviewed = input.reviewed
  if (typeof reviewed !== "boolean") {
    throw new Error("reviewed must be a boolean")
  }

  return {
    evidenceType: evidenceType as EvidenceLiteEvidenceType,
    linkedGate: linkedGate as EvidenceLiteGateKey,
    title,
    note,
    status: status as EvidenceLiteStatus,
    reviewed,
    evidenceCommandType: mapLegacyEvidenceTypeToCommandType(evidenceType as EvidenceLiteEvidenceType),
    linkedInvestorShieldGate: mapLegacyGateToInvestorShieldGate(linkedGate as EvidenceLiteGateKey),
    evidenceSummary: note,
    evidenceStatus: mapLegacyStatusToEvidenceStatus(status as EvidenceLiteStatus),
    evidenceStrength: EVIDENCE_COMMAND_DEFAULTS.evidenceStrength,
    reviewState: reviewed ? "REVIEWED_BY_OPERATOR" : "NOT_REVIEWED",
    blockerImpact: EVIDENCE_COMMAND_DEFAULTS.blockerImpact,
    linkedProfessionalGate: EVIDENCE_COMMAND_DEFAULTS.linkedProfessionalGate,
    recommendedNextAction: null,
    expiryOrUpdateDate: null,
    source: null,
    mobileCaptureNote: null,
  }
}

function readCommandCreatePayload(input: Record<string, unknown>): {
  evidenceType: EvidenceCommandType
  linkedGate: EvidenceLiteGateKey
  title: string
  note: string
  status: EvidenceLiteStatus
  reviewed: boolean
  evidenceCommandType: EvidenceCommandType
  linkedInvestorShieldGate: InvestorShieldGateKey
  evidenceSummary: string
  evidenceStatus: EvidenceCommandStatus
  evidenceStrength: EvidenceCommandStrength
  reviewState: EvidenceCommandReviewState
  blockerImpact: EvidenceCommandBlockerImpact
  linkedProfessionalGate: EvidenceCommandProfessionalGate
  recommendedNextAction: string | null
  expiryOrUpdateDate: string | null
  source: string | null
  mobileCaptureNote: string | null
} {
  const evidenceType = readRequiredText(input, "evidenceType")
  if (!EVIDENCE_COMMAND_TYPE_SET.has(evidenceType)) {
    throw new Error(`evidenceType must be one of: ${EVIDENCE_COMMAND_TYPES.join(", ")}`)
  }

  const linkedInvestorShieldGate = readRequiredText(input, "linkedInvestorShieldGate")
  const normalizedLinkedInvestorShieldGate =
    linkedInvestorShieldGate === "SOLICITOR_FEEDBACK"
      ? "SOLICITOR_REVIEW"
      : linkedInvestorShieldGate
  if (!INVESTOR_SHIELD_GATE_SET.has(normalizedLinkedInvestorShieldGate)) {
    throw new Error(
      `linkedInvestorShieldGate must be one of: ${INVESTOR_SHIELD_GATE_KEYS.join(", ")}`
    )
  }

  const linkedProfessionalGate = readRequiredText(input, "linkedProfessionalGate")
  if (!EVIDENCE_COMMAND_PROFESSIONAL_GATE_SET.has(linkedProfessionalGate)) {
    throw new Error(
      `linkedProfessionalGate must be one of: ${EVIDENCE_COMMAND_PROFESSIONAL_GATES.join(", ")}`
    )
  }

  const title = readRequiredText(input, "title")
  const evidenceSummary = readRequiredText(input, "evidenceSummary")

  const evidenceStatus = readRequiredText(input, "evidenceStatus")
  if (!EVIDENCE_COMMAND_STATUS_SET.has(evidenceStatus)) {
    throw new Error(`evidenceStatus must be one of: ${EVIDENCE_COMMAND_STATUSES.join(", ")}`)
  }

  const evidenceStrength = readRequiredText(input, "evidenceStrength")
  if (!EVIDENCE_COMMAND_STRENGTH_SET.has(evidenceStrength)) {
    throw new Error(`evidenceStrength must be one of: ${EVIDENCE_COMMAND_STRENGTHS.join(", ")}`)
  }

  const reviewState = readRequiredText(input, "reviewState")
  if (!EVIDENCE_COMMAND_REVIEW_STATE_SET.has(reviewState)) {
    throw new Error(`reviewState must be one of: ${EVIDENCE_COMMAND_REVIEW_STATES.join(", ")}`)
  }

  const blockerImpact = readRequiredText(input, "blockerImpact")
  if (!EVIDENCE_COMMAND_BLOCKER_IMPACT_SET.has(blockerImpact)) {
    throw new Error(`blockerImpact must be one of: ${EVIDENCE_COMMAND_BLOCKER_IMPACTS.join(", ")}`)
  }

  const recommendedNextAction = normalizeOptionalText(input.recommendedNextAction)
  if (recommendedNextAction === undefined) {
    throw new Error("recommendedNextAction must be a string or null")
  }

  const expiryOrUpdateDate = normalizeOptionalDateLike(input.expiryOrUpdateDate)
  if (expiryOrUpdateDate === undefined) {
    throw new Error("expiryOrUpdateDate must be a date-like string when provided")
  }

  const source = normalizeOptionalText(input.source)
  if (source === undefined) {
    throw new Error("source must be a string or null")
  }

  const mobileCaptureNote = normalizeOptionalText(input.mobileCaptureNote)
  if (mobileCaptureNote === undefined) {
    throw new Error("mobileCaptureNote must be a string or null")
  }

  return {
    evidenceType: evidenceType as EvidenceCommandType,
    linkedGate: mapInvestorShieldGateToLegacyGate(linkedInvestorShieldGate as InvestorShieldGateKey),
    title,
    note: evidenceSummary,
    status: mapEvidenceStatusToLegacyStatus(evidenceStatus as EvidenceCommandStatus),
    reviewed: mapReviewStateToReviewed(reviewState as EvidenceCommandReviewState),
    evidenceCommandType: evidenceType as EvidenceCommandType,
    linkedInvestorShieldGate: linkedInvestorShieldGate as InvestorShieldGateKey,
    evidenceSummary,
    evidenceStatus: evidenceStatus as EvidenceCommandStatus,
    evidenceStrength: evidenceStrength as EvidenceCommandStrength,
    reviewState: reviewState as EvidenceCommandReviewState,
    blockerImpact: blockerImpact as EvidenceCommandBlockerImpact,
    linkedProfessionalGate: linkedProfessionalGate as EvidenceCommandProfessionalGate,
    recommendedNextAction,
    expiryOrUpdateDate,
    source,
    mobileCaptureNote,
  }
}

function collectCreateValues(input: EvidenceLiteCreateInput): {
  columns: string[]
  values: unknown[]
} {
  const payload = input as Record<string, unknown>
  const isCommand = isCommandMutationInput(payload)
  const normalized = isCommand ? readCommandCreatePayload(payload) : readLegacyCreatePayload(payload)
  const dealId = readRequiredText(payload, "dealId")
  const evidenceType = isCommand
    ? mapCommandEvidenceTypeToLegacyType(normalized.evidenceType as EvidenceCommandType)
    : (normalized.evidenceType as EvidenceLiteEvidenceType)
  const commandEvidenceType = isCommand
    ? (normalized.evidenceType as EvidenceCommandType)
    : mapLegacyEvidenceTypeToCommandType(normalized.evidenceType as EvidenceLiteEvidenceType)

  return {
    columns: [
      "id",
      "deal_id",
      "evidence_type",
      "linked_gate",
      "linked_investor_shield_gate",
      "evidence_command_type",
      "title",
      "note",
      "evidence_summary",
      "status",
      "evidence_status",
      "evidence_strength",
      "review_state",
      "blocker_impact",
      "linked_professional_gate",
      "recommended_next_action",
      "expiry_or_update_date",
      "source",
      "mobile_capture_note",
      "reviewed",
    ],
    values: [
      generateEvidenceLiteId(),
      dealId,
      evidenceType,
      normalized.linkedGate,
      normalized.linkedInvestorShieldGate,
      commandEvidenceType,
      normalized.title,
      normalized.note,
      normalized.evidenceSummary,
      normalized.status,
      normalized.evidenceStatus,
      normalized.evidenceStrength,
      normalized.reviewState,
      normalized.blockerImpact,
      normalized.linkedProfessionalGate,
      normalized.recommendedNextAction,
      normalized.expiryOrUpdateDate,
      normalized.source,
      normalized.mobileCaptureNote,
      normalized.reviewed,
    ],
  }
}

function collectUpdatePairs(input: EvidenceLiteUpdateInput): Array<[string, unknown]> {
  const payload = input as Record<string, unknown>
  const isCommand = isCommandMutationInput(payload)
  const pairs: Array<[string, unknown]> = []

  const add = (column: string, value: unknown) => {
    pairs.push([column, value])
  }

  if (Object.prototype.hasOwnProperty.call(payload, "evidenceType")) {
    const evidenceType = readRequiredText(payload, "evidenceType")
    if (isCommand) {
      if (!EVIDENCE_COMMAND_TYPE_SET.has(evidenceType)) {
        throw new Error(`evidenceType must be one of: ${EVIDENCE_COMMAND_TYPES.join(", ")}`)
      }
      add("evidence_type", mapCommandEvidenceTypeToLegacyType(evidenceType as EvidenceCommandType))
      add("evidence_command_type", evidenceType)
    } else {
      if (!EVIDENCE_LITE_EVIDENCE_TYPE_SET.has(evidenceType)) {
        throw new Error(`evidenceType must be one of: ${EVIDENCE_LITE_EVIDENCE_TYPES.join(", ")}`)
      }
      add("evidence_type", evidenceType)
      add("evidence_command_type", mapLegacyEvidenceTypeToCommandType(evidenceType as EvidenceLiteEvidenceType))
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "linkedGate")) {
    const linkedGate = readRequiredText(payload, "linkedGate")
    if (!EVIDENCE_LITE_GATE_SET.has(linkedGate)) {
      throw new Error(`linkedGate must be one of: ${EVIDENCE_LITE_GATES.join(", ")}`)
    }
    add("linked_gate", linkedGate)
    add("linked_investor_shield_gate", mapLegacyGateToInvestorShieldGate(linkedGate as EvidenceLiteGateKey))
  }

  if (Object.prototype.hasOwnProperty.call(payload, "linkedInvestorShieldGate")) {
    const linkedInvestorShieldGate = readRequiredText(payload, "linkedInvestorShieldGate")
    const normalizedLinkedInvestorShieldGate =
      linkedInvestorShieldGate === "SOLICITOR_FEEDBACK"
        ? "SOLICITOR_REVIEW"
        : linkedInvestorShieldGate
    if (!INVESTOR_SHIELD_GATE_SET.has(normalizedLinkedInvestorShieldGate)) {
      throw new Error(
        `linkedInvestorShieldGate must be one of: ${INVESTOR_SHIELD_GATE_KEYS.join(", ")}`
      )
    }
    add("linked_investor_shield_gate", normalizedLinkedInvestorShieldGate)
    add(
      "linked_gate",
      mapInvestorShieldGateToLegacyGate(normalizedLinkedInvestorShieldGate as InvestorShieldGateKey)
    )
  }

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    add("title", readRequiredText(payload, "title"))
  }

  const notePresent = Object.prototype.hasOwnProperty.call(payload, "note")
  const evidenceSummaryPresent = Object.prototype.hasOwnProperty.call(payload, "evidenceSummary")
  if (notePresent || evidenceSummaryPresent) {
    const note = notePresent ? normalizeOptionalText(payload.note) : null
    const evidenceSummary = evidenceSummaryPresent ? normalizeOptionalText(payload.evidenceSummary) : null
    const text = evidenceSummary ?? note
    if (text === undefined) {
      throw new Error("evidenceSummary must be a string or null")
    }
    add("note", text)
    add("evidence_summary", text)
  }

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    const status = readRequiredText(payload, "status")
    if (!EVIDENCE_LITE_STATUS_SET.has(status)) {
      throw new Error(`status must be one of: ${EVIDENCE_LITE_STATUSES.join(", ")}`)
    }
    add("status", status)
    add("evidence_status", mapLegacyStatusToEvidenceStatus(status as EvidenceLiteStatus))
  }

  if (Object.prototype.hasOwnProperty.call(payload, "evidenceStatus")) {
    const evidenceStatus = readRequiredText(payload, "evidenceStatus")
    if (!EVIDENCE_COMMAND_STATUS_SET.has(evidenceStatus)) {
      throw new Error(`evidenceStatus must be one of: ${EVIDENCE_COMMAND_STATUSES.join(", ")}`)
    }
    add("evidence_status", evidenceStatus)
    add("status", mapEvidenceStatusToLegacyStatus(evidenceStatus as EvidenceCommandStatus))
  }

  if (Object.prototype.hasOwnProperty.call(payload, "reviewed")) {
    const reviewed = payload.reviewed
    if (typeof reviewed !== "boolean") {
      throw new Error("reviewed must be a boolean")
    }
    add("reviewed", reviewed)
    add("review_state", reviewed ? "REVIEWED_BY_OPERATOR" : "NOT_REVIEWED")
  }

  if (Object.prototype.hasOwnProperty.call(payload, "reviewState")) {
    const reviewState = readRequiredText(payload, "reviewState")
    if (!EVIDENCE_COMMAND_REVIEW_STATE_SET.has(reviewState)) {
      throw new Error(`reviewState must be one of: ${EVIDENCE_COMMAND_REVIEW_STATES.join(", ")}`)
    }
    add("review_state", reviewState)
    add("reviewed", mapReviewStateToReviewed(reviewState as EvidenceCommandReviewState))
  }

  if (Object.prototype.hasOwnProperty.call(payload, "evidenceStrength")) {
    const evidenceStrength = readRequiredText(payload, "evidenceStrength")
    if (!EVIDENCE_COMMAND_STRENGTH_SET.has(evidenceStrength)) {
      throw new Error(`evidenceStrength must be one of: ${EVIDENCE_COMMAND_STRENGTHS.join(", ")}`)
    }
    add("evidence_strength", evidenceStrength)
  }

  if (Object.prototype.hasOwnProperty.call(payload, "blockerImpact")) {
    const blockerImpact = readRequiredText(payload, "blockerImpact")
    if (!EVIDENCE_COMMAND_BLOCKER_IMPACT_SET.has(blockerImpact)) {
      throw new Error(`blockerImpact must be one of: ${EVIDENCE_COMMAND_BLOCKER_IMPACTS.join(", ")}`)
    }
    add("blocker_impact", blockerImpact)
  }

  if (Object.prototype.hasOwnProperty.call(payload, "linkedProfessionalGate")) {
    const linkedProfessionalGate = readRequiredText(payload, "linkedProfessionalGate")
    if (!EVIDENCE_COMMAND_PROFESSIONAL_GATE_SET.has(linkedProfessionalGate)) {
      throw new Error(
        `linkedProfessionalGate must be one of: ${EVIDENCE_COMMAND_PROFESSIONAL_GATES.join(", ")}`
      )
    }
    add("linked_professional_gate", linkedProfessionalGate)
  }

  if (Object.prototype.hasOwnProperty.call(payload, "recommendedNextAction")) {
    const value = normalizeOptionalText(payload.recommendedNextAction)
    if (value === undefined) {
      throw new Error("recommendedNextAction must be a string or null")
    }
    add("recommended_next_action", value)
  }

  if (Object.prototype.hasOwnProperty.call(payload, "expiryOrUpdateDate")) {
    const value = normalizeOptionalDateLike(payload.expiryOrUpdateDate)
    if (value === undefined) {
      throw new Error("expiryOrUpdateDate must be a date-like string when provided")
    }
    add("expiry_or_update_date", value)
  }

  if (Object.prototype.hasOwnProperty.call(payload, "source")) {
    const value = normalizeOptionalText(payload.source)
    if (value === undefined) {
      throw new Error("source must be a string or null")
    }
    add("source", value)
  }

  if (Object.prototype.hasOwnProperty.call(payload, "mobileCaptureNote")) {
    const value = normalizeOptionalText(payload.mobileCaptureNote)
    if (value === undefined) {
      throw new Error("mobileCaptureNote must be a string or null")
    }
    add("mobile_capture_note", value)
  }

  return pairs
}

function buildUpdateAssignments(input: EvidenceLiteUpdateInput): {
  assignments: string[]
  values: unknown[]
} {
  const assignments: string[] = []
  const values: unknown[] = []

  for (const [column, field] of collectUpdatePairs(input)) {
    values.push(field)
    assignments.push(`${column} = $${values.length}`)
  }

  assignments.push("updated_at = NOW()")

  return { assignments, values }
}

function mapEvidenceLiteRow(row: EvidenceLiteDbRow): EvidenceLiteRepositoryRecord {
  assertCanonicalEvidenceLiteValue("evidence_type", row.evidence_type)
  assertCanonicalEvidenceLiteValue("linked_gate", row.linked_gate)
  assertCanonicalEvidenceLiteValue("status", row.status)

  const linkedInvestorShieldGateRaw =
    row.linked_investor_shield_gate ?? mapLegacyGateToInvestorShieldGate(row.linked_gate as EvidenceLiteGateKey)
  const evidenceCommandTypeRaw =
    row.evidence_command_type ?? mapLegacyEvidenceTypeToCommandType(row.evidence_type as EvidenceLiteEvidenceType)
  const evidenceSummaryRaw = row.evidence_summary ?? row.note
  const evidenceStatusRaw =
    row.evidence_status ?? mapLegacyStatusToEvidenceStatus(row.status as EvidenceLiteStatus)
  const evidenceStrengthRaw = row.evidence_strength ?? EVIDENCE_COMMAND_DEFAULTS.evidenceStrength
  const reviewStateRaw =
    row.review_state ?? (row.reviewed ? "REVIEWED_BY_OPERATOR" : "NOT_REVIEWED")
  const blockerImpactRaw = row.blocker_impact ?? EVIDENCE_COMMAND_DEFAULTS.blockerImpact
  const linkedProfessionalGateRaw =
    row.linked_professional_gate ?? EVIDENCE_COMMAND_DEFAULTS.linkedProfessionalGate

  if (linkedInvestorShieldGateRaw !== null) {
    assertCanonicalEvidenceCommandValue(
      "linked_investor_shield_gate",
      linkedInvestorShieldGateRaw
    )
  }
  if (evidenceCommandTypeRaw !== null) {
    assertCanonicalEvidenceCommandValue("evidence_command_type", evidenceCommandTypeRaw)
  }
  if (evidenceStatusRaw !== null) {
    assertCanonicalEvidenceCommandValue("evidence_status", evidenceStatusRaw)
  }
  if (evidenceStrengthRaw !== null) {
    assertCanonicalEvidenceCommandValue("evidence_strength", evidenceStrengthRaw)
  }
  if (reviewStateRaw !== null) {
    assertCanonicalEvidenceCommandValue("review_state", reviewStateRaw)
  }
  if (blockerImpactRaw !== null) {
    assertCanonicalEvidenceCommandValue("blocker_impact", blockerImpactRaw)
  }
  if (linkedProfessionalGateRaw !== null) {
    assertCanonicalEvidenceCommandValue("linked_professional_gate", linkedProfessionalGateRaw)
  }

  return {
    id: row.id,
    dealId: row.deal_id,
    evidenceType: row.evidence_type as EvidenceLiteRecord["evidenceType"],
    linkedGate: row.linked_gate as EvidenceLiteRecord["linkedGate"],
    linkedInvestorShieldGate: linkedInvestorShieldGateRaw as InvestorShieldGateKey,
    evidenceCommandType: evidenceCommandTypeRaw as EvidenceCommandType,
    title: row.title,
    note: row.note,
    status: row.status as EvidenceLiteRecord["status"],
    evidenceSummary: (evidenceSummaryRaw ?? row.note) as string,
    evidenceStatus: evidenceStatusRaw as EvidenceCommandStatus,
    evidenceStrength: evidenceStrengthRaw as EvidenceCommandStrength,
    reviewState: reviewStateRaw as EvidenceCommandReviewState,
    blockerImpact: blockerImpactRaw as EvidenceCommandBlockerImpact,
    linkedProfessionalGate: linkedProfessionalGateRaw as EvidenceCommandProfessionalGate,
    recommendedNextAction: row.recommended_next_action ?? null,
    expiryOrUpdateDate: row.expiry_or_update_date ?? null,
    source: row.source ?? null,
    mobileCaptureNote: row.mobile_capture_note ?? null,
    reviewed: row.reviewed,
    reviewerNote: row.reviewer_note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listEvidenceLiteForDeal(dealId: string): Promise<EvidenceLiteRepositoryRecord[]> {
  const result = await query<EvidenceLiteDbRow>(
    `SELECT ${EVIDENCE_LITE_FIELDS}
     FROM brik_by_brik_engine.deal_evidence
     WHERE deal_id = $1
     ORDER BY created_at DESC, id DESC`,
    [dealId]
  )

  return result.rows.map(mapEvidenceLiteRow)
}

export async function getEvidenceLiteById(
  dealId: string,
  evidenceId: string
): Promise<EvidenceLiteRepositoryRecord | null> {
  const result = await query<EvidenceLiteDbRow>(
    `SELECT ${EVIDENCE_LITE_FIELDS}
     FROM brik_by_brik_engine.deal_evidence
     WHERE deal_id = $1
       AND id = $2
     LIMIT 1`,
    [dealId, evidenceId]
  )

  const row = result.rows[0]
  return row ? mapEvidenceLiteRow(row) : null
}

export async function createEvidenceLite(
  input: EvidenceLiteCreateInput
): Promise<EvidenceLiteRepositoryRecord> {
  const { columns, values } = collectCreateValues(input)
  const result = await query<EvidenceLiteDbRow>(
    `INSERT INTO brik_by_brik_engine.deal_evidence (
      ${columns.join(",\n      ")}
    ) VALUES (
      ${columns.map((_, index) => `$${index + 1}`).join(",\n      ")}
    ) RETURNING ${EVIDENCE_LITE_FIELDS}`,
    values
  )

  const row = result.rows[0]
  if (!row) {
    throw new Error("Evidence Lite create returned no row")
  }

  return mapEvidenceLiteRow(row)
}

export async function updateEvidenceLite(
  dealId: string,
  evidenceId: string,
  input: EvidenceLiteUpdateInput
): Promise<EvidenceLiteRepositoryRecord | null> {
  const { assignments, values } = buildUpdateAssignments(input)
  values.push(dealId)
  values.push(evidenceId)

  const result = await query<EvidenceLiteDbRow>(
    `UPDATE brik_by_brik_engine.deal_evidence
     SET ${assignments.join(", ")}
     WHERE deal_id = $${values.length - 1}
       AND id = $${values.length}
     RETURNING ${EVIDENCE_LITE_FIELDS}`,
    values
  )

  const row = result.rows[0]
  return row ? mapEvidenceLiteRow(row) : null
}

export { mapEvidenceLiteRow }
