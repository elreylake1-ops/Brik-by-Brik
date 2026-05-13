import type {
  GovernanceEscalationRoute,
  Phase3TaskCategory,
  Phase3TaskPriority,
} from "@/types/phase3-orchestration"

export const EVIDENCE_CATEGORIES = [
  "comparable_evidence",
  "listing_evidence",
  "refurb_evidence",
  "legal_survey_evidence",
  "lender_refinance_evidence",
  "market_evidence",
  "operator_note",
  "system_generated_evidence",
] as const

export type EvidenceCategory = typeof EVIDENCE_CATEGORIES[number]

export const EVIDENCE_STATUSES = [
  "missing",
  "provided",
  "weak",
  "conflicting",
  "requires_review",
  "accepted",
  "rejected",
  "not_applicable",
] as const

export type EvidenceStatus = typeof EVIDENCE_STATUSES[number]

export const EVIDENCE_SOURCES = [
  "user_supplied",
  "operator_entered",
  "system_generated",
  "third_party_document",
  "future_ai_extracted",
  "future_integration",
  "unknown",
] as const

export type EvidenceSource = typeof EVIDENCE_SOURCES[number]

export const EVIDENCE_CONFIDENCE_LEVELS = ["high", "medium", "low", "unknown"] as const

export type EvidenceConfidence = typeof EVIDENCE_CONFIDENCE_LEVELS[number]

// Advisory-only contract. These fields describe evidence quality and must not override
// deterministic deal decisions from the core engine.
// `future_ai_extracted` and `future_integration` are reserved source labels only.
// This file defines types only and does not implement AI, scraping, persistence, or integrations.
export type Phase3EvidenceItem = {
  id: string
  category: EvidenceCategory
  status: EvidenceStatus
  source: EvidenceSource
  confidence: EvidenceConfidence
  label: string
  summary?: string
  stableCode?: string
  relatedField?: string
  issues?: readonly string[]
  warnings?: readonly string[]
  advisoryOnly: true
}

export type Phase3EvidenceBundle = {
  items: readonly Phase3EvidenceItem[]
  missingCriticalEvidence: readonly string[]
  conflictingEvidence: readonly string[]
  reviewRequired: boolean
  confidence: EvidenceConfidence
  advisoryOnly: true
}

export type Phase3EvidenceBundleValidationResult = {
  valid: boolean
  errors: readonly string[]
  warnings: readonly string[]
  requiresReview: boolean
}

export const EVIDENCE_ORCHESTRATION_HINT_TRIGGERS = [
  "missing_evidence",
  "weak_evidence",
  "conflicting_evidence",
  "reserved_source_review",
  "operator_note",
  "accepted_evidence_awareness",
  "duplicate_evidence",
  "contract_warning",
] as const

export type EvidenceOrchestrationHintTrigger =
  typeof EVIDENCE_ORCHESTRATION_HINT_TRIGGERS[number]

export const EVIDENCE_ORCHESTRATION_HINT_SEVERITIES = ["low", "medium", "high"] as const

export type EvidenceOrchestrationHintSeverity =
  typeof EVIDENCE_ORCHESTRATION_HINT_SEVERITIES[number]

// Hint contracts only:
// - these do not create Phase3Task objects
// - these do not change deterministic governance or classifications
// - these do not approve evidence as truth
// - these are not wired into runtime behavior
export type EvidenceOrchestrationHint = {
  id: string
  evidenceItemId?: string
  category: EvidenceCategory
  trigger: EvidenceOrchestrationHintTrigger
  severity: EvidenceOrchestrationHintSeverity
  suggestedTaskCategory: Phase3TaskCategory
  suggestedTaskPriority: Phase3TaskPriority
  suggestedEscalationRoute: GovernanceEscalationRoute
  summary: string
  warnings?: readonly string[]
  advisoryOnly: true
}

export type EvidenceOrchestrationHints = {
  tasks: readonly EvidenceOrchestrationHint[]
  escalationRoutes: readonly GovernanceEscalationRoute[]
  warnings: readonly string[]
  reviewRequired: boolean
  advisoryOnly: true
}
