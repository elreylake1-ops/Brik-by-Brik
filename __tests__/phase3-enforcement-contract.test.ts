// Phase 3A-3 Step 2 — Runtime Enforcement Type Contract Tests
// Advisory-only. No runtime enforcement is implemented.
// Tests confirm contract shape, field invariants, and governance boundaries only.

import { describe, it, expect } from "vitest"
import type {
  Phase3AuthorityViolation,
  Phase3EnforcementResult,
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
