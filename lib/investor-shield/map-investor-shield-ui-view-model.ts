import type { InvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"
import type {
  InvestorShieldGateDisplay,
  InvestorShieldGateTypeDisplay,
  InvestorShieldUiViewModel,
  InvestorShieldUiGateKey,
  AdvisorySignalDisplay,
  DeterministicGovernanceDisplay,
  ManualReviewDisplay,
  ProtectedMovementDisplay,
  TaskRecommendationDisplay,
  WaiverDisplay,
} from "@/types/investor-shield-ui"

export type InvestorShieldUiMapperDealContext = {
  pipelineState?: string | null
  attemptedPipelineState?: string | null
  classification?: string | null
  governanceState?: string | null
  capitalProtectionState?: string | null
  trueMaoStatus?: string | null
}

export type InvestorShieldUiMapperInput = {
  dealId: string
  deal?: InvestorShieldUiMapperDealContext | null
  investorShield?: Partial<InvestorShieldUiModel> | null
  modelVersion?: string
  sourceRoute?: string
  loadedAt?: string
}

const DEFAULT_SOURCE_ROUTE = "/api/saved-deals/[id]/investor-shield-ui"

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function mapOverallStatus(
  status: InvestorShieldUiModel["overallStatus"] | undefined
): InvestorShieldUiViewModel["summary"]["overallStatus"] {
  switch (status) {
    case "CLEAR":
      return "clear"
    case "CAUTION":
      return "caution"
    case "BLOCKED":
    default:
      return "blocked"
  }
}

function mapGateType(gate: InvestorShieldUiModel["gateSummaries"][number]): InvestorShieldGateTypeDisplay {
  return gate.advisoryOnly ? "advisory" : "required"
}

function mapGateStatus(
  gate: InvestorShieldUiModel["gateSummaries"][number],
  movementAllowed: boolean
): InvestorShieldGateDisplay["status"] {
  const status = gate.status?.toUpperCase() ?? "NOT_STARTED"

  switch (status) {
    case "SATISFIED":
      return "satisfied"
    case "WAIVED":
      return "waived"
    case "FAILED":
      return "failed"
    case "WEAK":
      return "weak_evidence"
    case "IN_PROGRESS":
      return "manual_review_required"
    case "REQUIRED":
      return "missing_evidence"
    case "NOT_STARTED":
      return gate.missingEvidenceSummary.length > 0 ? "missing_evidence" : "not_started"
    case "BLOCKED":
      return "blocked"
    default:
      return movementAllowed ? "satisfied" : "missing_evidence"
  }
}

function mapEvidenceStatus(
  gate: InvestorShieldUiModel["gateSummaries"][number],
  status: InvestorShieldGateDisplay["status"]
): InvestorShieldGateDisplay["evidenceStatus"] {
  if (gate.advisoryOnly) {
    return "advisory_only"
  }

  switch (status) {
    case "satisfied":
      return "sufficient"
    case "waived":
      return "waived"
    case "failed":
      return "failed"
    case "weak_evidence":
      return "weak"
    case "manual_review_required":
    case "missing_evidence":
    case "not_started":
      return gate.evidenceCount > 0 ? "weak" : "not_provided"
    case "blocked":
      return "failed"
    default:
      return gate.evidenceCount > 0 ? "sufficient" : "not_provided"
  }
}

function mapTaskActionType(
  gateKey: string,
  title: string
): TaskRecommendationDisplay["actionType"] {
  switch (gateKey) {
    case "REFURB_CERTAINTY":
      return "obtain_builder_quote"
    case "BUILDER_PROPOSAL_CONTRACT":
      return "obtain_builder_contract"
    case "SOLICITOR_REVIEW":
      return "review_solicitor_feedback"
    case "LENDER_CRITERIA":
      return "review_lender_criteria"
    case "RENTAL_DEMAND":
      return "verify_rental_demand"
    case "DAMP_STRUCTURAL":
      return "manual_review"
    default:
      return title.toLowerCase().includes("review") ? "review_gate" : "request_evidence"
  }
}

function toTaskRecommendationKey(gateKey: string, title: string): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `task:${gateKey}:${normalizedTitle || "recommendation"}`
}

function mapTaskRecommendations(
  investorShield: Partial<InvestorShieldUiModel> | null | undefined
): readonly TaskRecommendationDisplay[] {
  const recommendations = investorShield?.taskRecommendations ?? []

  return recommendations.map((recommendation) => {
    const taskKey = toTaskRecommendationKey(recommendation.gateKey, recommendation.title)

    return {
      taskKey,
      gateKey: recommendation.gateKey as InvestorShieldUiGateKey,
      title: recommendation.title,
      description: recommendation.reason,
      status: "open",
      duplicateSafe: true,
      actionType: mapTaskActionType(recommendation.gateKey, recommendation.title),
    }
  })
}

function mapWaiverFromGate(
  gate: InvestorShieldUiModel["gateSummaries"][number]
): WaiverDisplay {
  if (gate.status !== "WAIVED") {
    return { isWaived: false }
  }

  return {
    isWaived: true,
    reason: gate.waiverReason ?? gate.shortExplanation,
    warningText: "Waiver remains visually distinct from satisfied evidence.",
  }
}

function mapGateDisplay(
  gate: InvestorShieldUiModel["gateSummaries"][number],
  taskRecommendations: readonly TaskRecommendationDisplay[],
  movementAllowed: boolean
): InvestorShieldGateDisplay {
  const status = mapGateStatus(gate, movementAllowed)
  const taskRecommendationIds = taskRecommendations
    .filter((recommendation) => recommendation.gateKey === gate.key)
    .map((recommendation) => recommendation.taskKey)

  return {
    gateKey: gate.key as InvestorShieldUiGateKey,
    label: gate.label,
    gateType: mapGateType(gate),
    status,
    evidenceStatus: mapEvidenceStatus(gate, status),
    isBlocking: status === "blocked" || status === "failed" || status === "missing_evidence",
    missingEvidenceWarnings:
      gate.missingEvidenceSummary.length > 0
        ? gate.missingEvidenceSummary
        : gate.status === "WAIVED"
          ? ["Waived gates remain traceable and distinct from satisfied evidence."]
          : [],
    taskRecommendationIds,
    waiver: mapWaiverFromGate(gate),
    manualReviewRequired: status === "manual_review_required" || status === "waived" || gate.status === "IN_PROGRESS",
    displayPriority:
      status === "blocked" || status === "failed" || status === "missing_evidence"
        ? 1
        : status === "manual_review_required" || status === "waived" || status === "weak_evidence"
          ? 2
          : 3,
    helperText:
      gate.shortExplanation ||
      (status === "waived"
        ? "Waiver remains distinct from satisfied evidence."
        : "Read-only gate display."),
  }
}

function mapAdvisorySignals(
  investorShield: Partial<InvestorShieldUiModel> | null | undefined,
  gates: readonly InvestorShieldGateDisplay[]
): readonly AdvisorySignalDisplay[] {
  const warnings = investorShield?.advisoryWarnings ?? []
  const warningsSignals = warnings.map((warning, index) => ({
    signalKey: `advisory-warning-${index + 1}`,
    label: "Advisory Warning",
    source: "system_default",
    confidenceLabel: "unknown",
    warningText: warning,
    advisoryOnly: true as const,
    cannotSatisfyHardGate: true as const,
  }))

  const subGateSignals = gates.flatMap((gate) =>
    gate.gateType !== "advisory"
      ? []
      : [
          {
            signalKey: `advisory-gate-${gate.gateKey}`,
            label: gate.label,
            source: "ai_advisory",
            confidenceLabel: "unknown",
            warningText: gate.helperText,
            advisoryOnly: true as const,
            cannotSatisfyHardGate: true as const,
          },
        ]
  )

  return [...subGateSignals, ...warningsSignals]
}

function mapManualReview(
  investorShield: Partial<InvestorShieldUiModel> | null | undefined,
  gates: readonly InvestorShieldGateDisplay[],
  advisorySignals: readonly AdvisorySignalDisplay[]
): ManualReviewDisplay {
  const required = Boolean(
    investorShield?.manualOverrideRequired ||
      gates.some((gate) => gate.manualReviewRequired) ||
      advisorySignals.length > 0 ||
      (investorShield?.blockingGateKeys?.length ?? 0) > 0
  )

  const causedBy = required
    ? [
        ...new Set([
          ...(investorShield?.blockingGateKeys ?? []),
          ...advisorySignals.map((signal) => signal.signalKey),
          ...gates.filter((gate) => gate.manualReviewRequired).map((gate) => gate.gateKey),
        ]),
      ]
    : []

  return {
    required,
    reason:
      investorShield?.manualOverrideRequired
        ? "Manual override is required."
        : required
          ? "Human review is required before this read-only state can be treated as clear."
          : "No manual review required.",
    causedBy,
    doesNotClearGate: true,
  }
}

function mapProtectedMovement(
  deal: InvestorShieldUiMapperInput["deal"],
  investorShield: Partial<InvestorShieldUiModel> | null | undefined
): ProtectedMovementDisplay {
  const movementAllowed = investorShield?.canProgress ?? false
  const blockingGateKeys = (investorShield?.blockingGateKeys ?? []).map((key) => key as InvestorShieldUiGateKey)

  return {
    currentPipelineState: normalizeText(deal?.pipelineState, "UNKNOWN"),
    attemptedPipelineState: normalizeOptionalText(deal?.attemptedPipelineState),
    movementAllowed,
    blockedReason:
      movementAllowed
      ? undefined
        : normalizeOptionalText(
            investorShield?.protectedMovementExplanation ??
              investorShield?.advisoryWarnings?.[0] ??
              (investorShield?.gateSummaries ?? []).find((gate) => gate.status !== "SATISFIED")?.shortExplanation
          ) ?? "Movement remains blocked."
,
    blockingGateKeys,
    pipelineMutationPrevented: !movementAllowed,
    explanation:
      normalizeOptionalText(
        investorShield?.protectedMovementExplanation ??
          investorShield?.advisoryWarnings?.[0] ??
          (investorShield?.gateSummaries ?? []).find((gate) => gate.status !== "SATISFIED")?.shortExplanation
      ) ?? "Read-only movement explanation unavailable.",
  }
}

function mapWaiverSummary(gates: readonly InvestorShieldGateDisplay[]): WaiverDisplay {
  const waivedGate = gates.find((gate) => gate.waiver.isWaived)

  if (!waivedGate) {
    return { isWaived: false }
  }

  return {
    isWaived: true,
    reason: waivedGate.waiver.reason,
    waivedBy: waivedGate.waiver.waivedBy,
    waivedAt: waivedGate.waiver.waivedAt,
    warningText: waivedGate.waiver.warningText ?? "Waiver remains visually distinct from satisfied evidence.",
  }
}

function mapDeterministicGovernance(
  deal: InvestorShieldUiMapperInput["deal"],
  investorShield: Partial<InvestorShieldUiModel> | null | undefined
): DeterministicGovernanceDisplay {
  return {
    classification: normalizeText(deal?.classification, "Unknown"),
    governanceState: normalizeText(deal?.governanceState, "UNKNOWN"),
    capitalProtectionState: normalizeText(deal?.capitalProtectionState, "UNKNOWN"),
    trueMaoStatus: normalizeOptionalText(deal?.trueMaoStatus),
    isDominant: true,
    warningText:
      normalizeOptionalText(investorShield?.protectedMovementExplanation) ??
      "Deterministic governance remains visually dominant.",
  }
}

export function mapInvestorShieldUiViewModel(
  input: InvestorShieldUiMapperInput
): InvestorShieldUiViewModel {
  const investorShield = input.investorShield ?? null
  const deal = input.deal ?? null
  const movementAllowed = investorShield?.canProgress ?? false

  const taskRecommendations = mapTaskRecommendations(investorShield)
  const gates = (investorShield?.gateSummaries ?? []).map((gate) =>
    mapGateDisplay(gate, taskRecommendations, movementAllowed)
  )
  const advisorySignals = mapAdvisorySignals(investorShield, gates)
  const manualReview = mapManualReview(investorShield, gates, advisorySignals)
  const waiverSummary = mapWaiverSummary(gates)

  return {
    dealId: input.dealId,
    summary: {
      headline: `Investor Shield ${mapOverallStatus(investorShield?.overallStatus).toUpperCase()}`,
      subheadline: "Read-only Investor Shield view model",
      overallStatus: mapOverallStatus(investorShield?.overallStatus),
      canProgress: movementAllowed,
      blockingGateCount: gates.filter((gate) => gate.isBlocking).length,
      cautionGateCount: investorShield?.cautionGateKeys?.length ?? 0,
      message:
        normalizeOptionalText(investorShield?.protectedMovementExplanation) ??
        (movementAllowed
          ? "Required gates are clear or validly waived."
          : "Required evidence remains incomplete or blocked."),
    },
    deterministicGovernance: mapDeterministicGovernance(deal, investorShield),
    gates,
    advisorySignals,
    protectedMovement: mapProtectedMovement(deal, investorShield),
    taskRecommendations,
    manualReview,
    waiverSummary,
    metadata: {
      modelVersion: input.modelVersion ?? "phase4d-ui-view-model-v1",
      sourceRoute: input.sourceRoute ?? DEFAULT_SOURCE_ROUTE,
      loadedAt: input.loadedAt,
      readOnly: true,
    },
  }
}
