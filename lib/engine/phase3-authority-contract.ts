import type {
  Phase3AuthorityDoctrine,
  Phase3AuthorityValidationResult,
  Phase3AuthoritativeOutput,
  Phase3AdvisoryOutput,
  Phase3StateOwner,
  Phase3StateOwnershipRule,
} from "@/types/phase3-authority"

const REQUIRED_HIERARCHY: readonly string[] = [
  "deterministic_governance",
  "capital_protection",
  "deal_classification",
  "workflow_orchestration",
  "evidence_advisory",
  "ui_presentation",
]

const REQUIRED_AUTHORITATIVE_OUTPUTS: readonly Phase3AuthoritativeOutput[] = [
  "true_mao",
  "finance_calculation",
  "capital_protection",
  "governance_threshold",
  "deal_classification",
  "fatal_risk_detection",
]

const REQUIRED_ADVISORY_OUTPUTS: readonly Phase3AdvisoryOutput[] = [
  "evidence_hint",
  "advisory_task",
  "ai_commentary",
  "merged_advisory_output",
  "developer_review_surface_output",
]

const FORBIDDEN_KEYS: readonly string[] = [
  "execute",
  "apply",
  "mutate",
  "override",
  "persist",
  "fetch",
  "api",
  "aiModel",
]

const DOCTRINE_KEYS: readonly string[] = [
  "doctrineName",
  "permanentRule",
  "hierarchy",
  "authoritativeOutputs",
  "advisoryOutputs",
  "escalationPriority",
  "stateOwnershipRules",
  "advisoryOnly",
]

const STATE_RULE_KEYS: readonly string[] = [
  "stateName",
  "owningLayer",
  "authorityLevel",
  "mayBeModifiedBy",
  "mayNotBeModifiedBy",
  "safeFailAction",
  "advisoryOnly",
]

function hierarchyInRequiredOrder(hierarchy: readonly string[]): boolean {
  let lastIndex = -1
  for (const layer of REQUIRED_HIERARCHY) {
    const nextIndex = hierarchy.indexOf(layer)
    if (nextIndex === -1 || nextIndex <= lastIndex) return false
    lastIndex = nextIndex
  }
  return true
}

function hasForbiddenKeys(keys: readonly string[]): boolean {
  return keys.some((key) => FORBIDDEN_KEYS.includes(key))
}

function deterministicRuleProhibitsAdvisoryModifiers(rule: Phase3StateOwnershipRule): boolean {
  if (rule.authorityLevel !== "authoritative") return true
  if (rule.owningLayer !== "deterministic_engine" && rule.owningLayer !== "governance_layer") return true
  const prohibitedModifiers: readonly Phase3StateOwner[] = [
    "advisory_layer",
    "ui_layer",
    "future_ai_layer",
  ]
  return prohibitedModifiers.every((layer) =>
    rule.mayNotBeModifiedBy.includes(layer)
  )
}

// Contract-level validation only:
// - no side effects
// - no runtime enforcement
// - no integration with engine/orchestrator/UI
// - no mutation of doctrine input
export function validatePhase3AuthorityDoctrine(
  doctrine: Phase3AuthorityDoctrine
): Phase3AuthorityValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (doctrine.advisoryOnly !== true) {
    errors.push("doctrine.advisoryOnly must be true")
  }

  if (!doctrine.permanentRule.includes("Advisory outputs may increase review burden")) {
    errors.push("doctrine.permanentRule must include advisory risk doctrine text")
  }

  if (!hierarchyInRequiredOrder(doctrine.hierarchy)) {
    errors.push("doctrine.hierarchy must preserve deterministic->capital->classification->workflow->evidence->ui order")
  }

  if (doctrine.escalationPriority[0] !== "fatal" || doctrine.escalationPriority[1] !== "reject") {
    errors.push("doctrine.escalationPriority must begin with fatal then reject")
  }

  for (const output of REQUIRED_AUTHORITATIVE_OUTPUTS) {
    if (!doctrine.authoritativeOutputs.includes(output)) {
      errors.push(`missing authoritative output: ${output}`)
    }
  }

  for (const output of REQUIRED_ADVISORY_OUTPUTS) {
    if (!doctrine.advisoryOutputs.includes(output)) {
      errors.push(`missing advisory output: ${output}`)
    }
  }

  const deterministicRules = doctrine.stateOwnershipRules.filter(
    (rule) => rule.authorityLevel === "authoritative"
  )
  for (const rule of deterministicRules) {
    if (!deterministicRuleProhibitsAdvisoryModifiers(rule)) {
      errors.push(
        `deterministic authoritative rule must prohibit advisory/ui/future_ai modifiers: ${rule.stateName}`
      )
    }
  }

  const topLevelKeys = Object.keys(doctrine as unknown as Record<string, unknown>)
  if (hasForbiddenKeys(topLevelKeys)) {
    errors.push("doctrine must not include runtime/enforcement-like keys")
  }

  const unknownDoctrineKeys = topLevelKeys.filter((key) => !DOCTRINE_KEYS.includes(key))
  if (unknownDoctrineKeys.length > 0) {
    errors.push(`doctrine contains unknown keys: ${unknownDoctrineKeys.join(", ")}`)
  }

  for (const rule of doctrine.stateOwnershipRules) {
    const keys = Object.keys(rule as unknown as Record<string, unknown>)
    if (hasForbiddenKeys(keys)) {
      errors.push(`state ownership rule must not include runtime/enforcement-like keys: ${rule.stateName}`)
    }
    const unknownRuleKeys = keys.filter((key) => !STATE_RULE_KEYS.includes(key))
    if (unknownRuleKeys.length > 0) {
      errors.push(`state ownership rule contains unknown keys: ${rule.stateName}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    advisoryOnly: true,
  }
}
