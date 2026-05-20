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

// --- Phase 3A-4 Severity and precedence contracts ---
// Contracts only: no runtime precedence resolution behavior is implemented yet.
// CRITICAL and FATAL tiers are blocking tiers for future runtime enforcement wiring.
// Precedence rules protect deterministic governance authority from lower-authority layers.
// No AI behavior is added by this file.

export const PHASE3A4_SEVERITY_TIERS = [
  "info",
  "warning",
  "high",
  "critical",
  "fatal",
] as const

export type Phase3A4SeverityTier = typeof PHASE3A4_SEVERITY_TIERS[number]

export const PHASE3A4_BLOCKING_SEVERITY_TIERS = ["critical", "fatal"] as const

export type Phase3A4PrecedenceLayer =
  | "governance"
  | "capital_protection"
  | "fatal_risk"
  | "deterministic_classification"
  | "deterministic_output"
  | "authority_enforcement"
  | "workflow"
  | "scoring"
  | "evidence_hint"
  | "advisory_output"
  | "ai_commentary"
  | "ui_presentation"

export type Phase3A4PrecedenceRule = {
  ruleId: string
  winner: Phase3A4PrecedenceLayer
  loser: Phase3A4PrecedenceLayer
  reason: string
  blocksProgression: boolean
  advisoryOnly: true
}

export type Phase3A4PrecedenceMatrix = {
  rules: readonly Phase3A4PrecedenceRule[]
  advisoryOnly: true
}

export const PHASE3A4_PRECEDENCE_RULES: readonly Phase3A4PrecedenceRule[] = [
  {
    ruleId: "governance-beats-workflow",
    winner: "governance",
    loser: "workflow",
    reason: "Governance authority cannot be downgraded or replaced by workflow routing.",
    blocksProgression: true,
    advisoryOnly: true,
  },
  {
    ruleId: "capital-protection-beats-scoring",
    winner: "capital_protection",
    loser: "scoring",
    reason: "Capital protection remains dominant over scoring or confidence outputs.",
    blocksProgression: true,
    advisoryOnly: true,
  },
  {
    ruleId: "fatal-risk-beats-advisory-output",
    winner: "fatal_risk",
    loser: "advisory_output",
    reason: "Fatal risk signals cannot be softened by advisory output layers.",
    blocksProgression: true,
    advisoryOnly: true,
  },
  {
    ruleId: "deterministic-classification-beats-evidence-hint",
    winner: "deterministic_classification",
    loser: "evidence_hint",
    reason: "Evidence hints are advisory and cannot override deterministic classification.",
    blocksProgression: true,
    advisoryOnly: true,
  },
  {
    ruleId: "deterministic-output-beats-ai-commentary",
    winner: "deterministic_output",
    loser: "ai_commentary",
    reason: "AI commentary is advisory-only and cannot override deterministic outputs.",
    blocksProgression: true,
    advisoryOnly: true,
  },
  {
    ruleId: "authority-enforcement-beats-ui-presentation",
    winner: "authority_enforcement",
    loser: "ui_presentation",
    reason: "UI presentation cannot bypass or soften enforcement authority decisions.",
    blocksProgression: true,
    advisoryOnly: true,
  },
] as const

export const PHASE3A4_PRECEDENCE_MATRIX: Phase3A4PrecedenceMatrix = {
  rules: PHASE3A4_PRECEDENCE_RULES,
  advisoryOnly: true,
}

// --- Phase 3A-4 Safe runtime mode and governance version metadata contracts ---
// Contracts only: no runtime sandbox behavior is implemented yet.
// No persistence or external actions are added by this file.
// Version metadata is traceability metadata only.
// No runtime wiring exists in this contract layer.

export const PHASE3A4_RUNTIME_MODES = ["safe_runtime_mode"] as const

export type Phase3A4RuntimeMode = typeof PHASE3A4_RUNTIME_MODES[number]

export const PHASE3A4_SANDBOX_RULES = [
  "no_persistence",
  "no_external_actions",
  "no_live_workflow_mutation",
  "no_crm_action",
  "no_automated_offer_action",
] as const

export type Phase3A4RuntimeSandboxRule = typeof PHASE3A4_SANDBOX_RULES[number]

export type Phase3A4GovernanceVersionMetadata = {
  governanceVersion: string
  doctrineVersion: string
  enforcementVersion: string
  runtimeIntegrationVersion: string
  advisoryOnly: true
}

export type Phase3A4SafeRuntimeModeContract = {
  runtimeMode: Phase3A4RuntimeMode
  sandboxRules: readonly Phase3A4RuntimeSandboxRule[]
  governanceVersion: Phase3A4GovernanceVersionMetadata
  allowsPersistence: false
  allowsExternalActions: false
  allowsLiveWorkflowMutation: false
  allowsCrmAction: false
  allowsAutomatedOfferAction: false
  advisoryOnly: true
}

export const PHASE3A4_GOVERNANCE_VERSION_METADATA: Phase3A4GovernanceVersionMetadata = {
  governanceVersion: "phase-3A-4",
  doctrineVersion: "phase-3A-2",
  enforcementVersion: "phase-3A-3",
  runtimeIntegrationVersion: "phase-3A-4",
  advisoryOnly: true,
}

export const PHASE3A4_SAFE_RUNTIME_MODE_CONTRACT: Phase3A4SafeRuntimeModeContract = {
  runtimeMode: "safe_runtime_mode",
  sandboxRules: PHASE3A4_SANDBOX_RULES,
  governanceVersion: PHASE3A4_GOVERNANCE_VERSION_METADATA,
  allowsPersistence: false,
  allowsExternalActions: false,
  allowsLiveWorkflowMutation: false,
  allowsCrmAction: false,
  allowsAutomatedOfferAction: false,
  advisoryOnly: true,
}

// --- Phase 3A-4 Conflict visualization and enforcement telemetry contracts ---
// Contracts only: no runtime conflict detection behavior is implemented yet.
// No telemetry storage or persistence is added in this file.
// Conflict visualization supports future developer review/debugging only.
// Telemetry fields are future analytics/QA metadata only.

export const PHASE3A4_CONFLICT_TYPES = [
  "workflow_governance_mismatch",
  "capital_protection_scoring_conflict",
  "fatal_risk_advisory_conflict",
  "deterministic_classification_evidence_conflict",
  "deterministic_output_ai_conflict",
  "authority_enforcement_ui_conflict",
] as const

export type Phase3A4ConflictType = typeof PHASE3A4_CONFLICT_TYPES[number]

export const PHASE3A4_CONFLICT_WINNERS = [
  "governance",
  "capital_protection",
  "fatal_risk",
  "deterministic_classification",
  "deterministic_output",
  "authority_enforcement",
] as const

export type Phase3A4ConflictWinner = typeof PHASE3A4_CONFLICT_WINNERS[number]

export const PHASE3A4_BLOCKED_LAYERS = [
  "workflow",
  "scoring",
  "advisory_output",
  "evidence_hint",
  "ai_commentary",
  "ui_presentation",
] as const

export type Phase3A4BlockedLayer = typeof PHASE3A4_BLOCKED_LAYERS[number]

export type Phase3A4ConflictVisualization = {
  conflictDetected: boolean
  conflictType: Phase3A4ConflictType
  authoritativeWinner: Phase3A4ConflictWinner
  blockedLayer: Phase3A4BlockedLayer
  reason: string
  advisoryOnly: true
}

export type Phase3A4EnforcementTelemetry = {
  violationCount: number
  blockedOverrideCount: number
  escalationConflictCount: number
  advisoryContainmentCount: number
  loopBreakerTriggered: boolean
  manualReviewEscalations: number
  advisoryOnly: true
}

export const PHASE3A4_ZERO_ENFORCEMENT_TELEMETRY: Phase3A4EnforcementTelemetry = {
  violationCount: 0,
  blockedOverrideCount: 0,
  escalationConflictCount: 0,
  advisoryContainmentCount: 0,
  loopBreakerTriggered: false,
  manualReviewEscalations: 0,
  advisoryOnly: true,
}
