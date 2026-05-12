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

export type Phase3Task = {
  id: string
  title: string
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
  missingCriticalEvidence: string[]
  blockedBy: string[]
  riskFlags: string[]
}

export type Phase3OrchestrationInput = {
  deterministicResult?: Phase3DeterministicSnapshot
  acceptedLimitations?: string[]
}

export type Phase3OrchestrationOutput = {
  workflowState: Phase3WorkflowState
  globalDealState: GlobalDealState
  governanceEscalationRoute: GovernanceEscalationRoute
  tasks: Phase3Task[]
  metadata: {
    deterministicResultProvided: boolean
    acceptedLimitations: string[]
    acceptedWithLimitations: boolean
    workflowFlags: Phase3WorkflowState[]
    evidenceGaps: string[]
  }
}
