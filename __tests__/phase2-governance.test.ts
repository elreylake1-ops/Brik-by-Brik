import { describe, expect, it } from "vitest"
import { applyGovernance, createGovernanceTestOutput } from "@/lib/engine/governance"
import { validatePhase2Output } from "@/lib/validators/validate-phase2-output"
import type { Phase2GovernanceInput } from "@/types/phase2-governance"

function makeBaseInput(overrides: Partial<Phase2GovernanceInput> = {}): Phase2GovernanceInput {
  return {
    purchasePrice: 120000,
    gdvRealistic: 200000,
    refurbCost: 15000,
    bridgeTermMonths: 6,
    comparablesCount: 4,
    gdvEvidenceStrength: "STRONG",
    refurbEvidenceStrength: "MODERATE",
    legalEvidenceStrength: "STRONG",
    rawHeatScore: 70,
    rawClassification: "WARM",
    ...overrides,
  }
}

describe("phase2 governance execution", () => {
  it("fatal structural risk forces NO_DEAL even when rawHeatScore is 84 and rawClassification is HOT", () => {
    const result = applyGovernance(
      makeBaseInput({
        hasStructuralRisk: true,
        rawHeatScore: 84,
        rawClassification: "HOT",
      })
    )

    expect(result.governance.state).toBe("BLOCKED")
    expect(result.governance.finalClassification).toBe("NO_DEAL")
    expect(result.governance.governanceOverrideApplied).toBe(true)
    expect(result.governance.fatalRisk).toBe(true)
  })

  it("missing comparables triggers REVIEW_REQUIRED under deterministic rule", () => {
    const result = applyGovernance(
      makeBaseInput({
        comparablesCount: 0,
        gdvEvidenceStrength: "MISSING",
        rawClassification: "HOT",
      })
    )

    expect(result.governance.state).toBe("REVIEW_REQUIRED")
    expect(result.governance.finalClassification).toBe("REVIEW_REQUIRED")
    expect(result.evidenceStatus.missingCriticalEvidence).toContain("comparables")
  })

  it("unrealistic GDV or weak GDV evidence triggers review", () => {
    const result = applyGovernance(
      makeBaseInput({
        gdvRealistic: 240000,
        comparablesCount: 1,
        gdvEvidenceStrength: "WEAK",
        rawClassification: "HOT",
      })
    )

    expect(result.reviewRequired).toBe(true)
    expect(result.governance.state).toBe("REVIEW_REQUIRED")
    expect(result.decisionGates.some((gate) => gate.gateId === "gdv-evidence" && gate.status !== "PASS")).toBe(true)
  })

  it("long bridge term triggers finance/time risk review", () => {
    const result = applyGovernance(
      makeBaseInput({
        bridgeTermMonths: 18,
      })
    )

    const gate = result.decisionGates.find((entry) => entry.gateId === "finance-time-risk")

    expect(gate?.status).toBe("REVIEW")
    expect(result.governance.state).toBe("REVIEW_REQUIRED")
  })

  it("negative realistic profit blocks and fails capital protection gate", () => {
    const result = applyGovernance(
      makeBaseInput({
        purchasePrice: 170000,
        gdvRealistic: 150000,
        refurbCost: 25000,
      })
    )

    const gate = result.decisionGates.find((entry) => entry.gateId === "capital-protection")

    expect(result.governance.state).toBe("BLOCKED")
    expect(gate?.status).toBe("FAIL")
  })

  it("zero refurb edge case does not crash and does not create false fatal risk by itself", () => {
    const result = applyGovernance(
      makeBaseInput({
        purchasePrice: 115000,
        gdvRealistic: 180000,
        refurbCost: 0,
        rawClassification: "HOT",
      })
    )

    expect(result.fatalRisk).toBe(false)
    expect(result.governance.state).not.toBe("BLOCKED")
  })

  it("high leverage triggers review", () => {
    const result = applyGovernance(
      makeBaseInput({
        loanToValue: 0.82,
      })
    )

    expect(result.reviewRequired).toBe(true)
    expect(result.governance.state).toBe("REVIEW_REQUIRED")
  })

  it("identical input returns identical governance output across repeated runs", () => {
    const input = makeBaseInput({
      comparablesCount: 1,
      gdvEvidenceStrength: "WEAK",
      loanToValue: 0.8,
      rawHeatScore: 84,
      rawClassification: "HOT",
    })

    const first = applyGovernance(input)
    const second = applyGovernance(input)

    expect(first).toEqual(second)
  })

  it("governance-only composed output passes validatePhase2Output", () => {
    const input = makeBaseInput({
      scenarioId: "phase2-governance-test",
      rawHeatScore: 84,
      rawClassification: "HOT",
      hasStructuralRisk: true,
    })

    const result = applyGovernance(input)
    const output = createGovernanceTestOutput(input, result)

    expect(validatePhase2Output(output)).toEqual({
      valid: true,
      errors: [],
    })
  })

  it("invalid unsafe HOT deal cannot remain final HOT when fatal risk exists", () => {
    const result = applyGovernance(
      makeBaseInput({
        rawHeatScore: 84,
        rawClassification: "HOT",
        hasStructuralRisk: true,
      })
    )

    expect(result.governance.finalClassification).not.toBe("HOT")
    expect(result.governance.finalClassification).toBe("NO_DEAL")
  })
})
