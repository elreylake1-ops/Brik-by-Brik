import type {
  GlobalDealState,
  Phase3EscalationSummary,
  Phase3AcceptedLimitation,
  Phase3DeterministicSnapshot,
  Phase3OrchestrationMetadata,
  Phase3OrchestrationInput,
  Phase3OrchestrationOutput,
  Phase3Task,
  Phase3WorkflowFlag,
  Phase3WorkflowState,
} from "@/types/phase3-orchestration"
import { PHASE3_ACCEPTED_LIMITATIONS } from "@/types/phase3-orchestration"

function toFinalClassificationValue(result: Phase3DeterministicSnapshot): string {
  return String(result.finalClassification)
}

function toGovernanceStateValue(result: Phase3DeterministicSnapshot): string {
  return String(result.governanceState)
}

function normalizeEvidenceTokens(values: readonly string[]): string[] {
  return values.map((value) => value.toLowerCase())
}

function hasAnyKeyword(tokens: readonly string[], keywords: readonly string[]): boolean {
  return tokens.some((token) => keywords.some((keyword) => token.includes(keyword)))
}

function hasUnsupportedDeterministicState(result: Phase3DeterministicSnapshot): boolean {
  const finalClassification = toFinalClassificationValue(result)
  const governanceState = toGovernanceStateValue(result)
  const supportedClassifications = ["HOT", "WARM", "MARGINAL", "NO_DEAL", "REVIEW_REQUIRED"]
  const supportedGovernanceStates = ["PASS", "REVIEW_REQUIRED", "BLOCKED"]

  return (
    !supportedClassifications.includes(finalClassification) ||
    !supportedGovernanceStates.includes(governanceState)
  )
}

function buildGlobalDealState(result: Phase3DeterministicSnapshot): GlobalDealState {
  const finalClassification = toFinalClassificationValue(result)
  const governanceState = toGovernanceStateValue(result)

  if (finalClassification === "NO_DEAL" || governanceState === "BLOCKED") {
    return "no_deal"
  }

  if (hasUnsupportedDeterministicState(result)) {
    return "review_required"
  }

  if (governanceState === "REVIEW_REQUIRED" || finalClassification === "REVIEW_REQUIRED" || result.reviewRequired) {
    return "review_required"
  }

  if (finalClassification === "MARGINAL") {
    return "conditional"
  }

  if (finalClassification === "HOT" || finalClassification === "WARM") {
    return "proceed_candidate"
  }

  return "review_required"
}

function buildEvidenceGapRoute(evidenceGaps: readonly string[]): Phase3EscalationSummary {
  const evidenceTokens = normalizeEvidenceTokens(evidenceGaps)
  const hasValuationGap = hasAnyKeyword(evidenceTokens, [
    "valuation",
    "gdv",
    "comparable",
    "comp",
    "sold",
    "price",
  ])
  const hasLenderGap = hasAnyKeyword(evidenceTokens, [
    "lender",
    "refinance",
    "refi",
    "bridge",
    "loan",
    "ltv",
  ])
  const hasLegalGap = hasAnyKeyword(evidenceTokens, [
    "legal",
    "survey",
    "structural",
    "title",
    "lease",
    "planning",
  ])

  if (hasValuationGap) {
    return {
      route: "valuation_review",
      severity: "high",
      reason: "valuation_evidence_gap",
      source: "evidence_gap_analysis",
      requiresManualReview: true,
      advisoryOnly: true,
    }
  }

  if (hasLenderGap) {
    return {
      route: "lender_review",
      severity: "high",
      reason: "lender_evidence_gap",
      source: "evidence_gap_analysis",
      requiresManualReview: true,
      advisoryOnly: true,
    }
  }

  if (hasLegalGap) {
    return {
      route: "legal_review",
      severity: "high",
      reason: "legal_evidence_gap",
      source: "evidence_gap_analysis",
      requiresManualReview: true,
      advisoryOnly: true,
    }
  }

  return {
    route: "evidence_gap",
    severity: "high",
    reason: "evidence_gap_generic",
    source: "evidence_gap_analysis",
    requiresManualReview: true,
    advisoryOnly: true,
  }
}

function buildEscalationSummary(
  result: Phase3DeterministicSnapshot,
  globalDealState: GlobalDealState,
  evidenceGaps: readonly string[]
): Phase3EscalationSummary {
  if (globalDealState === "no_deal") {
    return {
      route: "capital_protection",
      severity: "critical",
      reason: "capital_protection_block",
      source: "deterministic_snapshot",
      requiresManualReview: true,
      advisoryOnly: true,
    }
  }

  if (evidenceGaps.length > 0) {
    return buildEvidenceGapRoute(evidenceGaps)
  }

  if (result.riskFlags.some((flag) => flag.toLowerCase().includes("structural"))) {
    return {
      route: "structural_risk",
      severity: "high",
      reason: "structural_risk_detected",
      source: "deterministic_snapshot",
      requiresManualReview: true,
      advisoryOnly: true,
    }
  }

  if (hasUnsupportedDeterministicState(result)) {
    return {
      route: "manual_review",
      severity: "high",
      reason: "unknown_state_guardrail",
      source: "orchestrator_guardrail",
      requiresManualReview: true,
      advisoryOnly: true,
    }
  }

  if (result.reviewRequired || result.governanceState === "REVIEW_REQUIRED") {
    return {
      route: "manual_review",
      severity: "medium",
      reason: "governance_review_required",
      source: "deterministic_snapshot",
      requiresManualReview: true,
      advisoryOnly: true,
    }
  }

  return {
    route: "none",
    severity: "none",
    reason: "none",
    source: "deterministic_snapshot",
    requiresManualReview: false,
    advisoryOnly: true,
  }
}

function buildWorkflowState(
  globalDealState: GlobalDealState,
  route: Phase3EscalationSummary["route"]
): Phase3WorkflowState {
  if (globalDealState === "no_deal") return "blocked"
  if (
    route === "evidence_gap" ||
    route === "valuation_review" ||
    route === "lender_review" ||
    route === "legal_review"
  ) {
    return "evidence_review"
  }
  return "governance_review"
}

function buildTasksWithoutDeterministicResult(): Phase3Task[] {
  return [
    {
      id: "deterministic-analysis",
      title: "Run deterministic analysis",
      description: "Run deterministic calculation and governance engines before orchestration progression.",
      category: "deterministic",
      trigger: "missing_deterministic_snapshot",
      source: "orchestrator_guardrail",
      priority: "critical",
      status: "pending",
      route: "none",
      reason: "Deterministic output is required before orchestration can progress.",
      blocksProgression: true,
      blockingScope: "deal_progression",
      advisoryOnly: true,
    },
  ]
}

function buildTasksWithDeterministicResult(
  globalDealState: GlobalDealState,
  escalation: Phase3EscalationSummary,
  evidenceGaps: string[],
  acceptedWithLimitations: boolean
): Phase3Task[] {
  const reviewRequired = globalDealState === "review_required"
  const noDeal = globalDealState === "no_deal"
  const route = escalation.route
  const needsManualReview =
    escalation.requiresManualReview ||
    route === "evidence_gap" ||
    route === "manual_review" ||
    route === "valuation_review" ||
    route === "lender_review" ||
    route === "legal_review" ||
    route === "structural_risk" ||
    route === "capital_protection"
  const hasEvidenceGap = evidenceGaps.length > 0

  return [
    {
      id: "deterministic-analysis",
      title: "Deterministic analysis complete",
      description: "Deterministic snapshot is available for orchestration workflow routing.",
      category: "deterministic",
      trigger: "no_escalation_required",
      source: "deterministic_snapshot",
      priority: "critical",
      status: "completed",
      route: "none",
      reason: "Orchestration received deterministic governance and classification output.",
      blocksProgression: false,
      blockingScope: "none",
      advisoryOnly: true,
    },
    {
      id: "governance-review",
      title: "Governance review task",
      description: "Confirm deterministic governance state and ensure escalation decision is traceable.",
      category: "governance",
      trigger: reviewRequired ? "review_required_state" : "no_escalation_required",
      source: "deterministic_snapshot",
      priority: reviewRequired ? "high" : "low",
      status: reviewRequired ? "in_progress" : "completed",
      route,
      reason: reviewRequired
        ? "Deterministic output requires governance review before progression."
        : "Governance review completed with no additional escalation requirement.",
      blocksProgression: reviewRequired,
      blockingScope: reviewRequired ? "workflow_only" : "none",
      advisoryOnly: true,
    },
    {
      id: "evidence-review",
      title: "Evidence review tasks",
      description: "Review deterministic evidence gap list and request required missing support.",
      category: "evidence",
      trigger: hasEvidenceGap ? "evidence_gap_detected" : "no_escalation_required",
      source: "deterministic_snapshot",
      priority: hasEvidenceGap ? "critical" : "low",
      status: hasEvidenceGap ? "in_progress" : "not_applicable",
      route: hasEvidenceGap ? route : "none",
      reason:
        hasEvidenceGap
          ? `Missing critical evidence: ${evidenceGaps.join(", ")}`
          : "No critical evidence gaps reported in deterministic output.",
      blocksProgression: hasEvidenceGap,
      blockingScope: hasEvidenceGap ? "manual_review" : "none",
      advisoryOnly: true,
    },
    {
      id: "manual-review-routing",
      title: "Manual review routing",
      description: "Route escalated deterministic cases to manual reviewer challenge workflow.",
      category: "manual_review",
      trigger: needsManualReview ? "evidence_gap_detected" : "no_escalation_required",
      source: "orchestrator_guardrail",
      priority: needsManualReview ? "high" : "low",
      status: needsManualReview ? "in_progress" : "not_applicable",
      route: needsManualReview ? "manual_review" : "none",
      reason: needsManualReview
        ? "Escalation requires manual reviewer challenge before progression."
        : "No manual review routing required.",
      blocksProgression: needsManualReview,
      blockingScope: needsManualReview ? "manual_review" : "none",
      advisoryOnly: true,
    },
    {
      id: "capital-protection-stop",
      title: "Capital protection stop review",
      description: "Record deterministic stop state for blocked or no-deal outcomes.",
      category: "governance",
      trigger: noDeal ? "capital_protection_block" : "no_escalation_required",
      source: "deterministic_snapshot",
      priority: noDeal ? "critical" : "low",
      status: noDeal ? "blocked" : "not_applicable",
      route: noDeal ? "capital_protection" : "none",
      reason: noDeal
        ? "Deterministic governance blocked progression; capital protection stop remains active."
        : "No capital protection stop triggered by deterministic output.",
      blocksProgression: noDeal,
      blockingScope: noDeal ? "deal_progression" : "none",
      advisoryOnly: true,
    },
    {
      id: "accepted-limitations-awareness",
      title: "Accepted limitations awareness",
      description: "Surface accepted operational limitations without changing deterministic deal decisions.",
      category: "limitations_awareness",
      trigger: acceptedWithLimitations
        ? "accepted_limitations_present"
        : "no_escalation_required",
      source: "accepted_limitations",
      priority: acceptedWithLimitations ? "medium" : "low",
      status: acceptedWithLimitations ? "in_progress" : "not_applicable",
      route: "none",
      reason: acceptedWithLimitations
        ? "Accepted limitations acknowledged; awareness task created for review discipline."
        : "No accepted limitations supplied for awareness tracking.",
      blocksProgression: false,
      blockingScope: "none",
      advisoryOnly: true,
    },
  ]
}

function normalizeAcceptedLimitations(
  acceptedLimitationsInput: Phase3OrchestrationInput["acceptedLimitations"]
): Phase3AcceptedLimitation[] {
  if (!acceptedLimitationsInput || acceptedLimitationsInput.length === 0) {
    return []
  }

  return acceptedLimitationsInput.filter((limitation): limitation is Phase3AcceptedLimitation =>
    PHASE3_ACCEPTED_LIMITATIONS.includes(limitation)
  )
}

function buildWorkflowFlags(
  deterministicResultProvided: boolean,
  globalDealState: GlobalDealState,
  evidenceGaps: readonly string[],
  acceptedWithLimitations: boolean
): Phase3WorkflowFlag[] {
  const flags: Phase3WorkflowFlag[] = []

  if (!deterministicResultProvided) flags.push("deterministic_snapshot_missing")
  if (acceptedWithLimitations) flags.push("accepted_with_limitations")
  if (evidenceGaps.length > 0) flags.push("evidence_gap_detected")
  if (globalDealState === "review_required") flags.push("review_required")
  if (globalDealState === "no_deal") flags.push("governance_blocked")

  return flags
}

export function buildPhase3Orchestration(
  input: Phase3OrchestrationInput
): Phase3OrchestrationOutput {
  const acceptedLimitations = normalizeAcceptedLimitations(input.acceptedLimitations)
  const deterministicResult = input.deterministicResult
  const deterministicResultProvided = deterministicResult !== undefined
  const acceptedWithLimitations = acceptedLimitations.length > 0

  if (!deterministicResultProvided) {
    const metadata: Phase3OrchestrationMetadata = {
      deterministicResultProvided,
      acceptedLimitations,
      acceptedWithLimitations,
      workflowFlags: buildWorkflowFlags(
        deterministicResultProvided,
        "draft",
        [],
        acceptedWithLimitations
      ),
      evidenceGaps: [],
    }

    return {
      workflowState: "intake",
      globalDealState: "draft",
      governanceEscalationRoute: "none",
      escalation: {
        route: "none",
        severity: "none",
        reason: "none",
        source: "orchestrator_guardrail",
        requiresManualReview: false,
        advisoryOnly: true,
      },
      tasks: buildTasksWithoutDeterministicResult(),
      metadata,
    }
  }

  const evidenceGaps = [...new Set(deterministicResult.missingCriticalEvidence)]
  const globalDealState = buildGlobalDealState(deterministicResult)
  const escalation = buildEscalationSummary(deterministicResult, globalDealState, evidenceGaps)
  const governanceEscalationRoute = escalation.route
  const workflowState = buildWorkflowState(globalDealState, escalation.route)
  const metadata: Phase3OrchestrationMetadata = {
    deterministicResultProvided,
    acceptedLimitations,
    acceptedWithLimitations,
    workflowFlags: buildWorkflowFlags(
      deterministicResultProvided,
      globalDealState,
      evidenceGaps,
      acceptedWithLimitations
    ),
    evidenceGaps,
  }

  return {
    workflowState,
    globalDealState,
    governanceEscalationRoute,
    escalation,
    tasks: buildTasksWithDeterministicResult(
      globalDealState,
      escalation,
      evidenceGaps,
      acceptedWithLimitations
    ),
    metadata,
  }
}
