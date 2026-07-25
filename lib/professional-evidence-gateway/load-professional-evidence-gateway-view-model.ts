import {
  type ProfessionalEvidenceGatewayEvidenceInput,
  buildProfessionalEvidenceGatewayViewModel,
} from "@/lib/professional-evidence-gateway/professional-evidence-gateway-read-model"
import { classifyProfessionalReadiness } from "@/lib/professional-evidence-gateway/classify-professional-readiness"
import { normalizeEvidenceCommandInput } from "@/lib/evidence-lite/evidence-lite-validation"
import { validateProfessionalEvidenceReviewSource } from "@/lib/professional-evidence-gateway/professional-evidence-gateway-validation"
import type {
  FinalDecisionLockStatus,
  ProfessionalReadinessPresentation,
  ProfessionalReadinessPresentationState,
  ProfessionalEvidenceGatewayViewModel,
  ProfessionalEvidenceReviewSource,
  ProfessionalGateArea,
  ProfessionalGateStatus,
  ProfessionalReadiness,
} from "@/types/professional-evidence-gateway"

export type LoadedProfessionalEvidenceGatewayEvidence = {
  readonly id?: unknown
  readonly dealId?: unknown
  readonly evidenceType?: unknown
  readonly linkedGate?: unknown
  readonly linkedInvestorShieldGate?: unknown
  readonly evidenceCommandType?: unknown
  readonly title?: unknown
  readonly note?: unknown
  readonly evidenceSummary?: unknown
  readonly evidenceStatus?: unknown
  readonly evidenceStrength?: unknown
  readonly reviewState?: unknown
  readonly blockerImpact?: unknown
  readonly linkedProfessionalGate?: unknown
  readonly recommendedNextAction?: unknown
  readonly expiryOrUpdateDate?: unknown
  readonly source?: unknown
  readonly mobileCaptureNote?: unknown
}

export type LoadProfessionalEvidenceGatewayViewModelInput = {
  readonly savedDealId: unknown
  readonly evidence: readonly LoadedProfessionalEvidenceGatewayEvidence[]
  readonly finalDecisionLockStatus?: unknown
  readonly lockReason?: unknown
  readonly referenceDate?: unknown
}

const REVIEW_SOURCE_ALIASES: ReadonlyMap<string, ProfessionalEvidenceReviewSource> =
  new Map([
    ["OPERATOR_NOTE", "OPERATOR_NOTE"],
    ["OPERATOR", "OPERATOR_NOTE"],
    ["SOLICITOR", "SOLICITOR"],
    ["LEGAL", "SOLICITOR"],
    ["BROKER", "BROKER"],
    ["LENDER", "LENDER"],
    ["BUILDER", "BUILDER"],
    ["CONTRACTOR", "BUILDER"],
    ["SURVEYOR", "SURVEYOR"],
    ["STRUCTURAL_SURVEYOR", "SURVEYOR"],
    ["LAND_REGISTRY", "LAND_REGISTRY"],
    ["HM_LAND_REGISTRY", "LAND_REGISTRY"],
    ["RIGHTMOVE", "RIGHTMOVE_SOLD_DATA"],
    ["RIGHTMOVE_SOLD_DATA", "RIGHTMOVE_SOLD_DATA"],
    ["PORTAL_SOLD_DATA", "RIGHTMOVE_SOLD_DATA"],
    ["AGENT", "AGENT"],
    ["ESTATE_AGENT", "AGENT"],
    ["OTHER", "OTHER"],
  ])

const PROFESSIONAL_GATE_ALIASES: ReadonlyMap<string, ProfessionalGateArea> =
  new Map([
    ["SOLICITOR_REVIEW", "SOLICITOR_REVIEW"],
    ["SOLICITOR_TITLE_REVIEW", "SOLICITOR_REVIEW"],
    ["TITLE", "SOLICITOR_REVIEW"],
    ["TITLE_LEGAL", "SOLICITOR_REVIEW"],
    ["LEASEHOLD", "LEASEHOLD_ADVICE"],
    ["LEASEHOLD_ADVICE", "LEASEHOLD_ADVICE"],
    ["BROKER_CONFIRMATION", "BROKER_LENDER_CONFIRMATION"],
    ["LENDER_BROKER", "BROKER_LENDER_CONFIRMATION"],
    ["LENDER_BROKER_CONFIRMATION", "BROKER_LENDER_CONFIRMATION"],
    ["LENDER_CRITERIA", "BROKER_LENDER_CONFIRMATION"],
    ["BUILDER_QUOTE", "BUILDER_QUOTE_CONFIRMATION"],
    ["BUILDER_QUOTE_CONFIRMATION", "BUILDER_QUOTE_CONFIRMATION"],
    ["BUILDER_PROPOSAL_CONTRACT", "BUILDER_QUOTE_CONFIRMATION"],
    ["REFURB", "BUILDER_QUOTE_CONFIRMATION"],
    ["REFURB_CERTAINTY", "BUILDER_QUOTE_CONFIRMATION"],
    ["SURVEYOR_REPORT", "SURVEYOR_REPORT"],
    ["SURVEYOR_EVIDENCE", "SURVEYOR_REPORT"],
    ["DAMP_STRUCTURAL", "SURVEYOR_REPORT"],
    ["SPECIALIST_REPORT", "SURVEYOR_REPORT"],
    ["SOLD_COMPARABLE", "SOLD_COMPARABLE_REVIEW"],
    ["SOLD_COMPARABLE_REVIEW", "SOLD_COMPARABLE_REVIEW"],
    ["ACTUAL_SOLD_COMPARABLE_REVIEW", "SOLD_COMPARABLE_REVIEW"],
    ["SOLD_COMPS", "SOLD_COMPARABLE_REVIEW"],
  ])

const EVIDENCE_COMMAND_TYPE_ALIASES: ReadonlyMap<string, string> = new Map([
  ["SOLD_COMP", "SOLD_COMPARABLE"],
  ["TITLE_REVIEW", "TITLE_LEGAL"],
  ["LEASEHOLD_REVIEW", "LEASEHOLD"],
  ["REFURB_NOTE", "REFURB"],
  ["SURVEY_NOTE", "SURVEYOR_EVIDENCE"],
  ["LENDER_NOTE", "LENDER_BROKER"],
  ["AGENT_RESPONSE", "AGENT_RESPONSE"],
  ["SOLICITOR_REVIEW", "SOLICITOR_REVIEW"],
  ["PLANNING_BUILDING_CONTROL", "PLANNING_BUILDING_CONTROL"],
  ["BUILDER_QUOTE", "BUILDER_QUOTE"],
  ["OTHER", "OTHER"],
])

const PROFESSIONAL_GATE_TO_EVIDENCE_COMMAND_GATE: ReadonlyMap<ProfessionalGateArea, string> =
  new Map([
    ["SOLICITOR_REVIEW", "SOLICITOR_TITLE_REVIEW"],
    ["LEASEHOLD_ADVICE", "NONE"],
    ["BROKER_LENDER_CONFIRMATION", "LENDER_BROKER_CONFIRMATION"],
    ["BUILDER_QUOTE_CONFIRMATION", "BUILDER_QUOTE"],
    ["SURVEYOR_REPORT", "SURVEYOR_REPORT"],
    ["SOLD_COMPARABLE_REVIEW", "ACTUAL_SOLD_COMPARABLE_REVIEW"],
  ])

const PROFESSIONAL_GATE_TO_INVESTOR_SHIELD_GATE: ReadonlyMap<ProfessionalGateArea, string> =
  new Map([
    ["SOLICITOR_REVIEW", "SOLICITOR_REVIEW"],
    ["LEASEHOLD_ADVICE", "LEASEHOLD"],
    ["BROKER_LENDER_CONFIRMATION", "LENDER_CRITERIA"],
    ["BUILDER_QUOTE_CONFIRMATION", "REFURB_CERTAINTY"],
    ["SURVEYOR_REPORT", "DAMP_STRUCTURAL"],
    ["SOLD_COMPARABLE_REVIEW", "SOLD_COMPS"],
  ])

const PROFESSIONAL_READINESS_DISPLAY_LABELS: Record<
  ProfessionalReadinessPresentationState,
  string
> = {
  READY_FOR_REVIEW: "Ready for professional review",
  PROFESSIONALLY_CONFIRMED: "Professionally confirmed",
  WEAK_OR_NON_CONFIRMING: "Weak or non-confirming evidence",
  MISSING: "Professional evidence missing",
  ADVERSE: "Adverse professional finding",
  EXPIRED: "Professional evidence expired",
  MANUAL_REVIEW_REQUIRED: "Manual professional review required",
}

const PROFESSIONAL_READINESS_AUTHORITY_NOTICE =
  "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements."

const PROFESSIONAL_READINESS_EMPTY_SUMMARY =
  "No compatible professional evidence is currently available for review."

const PROFESSIONAL_READINESS_PRECEDENCE: readonly ProfessionalReadinessPresentationState[] = [
  "ADVERSE",
  "EXPIRED",
  "MISSING",
  "MANUAL_REVIEW_REQUIRED",
  "WEAK_OR_NON_CONFIRMING",
  "PROFESSIONALLY_CONFIRMED",
  "READY_FOR_REVIEW",
] as const

function normalizeToken(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed.toUpperCase().replace(/[-\s]+/g, "_") : undefined
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeNullableText(value: unknown): string | null {
  return normalizeText(value) ?? null
}

function mapEvidenceCommandType(
  evidence: LoadedProfessionalEvidenceGatewayEvidence
): string {
  const candidates = [evidence.evidenceCommandType, evidence.evidenceType]

  for (const candidate of candidates) {
    const token = normalizeToken(candidate)
    if (!token) {
      continue
    }

    const mapped = EVIDENCE_COMMAND_TYPE_ALIASES.get(token)
    if (mapped) {
      return mapped
    }
  }

  return "OTHER"
}

function mapEvidenceCommandProfessionalGate(
  evidence: LoadedProfessionalEvidenceGatewayEvidence,
  professionalGateArea: ProfessionalGateArea
): string {
  const explicitGate = normalizeToken(evidence.linkedProfessionalGate)
  if (explicitGate && explicitGate !== "NONE") {
    return explicitGate
  }

  return PROFESSIONAL_GATE_TO_EVIDENCE_COMMAND_GATE.get(professionalGateArea) ?? "NONE"
}

function mapInvestorShieldGate(
  evidence: LoadedProfessionalEvidenceGatewayEvidence,
  professionalGateArea: ProfessionalGateArea
): string {
  return (
    normalizeText(evidence.linkedInvestorShieldGate) ??
    normalizeText(evidence.linkedGate) ??
    PROFESSIONAL_GATE_TO_INVESTOR_SHIELD_GATE.get(professionalGateArea) ??
    "SOLICITOR_REVIEW"
  )
}

function mapReviewSource(
  evidence: LoadedProfessionalEvidenceGatewayEvidence
): ProfessionalEvidenceReviewSource {
  const explicitSource = normalizeToken(evidence.source)
  if (explicitSource) {
    const mappedSource = REVIEW_SOURCE_ALIASES.get(explicitSource)
    if (mappedSource) {
      return mappedSource
    }
  }

  const evidenceCommandType = normalizeToken(evidence.evidenceCommandType)
  if (evidenceCommandType === "AGENT_RESPONSE") {
    return "AGENT"
  }

  return "OPERATOR_NOTE"
}

function mapProfessionalGateArea(
  evidence: LoadedProfessionalEvidenceGatewayEvidence
): ProfessionalGateArea | undefined {
  const candidates = [
    evidence.linkedProfessionalGate,
    evidence.linkedInvestorShieldGate,
    evidence.linkedGate,
    evidence.evidenceCommandType,
    evidence.evidenceType,
  ]

  for (const candidate of candidates) {
    const token = normalizeToken(candidate)
    if (!token || token === "NONE") {
      continue
    }

    const mappedArea = PROFESSIONAL_GATE_ALIASES.get(token)
    if (mappedArea) {
      return mappedArea
    }
  }

  return undefined
}

function mapGateState(
  evidence: LoadedProfessionalEvidenceGatewayEvidence
): {
  professionalGateStatus: ProfessionalGateStatus
  professionalReadiness: ProfessionalReadiness
} {
  const evidenceStatus = normalizeToken(evidence.evidenceStatus)
  const reviewState = normalizeToken(evidence.reviewState)
  const blockerImpact = normalizeToken(evidence.blockerImpact)

  if (evidenceStatus === "EXPIRED") {
    return {
      professionalGateStatus: "EXPIRED",
      professionalReadiness: "BLOCKED",
    }
  }

  if (evidenceStatus === "REJECTED" || blockerImpact === "BLOCKS_PROGRESSION") {
    return {
      professionalGateStatus: "ADVERSE",
      professionalReadiness: "BLOCKED",
    }
  }

  if (evidenceStatus === "SUFFICIENT" || reviewState === "PROFESSIONAL_CONFIRMED") {
    return {
      professionalGateStatus: "CONFIRMED",
      professionalReadiness: "PROFESSIONALLY_CONFIRMED",
    }
  }

  if (
    evidenceStatus === "RECEIVED" ||
    evidenceStatus === "REVIEWED" ||
    reviewState === "REVIEWED_BY_OPERATOR" ||
    reviewState === "PROFESSIONAL_REVIEW_REQUIRED"
  ) {
    return {
      professionalGateStatus: "RECEIVED",
      professionalReadiness: "READY_FOR_REVIEW",
    }
  }

  if (evidenceStatus === "MISSING" || evidenceStatus === "REQUESTED") {
    return {
      professionalGateStatus: "REQUESTED",
      professionalReadiness: "NOT_READY",
    }
  }

  return {
    professionalGateStatus: "NOT_STARTED",
    professionalReadiness: "NOT_READY",
  }
}

export function mapLoadedEvidenceToProfessionalGatewayEvidenceInput(
  evidence: LoadedProfessionalEvidenceGatewayEvidence,
  savedDealId: string
): ProfessionalEvidenceGatewayEvidenceInput | undefined {
  const professionalGateArea = mapProfessionalGateArea(evidence)
  if (!professionalGateArea) {
    return undefined
  }

  const gateState = mapGateState(evidence)
  const evidenceId = normalizeText(evidence.id)
  const evidenceSummary =
    normalizeText(evidence.evidenceSummary) ??
    normalizeText(evidence.note) ??
    normalizeText(evidence.title) ??
    "Professional evidence review required"

  return {
    savedDealId,
    linkedEvidenceCommandEvidenceId: evidenceId,
    linkedInvestorShieldGate: mapInvestorShieldGate(evidence, professionalGateArea),
    evidenceType: mapEvidenceCommandType(evidence),
    evidenceStatus: normalizeToken(evidence.evidenceStatus) ?? "MISSING",
    linkedProfessionalGate: mapEvidenceCommandProfessionalGate(
      evidence,
      professionalGateArea
    ),
    professionalGateArea,
    professionalGateStatus: gateState.professionalGateStatus,
    professionalReadiness: gateState.professionalReadiness,
    reviewSource: mapReviewSource(evidence),
    reviewState: normalizeText(evidence.reviewState) ?? "VISIBLE_EVIDENCE",
    blockerImpact: normalizeText(evidence.blockerImpact) ?? "NONE",
    evidenceStrength: normalizeText(evidence.evidenceStrength) ?? "UNASSESSED",
    requiredEvidenceSummary: evidenceSummary,
    professionalConfirmationSummary: evidenceSummary,
    recommendedNextAction:
      normalizeText(evidence.recommendedNextAction) ??
      "Request compatible professional source confirmation",
    expiryOrReviewDate: normalizeNullableText(evidence.expiryOrUpdateDate),
    linkedEvidenceIds: evidenceId ? [evidenceId] : [],
  }
}

type ClassifiedProfessionalEvidence = {
  readonly input: ProfessionalEvidenceGatewayEvidenceInput
  readonly state: ProfessionalReadinessPresentationState
}

function classifyMappedProfessionalEvidence(
  input: ProfessionalEvidenceGatewayEvidenceInput,
  referenceDate: string | null | undefined
): ProfessionalReadinessPresentationState {
  const normalizedEvidence = normalizeEvidenceCommandInput({
    evidenceType: input.evidenceType,
    linkedInvestorShieldGate: input.linkedInvestorShieldGate,
    linkedProfessionalGate: input.linkedProfessionalGate,
    title: input.requiredEvidenceSummary,
    evidenceSummary: input.requiredEvidenceSummary,
    evidenceStatus: input.evidenceStatus,
    evidenceStrength: input.evidenceStrength,
    reviewState: input.reviewState,
    blockerImpact: input.blockerImpact,
    recommendedNextAction: input.recommendedNextAction,
    expiryOrUpdateDate: input.expiryOrReviewDate,
    source: input.reviewSource,
    mobileCaptureNote: null,
  })

  if (!normalizedEvidence) {
    return "MANUAL_REVIEW_REQUIRED"
  }

  return classifyProfessionalReadiness(
    {
      linkedInvestorShieldGate: input.linkedInvestorShieldGate as string,
      professionalGateArea: input.professionalGateArea as ProfessionalGateArea,
      evidenceType: normalizedEvidence.evidenceType,
      linkedProfessionalGate: normalizedEvidence.linkedProfessionalGate,
      reviewSource: validateProfessionalEvidenceReviewSource(input.reviewSource) ?? null,
      evidenceStatus: normalizedEvidence.evidenceStatus,
      evidenceStrength: normalizedEvidence.evidenceStrength,
      reviewState: normalizedEvidence.reviewState,
      blockerImpact: normalizedEvidence.blockerImpact,
      expiryOrUpdateDate: normalizedEvidence.expiryOrUpdateDate,
    },
    { referenceDate }
  )
}

function supportingSummaryForState(
  classified: ClassifiedProfessionalEvidence | undefined,
  state: ProfessionalReadinessPresentationState
): string {
  if (!classified) {
    return PROFESSIONAL_READINESS_EMPTY_SUMMARY
  }

  switch (state) {
    case "PROFESSIONALLY_CONFIRMED":
      return normalizeText(classified.input.professionalConfirmationSummary) ??
        "Professional confirmation is visible from a qualifying source."
    case "READY_FOR_REVIEW":
      return normalizeText(classified.input.requiredEvidenceSummary) ??
        "Professional evidence is present and awaiting qualified review."
    case "WEAK_OR_NON_CONFIRMING":
      return normalizeText(classified.input.professionalConfirmationSummary) ??
        "Evidence Lite records are informational and do not constitute professional confirmation."
    case "MISSING":
      return normalizeText(classified.input.requiredEvidenceSummary) ??
        PROFESSIONAL_READINESS_EMPTY_SUMMARY
    case "ADVERSE":
    case "EXPIRED":
    case "MANUAL_REVIEW_REQUIRED":
      return (
        normalizeText(classified.input.recommendedNextAction) ??
        normalizeText(classified.input.professionalConfirmationSummary) ??
        "Professional review remains required before safe reliance."
      )
    default:
      return PROFESSIONAL_READINESS_EMPTY_SUMMARY
  }
}

function buildProfessionalReadinessPresentation(
  evidence: readonly ProfessionalEvidenceGatewayEvidenceInput[],
  referenceDate: string | null | undefined
): ProfessionalReadinessPresentation {
  if (evidence.length === 0) {
    return {
      state: "MISSING",
      displayLabel: PROFESSIONAL_READINESS_DISPLAY_LABELS.MISSING,
      supportingSummary: PROFESSIONAL_READINESS_EMPTY_SUMMARY,
      authorityNotice: PROFESSIONAL_READINESS_AUTHORITY_NOTICE,
    }
  }

  const classifiedEvidence = evidence.map((entry) => ({
    input: entry,
    state: classifyMappedProfessionalEvidence(entry, referenceDate),
  }))

  const selectedState =
    PROFESSIONAL_READINESS_PRECEDENCE.find((state) =>
      classifiedEvidence.some((entry) => entry.state === state)
    ) ?? "MANUAL_REVIEW_REQUIRED"
  const representative = classifiedEvidence.find((entry) => entry.state === selectedState)

  return {
    state: selectedState,
    displayLabel: PROFESSIONAL_READINESS_DISPLAY_LABELS[selectedState],
    supportingSummary: supportingSummaryForState(representative, selectedState),
    authorityNotice: PROFESSIONAL_READINESS_AUTHORITY_NOTICE,
  }
}

export function loadProfessionalEvidenceGatewayViewModel(
  input: LoadProfessionalEvidenceGatewayViewModelInput
): ProfessionalEvidenceGatewayViewModel {
  const savedDealId = normalizeText(input.savedDealId) ?? "UNKNOWN_DEAL"
  const mappedEvidence = input.evidence.flatMap((evidence) => {
    const mapped = mapLoadedEvidenceToProfessionalGatewayEvidenceInput(
      evidence,
      savedDealId
    )

    return mapped ? [mapped] : []
  })
  const referenceDate = normalizeNullableText(input.referenceDate)
  const viewModel = buildProfessionalEvidenceGatewayViewModel({
    savedDealId,
    evidence: mappedEvidence,
    finalDecisionLockStatus: input.finalDecisionLockStatus as
      | FinalDecisionLockStatus
      | undefined,
    lockReason: input.lockReason,
    readinessPresentation: buildProfessionalReadinessPresentation(
      mappedEvidence,
      referenceDate
    ),
  })

  return viewModel
}
