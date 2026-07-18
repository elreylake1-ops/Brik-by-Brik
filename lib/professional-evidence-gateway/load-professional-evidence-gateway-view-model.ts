import {
  type ProfessionalEvidenceGatewayEvidenceInput,
  buildProfessionalEvidenceGatewayViewModel,
} from "@/lib/professional-evidence-gateway/professional-evidence-gateway-read-model"
import type {
  FinalDecisionLockStatus,
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
    linkedInvestorShieldGate:
      normalizeText(evidence.linkedInvestorShieldGate) ??
      normalizeText(evidence.linkedGate) ??
      professionalGateArea,
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

  return buildProfessionalEvidenceGatewayViewModel({
    savedDealId,
    evidence: mappedEvidence,
    finalDecisionLockStatus: input.finalDecisionLockStatus as
      | FinalDecisionLockStatus
      | undefined,
    lockReason: input.lockReason,
  })
}
