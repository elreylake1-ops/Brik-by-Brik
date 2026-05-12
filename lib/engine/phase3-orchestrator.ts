import type {
  GlobalDealState,
  GovernanceEscalationRoute,
  Phase3DeterministicSnapshot,
  Phase3OrchestrationInput,
  Phase3OrchestrationOutput,
  Phase3Task,
  Phase3WorkflowState,
} from "@/types/phase3-orchestration"

function buildGlobalDealState(result: Phase3DeterministicSnapshot): GlobalDealState {
  if (result.finalClassification === "NO_DEAL" || result.governanceState === "BLOCKED") {
    return "no_deal"
  }

  if (result.finalClassification === "REVIEW_REQUIRED" || result.reviewRequired) {
    return "review_required"
  }

  if (result.finalClassification === "MARGINAL") {
    return "conditional"
  }

  if (result.finalClassification === "HOT" || result.finalClassification === "WARM") {
    return "proceed_candidate"
  }

  return "analysis_ready"
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
      status: "pending",
      route: "none",
      reason: "Deterministic output is required before orchestration can progress.",
      blocksProgression: true,
    },
    {
      id: "governance-routing",
      title: "Prepare governance escalation routing",
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
  return [
    {
      id: "deterministic-analysis",
      title: "Deterministic analysis complete",
      status: "completed",
      route: "none",
      reason: "Orchestration received deterministic governance and classification output.",
      blocksProgression: false,
    },
    {
      id: "governance-routing",
      title: "Governance escalation routing",
      status: route === "none" ? "completed" : "in_progress",
      route,
      reason: route === "none" ? "No escalation route required." : `Escalation route set to ${route}.`,
      blocksProgression: route !== "none",
    },
    {
      id: "evidence-review",
      title: "Evidence review tasks",
      status: evidenceGaps.length > 0 ? "blocked" : "not_applicable",
      route: evidenceGaps.length > 0 ? "evidence_gap" : "none",
      reason:
        evidenceGaps.length > 0
          ? `Missing critical evidence: ${evidenceGaps.join(", ")}`
          : "No critical evidence gaps reported in deterministic output.",
      blocksProgression: evidenceGaps.length > 0,
    },
  ]
}

export function buildPhase3Orchestration(
  input: Phase3OrchestrationInput
): Phase3OrchestrationOutput {
  const acceptedLimitations = [...(input.acceptedLimitations ?? [])]
  const deterministicResult = input.deterministicResult
  const deterministicResultProvided = deterministicResult !== undefined
  const acceptedWithLimitations = acceptedLimitations.length > 0

  if (!deterministicResultProvided) {
    return {
      workflowState: "intake",
      globalDealState: "draft",
      governanceEscalationRoute: "none",
      tasks: buildTasksWithoutDeterministicResult(),
      metadata: {
        deterministicResultProvided,
        acceptedLimitations,
        acceptedWithLimitations,
        workflowFlags: acceptedWithLimitations ? ["accepted_with_limitations"] : [],
        evidenceGaps: [],
      },
    }
  }

  const evidenceGaps = [...deterministicResult.missingCriticalEvidence]
  const globalDealState = buildGlobalDealState(deterministicResult)
  const governanceEscalationRoute = buildEscalationRoute(deterministicResult)
  const workflowState = buildWorkflowState(globalDealState, governanceEscalationRoute)

  return {
    workflowState,
    globalDealState,
    governanceEscalationRoute,
    tasks: buildTasksWithDeterministicResult(governanceEscalationRoute, evidenceGaps),
    metadata: {
      deterministicResultProvided,
      acceptedLimitations,
      acceptedWithLimitations,
      workflowFlags: acceptedWithLimitations ? ["accepted_with_limitations"] : [],
      evidenceGaps,
    },
  }
}
