// Phase 3 enforcement contracts are type definitions only.
// Phase3EnforcementScenario is a pure input type for the enforcement engine.
// No runtime wiring. No app/route/database imports allowed from this file.
// They do not enforce runtime behavior and do not change deterministic outputs.
// No enforcement functions exist in this file.
// Enforcement must fail closed: IF UNCERTAIN → BLOCK, DOWNGRADE OR ESCALATE.
// Advisory outputs may increase review burden, but they may not reduce deterministic risk.
// Future AI remains subordinate to deterministic governance at all times.
// This file must not import app, engine, orchestrator, or React runtime code.

// --- Enforcement system identifiers ---

export const PHASE3_ENFORCEMENT_SYSTEMS = [
  "authority_enforcement_engine",
  "state_hierarchy_enforcement",
  "escalation_priority_engine",
  "advisory_containment_engine",
  "orchestration_guardrails",
  "ui_governance_enforcement",
  "violation_audit_layer",
] as const

export type Phase3EnforcementSystem = typeof PHASE3_ENFORCEMENT_SYSTEMS[number]

// --- Violation types from the enforcement architecture plan ---

export const PHASE3_VIOLATION_TYPES = [
  "advisory_overrides_governance",
  "workflow_overrides_capital_protection",
  "ui_softens_fatal_classification",
  "orchestration_bypasses_decision_gate",
  "evidence_reduces_review_burden",
  "ai_implies_approval",
  "merged_output_downgrades_escalation",
  "task_generation_implies_approval",
  "hidden_warning_or_suppressed_fatal_risk",
  "confidence_inflation_from_weak_evidence",
  "invalid_reject_to_proceed_progression",
  "advisory_route_replaces_capital_protection",
] as const

export type Phase3ViolationType = typeof PHASE3_VIOLATION_TYPES[number]

// --- Enforcement severity ---

export const PHASE3_ENFORCEMENT_SEVERITIES = ["fatal", "high", "medium", "low"] as const

export type Phase3EnforcementSeverity = typeof PHASE3_ENFORCEMENT_SEVERITIES[number]

// --- Runtime safe-fail actions ---

export const PHASE3_RUNTIME_SAFE_FAIL_ACTIONS = [
  "block",
  "downgrade",
  "escalate",
  "request_review",
  "preserve_deterministic_result",
  "block_advisory_upgrade",
  "increase_review_burden",
] as const

export type Phase3RuntimeSafeFailAction = typeof PHASE3_RUNTIME_SAFE_FAIL_ACTIONS[number]

// --- Enforcement outcomes ---

export const PHASE3_ENFORCEMENT_OUTCOMES = [
  "passed",
  "blocked",
  "escalated",
  "downgraded",
  "review_required",
] as const

export type Phase3EnforcementOutcome = typeof PHASE3_ENFORCEMENT_OUTCOMES[number]

// --- Authority violation record ---
// Advisory-only. No persistence or logging is implemented.
// Violation records describe what was attempted and what was protected.
// They do not trigger runtime blocking yet — that requires enforcement wiring in a later step.
export type Phase3AuthorityViolation = {
  violationId: string
  violationType: Phase3ViolationType
  detectedBy: Phase3EnforcementSystem
  severity: Phase3EnforcementSeverity
  attemptedOverride: string
  protectedAuthority: string
  safeFailAction: Phase3RuntimeSafeFailAction
  outcome: Phase3EnforcementOutcome
  advisoryOnly: true
}

// --- Enforcement result ---
// Output of a future enforcement check. Advisory only.
// valid: false means violations were detected; enforcement would apply safe-fail actions.
// Does not yet change runtime behavior.
export type Phase3EnforcementResult = {
  valid: boolean
  outcome: Phase3EnforcementOutcome
  violations: readonly Phase3AuthorityViolation[]
  warnings: readonly string[]
  safeFailActions: readonly Phase3RuntimeSafeFailAction[]
  advisoryOnly: true
}

// --- Escalation enforcement rule ---
// Defines which severity transitions are forbidden.
// Lower severity may not override higher severity.
// Advisory-only — not wired into escalation engine yet.
export type Phase3EscalationEnforcementRule = {
  fromSeverity: string
  attemptedSeverity: string
  allowed: boolean
  safeFailAction: Phase3RuntimeSafeFailAction
  advisoryOnly: true
}

// --- Orchestration guardrail ---
// Describes a boundary the orchestrator must not cross.
// Advisory-only — not wired into orchestrator yet.
export type Phase3OrchestrationGuardrail = {
  guardrailId: string
  protectedAuthority: string
  forbiddenAction: string
  safeFailAction: Phase3RuntimeSafeFailAction
  advisoryOnly: true
}

// --- UI governance rule ---
// Describes a presentation constraint the UI layer must follow.
// Advisory-only — not wired into any UI or display contract enforcement yet.
export type Phase3UIGovernanceRule = {
  ruleId: string
  requiredPresentation: string
  forbiddenPresentation: string
  safeFailAction: Phase3RuntimeSafeFailAction
  advisoryOnly: true
}

// --- Enforcement probe result ---
// Aggregate output of the pure enforcement probe.
// Advisory-only — no runtime wiring. No app/route/database fields.
export type Phase3EnforcementProbeResult = {
  scenarioCount: number
  passedCount: number
  violationCount: number
  results: readonly Phase3EnforcementResult[]
  warnings: readonly string[]
  advisoryOnly: true
}

// --- Enforcement scenario ---
// Input type for the pure enforcement engine.
// Describes an attempted authority override for evaluation.
// Advisory-only — no runtime wiring. No app/route/database fields.
export type Phase3EnforcementScenario = {
  scenarioId: string
  attemptedLayer: string
  protectedAuthority: string
  attemptedAction: string
  violationType: Phase3ViolationType
  detectedBy: Phase3EnforcementSystem
  severity: Phase3EnforcementSeverity
  safeFailAction: Phase3RuntimeSafeFailAction
  advisoryOnly: true
}
