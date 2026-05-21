import { describe, expect, it } from "vitest"
import { evaluateOperatorGuard } from "@/lib/operator-command/evaluate-operator-guard"
import type { OperatorGuardInput } from "@/types/operator-command"

function makeInput(overrides: Partial<OperatorGuardInput> = {}): OperatorGuardInput {
  return {
    deal_id: "deal-001",
    current_pipeline_state: "UNDER_ANALYSIS",
    requested_pipeline_state: "UNDER_ANALYSIS",
    governance_state: "CONDITIONAL",
    classification: "CONDITIONAL",
    workflow_action: "MOVE_PIPELINE_STATE",
    has_manual_review_task: false,
    has_blocking_tasks: true,
    has_missing_evidence: false,
    offer_amount: 175000,
    max_safe_offer: 182500,
    notes: "Offer rationale exists.",
    ...overrides,
  }
}

describe("Phase 4A operator guard logic", () => {
  it("REJECT blocks READY_FOR_OFFER", () => {
    const result = evaluateOperatorGuard(
      makeInput({
        governance_state: "REJECT",
        requested_pipeline_state: "READY_FOR_OFFER",
        workflow_action: "MOVE_PIPELINE_STATE",
      })
    )
    expect(result.decision).toBe("BLOCK")
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain("GOVERNANCE_REJECT_OR_FATAL")
  })

  it("FATAL blocks CREATE_OFFER", () => {
    const result = evaluateOperatorGuard(makeInput({ governance_state: "FATAL", workflow_action: "CREATE_OFFER" }))
    expect(result.decision).toBe("BLOCK")
    expect(result.allowed).toBe(false)
  })

  it("REJECT allows REJECTED", () => {
    const result = evaluateOperatorGuard(
      makeInput({ governance_state: "REJECT", requested_pipeline_state: "REJECTED" })
    )
    expect(result.decision).toBe("ALLOW")
    expect(result.allowed).toBe(true)
  })

  it("MANUAL_REVIEW_REQUIRED allows DUE_DILIGENCE only with manual review task", () => {
    const blocked = evaluateOperatorGuard(
      makeInput({
        governance_state: "MANUAL_REVIEW_REQUIRED",
        requested_pipeline_state: "DUE_DILIGENCE",
        has_manual_review_task: false,
      })
    )
    const allowed = evaluateOperatorGuard(
      makeInput({
        governance_state: "MANUAL_REVIEW_REQUIRED",
        requested_pipeline_state: "DUE_DILIGENCE",
        has_manual_review_task: true,
      })
    )

    expect(blocked.allowed).toBe(false)
    expect(allowed.allowed).toBe(true)
  })

  it("MANUAL_REVIEW_REQUIRED does not clean-allow READY_FOR_OFFER", () => {
    const result = evaluateOperatorGuard(
      makeInput({
        governance_state: "MANUAL_REVIEW_REQUIRED",
        requested_pipeline_state: "READY_FOR_OFFER",
      })
    )
    expect(result.decision).not.toBe("ALLOW")
    expect(result.allowed).toBe(false)
  })

  it("CONDITIONAL READY_FOR_OFFER requires tracked blockers", () => {
    const result = evaluateOperatorGuard(
      makeInput({
        governance_state: "CONDITIONAL",
        requested_pipeline_state: "READY_FOR_OFFER",
        has_blocking_tasks: false,
      })
    )
    expect(result.decision).toBe("REQUIRE_TASK")
    expect(result.reasons).toContain("CONDITIONAL_BLOCKERS_REQUIRED")
  })

  it("CONDITIONAL CREATE_OFFER requires rationale notes", () => {
    const result = evaluateOperatorGuard(
      makeInput({ governance_state: "CONDITIONAL", workflow_action: "CREATE_OFFER", notes: "  " })
    )
    expect(result.decision).toBe("REQUIRE_REVIEW")
    expect(result.reasons).toContain("OFFER_RATIONALE_REQUIRED")
  })

  it("STRONG_OPPORTUNITY allows READY_FOR_OFFER with no missing evidence", () => {
    const result = evaluateOperatorGuard(
      makeInput({
        governance_state: "STRONG_OPPORTUNITY",
        requested_pipeline_state: "READY_FOR_OFFER",
        has_missing_evidence: false,
      })
    )
    expect(result.decision).toBe("ALLOW")
    expect(result.allowed).toBe(true)
  })

  it("STRONG_OPPORTUNITY with missing evidence requires EVIDENCE task", () => {
    const result = evaluateOperatorGuard(
      makeInput({
        governance_state: "STRONG_OPPORTUNITY",
        requested_pipeline_state: "READY_FOR_OFFER",
        has_missing_evidence: true,
      })
    )
    expect(result.decision).toBe("REQUIRE_TASK")
    expect(result.required_task_type).toBe("EVIDENCE")
  })

  it("STRONG_OPPORTUNITY offer above max safe offer returns WARN", () => {
    const result = evaluateOperatorGuard(
      makeInput({
        governance_state: "STRONG_OPPORTUNITY",
        workflow_action: "CREATE_OFFER",
        has_missing_evidence: false,
        offer_amount: 190000,
        max_safe_offer: 182500,
      })
    )
    expect(result.decision).toBe("WARN")
    expect(result.allowed).toBe(true)
    expect(result.reasons).toContain("OFFER_ABOVE_MAO")
  })

  it("UNKNOWN_CONFLICT blocks OFFER_SENT", () => {
    const result = evaluateOperatorGuard(
      makeInput({ governance_state: "UNKNOWN_CONFLICT", requested_pipeline_state: "OFFER_SENT" })
    )
    expect(result.decision).toBe("BLOCK")
    expect(result.allowed).toBe(false)
  })

  it("UNKNOWN_CONFLICT allows UNDER_ANALYSIS", () => {
    const result = evaluateOperatorGuard(
      makeInput({ governance_state: "UNKNOWN_CONFLICT", requested_pipeline_state: "UNDER_ANALYSIS" })
    )
    expect(result.decision).toBe("ALLOW")
    expect(result.allowed).toBe(true)
  })

  it("does not mutate input", () => {
    const input = makeInput({ governance_state: "REJECT", requested_pipeline_state: "READY_FOR_OFFER" })
    const snapshot = JSON.stringify(input)
    evaluateOperatorGuard(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it("repeated runs return equal results", () => {
    const input = makeInput({ governance_state: "STRONG_OPPORTUNITY", workflow_action: "CREATE_OFFER" })
    const first = evaluateOperatorGuard(input)
    const second = evaluateOperatorGuard(input)
    expect(second).toEqual(first)
  })

  it("no forbidden runtime keys are introduced", () => {
    const result = evaluateOperatorGuard(makeInput())
    const serialized = JSON.stringify(result)
    const forbiddenKeys = ["apiUrl", "database", "aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]

    for (const forbidden of forbiddenKeys) {
      expect(serialized).not.toContain(`"${forbidden}"`)
    }
  })
})
