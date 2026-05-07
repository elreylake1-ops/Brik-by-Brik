import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { calculateDueDiligence } from "@/lib/engine/due-diligence-engine"
import { validatePhase2Fixture } from "@/lib/validators/validate-phase2-fixture"
import {
  CURRENT_ENGINE_RISK_FLAGS,
  type CurrentEngineRiskFlag,
  type Phase2ScenarioFixture,
} from "@/types/phase2-validation"

function loadFixtures(): Phase2ScenarioFixture[] {
  const fixturesDir = path.resolve(process.cwd(), "tests", "fixtures", "phase2")
  const fixtureFiles = readdirSync(fixturesDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()

  return fixtureFiles.map((fileName) => {
    const filePath = path.join(fixturesDir, fileName)
    return JSON.parse(readFileSync(filePath, "utf8")) as Phase2ScenarioFixture
  })
}

function getComparableRiskFlags(fixture: Phase2ScenarioFixture): CurrentEngineRiskFlag[] {
  return fixture.expectedRiskFlags.filter((flag): flag is CurrentEngineRiskFlag =>
    CURRENT_ENGINE_RISK_FLAGS.includes(flag as CurrentEngineRiskFlag)
  )
}

const fixtures = loadFixtures()

describe("phase2 stress suite fixtures", () => {
  it("contains the required 15 scenarios", () => {
    expect(fixtures).toHaveLength(15)
  })

  it("has unique scenario ids", () => {
    const ids = fixtures.map((fixture) => fixture.scenarioId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("passes runtime validation for fixture shape and completeness", () => {
    const failures = fixtures.flatMap((fixture) => {
      const validation = validatePhase2Fixture(fixture)

      return validation.valid
        ? []
        : [`${fixture.scenarioId}: ${validation.errors.join(" | ")}`]
    })

    expect(failures).toEqual([])
  })

  it("covers each required scenario theme once", () => {
    expect(fixtures.map((fixture) => fixture.name)).toEqual([
      "Strong BRRR candidate",
      "Marginal deal",
      "No deal",
      "Downside loss",
      "Weak GDV evidence",
      "Heavy refurb exposure",
      "High finance cost",
      "False HOT deal",
      "Structural / fatal risk",
      "Missing evidence / manual review",
      "Missing comparables",
      "Unrealistic GDV",
      "Long bridge term",
      "Zero refurb edge case",
      "High leverage scenario",
    ])
  })

  it("locks current numeric engine outputs where they already exist", () => {
    for (const fixture of fixtures) {
      const result = calculateDueDiligence(fixture.input.dueDiligence)

      expect(result.decision.dealClassification).toBe(fixture.expectedClassification)
      expect(result.decision.strategyRecommendation).toBe(fixture.expectedStrategyOutcome)
      expect(result.decision.riskFlags).toEqual(getComparableRiskFlags(fixture))
    }
  })
})
