import type { FinalDealClassification, GovernanceState } from "@/types/phase2"

export const PHASE3_WORKFLOW_STATES = [
  "intake",
  "evidence_review",
  "deterministic_analysis",
  "governance_review",
  "investor_review",
  "accepted_with_limitations",
  "blocked",
  "archived",
] as const

export type Phase3WorkflowState = typeof PHASE3_WORKFLOW_STATES[number]

export const GLOBAL_DEAL_STATES = [
  "draft",
  "analysis_ready",
  "review_required",
  "no_deal",
  "conditional",
  "proceed_candidate",
  "accepted_with_limitations",
] as const

export type GlobalDealState = typeof GLOBAL_DEAL_STATES[number]

export const GOVERNANCE_ESCALATION_ROUTES = [
  "none",
  "evidence_gap",
  "capital_protection",
  "structural_risk",
  "legal_review",
  "valuation_review",
  "refurb_review",
  "lender_review",
  "manual_review",
] as const

export type GovernanceEscalationRoute = typeof GOVERNANCE_ESCALATION_ROUTES[number]

export const PHASE3_TASK_STATUSES = [
  "pending",
  "in_progress",
  "blocked",
  "completed",
  "not_applicable",
] as const

export type Phase3TaskStatus = typeof PHASE3_TASK_STATUSES[number]

export const PHASE3_TASK_CATEGORIES = [
  "deterministic",
  "governance",
  "evidence",
  "manual_review",
] as const

export type Phase3TaskCategory = typeof PHASE3_TASK_CATEGORIES[number]

export const PHASE3_TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const

export type Phase3TaskPriority = typeof PHASE3_TASK_PRIORITIES[number]

export const PHASE3_ACCEPTED_LIMITATIONS = [
  "manual_comparable_input",
  "no_automated_sold_price_validation",
  "no_live_market_integrations",
  "no_automated_lender_validation",
  "no_legal_survey_evidence_ingestion",
  "rules_based_refurb_assumptions",
  "no_persistent_analysis_history",
  "no_ai_extraction_or_automation",
] as const

export type Phase3AcceptedLimitation = typeof PHASE3_ACCEPTED_LIMITATIONS[number]

export const PHASE3_WORKFLOW_FLAGS = [
  "accepted_with_limitations",
  "deterministic_snapshot_missing",
  "evidence_gap_detected",
  "review_required",
  "governance_blocked",
] as const

export type Phase3WorkflowFlag = typeof PHASE3_WORKFLOW_FLAGS[number]

export type Phase3Task = {
  id: string
  title: string
  category: Phase3TaskCategory
  priority: Phase3TaskPriority
  status: Phase3TaskStatus
  route: GovernanceEscalationRoute
  reason: string
  blocksProgression: boolean
}

export type Phase3DeterministicSnapshot = {
  governanceState: GovernanceState
  finalClassification: FinalDealClassification
  fatalRisk: boolean
  reviewRequired: boolean
  missingCriticalEvidence: readonly string[]
  blockedBy: readonly string[]
  riskFlags: readonly string[]
}

export type Phase3OrchestrationInput = {
  deterministicResult?: Phase3DeterministicSnapshot
  acceptedLimitations?: readonly Phase3AcceptedLimitation[]
}

export type Phase3OrchestrationMetadata = {
  deterministicResultProvided: boolean
  acceptedLimitations: readonly Phase3AcceptedLimitation[]
  acceptedWithLimitations: boolean
  workflowFlags: readonly Phase3WorkflowFlag[]
  evidenceGaps: readonly string[]
}

export type Phase3OrchestrationOutput = {
  workflowState: Phase3WorkflowState
  globalDealState: GlobalDealState
  governanceEscalationRoute: GovernanceEscalationRoute
  tasks: readonly Phase3Task[]
  metadata: Phase3OrchestrationMetadata
}
