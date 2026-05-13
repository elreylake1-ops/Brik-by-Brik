import { describe, expect, it } from "vitest"
import { buildPhase3Orchestration } from "@/lib/engine/phase3-orchestrator"
import type {
  Phase3AcceptedLimitation,
  Phase3DeterministicSnapshot,
} from "@/types/phase3-orchestration"

function makeDeterministicResult(
  overrides: Partial<Phase3DeterministicSnapshot> = {}
): Phase3DeterministicSnapshot {
  return {
    governanceState: "PASS",
    finalClassification: "HOT",
    fatalRisk: false,
    reviewRequired: false,
    missingCriticalEvidence: [],
    blockedBy: [],
    riskFlags: [],
    ...overrides,
  }
}

describe("phase3 orchestrator", () => {
  it("runs without changing deterministic output snapshot object", () => {
    const deterministicResult = makeDeterministicResult()
    const snapshotBefore = JSON.stringify(deterministicResult)

    buildPhase3Orchestration({ deterministicResult })

    expect(JSON.stringify(deterministicResult)).toBe(snapshotBefore)
  })

  it("maps no-deal deterministic result to globalDealState no_deal", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "BLOCKED",
        finalClassification: "NO_DEAL",
        fatalRisk: true,
      }),
    })

    expect(output.globalDealState).toBe("no_deal")
    expect(output.workflowState).toBe("blocked")
    expect(output.governanceEscalationRoute).toBe("capital_protection")
    expect(output.escalation.reason).toBe("capital_protection_block")
    expect(
      output.tasks.some(
        (task) =>
          task.id === "capital-protection-stop" &&
          task.route === "capital_protection" &&
          task.status === "blocked"
      )
    ).toBe(true)
  })

  it("maps review-required deterministic result to globalDealState review_required", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
      }),
    })

    expect(output.globalDealState).toBe("review_required")
    expect(output.governanceEscalationRoute).toBe("manual_review")
    expect(output.escalation.reason).toBe("governance_review_required")
    expect(
      output.tasks.some(
        (task) =>
          task.id === "governance-review" &&
          task.status === "in_progress" &&
          task.route === "manual_review"
      )
    ).toBe(true)
  })

  it("preserves accepted limitations in metadata", () => {
    const acceptedLimitations: Phase3AcceptedLimitation[] = [
      "manual_comparable_input",
      "no_automated_sold_price_validation",
    ]
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult(),
      acceptedLimitations,
    })

    expect(output.metadata.acceptedWithLimitations).toBe(true)
    expect(output.metadata.acceptedLimitations).toEqual(acceptedLimitations)
    expect(output.metadata.workflowFlags).toContain("accepted_with_limitations")
  })

  it("copies accepted limitations and does not share input array reference", () => {
    const acceptedLimitations: Phase3AcceptedLimitation[] = [
      "manual_comparable_input",
      "rules_based_refurb_assumptions",
    ]
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult(),
      acceptedLimitations,
    })

    acceptedLimitations.push("no_automated_lender_validation")

    expect(output.metadata.acceptedLimitations).toEqual([
      "manual_comparable_input",
      "rules_based_refurb_assumptions",
    ])
  })

  it("routes non-specialized evidence gaps to evidence_gap escalation route", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
        missingCriticalEvidence: ["proof_of_funds", "seller_docs"],
      }),
    })

    expect(output.governanceEscalationRoute).toBe("evidence_gap")
    expect(output.escalation.reason).toBe("evidence_gap_generic")
    expect(output.metadata.evidenceGaps).toEqual(["proof_of_funds", "seller_docs"])
    expect(output.tasks.some((task) => task.route === "evidence_gap")).toBe(true)
    expect(output.tasks.some((task) => task.id === "manual-review-routing" && task.route === "manual_review")).toBe(
      true
    )
  })

  it("duplicate evidence gaps do not create duplicate task triggers", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
        missingCriticalEvidence: ["comparables", "comparables", "survey"],
      }),
    })

    expect(output.metadata.evidenceGaps).toEqual(["comparables", "survey"])
    expect(output.tasks.filter((task) => task.id === "evidence-review")).toHaveLength(1)
  })

  it("prioritizes capital_protection route over evidence routes for blocked no-deal states", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "BLOCKED",
        finalClassification: "NO_DEAL",
        fatalRisk: true,
        reviewRequired: true,
        missingCriticalEvidence: ["comparables", "legal survey"],
      }),
    })

    expect(output.globalDealState).toBe("no_deal")
    expect(output.governanceEscalationRoute).toBe("capital_protection")
    expect(output.escalation.reason).toBe("capital_protection_block")
  })

  it("routes valuation-related evidence gaps to valuation_review", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
        missingCriticalEvidence: ["gdv comp mismatch", "sold price support missing"],
      }),
    })

    expect(output.governanceEscalationRoute).toBe("valuation_review")
    expect(output.escalation.reason).toBe("valuation_evidence_gap")
    expect(output.tasks.some((task) => task.id === "manual-review-routing" && task.status === "in_progress")).toBe(
      true
    )
  })

  it("routes lender-related evidence gaps to lender_review", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
        missingCriticalEvidence: ["lender refinance confirmation missing"],
      }),
    })

    expect(output.governanceEscalationRoute).toBe("lender_review")
    expect(output.escalation.reason).toBe("lender_evidence_gap")
  })

  it("routes legal or structural evidence gaps to legal_review", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
        missingCriticalEvidence: ["legal survey pack not provided", "structural report pending"],
      }),
    })

    expect(output.governanceEscalationRoute).toBe("legal_review")
    expect(output.escalation.reason).toBe("legal_evidence_gap")
  })

  it("handles missing deterministic result with pending task state", () => {
    const output = buildPhase3Orchestration({
      acceptedLimitations: ["manual_comparable_input"],
    })

    expect(output.workflowState).toBe("intake")
    expect(output.governanceEscalationRoute).toBe("none")
    expect(output.escalation.reason).toBe("none")
    expect(output.globalDealState).toBe("draft")
    expect(output.tasks.some((task) => task.id === "deterministic-analysis" && task.status === "pending")).toBe(
      true
    )
    expect(output.metadata.workflowFlags).toEqual([
      "deterministic_snapshot_missing",
      "accepted_with_limitations",
    ])
  })

  it("task ordering is stable and deterministic", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
        missingCriticalEvidence: ["comparables"],
      }),
      acceptedLimitations: ["manual_comparable_input"],
    })

    expect(output.tasks.map((task) => task.id)).toEqual([
      "deterministic-analysis",
      "governance-review",
      "evidence-review",
      "manual-review-routing",
      "capital-protection-stop",
      "accepted-limitations-awareness",
    ])
  })

  it("returns deterministic output for repeated identical input", () => {
    const input = {
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
        riskFlags: ["Missing evidence"],
      }),
      acceptedLimitations: ["manual_comparable_input"] as const,
    }

    const first = buildPhase3Orchestration(input)
    const second = buildPhase3Orchestration(input)

    expect(first).toEqual(second)
  })

  it("produces stable task IDs across repeated runs", () => {
    const input = {
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
      }),
    }

    const first = buildPhase3Orchestration(input).tasks.map((task) => task.id)
    const second = buildPhase3Orchestration(input).tasks.map((task) => task.id)

    expect(first).toEqual(second)
  })

  it("does not include random or date fields in orchestration output", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult(),
    })

    expect(JSON.stringify(output)).not.toMatch(
      /"createdAt"\s*:|"timestamp"\s*:|"generatedAt"\s*:|"random"\s*:|"uuid"\s*:|"idempotencyKey"\s*:/i
    )
  })

  it("degrades unsupported deterministic classification safely to review_required", () => {
    const result = makeDeterministicResult({
      finalClassification: "HOT",
    }) as unknown as Phase3DeterministicSnapshot

    ;(result as { finalClassification: string }).finalClassification = "UNKNOWN_STATE"

    const output = buildPhase3Orchestration({
      deterministicResult: result,
    })

    expect(output.globalDealState).toBe("review_required")
    expect(output.governanceEscalationRoute).toBe("manual_review")
    expect(output.escalation.reason).toBe("unknown_state_guardrail")
    expect(output.globalDealState).not.toBe("proceed_candidate")
  })

  it("accepted limitations alone do not create no_deal state", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "PASS",
        finalClassification: "WARM",
      }),
      acceptedLimitations: ["manual_comparable_input", "rules_based_refurb_assumptions"],
    })

    expect(output.metadata.acceptedWithLimitations).toBe(true)
    expect(output.globalDealState).not.toBe("no_deal")
    expect(output.governanceEscalationRoute).toBe("none")
    expect(
      output.tasks.some(
        (task) =>
          task.id === "accepted-limitations-awareness" &&
          task.blocksProgression === false &&
          task.category === "limitations_awareness"
      )
    ).toBe(true)
  })

  it("repeated identical inputs produce identical task arrays", () => {
    const input = {
      deterministicResult: makeDeterministicResult({
        governanceState: "PASS",
        finalClassification: "WARM",
        reviewRequired: false,
      }),
      acceptedLimitations: ["rules_based_refurb_assumptions"] as const,
    }

    const first = buildPhase3Orchestration(input).tasks
    const second = buildPhase3Orchestration(input).tasks

    expect(first).toEqual(second)
  })

  it("repeated identical inputs produce identical escalation route and escalation summary", () => {
    const input = {
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
        missingCriticalEvidence: ["valuation comps missing"],
      }),
    }

    const first = buildPhase3Orchestration(input)
    const second = buildPhase3Orchestration(input)

    expect(first.governanceEscalationRoute).toBe(second.governanceEscalationRoute)
    expect(first.escalation).toEqual(second.escalation)
  })
})
