import { describe, expect, it } from "vitest"
import { buildPhase3Orchestration } from "@/lib/engine/phase3-orchestrator"
import type { Phase3DeterministicSnapshot } from "@/types/phase3-orchestration"

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
  })

  it("preserves accepted limitations in metadata", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult(),
      acceptedLimitations: [
        "manual comparable input",
        "no automated sold-price validation",
      ],
    })

    expect(output.metadata.acceptedWithLimitations).toBe(true)
    expect(output.metadata.acceptedLimitations).toEqual([
      "manual comparable input",
      "no automated sold-price validation",
    ])
    expect(output.metadata.workflowFlags).toContain("accepted_with_limitations")
  })

  it("routes evidence gaps to evidence_gap escalation route", () => {
    const output = buildPhase3Orchestration({
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
        missingCriticalEvidence: ["comparables", "survey"],
      }),
    })

    expect(output.governanceEscalationRoute).toBe("evidence_gap")
    expect(output.metadata.evidenceGaps).toEqual(["comparables", "survey"])
    expect(output.tasks.some((task) => task.route === "evidence_gap")).toBe(true)
  })

  it("handles missing deterministic result with pending task state", () => {
    const output = buildPhase3Orchestration({})

    expect(output.workflowState).toBe("intake")
    expect(output.governanceEscalationRoute).toBe("none")
    expect(output.tasks.some((task) => task.id === "deterministic-analysis" && task.status === "pending")).toBe(
      true
    )
  })

  it("returns deterministic output for repeated identical input", () => {
    const input = {
      deterministicResult: makeDeterministicResult({
        governanceState: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
        riskFlags: ["Missing evidence"],
      }),
      acceptedLimitations: ["manual comparable input"],
    }

    const first = buildPhase3Orchestration(input)
    const second = buildPhase3Orchestration(input)

    expect(first).toEqual(second)
  })
})
