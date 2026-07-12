import {
  FINAL_DECISION_LOCK_STATUSES,
  PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS,
  PROFESSIONAL_EVIDENCE_REVIEW_SOURCES,
  PROFESSIONAL_GATE_AREAS,
  PROFESSIONAL_GATE_STATUSES,
  PROFESSIONAL_READINESS_STATUSES,
  type FinalDecisionLockStatus,
  type ProfessionalEvidenceReviewSource,
  type ProfessionalGateArea,
  type ProfessionalGateStatus,
  type ProfessionalReadiness,
} from "@/types/professional-evidence-gateway"

export type ProfessionalEvidenceGatewayValidationError = {
  field: string
  message: string
}

export type ProfessionalEvidenceGatewayValidationResult<T> = {
  valid: boolean
  value?: T
  errors: readonly ProfessionalEvidenceGatewayValidationError[]
  warnings: readonly string[]
}

export type ProfessionalEvidenceGatewayDraftInput = {
  savedDealId?: unknown
  linkedEvidenceCommandEvidenceId?: unknown
  linkedInvestorShieldGate?: unknown
  professionalGateArea?: unknown
  professionalGateStatus?: unknown
  professionalReadiness?: unknown
  reviewState?: unknown
  blockerImpact?: unknown
  evidenceStrength?: unknown
  requiredEvidenceSummary?: unknown
  professionalConfirmationSummary?: unknown
  recommendedNextAction?: unknown
  expiryOrReviewDate?: unknown
  finalDecisionLockStatus?: unknown
  lockReason?: unknown
  reviewSource?: unknown
  linkedEvidenceIds?: unknown
}

export type NormalizedProfessionalEvidenceGatewayDraft = {
  savedDealId: string
  linkedEvidenceCommandEvidenceId: string | null
  linkedInvestorShieldGate: string
  professionalGateArea: ProfessionalGateArea
  professionalGateStatus: ProfessionalGateStatus
  professionalReadiness: ProfessionalReadiness
  reviewState: string
  blockerImpact: string
  evidenceStrength: string
  requiredEvidenceSummary: string
  professionalConfirmationSummary: string
  recommendedNextAction: string
  expiryOrReviewDate: string | null
  finalDecisionLockStatus: FinalDecisionLockStatus
  lockReason: string
  reviewSource: ProfessionalEvidenceReviewSource
  linkedEvidenceIds: readonly string[]
}

const PROFESSIONAL_GATE_AREA_SET = new Set<string>(PROFESSIONAL_GATE_AREAS)
const PROFESSIONAL_GATE_STATUS_SET = new Set<string>(PROFESSIONAL_GATE_STATUSES)
const PROFESSIONAL_READINESS_SET = new Set<string>(PROFESSIONAL_READINESS_STATUSES)
const FINAL_DECISION_LOCK_STATUS_SET = new Set<string>(FINAL_DECISION_LOCK_STATUSES)
const PROFESSIONAL_EVIDENCE_REVIEW_SOURCE_SET = new Set<string>(PROFESSIONAL_EVIDENCE_REVIEW_SOURCES)

const DRAFT_ALLOWED_FIELDS = new Set([
  "savedDealId",
  "linkedEvidenceCommandEvidenceId",
  "linkedInvestorShieldGate",
  "professionalGateArea",
  "professionalGateStatus",
  "professionalReadiness",
  "reviewState",
  "blockerImpact",
  "evidenceStrength",
  "requiredEvidenceSummary",
  "professionalConfirmationSummary",
  "recommendedNextAction",
  "expiryOrReviewDate",
  "finalDecisionLockStatus",
  "lockReason",
  "reviewSource",
  "linkedEvidenceIds",
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function pushError(
  errors: ProfessionalEvidenceGatewayValidationError[],
  field: string,
  message: string
): void {
  errors.push({ field, message })
}

function validateKnownFields(
  input: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
  errors: ProfessionalEvidenceGatewayValidationError[]
): void {
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      pushError(errors, field, `unexpected field: ${field}`)
    }
  }
}

function normalizeTrimmedText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
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

  return isDateLikeString(trimmed) ? trimmed : undefined
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

function normalizeStringArray(value: unknown): readonly string[] | undefined {
  if (value === undefined || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    return undefined
  }

  const normalized: string[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (typeof entry !== "string") {
      return undefined
    }

    const trimmed = entry.trim()
    if (trimmed.length === 0) {
      return undefined
    }

    if (!seen.has(trimmed)) {
      seen.add(trimmed)
      normalized.push(trimmed)
    }
  }

  return normalized
}

function validateRequiredText(
  input: Record<string, unknown>,
  field: keyof Pick<
    ProfessionalEvidenceGatewayDraftInput,
    | "savedDealId"
    | "linkedInvestorShieldGate"
    | "reviewState"
    | "blockerImpact"
    | "evidenceStrength"
    | "requiredEvidenceSummary"
    | "professionalConfirmationSummary"
    | "recommendedNextAction"
    | "lockReason"
  >,
  errors: ProfessionalEvidenceGatewayValidationError[]
): string | undefined {
  const normalized = normalizeTrimmedText(input[field])
  if (!normalized) {
    pushError(errors, field, `${String(field)} must be a non-empty string`)
    return undefined
  }

  return normalized
}

export function validateProfessionalGateArea(
  value: unknown
): ProfessionalGateArea | undefined {
  return normalizeControlledEnum<ProfessionalGateArea>(value, PROFESSIONAL_GATE_AREA_SET)
}

export function validateProfessionalGateStatus(
  value: unknown
): ProfessionalGateStatus | undefined {
  return normalizeControlledEnum<ProfessionalGateStatus>(value, PROFESSIONAL_GATE_STATUS_SET)
}

export function validateProfessionalReadiness(
  value: unknown
): ProfessionalReadiness | undefined {
  return normalizeControlledEnum<ProfessionalReadiness>(value, PROFESSIONAL_READINESS_SET)
}

export function validateFinalDecisionLockStatus(
  value: unknown
): FinalDecisionLockStatus | undefined {
  return normalizeControlledEnum<FinalDecisionLockStatus>(
    value,
    FINAL_DECISION_LOCK_STATUS_SET
  )
}

export function validateProfessionalEvidenceReviewSource(
  value: unknown
): ProfessionalEvidenceReviewSource | undefined {
  return normalizeControlledEnum<ProfessionalEvidenceReviewSource>(
    value,
    PROFESSIONAL_EVIDENCE_REVIEW_SOURCE_SET
  )
}

export function validateProfessionalEvidenceGatewayDraft(
  input: unknown
): ProfessionalEvidenceGatewayValidationResult<NormalizedProfessionalEvidenceGatewayDraft> {
  const errors: ProfessionalEvidenceGatewayValidationError[] = []
  if (!isPlainObject(input)) {
    return {
      valid: false,
      errors: [{ field: "root", message: "input must be a plain object" }],
      warnings: [],
    }
  }

  validateKnownFields(input, DRAFT_ALLOWED_FIELDS, errors)

  const savedDealId = validateRequiredText(input, "savedDealId", errors)
  const linkedEvidenceCommandEvidenceId = normalizeOptionalText(
    input.linkedEvidenceCommandEvidenceId
  )
  if (linkedEvidenceCommandEvidenceId === undefined) {
    pushError(
      errors,
      "linkedEvidenceCommandEvidenceId",
      "linkedEvidenceCommandEvidenceId must be a string or null"
    )
  }

  const linkedInvestorShieldGate = validateRequiredText(
    input,
    "linkedInvestorShieldGate",
    errors
  )
  const professionalGateArea = validateProfessionalGateArea(input.professionalGateArea)
  if (!professionalGateArea) {
    pushError(
      errors,
      "professionalGateArea",
      `professionalGateArea must be one of: ${PROFESSIONAL_GATE_AREAS.join(", ")}`
    )
  }

  const professionalGateStatus = validateProfessionalGateStatus(input.professionalGateStatus)
  if (!professionalGateStatus && input.professionalGateStatus !== undefined) {
    pushError(
      errors,
      "professionalGateStatus",
      `professionalGateStatus must be one of: ${PROFESSIONAL_GATE_STATUSES.join(", ")}`
    )
  }

  const professionalReadiness = validateProfessionalReadiness(input.professionalReadiness)
  if (!professionalReadiness && input.professionalReadiness !== undefined) {
    pushError(
      errors,
      "professionalReadiness",
      `professionalReadiness must be one of: ${PROFESSIONAL_READINESS_STATUSES.join(", ")}`
    )
  }

  const reviewState = validateRequiredText(input, "reviewState", errors)
  const blockerImpact = validateRequiredText(input, "blockerImpact", errors)
  const evidenceStrength = validateRequiredText(input, "evidenceStrength", errors)
  const requiredEvidenceSummary = validateRequiredText(
    input,
    "requiredEvidenceSummary",
    errors
  )
  const professionalConfirmationSummary = validateRequiredText(
    input,
    "professionalConfirmationSummary",
    errors
  )
  const recommendedNextAction = validateRequiredText(
    input,
    "recommendedNextAction",
    errors
  )
  const expiryOrReviewDate = normalizeOptionalDateLike(input.expiryOrReviewDate)
  if (expiryOrReviewDate === undefined) {
    pushError(
      errors,
      "expiryOrReviewDate",
      "expiryOrReviewDate must be a date-like string when provided"
    )
  }

  const finalDecisionLockStatus = validateFinalDecisionLockStatus(
    input.finalDecisionLockStatus
  )
  if (!finalDecisionLockStatus && input.finalDecisionLockStatus !== undefined) {
    pushError(
      errors,
      "finalDecisionLockStatus",
      `finalDecisionLockStatus must be one of: ${FINAL_DECISION_LOCK_STATUSES.join(", ")}`
    )
  }

  const lockReason = validateRequiredText(input, "lockReason", errors)
  const reviewSource = validateProfessionalEvidenceReviewSource(input.reviewSource)
  if (!reviewSource && input.reviewSource !== undefined) {
    pushError(
      errors,
      "reviewSource",
      `reviewSource must be one of: ${PROFESSIONAL_EVIDENCE_REVIEW_SOURCES.join(", ")}`
    )
  }

  const linkedEvidenceIds = normalizeStringArray(input.linkedEvidenceIds)
  if (linkedEvidenceIds === undefined) {
    pushError(
      errors,
      "linkedEvidenceIds",
      "linkedEvidenceIds must be an array of non-empty strings when provided"
    )
  }

  const normalizedProfessionalGateStatus =
    professionalGateStatus ?? PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.professionalGateStatus
  const normalizedProfessionalReadiness =
    professionalReadiness ?? PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.professionalReadiness
  const normalizedFinalDecisionLockStatus =
    finalDecisionLockStatus ?? PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.finalDecisionLockStatus
  const normalizedReviewSource = reviewSource ?? "OPERATOR_NOTE"

  if (
    errors.length > 0 ||
    !savedDealId ||
    linkedEvidenceCommandEvidenceId === undefined ||
    !linkedInvestorShieldGate ||
    !professionalGateArea ||
    !reviewState ||
    !blockerImpact ||
    !evidenceStrength ||
    !requiredEvidenceSummary ||
    !professionalConfirmationSummary ||
    !recommendedNextAction ||
    expiryOrReviewDate === undefined ||
    !lockReason ||
    !linkedEvidenceIds ||
    !normalizedReviewSource
  ) {
    return { valid: false, errors, warnings: [] }
  }

  return {
    valid: true,
    value: {
      savedDealId,
      linkedEvidenceCommandEvidenceId,
      linkedInvestorShieldGate,
      professionalGateArea,
      professionalGateStatus: normalizedProfessionalGateStatus,
      professionalReadiness: normalizedProfessionalReadiness,
      reviewState,
      blockerImpact,
      evidenceStrength,
      requiredEvidenceSummary,
      professionalConfirmationSummary,
      recommendedNextAction,
      expiryOrReviewDate,
      finalDecisionLockStatus: normalizedFinalDecisionLockStatus,
      lockReason,
      reviewSource: normalizedReviewSource,
      linkedEvidenceIds,
    },
    errors: [],
    warnings: [],
  }
}

export function normalizeProfessionalEvidenceGatewayDraft(
  input: ProfessionalEvidenceGatewayDraftInput | null | undefined
): NormalizedProfessionalEvidenceGatewayDraft | undefined {
  const result = validateProfessionalEvidenceGatewayDraft(input)
  return result.valid ? result.value : undefined
}

