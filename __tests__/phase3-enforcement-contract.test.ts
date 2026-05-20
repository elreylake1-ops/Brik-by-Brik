// Phase 3A-3 Step 2 + Step 3 + Step 4 — Runtime Enforcement Type Contract Tests
// Advisory-only. No runtime enforcement is implemented.
// Tests confirm contract shape, field invariants, governance boundaries, and validation helper behavior.

import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { validatePhase3EnforcementResult } from "../lib/engine/phase3-enforcement-contract"
import type { Phase3EnforcementResult, Phase3AuthorityViolation } from "../types/phase3-enforcement"
import type {
  Phase3EscalationEnforcementRule,
  Phase3OrchestrationGuardrail,
  Phase3UIGovernanceRule,
} from "../types/phase3-enforcement"
import {
  PHASE3_ENFORCEMENT_SYSTEMS,
  PHASE3_VIOLATION_TYPES,
  PHASE3_ENFORCEMENT_SEVERITIES,
  PHASE3_RUNTIME_SAFE_FAIL_ACTIONS,
  PHASE3_ENFORCEMENT_OUTCOMES,
} from "../types/phase3-enforcement"

describe("Phase3AuthorityViolation contract", () => {
  it("accepts valid violation object", () => {
    const violation: Phase3AuthorityViolation = {
      violationId: "v-001",
      violationType: "advisory_overrides_governance",
      detectedBy: "authority_enforcement_engine",
      severity: "fatal",
      attemptedOverride: "evidence hint sets finalClassification to proceed_candidate",
      protectedAuthority: "deterministic_governance.finalClassification",
      safeFailAction: "block_advisory_upgrade",
      outcome: "blocked",
      advisoryOnly: true,
    }
    expect(violation.violationId).toBe("v-001")
    expect(violation.advisoryOnly).toBe(true)
    expect(violation.outcome).toBe("blocked")
  })

  it("carries advisoryOnly true", () => {
    const violation: Phase3AuthorityViolation = {
      violationId: "v-002",
      violationType: "workflow_overrides_capital_protection",
      detectedBy: "state_hierarchy_enforcement",
      severity: "fatal",
      attemptedOverride: "orchestrator sets globalDealState proceed_candidate on NO_DEAL",
      protectedAuthority: "capital_protection",
      safeFailAction: "preserve_deterministic_result",
      outcome: "blocked",
      advisoryOnly: true,
    }
    expect(violation.advisoryOnly).toBe(true)
  })
})

describe("Phase3EnforcementResult contract", () => {
  it("accepts valid enforcement result with violations", () => {
    const violation: Phase3AuthorityViolation = {
      violationId: "v-003",
      violationType: "merged_output_downgrades_escalation",
      detectedBy: "escalation_priority_engine",
      severity: "fatal",
      attemptedOverride: "merge selects valuation_review over capital_protection",
      protectedAuthority: "capital_protection escalation route",
      safeFailAction: "preserve_deterministic_result",
      outcome: "blocked",
      advisoryOnly: true,
    }
    const result: Phase3EnforcementResult = {
      valid: false,
      outcome: "blocked",
      violations: [violation],
      warnings: ["capital_protection route restored; advisory route appended as secondary"],
      safeFailActions: ["preserve_deterministic_result", "increase_review_burden"],
      advisoryOnly: true,
    }
    expect(result.valid).toBe(false)
    expect(result.outcome).toBe("blocked")
    expect(result.violations).toHaveLength(1)
    expect(result.advisoryOnly).toBe(true)
  })

  it("accepts valid passing enforcement result", () => {
    const result: Phase3EnforcementResult = {
      valid: true,
      outcome: "passed",
      violations: [],
      warnings: [],
      safeFailActions: [],
      advisoryOnly: true,
    }
    expect(result.valid).toBe(true)
    expect(result.outcome).toBe("passed")
    expect(result.violations).toHaveLength(0)
    expect(result.advisoryOnly).toBe(true)
  })

  it("accepts review_required outcome", () => {
    const result: Phase3EnforcementResult = {
      valid: false,
      outcome: "review_required",
      violations: [],
      warnings: ["contradictory states detected between advisory and governance layers"],
      safeFailActions: ["increase_review_burden", "escalate"],
      advisoryOnly: true,
    }
    expect(result.outcome).toBe("review_required")
    expect(result.advisoryOnly).toBe(true)
  })
})

describe("Phase3EscalationEnforcementRule contract", () => {
  it("accepts valid escalation rule blocking downgrade", () => {
    const rule: Phase3EscalationEnforcementRule = {
      fromSeverity: "fatal",
      attemptedSeverity: "high",
      allowed: false,
      safeFailAction: "preserve_deterministic_result",
      advisoryOnly: true,
    }
    expect(rule.allowed).toBe(false)
    expect(rule.safeFailAction).toBe("preserve_deterministic_result")
    expect(rule.advisoryOnly).toBe(true)
  })

  it("carries advisoryOnly true", () => {
    const rule: Phase3EscalationEnforcementRule = {
      fromSeverity: "high",
      attemptedSeverity: "medium",
      allowed: false,
      safeFailAction: "escalate",
      advisoryOnly: true,
    }
    expect(rule.advisoryOnly).toBe(true)
  })
})

describe("Phase3OrchestrationGuardrail contract", () => {
  it("accepts valid orchestration guardrail", () => {
    const guardrail: Phase3OrchestrationGuardrail = {
      guardrailId: "g-capital-protection-preserve",
      protectedAuthority: "capital_protection",
      forbiddenAction: "downgrade capital_protection escalation route to valuation_review",
      safeFailAction: "preserve_deterministic_result",
      advisoryOnly: true,
    }
    expect(guardrail.guardrailId).toBe("g-capital-protection-preserve")
    expect(guardrail.advisoryOnly).toBe(true)
  })

  it("carries advisoryOnly true", () => {
    const guardrail: Phase3OrchestrationGuardrail = {
      guardrailId: "g-decision-gate",
      protectedAuthority: "governance.decision_gate",
      forbiddenAction: "bypass decision gate from orchestration task generation",
      safeFailAction: "block_advisory_upgrade",
      advisoryOnly: true,
    }
    expect(guardrail.advisoryOnly).toBe(true)
  })
})

describe("Phase3UIGovernanceRule contract", () => {
  it("accepts valid UI governance rule", () => {
    const rule: Phase3UIGovernanceRule = {
      ruleId: "ui-governance-first",
      requiredPresentation: "deterministic governance decision section renders before advisory sections",
      forbiddenPresentation: "advisory confidence renders before governance verdict",
      safeFailAction: "block_advisory_upgrade",
      advisoryOnly: true,
    }
    expect(rule.ruleId).toBe("ui-governance-first")
    expect(rule.advisoryOnly).toBe(true)
  })

  it("carries advisoryOnly true", () => {
    const rule: Phase3UIGovernanceRule = {
      ruleId: "ui-no-soften-fatal",
      requiredPresentation: "NO_DEAL verdict shown with capital protection warning prominently",
      forbiddenPresentation: "green styling or softened label on NO_DEAL classification",
      safeFailAction: "preserve_deterministic_result",
      advisoryOnly: true,
    }
    expect(rule.advisoryOnly).toBe(true)
  })
})

describe("PHASE3_VIOLATION_TYPES array", () => {
  it("includes advisory_overrides_governance", () => {
    expect(PHASE3_VIOLATION_TYPES).toContain("advisory_overrides_governance")
  })

  it("includes workflow_overrides_capital_protection", () => {
    expect(PHASE3_VIOLATION_TYPES).toContain("workflow_overrides_capital_protection")
  })

  it("includes all 12 violation types from violation matrix", () => {
    expect(PHASE3_VIOLATION_TYPES).toHaveLength(12)
    expect(PHASE3_VIOLATION_TYPES).toContain("ui_softens_fatal_classification")
    expect(PHASE3_VIOLATION_TYPES).toContain("orchestration_bypasses_decision_gate")
    expect(PHASE3_VIOLATION_TYPES).toContain("evidence_reduces_review_burden")
    expect(PHASE3_VIOLATION_TYPES).toContain("ai_implies_approval")
    expect(PHASE3_VIOLATION_TYPES).toContain("merged_output_downgrades_escalation")
    expect(PHASE3_VIOLATION_TYPES).toContain("task_generation_implies_approval")
    expect(PHASE3_VIOLATION_TYPES).toContain("hidden_warning_or_suppressed_fatal_risk")
    expect(PHASE3_VIOLATION_TYPES).toContain("confidence_inflation_from_weak_evidence")
    expect(PHASE3_VIOLATION_TYPES).toContain("invalid_reject_to_proceed_progression")
    expect(PHASE3_VIOLATION_TYPES).toContain("advisory_route_replaces_capital_protection")
  })
})

describe("PHASE3_RUNTIME_SAFE_FAIL_ACTIONS array", () => {
  it("includes block", () => {
    expect(PHASE3_RUNTIME_SAFE_FAIL_ACTIONS).toContain("block")
  })

  it("includes downgrade", () => {
    expect(PHASE3_RUNTIME_SAFE_FAIL_ACTIONS).toContain("downgrade")
  })

  it("includes escalate", () => {
    expect(PHASE3_RUNTIME_SAFE_FAIL_ACTIONS).toContain("escalate")
  })

  it("includes request_review", () => {
    expect(PHASE3_RUNTIME_SAFE_FAIL_ACTIONS).toContain("request_review")
  })

  it("includes preserve_deterministic_result and block_advisory_upgrade", () => {
    expect(PHASE3_RUNTIME_SAFE_FAIL_ACTIONS).toContain("preserve_deterministic_result")
    expect(PHASE3_RUNTIME_SAFE_FAIL_ACTIONS).toContain("block_advisory_upgrade")
  })
})

describe("PHASE3_ENFORCEMENT_OUTCOMES array", () => {
  it("includes blocked", () => {
    expect(PHASE3_ENFORCEMENT_OUTCOMES).toContain("blocked")
  })

  it("includes review_required", () => {
    expect(PHASE3_ENFORCEMENT_OUTCOMES).toContain("review_required")
  })

  it("includes passed, escalated, downgraded", () => {
    expect(PHASE3_ENFORCEMENT_OUTCOMES).toContain("passed")
    expect(PHASE3_ENFORCEMENT_OUTCOMES).toContain("escalated")
    expect(PHASE3_ENFORCEMENT_OUTCOMES).toContain("downgraded")
  })
})

describe("PHASE3_ENFORCEMENT_SYSTEMS array", () => {
  it("includes all 7 planned enforcement systems", () => {
    expect(PHASE3_ENFORCEMENT_SYSTEMS).toHaveLength(7)
    expect(PHASE3_ENFORCEMENT_SYSTEMS).toContain("authority_enforcement_engine")
    expect(PHASE3_ENFORCEMENT_SYSTEMS).toContain("state_hierarchy_enforcement")
    expect(PHASE3_ENFORCEMENT_SYSTEMS).toContain("escalation_priority_engine")
    expect(PHASE3_ENFORCEMENT_SYSTEMS).toContain("advisory_containment_engine")
    expect(PHASE3_ENFORCEMENT_SYSTEMS).toContain("orchestration_guardrails")
    expect(PHASE3_ENFORCEMENT_SYSTEMS).toContain("ui_governance_enforcement")
    expect(PHASE3_ENFORCEMENT_SYSTEMS).toContain("violation_audit_layer")
  })
})

describe("PHASE3_ENFORCEMENT_SEVERITIES array", () => {
  it("includes fatal, high, medium, low", () => {
    expect(PHASE3_ENFORCEMENT_SEVERITIES).toContain("fatal")
    expect(PHASE3_ENFORCEMENT_SEVERITIES).toContain("high")
    expect(PHASE3_ENFORCEMENT_SEVERITIES).toContain("medium")
    expect(PHASE3_ENFORCEMENT_SEVERITIES).toContain("low")
  })
})

describe("Enforcement contract runtime boundary", () => {
  it("types file exports no callable functions", async () => {
    const mod = await import("../types/phase3-enforcement")
    for (const value of Object.values(mod)) {
      expect(typeof value).not.toBe("function")
    }
  })

  it("all exported values are readonly const arrays or strings (no class instances, no closures)", async () => {
    const mod = await import("../types/phase3-enforcement")
    for (const value of Object.values(mod)) {
      expect(typeof value === "string" || Array.isArray(value)).toBe(true)
    }
  })
})

// --- Step 3: Fixture loading helpers ---

const FIXTURE_BASE = join(__dirname, "fixtures", "phase3-enforcement")

function loadViolationFixture(name: string): Phase3AuthorityViolation {
  return JSON.parse(readFileSync(join(FIXTURE_BASE, name), "utf-8")) as Phase3AuthorityViolation
}

function loadResultFixture(name: string): Phase3EnforcementResult {
  return JSON.parse(readFileSync(join(FIXTURE_BASE, name), "utf-8")) as Phase3EnforcementResult
}

// --- Step 3: Fixture validation tests ---

describe("Enforcement fixtures — violation shape", () => {
  it("advisory-overrides-governance-violation fixture is structurally valid", () => {
    const v = loadViolationFixture("advisory-overrides-governance-violation.json")
    expect(v.violationType).toBe("advisory_overrides_governance")
    expect(v.detectedBy).toBe("authority_enforcement_engine")
    expect(v.severity).toBe("fatal")
    expect(v.safeFailAction).toBe("block_advisory_upgrade")
    expect(v.outcome).toBe("blocked")
    expect(v.advisoryOnly).toBe(true)
  })

  it("workflow-overrides-capital-protection-violation fixture is structurally valid", () => {
    const v = loadViolationFixture("workflow-overrides-capital-protection-violation.json")
    expect(v.violationType).toBe("workflow_overrides_capital_protection")
    expect(v.detectedBy).toBe("state_hierarchy_enforcement")
    expect(v.severity).toBe("fatal")
    expect(v.safeFailAction).toBe("preserve_deterministic_result")
    expect(v.outcome).toBe("blocked")
    expect(v.advisoryOnly).toBe(true)
  })

  it("escalation-downgrade-violation fixture is structurally valid", () => {
    const v = loadViolationFixture("escalation-downgrade-violation.json")
    expect(v.violationType).toBe("merged_output_downgrades_escalation")
    expect(v.detectedBy).toBe("escalation_priority_engine")
    expect(v.severity).toBe("fatal")
    expect(v.safeFailAction).toBe("preserve_deterministic_result")
    expect(v.outcome).toBe("blocked")
    expect(v.advisoryOnly).toBe(true)
  })

  it("ui-softens-fatal-classification-violation fixture is structurally valid", () => {
    const v = loadViolationFixture("ui-softens-fatal-classification-violation.json")
    expect(v.violationType).toBe("ui_softens_fatal_classification")
    expect(v.detectedBy).toBe("ui_governance_enforcement")
    expect(v.severity).toBe("high")
    expect(v.safeFailAction).toBe("increase_review_burden")
    expect(v.outcome).toBe("escalated")
    expect(v.advisoryOnly).toBe(true)
  })
})

describe("Enforcement fixtures — result shape", () => {
  it("valid-enforcement-result-clean fixture loads and is structurally valid", () => {
    const r = loadResultFixture("valid-enforcement-result-clean.json")
    expect(r.valid).toBe(true)
    expect(r.outcome).toBe("passed")
    expect(r.violations).toHaveLength(0)
    expect(r.warnings).toHaveLength(0)
    expect(r.safeFailActions).toHaveLength(0)
    expect(r.advisoryOnly).toBe(true)
  })

  it("enforcement-result-with-violations fixture loads and is structurally valid", () => {
    const r = loadResultFixture("enforcement-result-with-violations.json")
    expect(r.valid).toBe(false)
    expect(r.outcome).toBe("blocked")
    expect(r.violations.length).toBeGreaterThan(0)
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.safeFailActions.length).toBeGreaterThan(0)
    expect(r.advisoryOnly).toBe(true)
  })
})

// --- Step 3: Validation helper tests ---

describe("validatePhase3EnforcementResult — clean result", () => {
  it("validates clean enforcement result successfully", () => {
    const r = loadResultFixture("valid-enforcement-result-clean.json")
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.advisoryOnly).toBe(true)
  })
})

describe("validatePhase3EnforcementResult — result with violations", () => {
  it("validates enforcement result with violations as structurally valid", () => {
    const r = loadResultFixture("enforcement-result-with-violations.json")
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.advisoryOnly).toBe(true)
  })
})

describe("validatePhase3EnforcementResult — advisoryOnly guard", () => {
  it("returns error when advisoryOnly is false", () => {
    const r = {
      ...loadResultFixture("valid-enforcement-result-clean.json"),
      advisoryOnly: false as unknown as true,
    }
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes("advisoryOnly"))).toBe(true)
    expect(result.advisoryOnly).toBe(true)
  })

  it("returns error when violation advisoryOnly is false", () => {
    const violation = {
      ...loadViolationFixture("advisory-overrides-governance-violation.json"),
      advisoryOnly: false as unknown as true,
    }
    const r: Phase3EnforcementResult = {
      valid: false,
      outcome: "blocked",
      violations: [violation],
      warnings: ["advisory upgrade blocked"],
      safeFailActions: ["block_advisory_upgrade"],
      advisoryOnly: true,
    }
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes("advisoryOnly"))).toBe(true)
  })
})

describe("validatePhase3EnforcementResult — fatal/high + passed outcome", () => {
  it("returns error when fatal violation exists with passed outcome", () => {
    const violation = loadViolationFixture("advisory-overrides-governance-violation.json")
    const r: Phase3EnforcementResult = {
      valid: false,
      outcome: "passed",
      violations: [violation],
      warnings: [],
      safeFailActions: ["block_advisory_upgrade"],
      advisoryOnly: true,
    }
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes("passed"))).toBe(true)
  })

  it("returns error when high severity violation exists with passed outcome", () => {
    const violation = loadViolationFixture("ui-softens-fatal-classification-violation.json")
    const r: Phase3EnforcementResult = {
      valid: false,
      outcome: "passed",
      violations: [violation],
      warnings: [],
      safeFailActions: ["increase_review_burden"],
      advisoryOnly: true,
    }
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes("passed"))).toBe(true)
  })
})

describe("validatePhase3EnforcementResult — safeFailAction coverage", () => {
  it("returns error when violation safeFailAction is missing from result.safeFailActions", () => {
    const violation = loadViolationFixture("advisory-overrides-governance-violation.json")
    const r: Phase3EnforcementResult = {
      valid: false,
      outcome: "blocked",
      violations: [violation],
      warnings: ["advisory upgrade blocked"],
      safeFailActions: [],
      advisoryOnly: true,
    }
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes("safeFailAction"))).toBe(true)
  })
})

describe("validatePhase3EnforcementResult — invalid fields", () => {
  it("returns error when valid is false and violations and warnings are empty", () => {
    const r: Phase3EnforcementResult = {
      valid: false,
      outcome: "blocked",
      violations: [],
      warnings: [],
      safeFailActions: [],
      advisoryOnly: true,
    }
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it("returns error for unknown violationType", () => {
    const violation = {
      ...loadViolationFixture("advisory-overrides-governance-violation.json"),
      violationType: "not_a_real_violation_type" as unknown as Phase3AuthorityViolation["violationType"],
    }
    const r: Phase3EnforcementResult = {
      valid: false,
      outcome: "blocked",
      violations: [violation],
      warnings: ["test"],
      safeFailActions: ["block_advisory_upgrade"],
      advisoryOnly: true,
    }
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes("violationType"))).toBe(true)
  })

  it("returns error for unknown detectedBy system", () => {
    const violation = {
      ...loadViolationFixture("advisory-overrides-governance-violation.json"),
      detectedBy: "unknown_system" as unknown as Phase3AuthorityViolation["detectedBy"],
    }
    const r: Phase3EnforcementResult = {
      valid: false,
      outcome: "blocked",
      violations: [violation],
      warnings: ["test"],
      safeFailActions: ["block_advisory_upgrade"],
      advisoryOnly: true,
    }
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes("detectedBy"))).toBe(true)
  })

  it("returns error for forbidden runtime key on result", () => {
    const r = {
      ...loadResultFixture("valid-enforcement-result-clean.json"),
      execute: () => {},
    } as unknown as Phase3EnforcementResult
    const result = validatePhase3EnforcementResult(r)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes("execute"))).toBe(true)
  })
})

describe("validatePhase3EnforcementResult — immutability and determinism", () => {
  it("does not mutate input", () => {
    const r = loadResultFixture("enforcement-result-with-violations.json")
    const snapshot = JSON.stringify(r)
    validatePhase3EnforcementResult(r)
    expect(JSON.stringify(r)).toBe(snapshot)
  })

  it("produces identical output on repeated calls (deterministic)", () => {
    const r = loadResultFixture("enforcement-result-with-violations.json")
    const first = validatePhase3EnforcementResult(r)
    const second = validatePhase3EnforcementResult(r)
    expect(first).toEqual(second)
  })
})

describe("validatePhase3EnforcementResult — helper export surface", () => {
  it("does not export apply, enforce, execute, or mutate functions", async () => {
    const mod = await import("../lib/engine/phase3-enforcement-contract")
    const keys = Object.keys(mod)
    const forbidden = ["apply", "enforce", "execute", "mutate", "persist", "handler"]
    for (const f of forbidden) {
      const match = keys.find(k => k === f)
      expect(match).toBeUndefined()
    }
  })
})

// --- Step 4: Validation output fixture locking ---

const VALIDATION_OUTPUT_BASE = join(__dirname, "fixtures", "phase3-enforcement-validation")

type ValidationOutput = {
  valid: boolean
  errors: readonly string[]
  warnings: readonly string[]
  advisoryOnly: true
}

function loadValidationOutputFixture(name: string): ValidationOutput {
  return JSON.parse(readFileSync(join(VALIDATION_OUTPUT_BASE, name), "utf-8")) as ValidationOutput
}

// Wrap a single violation in a minimal Phase3EnforcementResult for validation.
// Uses the violation's own outcome and safeFailAction so the result is internally consistent.
function wrapViolation(violation: Phase3AuthorityViolation): Phase3EnforcementResult {
  return {
    valid: false,
    outcome: violation.outcome,
    violations: [violation],
    warnings: [`${violation.violationType} detected`],
    safeFailActions: [violation.safeFailAction],
    advisoryOnly: true,
  }
}

describe("Step 4 — Fixture-locked validation outputs: violation fixtures", () => {
  const VIOLATION_FIXTURES: Array<{ source: string; outputFixture: string }> = [
    {
      source: "advisory-overrides-governance-violation.json",
      outputFixture: "advisory-overrides-governance-violation-validation.json",
    },
    {
      source: "workflow-overrides-capital-protection-violation.json",
      outputFixture: "workflow-overrides-capital-protection-violation-validation.json",
    },
    {
      source: "escalation-downgrade-violation.json",
      outputFixture: "escalation-downgrade-violation-validation.json",
    },
    {
      source: "ui-softens-fatal-classification-violation.json",
      outputFixture: "ui-softens-fatal-classification-violation-validation.json",
    },
  ]

  for (const { source, outputFixture } of VIOLATION_FIXTURES) {
    it(`validation output matches locked fixture for ${source}`, () => {
      const violation = loadViolationFixture(source)
      const result = validatePhase3EnforcementResult(wrapViolation(violation))
      const expected = loadValidationOutputFixture(outputFixture)
      expect(result).toEqual(expected)
    })
  }
})

describe("Step 4 — Fixture-locked validation outputs: result fixtures", () => {
  it("validation output matches locked fixture for valid-enforcement-result-clean.json", () => {
    const r = loadResultFixture("valid-enforcement-result-clean.json")
    const result = validatePhase3EnforcementResult(r)
    const expected = loadValidationOutputFixture("valid-enforcement-result-clean-validation.json")
    expect(result).toEqual(expected)
  })

  it("validation output matches locked fixture for enforcement-result-with-violations.json", () => {
    const r = loadResultFixture("enforcement-result-with-violations.json")
    const result = validatePhase3EnforcementResult(r)
    const expected = loadValidationOutputFixture("enforcement-result-with-violations-validation.json")
    expect(result).toEqual(expected)
  })
})

describe("Step 4 — Validation output stability", () => {
  it("all 6 locked outputs carry advisoryOnly true", () => {
    const outputFixtures = [
      "advisory-overrides-governance-violation-validation.json",
      "workflow-overrides-capital-protection-violation-validation.json",
      "escalation-downgrade-violation-validation.json",
      "ui-softens-fatal-classification-violation-validation.json",
      "valid-enforcement-result-clean-validation.json",
      "enforcement-result-with-violations-validation.json",
    ]
    for (const name of outputFixtures) {
      const f = loadValidationOutputFixture(name)
      expect(f.advisoryOnly, `${name} must carry advisoryOnly: true`).toBe(true)
    }
  })

  it("all 6 locked outputs carry no runtime or enforcement-behavior keys", () => {
    const forbidden = ["execute", "enforce", "apply", "mutate", "persist", "fetch", "api", "aiModel", "database", "routeHandler", "handler"]
    const outputFixtures = [
      "advisory-overrides-governance-violation-validation.json",
      "workflow-overrides-capital-protection-violation-validation.json",
      "escalation-downgrade-violation-validation.json",
      "ui-softens-fatal-classification-violation-validation.json",
      "valid-enforcement-result-clean-validation.json",
      "enforcement-result-with-violations-validation.json",
    ]
    for (const name of outputFixtures) {
      const f = loadValidationOutputFixture(name)
      for (const key of forbidden) {
        expect(Object.keys(f), `${name} must not contain key "${key}"`).not.toContain(key)
      }
    }
  })

  it("repeated validation of the same input returns output equal to locked fixture", () => {
    const r = loadResultFixture("enforcement-result-with-violations.json")
    const expected = loadValidationOutputFixture("enforcement-result-with-violations-validation.json")
    expect(validatePhase3EnforcementResult(r)).toEqual(expected)
    expect(validatePhase3EnforcementResult(r)).toEqual(expected)
    expect(validatePhase3EnforcementResult(r)).toEqual(expected)
  })

  it("violation fixture wrapping does not mutate violation", () => {
    const violation = loadViolationFixture("advisory-overrides-governance-violation.json")
    const snapshot = JSON.stringify(violation)
    validatePhase3EnforcementResult(wrapViolation(violation))
    expect(JSON.stringify(violation)).toBe(snapshot)
  })
})
