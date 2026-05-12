import type {
  GlobalDealState,
  GovernanceEscalationRoute,
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

function buildGlobalDealState(result: Phase3DeterministicSnapshot): GlobalDealState {
  const finalClassification = toFinalClassificationValue(result)
  const governanceState = toGovernanceStateValue(result)

  if (finalClassification === "NO_DEAL" || governanceState === "BLOCKED") {
    return "no_deal"
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

function buildEscalationRoute(result: Phase3DeterministicSnapshot): GovernanceEscalationRoute {
  if (result.missingCriticalEvidence.length > 0) {
    return "evidence_gap"
  }

  if (result.riskFlags.some((flag) => flag.toLowerCase().includes("structural"))) {
    return "structural_risk"
  }

  if (result.fatalRisk || result.blockedBy.some((reason) => reason.toLowerCase().includes("capital"))) {
    return "capital_protection"
  }

  if (result.reviewRequired || result.governanceState === "REVIEW_REQUIRED") {
    return "manual_review"
  }

  return "none"
}

function buildWorkflowState(
  globalDealState: GlobalDealState,
  route: GovernanceEscalationRoute
): Phase3WorkflowState {
  if (globalDealState === "no_deal") return "blocked"
  if (route === "evidence_gap") return "evidence_review"
  return "governance_review"
}

function buildTasksWithoutDeterministicResult(): Phase3Task[] {
  return [
    {
      id: "deterministic-analysis",
      title: "Run deterministic analysis",
      category: "deterministic",
      priority: "critical",
      status: "pending",
      route: "none",
      reason: "Deterministic output is required before orchestration can progress.",
      blocksProgression: true,
    },
    {
      id: "governance-routing",
      title: "Prepare governance escalation routing",
      category: "governance",
      priority: "low",
      status: "not_applicable",
      route: "none",
      reason: "Awaiting deterministic analysis result.",
      blocksProgression: false,
    },
  ]
}

function buildTasksWithDeterministicResult(
  route: GovernanceEscalationRoute,
  evidenceGaps: string[]
): Phase3Task[] {
  const needsManualReview = route === "evidence_gap" || route === "manual_review"

  return [
    {
      id: "deterministic-analysis",
      title: "Deterministic analysis complete",
      category: "deterministic",
      priority: "critical",
      status: "completed",
      route: "none",
      reason: "Orchestration received deterministic governance and classification output.",
      blocksProgression: false,
    },
    {
      id: "governance-routing",
      title: "Governance escalation routing",
      category: "governance",
      priority: route === "none" ? "low" : "high",
      status: route === "none" ? "completed" : "in_progress",
      route,
      reason: route === "none" ? "No escalation route required." : `Escalation route set to ${route}.`,
      blocksProgression: route !== "none",
    },
    {
      id: "evidence-review",
      title: "Evidence review tasks",
      category: "evidence",
      priority: evidenceGaps.length > 0 ? "critical" : "low",
      status: evidenceGaps.length > 0 ? "blocked" : "not_applicable",
      route: evidenceGaps.length > 0 ? "evidence_gap" : "none",
      reason:
        evidenceGaps.length > 0
          ? `Missing critical evidence: ${evidenceGaps.join(", ")}`
          : "No critical evidence gaps reported in deterministic output.",
      blocksProgression: evidenceGaps.length > 0,
    },
    {
      id: "manual-review-routing",
      title: "Manual review routing",
      category: "manual_review",
      priority: needsManualReview ? "high" : "low",
      status: needsManualReview ? "in_progress" : "not_applicable",
      route: needsManualReview ? "manual_review" : "none",
      reason: needsManualReview
        ? "Escalation requires manual reviewer challenge before progression."
        : "No manual review routing required.",
      blocksProgression: needsManualReview,
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
      tasks: buildTasksWithoutDeterministicResult(),
      metadata,
    }
  }

  const evidenceGaps = [...deterministicResult.missingCriticalEvidence]
  const globalDealState = buildGlobalDealState(deterministicResult)
  const governanceEscalationRoute = buildEscalationRoute(deterministicResult)
  const workflowState = buildWorkflowState(globalDealState, governanceEscalationRoute)
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
    tasks: buildTasksWithDeterministicResult(governanceEscalationRoute, evidenceGaps),
    metadata,
  }
}
