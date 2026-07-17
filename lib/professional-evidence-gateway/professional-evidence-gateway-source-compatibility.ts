import {
  PROFESSIONAL_EVIDENCE_REVIEW_SOURCES,
  PROFESSIONAL_GATE_AREAS,
  type ProfessionalEvidenceReviewSource,
  type ProfessionalGateArea,
} from "@/types/professional-evidence-gateway"

export type ProfessionalGateSourceCompatibilityError = {
  readonly field: "professionalGateArea" | "reviewSource"
  readonly message: string
}

export type ProfessionalGateSourceCompatibilityResult = {
  readonly compatible: boolean
  readonly errors: readonly ProfessionalGateSourceCompatibilityError[]
}

const PROFESSIONAL_GATE_AREA_SET = new Set<string>(PROFESSIONAL_GATE_AREAS)
const PROFESSIONAL_EVIDENCE_REVIEW_SOURCE_SET = new Set<string>(
  PROFESSIONAL_EVIDENCE_REVIEW_SOURCES
)

const PROFESSIONAL_GATE_SOURCE_COMPATIBILITY = {
  SOLICITOR_REVIEW: ["SOLICITOR", "LAND_REGISTRY"],
  LEASEHOLD_ADVICE: ["SOLICITOR", "LAND_REGISTRY"],
  BROKER_LENDER_CONFIRMATION: ["BROKER", "LENDER"],
  BUILDER_QUOTE_CONFIRMATION: ["BUILDER", "SURVEYOR"],
  SURVEYOR_REPORT: ["SURVEYOR"],
  SOLD_COMPARABLE_REVIEW: ["SURVEYOR", "SOLICITOR", "LAND_REGISTRY"],
} as const satisfies Record<
  ProfessionalGateArea,
  readonly ProfessionalEvidenceReviewSource[]
>

function normalizeProfessionalGateArea(
  area: unknown
): ProfessionalGateArea | undefined {
  if (typeof area !== "string") {
    return undefined
  }

  const trimmed = area.trim()
  return PROFESSIONAL_GATE_AREA_SET.has(trimmed)
    ? (trimmed as ProfessionalGateArea)
    : undefined
}

function normalizeProfessionalEvidenceReviewSource(
  source: unknown
): ProfessionalEvidenceReviewSource | undefined {
  if (typeof source !== "string") {
    return undefined
  }

  const trimmed = source.trim()
  return PROFESSIONAL_EVIDENCE_REVIEW_SOURCE_SET.has(trimmed)
    ? (trimmed as ProfessionalEvidenceReviewSource)
    : undefined
}

export function getQualifyingReviewSourcesForGate(
  area: ProfessionalGateArea
): readonly ProfessionalEvidenceReviewSource[] {
  return [...PROFESSIONAL_GATE_SOURCE_COMPATIBILITY[area]]
}

export function getNonQualifyingReviewSourcesForGate(
  area: ProfessionalGateArea
): readonly ProfessionalEvidenceReviewSource[] {
  const qualifyingSources = new Set<ProfessionalEvidenceReviewSource>(
    PROFESSIONAL_GATE_SOURCE_COMPATIBILITY[area]
  )

  return PROFESSIONAL_EVIDENCE_REVIEW_SOURCES.filter(
    (source) => !qualifyingSources.has(source)
  )
}

export function isProfessionalEvidenceReviewSourceQualifyingForGate(
  area: unknown,
  source: unknown
): source is ProfessionalEvidenceReviewSource {
  const normalizedArea = normalizeProfessionalGateArea(area)
  const normalizedSource = normalizeProfessionalEvidenceReviewSource(source)

  if (!normalizedArea || !normalizedSource) {
    return false
  }

  const qualifyingSources = new Set<ProfessionalEvidenceReviewSource>(
    PROFESSIONAL_GATE_SOURCE_COMPATIBILITY[normalizedArea]
  )

  return qualifyingSources.has(normalizedSource)
}

export function assertProfessionalGateSourceCompatibility(
  area: unknown,
  source: unknown
): ProfessionalGateSourceCompatibilityResult {
  const errors: ProfessionalGateSourceCompatibilityError[] = []
  const normalizedArea = normalizeProfessionalGateArea(area)
  const normalizedSource = normalizeProfessionalEvidenceReviewSource(source)

  if (!normalizedArea) {
    errors.push({
      field: "professionalGateArea",
      message: `professionalGateArea must be one of: ${PROFESSIONAL_GATE_AREAS.join(", ")}`,
    })
  }

  if (!normalizedSource) {
    errors.push({
      field: "reviewSource",
      message: `reviewSource must be one of: ${PROFESSIONAL_EVIDENCE_REVIEW_SOURCES.join(", ")}`,
    })
  }

  if (normalizedArea && normalizedSource) {
    const compatible =
      isProfessionalEvidenceReviewSourceQualifyingForGate(
        normalizedArea,
        normalizedSource
      )

    if (!compatible) {
      errors.push({
        field: "reviewSource",
        message: `reviewSource is not qualifying for professionalGateArea ${normalizedArea}`,
      })
    }
  }

  return {
    compatible: errors.length === 0,
    errors,
  }
}
