// Phase 3 authority contracts are constitutional metadata only.
// They do not enforce runtime behavior yet and do not change deterministic outputs.
// Advisory layers may increase review burden, but they may not reduce deterministic risk.
// Future AI remains advisory-only and cannot become authoritative through this file.

export const PHASE3_AUTHORITY_LEVELS = ["authoritative", "advisory", "presentation"] as const

export type Phase3AuthorityLevel = typeof PHASE3_AUTHORITY_LEVELS[number]

export const PHASE3_AUTHORITY_LAYERS = [
  "deterministic_governance",
  "capital_protection",
  "deal_classification",
  "workflow_orchestration",
  "evidence_advisory",
  "ui_presentation",
  "future_ai_assistance",
] as const

export type Phase3AuthorityLayer = typeof PHASE3_AUTHORITY_LAYERS[number]

export const PHASE3_AUTHORITATIVE_OUTPUTS = [
  "true_mao",
  "finance_calculation",
  "capital_protection",
  "governance_threshold",
  "deal_classification",
  "decision_gate",
  "fatal_risk_detection",
  "deterministic_final_result",
] as const

export type Phase3AuthoritativeOutput = typeof PHASE3_AUTHORITATIVE_OUTPUTS[number]

export const PHASE3_ADVISORY_OUTPUTS = [
  "evidence_hint",
  "review_suggestion",
  "workflow_routing",
  "advisory_task",
  "investor_summary",
  "ai_commentary",
  "evidence_confidence_indicator",
  "merged_advisory_output",
  "developer_review_surface_output",
] as const

export type Phase3AdvisoryOutput = typeof PHASE3_ADVISORY_OUTPUTS[number]

export const PHASE3_STATE_OWNERS = [
  "governance_layer",
  "deterministic_engine",
  "orchestrator",
  "evidence_layer",
  "advisory_layer",
  "ui_layer",
  "future_ai_layer",
] as const

export type Phase3StateOwner = typeof PHASE3_STATE_OWNERS[number]

export const PHASE3_ESCALATION_PRIORITIES = [
  "fatal",
  "reject",
  "manual_review_required",
  "conditional",
  "strong_opportunity",
] as const

export type Phase3EscalationPriority = typeof PHASE3_ESCALATION_PRIORITIES[number]

export const PHASE3_SAFE_FAIL_ACTIONS = [
  "preserve_deterministic_result",
  "increase_review_burden",
  "downgrade_confidence",
  "require_manual_review",
  "block_advisory_upgrade",
] as const

export type Phase3SafeFailAction = typeof PHASE3_SAFE_FAIL_ACTIONS[number]

export type Phase3StateOwnershipRule = {
  stateName: string
  owningLayer: Phase3StateOwner
  authorityLevel: Phase3AuthorityLevel
  mayBeModifiedBy: readonly Phase3StateOwner[]
  mayNotBeModifiedBy: readonly Phase3StateOwner[]
  safeFailAction: Phase3SafeFailAction
  advisoryOnly: boolean
}

export type Phase3AuthorityDoctrine = {
  doctrineName: string
  permanentRule: string
  hierarchy: readonly Phase3AuthorityLayer[]
  authoritativeOutputs: readonly Phase3AuthoritativeOutput[]
  advisoryOutputs: readonly Phase3AdvisoryOutput[]
  escalationPriority: readonly Phase3EscalationPriority[]
  stateOwnershipRules: readonly Phase3StateOwnershipRule[]
  advisoryOnly: true
}

export type Phase3AuthorityValidationResult = {
  valid: boolean
  errors: readonly string[]
  warnings: readonly string[]
  advisoryOnly: true
}

export const PHASE3_AUTHORITY_HIERARCHY: readonly Phase3AuthorityLayer[] = [
  "deterministic_governance",
  "capital_protection",
  "deal_classification",
  "workflow_orchestration",
  "evidence_advisory",
  "ui_presentation",
  "future_ai_assistance",
] as const

export const PHASE3_ESCALATION_PRIORITY: readonly Phase3EscalationPriority[] = [
  "fatal",
  "reject",
  "manual_review_required",
  "conditional",
  "strong_opportunity",
] as const

const DETERMINISTIC_STATE_OWNERSHIP_RULES: readonly Phase3StateOwnershipRule[] = [
  {
    stateName: "true_mao",
    owningLayer: "deterministic_engine",
    authorityLevel: "authoritative",
    mayBeModifiedBy: ["deterministic_engine", "governance_layer"],
    mayNotBeModifiedBy: ["orchestrator", "evidence_layer", "advisory_layer", "ui_layer", "future_ai_layer"],
    safeFailAction: "preserve_deterministic_result",
    advisoryOnly: false,
  },
  {
    stateName: "finance_result",
    owningLayer: "deterministic_engine",
    authorityLevel: "authoritative",
    mayBeModifiedBy: ["deterministic_engine", "governance_layer"],
    mayNotBeModifiedBy: ["orchestrator", "evidence_layer", "advisory_layer", "ui_layer", "future_ai_layer"],
    safeFailAction: "preserve_deterministic_result",
    advisoryOnly: false,
  },
  {
    stateName: "final_classification",
    owningLayer: "governance_layer",
    authorityLevel: "authoritative",
    mayBeModifiedBy: ["governance_layer", "deterministic_engine"],
    mayNotBeModifiedBy: ["orchestrator", "evidence_layer", "advisory_layer", "ui_layer", "future_ai_layer"],
    safeFailAction: "block_advisory_upgrade",
    advisoryOnly: false,
  },
  {
    stateName: "fatal_risk",
    owningLayer: "governance_layer",
    authorityLevel: "authoritative",
    mayBeModifiedBy: ["governance_layer", "deterministic_engine"],
    mayNotBeModifiedBy: ["orchestrator", "evidence_layer", "advisory_layer", "ui_layer", "future_ai_layer"],
    safeFailAction: "require_manual_review",
    advisoryOnly: false,
  },
] as const

export const PHASE3_AUTHORITY_DOCTRINE: Phase3AuthorityDoctrine = {
  doctrineName: "phase3_authority_state_governance",
  permanentRule: "Advisory outputs may increase review burden, but they may not reduce deterministic risk.",
  hierarchy: PHASE3_AUTHORITY_HIERARCHY,
  authoritativeOutputs: PHASE3_AUTHORITATIVE_OUTPUTS,
  advisoryOutputs: PHASE3_ADVISORY_OUTPUTS,
  escalationPriority: PHASE3_ESCALATION_PRIORITY,
  stateOwnershipRules: DETERMINISTIC_STATE_OWNERSHIP_RULES,
  advisoryOnly: true,
}
