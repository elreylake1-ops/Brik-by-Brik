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
  type EvidenceCommandInput,
  type EvidenceCommandProfessionalGate,
  type EvidenceCommandReviewState,
  type EvidenceCommandStatus,
  type EvidenceCommandStrength,
  type EvidenceCommandType,
  type EvidenceLiteEvidenceType,
  type EvidenceLiteGateKey,
  type EvidenceLiteStatus,
  type EvidenceLiteValidationError,
  type EvidenceLiteValidationResult,
  type NormalizedEvidenceCommandInput,
  type NormalizedCreateEvidenceLiteInput,
  type NormalizedUpdateEvidenceLiteInput,
} from "@/types/evidence-lite"
import { INVESTOR_SHIELD_GATE_KEYS, type InvestorShieldGateKey } from "@/types/investor-shield"

const CREATE_ALLOWED_FIELDS = new Set([
  "dealId",
  "evidenceType",
  "linkedGate",
  "title",
  "note",
  "status",
  "reviewed",
])

const UPDATE_ALLOWED_FIELDS = new Set([
  "evidenceType",
  "linkedGate",
  "title",
  "note",
  "reviewed",
])

const UPDATE_TITLE_MAX_LENGTH = 200
const UPDATE_NOTE_MAX_LENGTH = 5000

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
const EVIDENCE_COMMAND_ALLOWED_FIELDS = new Set([
  "evidenceType",
  "linkedInvestorShieldGate",
  "linkedProfessionalGate",
  "title",
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function normalizeTrimmedText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeEvidenceLiteStatus(value: unknown): EvidenceLiteStatus | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return EVIDENCE_LITE_STATUS_SET.has(trimmed) ? (trimmed as EvidenceLiteStatus) : undefined
}

function normalizeEvidenceLiteEvidenceType(value: unknown): EvidenceLiteEvidenceType | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return EVIDENCE_LITE_EVIDENCE_TYPE_SET.has(trimmed)
    ? (trimmed as EvidenceLiteEvidenceType)
    : undefined
}

function normalizeControlledEnum<T extends string>(
  value: unknown,
  allowedValues: ReadonlySet<string>
): T | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return allowedValues.has(trimmed) ? (trimmed as T) : undefined
}

function normalizeOptionalTextField(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isDateLikeString(value: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yearText, monthText, dayText] = value.split("-")
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const date = new Date(Date.UTC(year, month - 1, day))

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    )
  }

  return !Number.isNaN(Date.parse(value))
}

function normalizeOptionalDateLikeField(value: unknown): string | null | undefined {
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

  return isDateLikeString(trimmed) ? trimmed : undefined
}

function normalizeDefaultedEnumField<T extends string>(
  value: unknown,
  allowedValues: ReadonlySet<string>,
  defaultValue: T
): T | undefined {
  if (value === undefined || value === null) {
    return defaultValue
  }

  return normalizeControlledEnum<T>(value, allowedValues)
}

function normalizeEvidenceCommandType(value: unknown): EvidenceCommandType | undefined {
  return normalizeControlledEnum<EvidenceCommandType>(value, EVIDENCE_COMMAND_TYPE_SET)
}

function normalizeInvestorShieldGateKey(value: unknown): InvestorShieldGateKey | undefined {
  return normalizeControlledEnum<InvestorShieldGateKey>(value, INVESTOR_SHIELD_GATE_SET)
}

function pushError(
  errors: EvidenceLiteValidationError[],
  field: string,
  message: string
): void {
  errors.push({ field, message })
}

function validateRequiredText(
  input: Record<string, unknown>,
  field: "dealId" | "title" | "note",
  errors: EvidenceLiteValidationError[]
): string | undefined {
  const normalized = normalizeTrimmedText(input[field])
  if (!normalized) {
    pushError(errors, field, `${field} must be a non-empty string`)
    return undefined
  }

  return normalized
}

function validateKnownFields(
  input: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
  errors: EvidenceLiteValidationError[]
): void {
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      pushError(errors, field, `unexpected field: ${field}`)
    }
  }
}

export function normalizeEvidenceLiteGateKey(value: unknown): EvidenceLiteGateKey | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  if (trimmed === "SOLICITOR_FEEDBACK") {
    return "SOLICITOR_REVIEW"
  }

  return EVIDENCE_LITE_GATE_SET.has(trimmed) ? (trimmed as EvidenceLiteGateKey) : undefined
}

export function validateCreateEvidenceLiteInput(
  input: unknown
): EvidenceLiteValidationResult<NormalizedCreateEvidenceLiteInput> {
  const errors: EvidenceLiteValidationError[] = []
  if (!isPlainObject(input)) {
    return {
      valid: false,
      errors: [{ field: "root", message: "input must be a plain object" }],
      warnings: [],
    }
  }

  validateKnownFields(input, CREATE_ALLOWED_FIELDS, errors)

  const dealId = validateRequiredText(input, "dealId", errors)
  const evidenceType = normalizeEvidenceLiteEvidenceType(input.evidenceType)
  if (!evidenceType) {
    pushError(
      errors,
      "evidenceType",
      `evidenceType must be one of: ${EVIDENCE_LITE_EVIDENCE_TYPES.join(", ")}`
    )
  }

  const linkedGate = normalizeEvidenceLiteGateKey(input.linkedGate)
  if (!linkedGate) {
    pushError(
      errors,
      "linkedGate",
      `linkedGate must be one of: ${EVIDENCE_LITE_GATES.join(", ")}`
    )
  }

  const title = validateRequiredText(input, "title", errors)
  const note = validateRequiredText(input, "note", errors)

  const status = normalizeEvidenceLiteStatus(input.status)
  if (!status) {
    pushError(errors, "status", `status must be one of: ${EVIDENCE_LITE_STATUSES.join(", ")}`)
  }

  if (typeof input.reviewed !== "boolean") {
    pushError(errors, "reviewed", "reviewed must be a boolean")
  }

  if (errors.length > 0 || !dealId || !evidenceType || !linkedGate || !title || !note || !status) {
    return { valid: false, errors, warnings: [] }
  }

  return {
    valid: true,
    value: {
      dealId,
      evidenceType,
      linkedGate,
      title,
      note,
      status,
      reviewed: input.reviewed as boolean,
    },
    errors: [],
    warnings:
      typeof input.linkedGate === "string" && input.linkedGate.trim() === "SOLICITOR_FEEDBACK"
        ? ["linkedGate normalized from SOLICITOR_FEEDBACK to SOLICITOR_REVIEW"]
        : [],
  }
}

export function validateUpdateEvidenceLiteInput(
  input: unknown
): EvidenceLiteValidationResult<NormalizedUpdateEvidenceLiteInput> {
  const errors: EvidenceLiteValidationError[] = []
  if (!isPlainObject(input)) {
    return {
      valid: false,
      errors: [{ field: "root", message: "input must be a plain object" }],
      warnings: [],
    }
  }

  validateKnownFields(input, UPDATE_ALLOWED_FIELDS, errors)
  if ("id" in input) {
    pushError(errors, "id", "id is immutable")
  }
  if ("dealId" in input) {
    pushError(errors, "dealId", "dealId is immutable")
  }
  if ("evidenceId" in input) {
    pushError(errors, "evidenceId", "evidenceId is immutable")
  }
  if ("createdAt" in input) {
    pushError(errors, "createdAt", "createdAt is immutable")
  }
  if ("updatedAt" in input) {
    pushError(errors, "updatedAt", "updatedAt is immutable")
  }

  const normalized: NormalizedUpdateEvidenceLiteInput = {}
  let linkedGateAliasNormalized = false

  const evidenceType = normalizeEvidenceLiteEvidenceType(input.evidenceType)
  if (input.evidenceType !== undefined) {
    if (!evidenceType) {
      pushError(
        errors,
        "evidenceType",
        `evidenceType must be one of: ${EVIDENCE_LITE_EVIDENCE_TYPES.join(", ")}`
      )
    } else {
      normalized.evidenceType = evidenceType
    }
  }

  const linkedGate = normalizeEvidenceLiteGateKey(input.linkedGate)
  if (input.linkedGate !== undefined) {
    if (!linkedGate) {
      pushError(
        errors,
        "linkedGate",
        `linkedGate must be one of: ${EVIDENCE_LITE_GATES.join(", ")}`
      )
    } else {
      normalized.linkedGate = linkedGate
      linkedGateAliasNormalized =
        typeof input.linkedGate === "string" && input.linkedGate.trim() === "SOLICITOR_FEEDBACK"
    }
  }

  const title = normalizeTrimmedText(input.title)
  if (input.title !== undefined) {
    if (!title) {
      pushError(errors, "title", "title must be a non-empty string")
    } else if (title.length > UPDATE_TITLE_MAX_LENGTH) {
      pushError(
        errors,
        "title",
        `title must be ${UPDATE_TITLE_MAX_LENGTH} characters or fewer`
      )
    } else {
      normalized.title = title
    }
  }

  const note = normalizeTrimmedText(input.note)
  if (input.note !== undefined) {
    if (!note) {
      pushError(errors, "note", "note must be a non-empty string")
    } else if (note.length > UPDATE_NOTE_MAX_LENGTH) {
      pushError(errors, "note", `note must be ${UPDATE_NOTE_MAX_LENGTH} characters or fewer`)
    } else {
      normalized.note = note
    }
  }

  if (input.reviewed !== undefined) {
    if (typeof input.reviewed !== "boolean") {
      pushError(errors, "reviewed", "reviewed must be a boolean")
    } else {
      normalized.reviewed = input.reviewed
    }
  }

  const hasMutation = Object.keys(normalized).length > 0
  if (!hasMutation) {
    pushError(errors, "root", "update input must include at least one mutable field")
  }

  if (errors.length > 0 || !hasMutation) {
    return { valid: false, errors, warnings: [] }
  }

  return {
    valid: true,
    value: normalized,
    errors: [],
    warnings: linkedGateAliasNormalized
      ? ["linkedGate normalized from SOLICITOR_FEEDBACK to SOLICITOR_REVIEW"]
      : [],
  }
}

export function validateEvidenceCommandInput(
  input: unknown
): EvidenceLiteValidationResult<NormalizedEvidenceCommandInput> {
  const errors: EvidenceLiteValidationError[] = []
  if (!isPlainObject(input)) {
    return {
      valid: false,
      errors: [{ field: "root", message: "input must be a plain object" }],
      warnings: [],
    }
  }

  validateKnownFields(input, EVIDENCE_COMMAND_ALLOWED_FIELDS, errors)

  const evidenceType = normalizeEvidenceCommandType(input.evidenceType)
  if (!evidenceType) {
    pushError(
      errors,
      "evidenceType",
      `evidenceType must be one of: ${EVIDENCE_COMMAND_TYPES.join(", ")}`
    )
  }

  const linkedInvestorShieldGate = normalizeInvestorShieldGateKey(input.linkedInvestorShieldGate)
  if (!linkedInvestorShieldGate) {
    pushError(
      errors,
      "linkedInvestorShieldGate",
      `linkedInvestorShieldGate must be one of: ${INVESTOR_SHIELD_GATE_KEYS.join(", ")}`
    )
  }

  const linkedProfessionalGate = normalizeDefaultedEnumField<EvidenceCommandProfessionalGate>(
    input.linkedProfessionalGate,
    EVIDENCE_COMMAND_PROFESSIONAL_GATE_SET,
    EVIDENCE_COMMAND_DEFAULTS.linkedProfessionalGate
  )
  if (!linkedProfessionalGate) {
    pushError(
      errors,
      "linkedProfessionalGate",
      `linkedProfessionalGate must be one of: ${EVIDENCE_COMMAND_PROFESSIONAL_GATES.join(", ")}`
    )
  }

  const title = normalizeTrimmedText(input.title)
  if (!title) {
    pushError(errors, "title", "title must be a non-empty string")
  }

  const evidenceSummary = normalizeTrimmedText(input.evidenceSummary)
  if (!evidenceSummary) {
    pushError(errors, "evidenceSummary", "evidenceSummary must be a non-empty string")
  }

  const evidenceStatus = normalizeDefaultedEnumField<EvidenceCommandStatus>(
    input.evidenceStatus,
    EVIDENCE_COMMAND_STATUS_SET,
    EVIDENCE_COMMAND_DEFAULTS.evidenceStatus
  )
  if (!evidenceStatus) {
    pushError(
      errors,
      "evidenceStatus",
      `evidenceStatus must be one of: ${EVIDENCE_COMMAND_STATUSES.join(", ")}`
    )
  }

  const evidenceStrength = normalizeDefaultedEnumField<EvidenceCommandStrength>(
    input.evidenceStrength,
    EVIDENCE_COMMAND_STRENGTH_SET,
    EVIDENCE_COMMAND_DEFAULTS.evidenceStrength
  )
  if (!evidenceStrength) {
    pushError(
      errors,
      "evidenceStrength",
      `evidenceStrength must be one of: ${EVIDENCE_COMMAND_STRENGTHS.join(", ")}`
    )
  }

  const reviewState = normalizeDefaultedEnumField<EvidenceCommandReviewState>(
    input.reviewState,
    EVIDENCE_COMMAND_REVIEW_STATE_SET,
    EVIDENCE_COMMAND_DEFAULTS.reviewState
  )
  if (!reviewState) {
    pushError(
      errors,
      "reviewState",
      `reviewState must be one of: ${EVIDENCE_COMMAND_REVIEW_STATES.join(", ")}`
    )
  }

  const blockerImpact = normalizeDefaultedEnumField<EvidenceCommandBlockerImpact>(
    input.blockerImpact,
    EVIDENCE_COMMAND_BLOCKER_IMPACT_SET,
    EVIDENCE_COMMAND_DEFAULTS.blockerImpact
  )
  if (!blockerImpact) {
    pushError(
      errors,
      "blockerImpact",
      `blockerImpact must be one of: ${EVIDENCE_COMMAND_BLOCKER_IMPACTS.join(", ")}`
    )
  }

  const recommendedNextAction = normalizeOptionalTextField(input.recommendedNextAction)
  if (recommendedNextAction === undefined) {
    pushError(errors, "recommendedNextAction", "recommendedNextAction must be a string or null")
  }

  const expiryOrUpdateDate = normalizeOptionalDateLikeField(input.expiryOrUpdateDate)
  if (expiryOrUpdateDate === undefined) {
    pushError(
      errors,
      "expiryOrUpdateDate",
      "expiryOrUpdateDate must be a date-like string when provided"
    )
  }

  const source = normalizeOptionalTextField(input.source)
  if (source === undefined) {
    pushError(errors, "source", "source must be a string or null")
  }

  const mobileCaptureNote = normalizeOptionalTextField(input.mobileCaptureNote)
  if (mobileCaptureNote === undefined) {
    pushError(errors, "mobileCaptureNote", "mobileCaptureNote must be a string or null")
  }

  if (
    errors.length > 0 ||
    !evidenceType ||
    !linkedInvestorShieldGate ||
    !linkedProfessionalGate ||
    !title ||
    !evidenceSummary ||
    !evidenceStatus ||
    !evidenceStrength ||
    !reviewState ||
    !blockerImpact ||
    recommendedNextAction === undefined ||
    expiryOrUpdateDate === undefined ||
    source === undefined ||
    mobileCaptureNote === undefined
  ) {
    return { valid: false, errors, warnings: [] }
  }

  return {
    valid: true,
    value: {
      evidenceType,
      linkedInvestorShieldGate,
      linkedProfessionalGate,
      title,
      evidenceSummary,
      evidenceStatus,
      evidenceStrength,
      reviewState,
      blockerImpact,
      recommendedNextAction,
      expiryOrUpdateDate,
      source,
      mobileCaptureNote,
    },
    errors: [],
    warnings: [],
  }
}

export function normalizeEvidenceCommandInput(
  input: EvidenceCommandInput | null | undefined
): NormalizedEvidenceCommandInput | undefined {
  const result = validateEvidenceCommandInput(input)
  return result.valid ? result.value : undefined
}

export { normalizeEvidenceLiteEvidenceType, normalizeEvidenceLiteStatus, normalizeTrimmedText }
