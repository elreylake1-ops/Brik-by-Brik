import type { EvidenceOrchestrationHints } from "@/types/phase3-evidence"
import type {
  GovernanceEscalationRoute,
  Phase3MergeWarning,
  Phase3MergedOrchestrationOutput,
  Phase3MergedTask,
  Phase3OrchestrationOutput,
  Phase3TaskPriority,
  Phase3TaskStatus,
} from "@/types/phase3-orchestration"

const ROUTE_PRIORITY: readonly GovernanceEscalationRoute[] = [
  "capital_protection",
  "structural_risk",
  "legal_review",
  "lender_review",
  "valuation_review",
  "evidence_gap",
  "manual_review",
  "refurb_review",
  "none",
]

function uniqueRoutes(routes: readonly GovernanceEscalationRoute[]): GovernanceEscalationRoute[] {
  const seen = new Set<GovernanceEscalationRoute>()
  const result: GovernanceEscalationRoute[] = []
  for (const route of routes) {
    if (seen.has(route)) continue
    seen.add(route)
    result.push(route)
  }
  return result
}

function choosePrimaryRoute(
  orchestration: Phase3OrchestrationOutput,
  evidenceHints: EvidenceOrchestrationHints
): GovernanceEscalationRoute {
  if (!orchestration.metadata.deterministicResultProvided) {
    return orchestration.governanceEscalationRoute
  }

  if (orchestration.governanceEscalationRoute === "capital_protection") {
    return "capital_protection"
  }

  const candidates = uniqueRoutes([
    orchestration.governanceEscalationRoute,
    ...evidenceHints.escalationRoutes,
  ])
  for (const preferredRoute of ROUTE_PRIORITY) {
    if (candidates.includes(preferredRoute)) {
      return preferredRoute
    }
  }

  return orchestration.governanceEscalationRoute
}

function mapDeterministicTask(task: Phase3OrchestrationOutput["tasks"][number]): Phase3MergedTask {
  return {
    id: task.id,
    source: task.source,
    title: task.title,
    description: task.description,
    category: task.category,
    trigger: task.trigger,
    priority: task.priority,
    status: task.status,
    escalationRoute: task.route,
    blocksProgression: task.blocksProgression,
    advisoryOnly: true,
  }
}

function buildHintTitle(task: EvidenceOrchestrationHints["tasks"][number]): string {
  if (task.trigger === "weak_evidence" && task.category === "comparable_evidence") {
    return "Weak comparable evidence review"
  }
  if (task.trigger === "conflicting_evidence" && task.category === "legal_survey_evidence") {
    return "Legal conflict evidence review"
  }
  if (task.trigger === "accepted_evidence_awareness" && task.category === "operator_note") {
    return "Accepted operator note awareness"
  }
  if (task.trigger === "missing_evidence" && task.category === "lender_refinance_evidence") {
    return "Missing lender evidence review"
  }
  return task.summary
}

function buildHintDescription(task: EvidenceOrchestrationHints["tasks"][number]): string {
  if (task.trigger === "weak_evidence" && task.category === "comparable_evidence") {
    return "Comparable evidence is weak. Advisory review required before confidence is treated as clean."
  }
  if (task.trigger === "conflicting_evidence" && task.category === "legal_survey_evidence") {
    return "Legal and survey evidence conflict detected. Advisory manual legal review is required."
  }
  if (task.trigger === "accepted_evidence_awareness" && task.category === "operator_note") {
    return "Accepted operator note is awareness-only and has no deterministic approval effect."
  }
  if (task.trigger === "missing_evidence" && task.category === "lender_refinance_evidence") {
    return "Lender refinance evidence is missing. Advisory review should be queued for lender validation."
  }
  return task.summary
}

function resolveEvidenceTaskStatus(
  orchestration: Phase3OrchestrationOutput,
  hintPriority: Phase3TaskPriority
): Phase3TaskStatus {
  if (!orchestration.metadata.deterministicResultProvided) {
    return "pending"
  }
  if (hintPriority === "low") {
    return "in_progress"
  }
  return "in_progress"
}

function mapEvidenceTask(
  orchestration: Phase3OrchestrationOutput,
  task: EvidenceOrchestrationHints["tasks"][number]
): Phase3MergedTask {
  return {
    id: task.id,
    source: "evidence_hint",
    title: buildHintTitle(task),
    description: buildHintDescription(task),
    category: task.suggestedTaskCategory,
    trigger: task.trigger,
    priority: task.suggestedTaskPriority,
    status: resolveEvidenceTaskStatus(orchestration, task.suggestedTaskPriority),
    escalationRoute: task.suggestedEscalationRoute,
    blocksProgression: task.trigger === "conflicting_evidence",
    advisoryOnly: true,
  }
}

function hasTaskById(tasks: readonly Phase3MergedTask[], id: string): boolean {
  return tasks.some((task) => task.id === id)
}

function buildWarnings(
  orchestration: Phase3OrchestrationOutput,
  evidenceHints: EvidenceOrchestrationHints,
  primaryRoute: GovernanceEscalationRoute,
  mergedTasks: readonly Phase3MergedTask[]
): Phase3MergeWarning[] {
  const warnings: Phase3MergeWarning[] = []
  const seenMessages = new Set<string>()

  function pushWarning(warning: Phase3MergeWarning): void {
    if (seenMessages.has(warning.message)) return
    seenMessages.add(warning.message)
    warnings.push(warning)
  }

  if (primaryRoute === "capital_protection" && evidenceHints.tasks.length > 0) {
    pushWarning({
      id: "warn-det-capital-protection-priority",
      source: "orchestrator_guardrail",
      message: "Capital protection remains primary and must not be downgraded by evidence hints.",
      relatedTaskId: hasTaskById(mergedTasks, "capital-protection-stop")
        ? "capital-protection-stop"
        : undefined,
      advisoryOnly: true,
    })
  }

  if (!orchestration.metadata.deterministicResultProvided && evidenceHints.tasks.length > 0) {
    pushWarning({
      id: "warn-intake-deterministic-pending",
      source: "orchestrator_guardrail",
      message: "Deterministic snapshot is not yet available; merged output remains intake-only advisory state.",
      relatedTaskId: hasTaskById(mergedTasks, "deterministic-analysis")
        ? "deterministic-analysis"
        : undefined,
      advisoryOnly: true,
    })
  }

  for (const task of evidenceHints.tasks) {
    if (task.trigger === "weak_evidence" && task.category === "comparable_evidence") {
      pushWarning({
        id: "warn-weak-comp-001",
        source: "evidence_hint",
        message: "Weak comparable evidence is advisory and does not soften deterministic no_deal outcome.",
        relatedTaskId: task.id,
        relatedEvidenceItemId: task.evidenceItemId,
        advisoryOnly: true,
      })
      continue
    }

    if (task.trigger === "conflicting_evidence" && task.category === "legal_survey_evidence") {
      pushWarning({
        id: "warn-legal-conflict-001",
        source: "evidence_hint",
        message: "Conflicting legal evidence requires manual legal review and cannot be auto-resolved.",
        relatedTaskId: task.id,
        relatedEvidenceItemId: task.evidenceItemId,
        advisoryOnly: true,
      })
      continue
    }

    if (task.trigger === "missing_evidence" && task.category === "lender_refinance_evidence") {
      pushWarning({
        id: "warn-lender-missing-001",
        source: "evidence_hint",
        message: "Missing lender evidence is advisory until deterministic analysis is completed.",
        relatedTaskId: task.id,
        relatedEvidenceItemId: task.evidenceItemId,
        advisoryOnly: true,
      })
    }
  }

  for (const warningMessage of evidenceHints.warnings) {
    if (warnings.some((warning) => warning.message === warningMessage)) continue
  }

  return warnings
}

function buildSecondaryRoutes(
  orchestration: Phase3OrchestrationOutput,
  evidenceHints: EvidenceOrchestrationHints,
  primaryRoute: GovernanceEscalationRoute,
  mergedTasks: readonly Phase3MergedTask[]
): GovernanceEscalationRoute[] {
  const secondaryCandidates: GovernanceEscalationRoute[] = []

  for (const route of evidenceHints.escalationRoutes) {
    if (route !== "none") {
      secondaryCandidates.push(route)
    }
  }

  for (const task of mergedTasks) {
    if (task.escalationRoute !== "none") {
      secondaryCandidates.push(task.escalationRoute)
    }
  }

  const deduped = uniqueRoutes(secondaryCandidates)
  return deduped.filter((route) => route !== primaryRoute && route !== "none")
}

export function mergeOrchestrationWithEvidenceHints(
  orchestration: Phase3OrchestrationOutput,
  evidenceHints: EvidenceOrchestrationHints
): Phase3MergedOrchestrationOutput {
  const deterministicTasks = orchestration.tasks.map(mapDeterministicTask)
  const deterministicTaskIds = new Set(deterministicTasks.map((task) => task.id))

  const evidenceTasks = evidenceHints.tasks
    .filter((task) => !deterministicTaskIds.has(task.id))
    .map((task) => mapEvidenceTask(orchestration, task))

  const mergedTasks = [...deterministicTasks, ...evidenceTasks]
  const primaryEscalationRoute = choosePrimaryRoute(orchestration, evidenceHints)
  const secondaryEscalationRoutes = buildSecondaryRoutes(
    orchestration,
    evidenceHints,
    primaryEscalationRoute,
    mergedTasks
  )
  const warnings = buildWarnings(orchestration, evidenceHints, primaryEscalationRoute, mergedTasks)

  return {
    workflowState: orchestration.workflowState,
    globalDealState: orchestration.globalDealState,
    primaryEscalationRoute,
    secondaryEscalationRoutes,
    tasks: mergedTasks,
    warnings,
    metadata: {
      deterministicTaskCount: deterministicTasks.length,
      evidenceHintCount: evidenceHints.tasks.length,
      mergedTaskCount: mergedTasks.length,
      warningCount: warnings.length,
      reviewRequired: orchestration.globalDealState === "no_deal"
        ? true
        : orchestration.metadata.deterministicResultProvided
          ? (orchestration.globalDealState === "review_required" || evidenceHints.reviewRequired)
          : evidenceHints.reviewRequired,
      advisoryOnly: true,
    },
    advisoryOnly: true,
  }
}
