import {
  PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS,
  type ProfessionalEvidenceGatewayDecisionLock,
  type ProfessionalEvidenceGatewayGate,
  type ProfessionalEvidenceGatewayRecord,
  type ProfessionalReadinessPresentation,
  type ProfessionalEvidenceGatewaySection,
  type ProfessionalEvidenceGatewayViewModel,
  type ProfessionalEvidenceReviewSource,
  type ProfessionalGateArea,
  type ProfessionalGateStatus,
  type ProfessionalReadiness,
} from "@/types/professional-evidence-gateway"
import {
  validateFinalDecisionLockStatus,
  validateProfessionalEvidenceReviewSource,
  validateProfessionalGateArea,
  validateProfessionalGateStatus,
  validateProfessionalReadiness,
} from "@/lib/professional-evidence-gateway/professional-evidence-gateway-validation"
import { isProfessionalEvidenceReviewSourceQualifyingForGate } from "@/lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility"

export type ProfessionalEvidenceGatewayEvidenceInput = {
  readonly savedDealId?: unknown
  readonly linkedEvidenceCommandEvidenceId?: unknown
  readonly linkedInvestorShieldGate?: unknown
  readonly evidenceType?: unknown
  readonly evidenceStatus?: unknown
  readonly linkedProfessionalGate?: unknown
  readonly professionalGateArea?: unknown
  readonly professionalGateStatus?: unknown
  readonly professionalReadiness?: unknown
  readonly reviewSource?: unknown
  readonly reviewState?: unknown
  readonly blockerImpact?: unknown
  readonly evidenceStrength?: unknown
  readonly requiredEvidenceSummary?: unknown
  readonly professionalConfirmationSummary?: unknown
  readonly recommendedNextAction?: unknown
  readonly expiryOrReviewDate?: unknown
  readonly finalDecisionLockStatus?: unknown
  readonly lockReason?: unknown
  readonly linkedEvidenceIds?: unknown
}

export type ProfessionalGateReadinessInput = Pick<
  ProfessionalEvidenceGatewayEvidenceInput,
  "professionalGateArea" | "professionalGateStatus" | "professionalReadiness" | "reviewSource"
>

export type ProfessionalGateReadinessMapping = {
  readonly professionalGateArea: ProfessionalGateArea
  readonly professionalGateStatus: ProfessionalGateStatus
  readonly professionalReadiness: ProfessionalReadiness
  readonly reviewSource: ProfessionalEvidenceReviewSource
  readonly professionallyConfirming: boolean
}

export type ProfessionalEvidenceGatewayDecisionLockInput = {
  readonly savedDealId: unknown
  readonly gates?: readonly ProfessionalEvidenceGatewayGate[]
  readonly finalDecisionLockStatus?: unknown
  readonly lockReason?: unknown
}

export type ProfessionalEvidenceGatewayViewModelInput = {
  readonly savedDealId: unknown
  readonly evidence: readonly ProfessionalEvidenceGatewayEvidenceInput[]
  readonly finalDecisionLockStatus?: unknown
  readonly lockReason?: unknown
  readonly readinessPresentation?: ProfessionalReadinessPresentation
}

function normalizeRequiredText(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeLinkedEvidenceIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized: string[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue
    }

    const trimmed = entry.trim()
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed)
      normalized.push(trimmed)
    }
  }

  return normalized
}

function normalizeProfessionalGateArea(value: unknown): ProfessionalGateArea {
  const professionalGateArea = validateProfessionalGateArea(value)

  if (!professionalGateArea) {
    throw new Error("professionalGateArea must be canonical")
  }

  return professionalGateArea
}

function normalizeReviewSource(
  value: unknown
): ProfessionalEvidenceReviewSource {
  return validateProfessionalEvidenceReviewSource(value) ?? "OPERATOR_NOTE"
}

function requiresProfessionalConfirmation(
  professionalGateStatus: ProfessionalGateStatus,
  professionalReadiness: ProfessionalReadiness
): boolean {
  return (
    professionalGateStatus === "CONFIRMED" ||
    professionalReadiness === "PROFESSIONALLY_CONFIRMED"
  )
}

function hasExplicitCompatibleReviewSource(
  professionalGateArea: ProfessionalGateArea,
  reviewSourceInput: unknown,
  reviewSource: ProfessionalEvidenceReviewSource
): boolean {
  return (
    reviewSourceInput !== undefined &&
    isProfessionalEvidenceReviewSourceQualifyingForGate(
      professionalGateArea,
      reviewSource
    )
  )
}

export function mapProfessionalGateReadiness(
  input: ProfessionalGateReadinessInput
): ProfessionalGateReadinessMapping {
  const professionalGateArea = normalizeProfessionalGateArea(input.professionalGateArea)
  const reviewSource = normalizeReviewSource(input.reviewSource)
  const requestedProfessionalGateStatus =
    validateProfessionalGateStatus(input.professionalGateStatus) ??
    PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.professionalGateStatus
  const requestedProfessionalReadiness =
    validateProfessionalReadiness(input.professionalReadiness) ??
    PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.professionalReadiness
  const compatibleReviewSource = hasExplicitCompatibleReviewSource(
    professionalGateArea,
    input.reviewSource,
    reviewSource
  )
  const requestedConfirmation = requiresProfessionalConfirmation(
    requestedProfessionalGateStatus,
    requestedProfessionalReadiness
  )

  if (!requestedConfirmation || compatibleReviewSource) {
    return {
      professionalGateArea,
      professionalGateStatus: requestedProfessionalGateStatus,
      professionalReadiness: requestedProfessionalReadiness,
      reviewSource,
      professionallyConfirming: requestedConfirmation && compatibleReviewSource,
    }
  }

  return {
    professionalGateArea,
    professionalGateStatus:
      requestedProfessionalGateStatus === "CONFIRMED"
        ? "UNDER_REVIEW"
        : requestedProfessionalGateStatus,
    professionalReadiness:
      requestedProfessionalReadiness === "PROFESSIONALLY_CONFIRMED"
        ? "READY_FOR_REVIEW"
        : requestedProfessionalReadiness,
    reviewSource,
    professionallyConfirming: false,
  }
}

export function mapEvidenceToProfessionalGatewayRecord(
  input: ProfessionalEvidenceGatewayEvidenceInput
): ProfessionalEvidenceGatewayRecord {
  const readiness = mapProfessionalGateReadiness(input)
  const savedDealId = normalizeRequiredText(input.savedDealId, "UNKNOWN_DEAL")
  const linkedEvidenceCommandEvidenceId = normalizeOptionalText(
    input.linkedEvidenceCommandEvidenceId
  )
  const linkedEvidenceIds = normalizeLinkedEvidenceIds(input.linkedEvidenceIds)
  const finalDecisionLockStatus =
    validateFinalDecisionLockStatus(input.finalDecisionLockStatus) ??
    PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.finalDecisionLockStatus

  return {
    savedDealId,
    linkedEvidenceCommandEvidenceId,
    linkedInvestorShieldGate: normalizeRequiredText(
      input.linkedInvestorShieldGate,
      readiness.professionalGateArea
    ),
    professionalGateArea: readiness.professionalGateArea,
    professionalGateStatus: readiness.professionalGateStatus,
    professionalReadiness: readiness.professionalReadiness,
    reviewSource: readiness.reviewSource,
    reviewState: normalizeRequiredText(input.reviewState, "VISIBLE_EVIDENCE"),
    blockerImpact: normalizeRequiredText(input.blockerImpact, "NONE"),
    evidenceStrength: normalizeRequiredText(input.evidenceStrength, "UNASSESSED"),
    requiredEvidenceSummary: normalizeRequiredText(
      input.requiredEvidenceSummary,
      "Professional evidence review required"
    ),
    professionalConfirmationSummary: readiness.professionallyConfirming
      ? normalizeRequiredText(
          input.professionalConfirmationSummary,
          "Professional confirmation received from qualifying source"
        )
      : "Professional confirmation requires explicit compatible qualifying source",
    recommendedNextAction: normalizeRequiredText(
      input.recommendedNextAction,
      readiness.professionallyConfirming
        ? "Continue professional review"
        : "Request compatible professional source confirmation"
    ),
    expiryOrReviewDate: normalizeOptionalText(input.expiryOrReviewDate),
    finalDecisionLockStatus,
    lockReason: normalizeRequiredText(
      input.lockReason,
      "Display-only professional evidence lock state"
    ),
    linkedEvidenceIds,
  }
}

function toGate(record: ProfessionalEvidenceGatewayRecord): ProfessionalEvidenceGatewayGate {
  return {
    savedDealId: record.savedDealId,
    professionalGateArea: record.professionalGateArea,
    linkedInvestorShieldGate: record.linkedInvestorShieldGate,
    professionalGateStatus: record.professionalGateStatus,
    professionalReadiness: record.professionalReadiness,
    reviewSource: record.reviewSource,
    reviewState: record.reviewState,
    blockerImpact: record.blockerImpact,
    evidenceStrength: record.evidenceStrength,
    requiredEvidenceSummary: record.requiredEvidenceSummary,
    professionalConfirmationSummary: record.professionalConfirmationSummary,
    recommendedNextAction: record.recommendedNextAction,
    expiryOrReviewDate: record.expiryOrReviewDate,
    linkedEvidenceCommandEvidenceId: record.linkedEvidenceCommandEvidenceId,
    linkedEvidenceIds: [...record.linkedEvidenceIds],
  }
}

function deriveAggregateGateStatus(
  gates: readonly ProfessionalEvidenceGatewayGate[]
): ProfessionalGateStatus {
  if (gates.length === 0) {
    return PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.professionalGateStatus
  }

  if (gates.every((gate) => gate.professionalGateStatus === "CONFIRMED")) {
    return "CONFIRMED"
  }

  if (gates.some((gate) => gate.professionalGateStatus === "ADVERSE")) {
    return "ADVERSE"
  }

  if (gates.some((gate) => gate.professionalGateStatus === "UNDER_REVIEW")) {
    return "UNDER_REVIEW"
  }

  if (gates.some((gate) => gate.professionalGateStatus === "RECEIVED")) {
    return "RECEIVED"
  }

  return gates[0].professionalGateStatus
}

function deriveAggregateReadiness(
  gates: readonly ProfessionalEvidenceGatewayGate[]
): ProfessionalReadiness {
  if (gates.length === 0) {
    return PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.professionalReadiness
  }

  if (gates.some((gate) => gate.professionalReadiness === "BLOCKED")) {
    return "BLOCKED"
  }

  if (
    gates.every(
      (gate) => gate.professionalReadiness === "PROFESSIONALLY_CONFIRMED"
    )
  ) {
    return "PROFESSIONALLY_CONFIRMED"
  }

  if (
    gates.some(
      (gate) =>
        gate.professionalReadiness === "READY_FOR_REVIEW" ||
        gate.professionalReadiness === "PROFESSIONALLY_CONFIRMED"
    )
  ) {
    return "PARTIALLY_READY"
  }

  return gates[0].professionalReadiness
}

function collectLinkedEvidenceIds(
  gates: readonly ProfessionalEvidenceGatewayGate[]
): readonly string[] {
  const linkedEvidenceIds: string[] = []
  const seen = new Set<string>()

  for (const gate of gates) {
    for (const linkedEvidenceId of gate.linkedEvidenceIds) {
      if (!seen.has(linkedEvidenceId)) {
        seen.add(linkedEvidenceId)
        linkedEvidenceIds.push(linkedEvidenceId)
      }
    }
  }

  return linkedEvidenceIds
}

function defaultReadinessPresentation(
  gates: readonly ProfessionalEvidenceGatewayGate[]
): ProfessionalReadinessPresentation {
  if (gates.length === 0) {
    return {
      state: "MISSING",
      displayLabel: "Professional evidence missing",
      supportingSummary: "No compatible professional evidence is currently available for review.",
      authorityNotice:
        "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
    }
  }

  if (
    gates.some(
      (gate) =>
        gate.professionalGateStatus === "CONFIRMED" &&
        gate.professionalReadiness === "PROFESSIONALLY_CONFIRMED"
    )
  ) {
    return {
      state: "PROFESSIONALLY_CONFIRMED",
      displayLabel: "Professionally confirmed",
      supportingSummary:
        gates[0].professionalConfirmationSummary ??
        "Professional confirmation is visible from a qualifying source.",
      authorityNotice:
        "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
    }
  }

  return {
    state: "READY_FOR_REVIEW",
    displayLabel: "Ready for professional review",
    supportingSummary:
      gates[0].requiredEvidenceSummary ??
      "Professional evidence is present and awaiting qualified review.",
    authorityNotice:
      "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
  }
}

export function deriveProfessionalDecisionLock(
  input: ProfessionalEvidenceGatewayDecisionLockInput
): ProfessionalEvidenceGatewayDecisionLock {
  const savedDealId = normalizeRequiredText(input.savedDealId, "UNKNOWN_DEAL")
  const gates = input.gates ? [...input.gates] : []
  const finalDecisionLockStatus =
    validateFinalDecisionLockStatus(input.finalDecisionLockStatus) ??
    PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.finalDecisionLockStatus

  return {
    savedDealId,
    finalDecisionLockStatus,
    lockReason: normalizeRequiredText(
      input.lockReason,
      "Display-only professional evidence lock state"
    ),
    linkedGateAreas: gates.map((gate) => gate.professionalGateArea),
    linkedEvidenceIds: collectLinkedEvidenceIds(gates),
  }
}

export function buildProfessionalEvidenceGatewayViewModel(
  input: ProfessionalEvidenceGatewayViewModelInput
): ProfessionalEvidenceGatewayViewModel {
  const savedDealId = normalizeRequiredText(input.savedDealId, "UNKNOWN_DEAL")
  const gates = input.evidence.map((evidence) =>
    toGate(
      mapEvidenceToProfessionalGatewayRecord({
        ...evidence,
        savedDealId: evidence.savedDealId ?? savedDealId,
      })
    )
  )
  const readiness = deriveAggregateReadiness(gates)
  const finalDecisionLockStatus =
    validateFinalDecisionLockStatus(input.finalDecisionLockStatus) ??
    PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.finalDecisionLockStatus
  const sections: readonly ProfessionalEvidenceGatewaySection[] = [
    {
      savedDealId,
      sectionKey: "professional-evidence-gateway",
      sectionTitle: "Professional Evidence Gateway",
      sectionSummary: "Read-only professional evidence gateway mapping",
      gates,
      readiness,
      finalDecisionLockStatus,
    },
  ]
  const firstGate = gates[0]

  return {
    savedDealId,
    gates,
    sections,
    decisionLock: deriveProfessionalDecisionLock({
      savedDealId,
      gates,
      finalDecisionLockStatus,
      lockReason: input.lockReason,
    }),
    readinessPresentation:
      input.readinessPresentation ?? defaultReadinessPresentation(gates),
    professionalGateStatus: deriveAggregateGateStatus(gates),
    professionalReadiness: readiness,
    reviewSource: firstGate?.reviewSource ?? "OPERATOR_NOTE",
    requiredEvidenceSummary:
      firstGate?.requiredEvidenceSummary ?? "Professional evidence review required",
    professionalConfirmationSummary:
      firstGate?.professionalConfirmationSummary ??
      "Professional confirmation requires explicit compatible qualifying source",
    recommendedNextAction:
      firstGate?.recommendedNextAction ??
      "Request compatible professional source confirmation",
    linkedEvidenceCommandEvidenceId:
      firstGate?.linkedEvidenceCommandEvidenceId ?? null,
  }
}
