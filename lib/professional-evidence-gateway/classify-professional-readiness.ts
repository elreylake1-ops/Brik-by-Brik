import { isProfessionalEvidenceReviewSourceQualifyingForGate } from "@/lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility"
import type {
  EvidenceCommandBlockerImpact,
  EvidenceCommandProfessionalGate,
  EvidenceCommandReviewState,
  EvidenceCommandStatus,
  EvidenceCommandStrength,
  EvidenceCommandType,
} from "@/types/evidence-lite"
import type {
  ProfessionalEvidenceReviewSource,
  ProfessionalGateArea,
  ProfessionalReadinessPresentationState,
} from "@/types/professional-evidence-gateway"
import { PROFESSIONAL_READINESS_PRESENTATION_STATES } from "@/types/professional-evidence-gateway"

export const PROFESSIONAL_READINESS_CLASSIFIER_STATES =
  PROFESSIONAL_READINESS_PRESENTATION_STATES

export type ProfessionalReadinessClassifierState = ProfessionalReadinessPresentationState

export type ProfessionalReadinessClassifierInput = {
  readonly linkedInvestorShieldGate: string | null
  readonly professionalGateArea: ProfessionalGateArea
  readonly evidenceType: EvidenceCommandType
  readonly linkedProfessionalGate: EvidenceCommandProfessionalGate
  readonly reviewSource: ProfessionalEvidenceReviewSource | null
  readonly evidenceStatus: EvidenceCommandStatus
  readonly evidenceStrength: EvidenceCommandStrength
  readonly reviewState: EvidenceCommandReviewState
  readonly blockerImpact: EvidenceCommandBlockerImpact
  readonly expiryOrUpdateDate: string | null
}

export type ProfessionalReadinessClassifierOptions = {
  readonly referenceDate?: string | null
}

const ACTIVE_EVIDENCE_STATUSES = new Set<EvidenceCommandStatus>([
  "RECEIVED",
  "REVIEWED",
  "SUFFICIENT",
  "INSUFFICIENT",
])

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28
    case 4:
    case 6:
    case 9:
    case 11:
      return 30
    default:
      return 31
  }
}

function parseIsoCompatibleDate(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1])
    const month = Number(dateOnlyMatch[2])
    const day = Number(dateOnlyMatch[3])

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth(year, month)
    ) {
      return null
    }

    return Date.UTC(year, month - 1, day)
  }

  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

function classifyExpiry(
  input: ProfessionalReadinessClassifierInput,
  referenceDate: string | null | undefined
): Extract<
  ProfessionalReadinessClassifierState,
  "EXPIRED" | "MANUAL_REVIEW_REQUIRED"
> | null {
  if (input.evidenceStatus === "EXPIRED") {
    return "EXPIRED"
  }

  if (input.expiryOrUpdateDate === null) {
    return null
  }

  const expiryTimestamp = parseIsoCompatibleDate(input.expiryOrUpdateDate)
  if (expiryTimestamp === null) {
    return "MANUAL_REVIEW_REQUIRED"
  }

  if (referenceDate === undefined || referenceDate === null) {
    return "MANUAL_REVIEW_REQUIRED"
  }

  const referenceTimestamp = parseIsoCompatibleDate(referenceDate)
  if (referenceTimestamp === null) {
    return "MANUAL_REVIEW_REQUIRED"
  }

  return expiryTimestamp < referenceTimestamp ? "EXPIRED" : null
}

function hasQualifyingReviewSource(
  input: ProfessionalReadinessClassifierInput
): boolean {
  return (
    input.reviewSource !== null &&
    isProfessionalEvidenceReviewSourceQualifyingForGate(
      input.professionalGateArea,
      input.reviewSource
    )
  )
}

function isExplicitProfessionalConfirmation(
  input: ProfessionalReadinessClassifierInput
): boolean {
  return (
    input.evidenceStatus === "SUFFICIENT" &&
    input.reviewState === "PROFESSIONAL_CONFIRMED"
  )
}

function hasConflictingConfirmationSignals(
  input: ProfessionalReadinessClassifierInput
): boolean {
  return (
    input.reviewState === "PROFESSIONAL_CONFIRMED" &&
    input.evidenceStatus !== "SUFFICIENT"
  )
}

function isWeakOrNonConfirming(
  input: ProfessionalReadinessClassifierInput
): boolean {
  if (input.evidenceStatus === "INSUFFICIENT") {
    return true
  }

  if (input.evidenceStrength === "WEAK") {
    return true
  }

  if (input.reviewState === "REVIEWED_BY_OPERATOR") {
    return true
  }

  if (!ACTIVE_EVIDENCE_STATUSES.has(input.evidenceStatus)) {
    return false
  }

  return !hasQualifyingReviewSource(input)
}

export function classifyProfessionalReadiness(
  input: ProfessionalReadinessClassifierInput,
  options: ProfessionalReadinessClassifierOptions = {}
): ProfessionalReadinessClassifierState {
  if (
    input.evidenceStatus === "REJECTED" ||
    input.blockerImpact === "BLOCKS_PROGRESSION"
  ) {
    return "ADVERSE"
  }

  const expiryClassification = classifyExpiry(input, options.referenceDate)
  if (expiryClassification !== null) {
    return expiryClassification
  }

  if (
    input.evidenceStatus === "MISSING" ||
    input.evidenceStatus === "REQUESTED"
  ) {
    return "MISSING"
  }

  if (
    input.blockerImpact === "REQUIRES_MANUAL_REVIEW" ||
    hasConflictingConfirmationSignals(input)
  ) {
    return "MANUAL_REVIEW_REQUIRED"
  }

  if (isWeakOrNonConfirming(input)) {
    return "WEAK_OR_NON_CONFIRMING"
  }

  if (isExplicitProfessionalConfirmation(input) && hasQualifyingReviewSource(input)) {
    return "PROFESSIONALLY_CONFIRMED"
  }

  if (
    ACTIVE_EVIDENCE_STATUSES.has(input.evidenceStatus) &&
    hasQualifyingReviewSource(input) &&
    input.reviewState !== "PROFESSIONAL_CONFIRMED"
  ) {
    return "READY_FOR_REVIEW"
  }

  return "MANUAL_REVIEW_REQUIRED"
}
