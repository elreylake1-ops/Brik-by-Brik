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

export const PHASE3_ESCALATION_SEVERITIES = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
] as const

export type Phase3EscalationSeverity = typeof PHASE3_ESCALATION_SEVERITIES[number]

export const PHASE3_ESCALATION_REASONS = [
  "none",
  "capital_protection_block",
  "evidence_gap_generic",
  "valuation_evidence_gap",
  "lender_evidence_gap",
  "legal_evidence_gap",
  "structural_risk_detected",
  "governance_review_required",
  "unknown_state_guardrail",
] as const

export type Phase3EscalationReason = typeof PHASE3_ESCALATION_REASONS[number]

export const PHASE3_ESCALATION_SOURCES = [
  "deterministic_snapshot",
  "evidence_gap_analysis",
  "orchestrator_guardrail",
] as const

export type Phase3EscalationSource = typeof PHASE3_ESCALATION_SOURCES[number]

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
  "limitations_awareness",
] as const

export type Phase3TaskCategory = typeof PHASE3_TASK_CATEGORIES[number]

export const PHASE3_TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const

export type Phase3TaskPriority = typeof PHASE3_TASK_PRIORITIES[number]

export const PHASE3_TASK_TRIGGERS = [
  "missing_deterministic_snapshot",
  "review_required_state",
  "evidence_gap_detected",
  "capital_protection_block",
  "accepted_limitations_present",
  "no_escalation_required",
] as const

export type Phase3TaskTrigger = typeof PHASE3_TASK_TRIGGERS[number]

export const PHASE3_TASK_SOURCES = [
  "deterministic_snapshot",
  "accepted_limitations",
  "orchestrator_guardrail",
] as const

export type Phase3TaskSource = typeof PHASE3_TASK_SOURCES[number]

export const PHASE3_TASK_BLOCKING_SCOPES = [
  "none",
  "workflow_only",
  "manual_review",
  "deal_progression",
] as const

export type Phase3TaskBlockingScope = typeof PHASE3_TASK_BLOCKING_SCOPES[number]

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
  description: string
  category: Phase3TaskCategory
  trigger: Phase3TaskTrigger
  source: Phase3TaskSource
  priority: Phase3TaskPriority
  status: Phase3TaskStatus
  route: GovernanceEscalationRoute
  reason: string
  blocksProgression: boolean
  blockingScope: Phase3TaskBlockingScope
  advisoryOnly: true
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

export type Phase3EscalationSummary = {
  route: GovernanceEscalationRoute
  severity: Phase3EscalationSeverity
  reason: Phase3EscalationReason
  source: Phase3EscalationSource
  requiresManualReview: boolean
  advisoryOnly: true
}

export type Phase3OrchestrationOutput = {
  workflowState: Phase3WorkflowState
  globalDealState: GlobalDealState
  governanceEscalationRoute: GovernanceEscalationRoute
  escalation: Phase3EscalationSummary
  tasks: readonly Phase3Task[]
  metadata: Phase3OrchestrationMetadata
}
