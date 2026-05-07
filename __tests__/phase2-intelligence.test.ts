import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { buildPhase2Analysis } from "@/lib/engine/intelligence"
import { mapPhase2FixtureToInput } from "@/lib/engine/intelligence/map-phase2-fixture-to-input"
import { validatePhase2Output } from "@/lib/validators/validate-phase2-output"
import type { Phase2ScenarioFixture } from "@/types/phase2-validation"
import type { Phase2IntelligenceInput } from "@/types/phase2-intelligence"

function makeBaseInput(overrides: Partial<Phase2IntelligenceInput> = {}): Phase2IntelligenceInput {
  return {
    purchasePrice: 120000,
    gdvRealistic: 200000,
    refurbCost: 15000,
    bridgeTermMonths: 6,
    comparablesCount: 4,
    gdvEvidenceStrength: "STRONG",
    refurbEvidenceStrength: "MODERATE",
    legalEvidenceStrength: "STRONG",
    ...overrides,
  }
}

function loadScenarioFixture(fileName: string): Phase2ScenarioFixture {
  const fixturePath = path.resolve(process.cwd(), "tests", "fixtures", "phase2", fileName)
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Phase2ScenarioFixture
}

describe("phase2 deterministic intelligence engines", () => {
  it("strong BRRR candidate produces raw HOT/WARM and governance PASS if no blockers", () => {
    const output = buildPhase2Analysis(
      makeBaseInput({
        purchasePrice: 110000,
        gdvRealistic: 200000,
        refurbCost: 20000,
        comparablesCount: 5,
        gdvEvidenceStrength: "STRONG",
        refurbEvidenceStrength: "STRONG",
        legalEvidenceStrength: "STRONG",
      })
    )

    expect(["HOT", "WARM"]).toContain(output.dealHeatScore.band)
    expect(output.governance.state).toBe("PASS")
  })

  it("false HOT deal produces raw HOT but final NO_DEAL due governance fatal risk", () => {
    const output = buildPhase2Analysis(
      makeBaseInput({
        scenarioId: "false-hot-fatal",
        purchasePrice: 105000,
        gdvRealistic: 205000,
        refurbCost: 15000,
        comparablesCount: 5,
        gdvEvidenceStrength: "STRONG",
        refurbEvidenceStrength: "STRONG",
        legalEvidenceStrength: "STRONG",
        hasStructuralRisk: true,
        motivationSignals: ["probate", "vacant", "reduced"],
        listingSignals: ["hot", "must sell"],
      })
    )

    expect(output.dealHeatScore.band).toBe("HOT")
    expect(output.governance.finalClassification).toBe("NO_DEAL")
    expect(output.governance.state).toBe("BLOCKED")
  })

  it("missing comparables produces REVIEW_REQUIRED and next action to obtain comparables", () => {
    const output = buildPhase2Analysis(
      makeBaseInput({
        comparablesCount: 0,
        gdvEvidenceStrength: "MISSING",
      })
    )

    expect(output.governance.finalClassification).toBe("REVIEW_REQUIRED")
    expect(output.nextActions.some((action) => action.id === "obtain-comparables")).toBe(true)
  })

  it("weak GDV evidence appears in risk radar and investor warnings", () => {
    const output = buildPhase2Analysis(
      makeBaseInput({
        gdvEvidenceStrength: "WEAK",
        comparablesCount: 2,
      })
    )

    expect(output.riskRadar.riskFlags.some((flag) => flag.code === "GDV_EVIDENCE_WEAK")).toBe(true)
    expect(output.investorSummary.investorWarnings.length).toBeGreaterThan(0)
  })

  it("heavy refurb exposure creates risk flag and builder validation action", () => {
    const output = buildPhase2Analysis(
      makeBaseInput({
        purchasePrice: 100000,
        gdvRealistic: 185000,
        refurbCost: 35000,
        refurbEvidenceStrength: "WEAK",
      })
    )

    expect(output.riskRadar.riskFlags.some((flag) => flag.code === "REFURB_EXPOSURE_HIGH")).toBe(true)
    expect(output.nextActions.some((action) => action.id === "builder-scope-validation")).toBe(true)
  })

  it("long bridge term creates time/finance risk flag and action", () => {
    const output = buildPhase2Analysis(
      makeBaseInput({
        bridgeTermMonths: 18,
      })
    )

    expect(output.riskRadar.riskFlags.some((flag) => flag.code.startsWith("TIME_RISK_"))).toBe(true)
    expect(output.nextActions.some((action) => action.id === "finance-timeline-review")).toBe(true)
  })

  it("zero refurb edge case does not crash and can still be evaluated", () => {
    const output = buildPhase2Analysis(
      makeBaseInput({
        purchasePrice: 115000,
        gdvRealistic: 180000,
        refurbCost: 0,
        comparablesCount: 5,
        gdvEvidenceStrength: "STRONG",
        refurbEvidenceStrength: "STRONG",
      })
    )

    expect(output.dealHeatScore.score).toBeGreaterThanOrEqual(0)
    expect(output.governance.state).toBeDefined()
  })

  it("high leverage creates review risk and lender/refinance validation action", () => {
    const output = buildPhase2Analysis(
      makeBaseInput({
        loanToValue: 0.82,
        hasRefinanceRisk: true,
      })
    )

    expect(output.riskRadar.riskFlags.some((flag) => flag.code === "LEVERAGE_HIGH")).toBe(true)
    expect(output.nextActions.some((action) => action.id === "lender-refinance-validation")).toBe(true)
  })

  it("all generated Phase2AnalysisOutput samples pass validatePhase2Output", () => {
    const outputs = [
      buildPhase2Analysis(makeBaseInput()),
      buildPhase2Analysis(
        makeBaseInput({
          comparablesCount: 0,
          gdvEvidenceStrength: "MISSING",
        })
      ),
      buildPhase2Analysis(
        makeBaseInput({
          hasStructuralRisk: true,
          motivationSignals: ["vacant", "probate"],
          listingSignals: ["hot"],
        })
      ),
    ]

    for (const output of outputs) {
      expect(validatePhase2Output(output)).toEqual({
        valid: true,
        errors: [],
      })
    }
  })

  it("repeated identical input returns identical output", () => {
    const input = makeBaseInput({
      scenarioId: "repeatable",
      gdvEvidenceStrength: "WEAK",
      comparablesCount: 1,
      listingSignals: ["hot"],
    })

    const first = buildPhase2Analysis(input)
    const second = buildPhase2Analysis(input)

    expect(first).toEqual(second)
  })

  it("selected existing Phase 2A fixtures build valid outputs", () => {
    const selectedFixtures = [
      loadScenarioFixture("01-strong-brrr-candidate.json"),
      loadScenarioFixture("08-false-hot-deal.json"),
      loadScenarioFixture("09-structural-fatal-risk.json"),
      loadScenarioFixture("11-missing-comparables.json"),
      loadScenarioFixture("14-zero-refurb-edge-case.json"),
    ]

    const outputs = selectedFixtures.map((fixture) => buildPhase2Analysis(mapPhase2FixtureToInput(fixture)))

    expect(outputs[0].governance.state).toBe("PASS")
    expect(outputs[1].governance.state).toBe("REVIEW_REQUIRED")
    expect(outputs[2].governance.finalClassification).toBe("NO_DEAL")
    expect(outputs[3].governance.state).toBe("REVIEW_REQUIRED")
    expect(outputs[4].governance.state).toBe("PASS")

    for (const output of outputs) {
      expect(validatePhase2Output(output).valid).toBe(true)
    }
  })
})
