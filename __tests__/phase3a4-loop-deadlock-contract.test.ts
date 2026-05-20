import { describe, expect, it } from "vitest"
import type {
  Phase3A4DeadlockGuardContract,
  Phase3A4LoopBreakerContract,
} from "@/types/phase3-enforcement"
import * as enforcementContracts from "@/types/phase3-enforcement"

describe("Phase 3A-4 loop breaker and deadlock guard contracts", () => {
  it("loop risk types include all required values", () => {
    expect(enforcementContracts.PHASE3A4_LOOP_RISK_TYPES).toEqual(
      expect.arrayContaining([
        "repeated_same_escalation",
        "repeated_failed_transition",
        "unresolved_advisory_loop",
        "workflow_stuck_between_states",
        "recurring_manual_review_trigger",
      ])
    )
  })

  it("loop breaker statuses include manual_review_required", () => {
    expect(enforcementContracts.PHASE3A4_LOOP_BREAKER_STATUSES).toContain("manual_review_required")
  })

  it("progression statuses include blocked", () => {
    expect(enforcementContracts.PHASE3A4_PROGRESSION_STATUSES).toContain("blocked")
  })

  it("reasons include loop_or_deadlock_risk", () => {
    expect(enforcementContracts.PHASE3A4_LOOP_BREAKER_REASONS).toContain("loop_or_deadlock_risk")
  })

  it("loop breaker contract shape is valid", () => {
    const contract: Phase3A4LoopBreakerContract = {
      riskType: "repeated_same_escalation",
      status: "loop_risk_detected",
      progression: "allowed",
      reason: "none",
      thresholdExceeded: false,
      manualReviewRequired: false,
      advisoryOnly: true,
    }
    expect(contract.advisoryOnly).toBe(true)
  })

  it("thresholdExceeded true can pair with manualReviewRequired true", () => {
    const contract: Phase3A4LoopBreakerContract = {
      riskType: "recurring_manual_review_trigger",
      status: "manual_review_required",
      progression: "blocked",
      reason: "loop_or_deadlock_risk",
      thresholdExceeded: true,
      manualReviewRequired: true,
      advisoryOnly: true,
    }
    expect(contract.thresholdExceeded).toBe(true)
    expect(contract.manualReviewRequired).toBe(true)
  })

  it("thresholdExceeded true can pair with progression blocked", () => {
    const contract: Phase3A4LoopBreakerContract = {
      riskType: "workflow_stuck_between_states",
      status: "manual_review_required",
      progression: "blocked",
      reason: "loop_or_deadlock_risk",
      thresholdExceeded: true,
      manualReviewRequired: true,
      advisoryOnly: true,
    }
    expect(contract.thresholdExceeded).toBe(true)
    expect(contract.progression).toBe("blocked")
  })

  it("manual review contract example has expected threshold-exceeded state", () => {
    const contract: Phase3A4LoopBreakerContract = {
      riskType: "repeated_failed_transition",
      status: "manual_review_required",
      progression: "blocked",
      reason: "loop_or_deadlock_risk",
      thresholdExceeded: true,
      manualReviewRequired: true,
      advisoryOnly: true,
    }
    expect(contract.status).toBe("manual_review_required")
    expect(contract.progression).toBe("blocked")
    expect(contract.reason).toBe("loop_or_deadlock_risk")
    expect(contract.manualReviewRequired).toBe(true)
    expect(contract.advisoryOnly).toBe(true)
  })

  it("deadlock guard contract shape is valid", () => {
    const guard: Phase3A4DeadlockGuardContract = {
      detectedRiskTypes: ["repeated_same_escalation"],
      status: "loop_risk_detected",
      progression: "allowed",
      reason: "none",
      manualReviewRequired: false,
      advisoryOnly: true,
    }
    expect(guard.advisoryOnly).toBe(true)
  })

  it("detectedRiskTypes can include repeated escalation and failed transition", () => {
    const guard: Phase3A4DeadlockGuardContract = {
      detectedRiskTypes: ["repeated_same_escalation", "repeated_failed_transition"],
      status: "manual_review_required",
      progression: "blocked",
      reason: "loop_or_deadlock_risk",
      manualReviewRequired: true,
      advisoryOnly: true,
    }
    expect(guard.detectedRiskTypes).toContain("repeated_same_escalation")
    expect(guard.detectedRiskTypes).toContain("repeated_failed_transition")
  })

  it("no runtime fields exist on loop breaker and deadlock guard contracts", () => {
    const forbiddenFields = [
      "execute",
      "enforce",
      "apply",
      "mutate",
      "persist",
      "fetch",
      "api",
      "aiModel",
      "database",
      "routeHandler",
      "handler",
      "detect",
      "transition",
      "run",
      "loop",
    ]

    const loopContract: Phase3A4LoopBreakerContract = {
      riskType: "unresolved_advisory_loop",
      status: "loop_risk_detected",
      progression: "allowed",
      reason: "none",
      thresholdExceeded: false,
      manualReviewRequired: false,
      advisoryOnly: true,
    }

    const deadlockContract: Phase3A4DeadlockGuardContract = {
      detectedRiskTypes: ["workflow_stuck_between_states"],
      status: "loop_risk_detected",
      progression: "allowed",
      reason: "none",
      manualReviewRequired: false,
      advisoryOnly: true,
    }

    for (const key of Object.keys(loopContract)) {
      expect(forbiddenFields).not.toContain(key)
    }

    for (const key of Object.keys(deadlockContract)) {
      expect(forbiddenFields).not.toContain(key)
    }
  })

  it("no detection/runtime guard function is exported", () => {
    expect("detectPhase3A4LoopRisk" in enforcementContracts).toBe(false)
    expect("runPhase3A4LoopBreaker" in enforcementContracts).toBe(false)
    expect("transitionPhase3A4Workflow" in enforcementContracts).toBe(false)
    expect("applyPhase3A4DeadlockGuard" in enforcementContracts).toBe(false)
  })
})
