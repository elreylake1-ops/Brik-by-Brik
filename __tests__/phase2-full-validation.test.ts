import { describe, expect, it } from "vitest"
import {
  loadPhase2Fixtures,
  PHASE2_EXPECTED_SCENARIO_COUNT,
} from "@/lib/validation/load-phase2-fixtures"
import {
  runPhase2Validation,
} from "@/lib/validation/run-phase2-validation"
import { validatePhase2Output } from "@/lib/validators/validate-phase2-output"

const fixtures = loadPhase2Fixtures()
const validationRun = runPhase2Validation(fixtures)

describe("phase2 full validation suite", () => {
  it("executes all 15 fixtures", () => {
    expect(validationRun.totalScenarios).toBe(PHASE2_EXPECTED_SCENARIO_COUNT)
    expect(validationRun.scenarioResults).toHaveLength(PHASE2_EXPECTED_SCENARIO_COUNT)
  })

  it("produces only outputs that pass validatePhase2Output", () => {
    const failures = validationRun.scenarioResults.flatMap((scenario) => {
      if (!scenario.actualOutput) {
        return [`${scenario.scenarioId}: output missing`]
      }

      const validation = validatePhase2Output(scenario.actualOutput)
      return validation.valid ? [] : [`${scenario.scenarioId}: ${validation.errors.join(" | ")}`]
    })

    expect(failures).toEqual([])
  })

  it("passes consistency checks for every fixture across repeated runs", () => {
    expect(validationRun.consistencyResults.every((result) => result.consistent)).toBe(true)
  })

  it("proves governance override behavior on the critical override scenarios", () => {
    const falseHot = validationRun.governanceOverrideResults.find(
      (result) => result.scenarioId === "phase2-008"
    )
    const structuralFatal = validationRun.governanceOverrideResults.find(
      (result) => result.scenarioId === "phase2-009"
    )

    expect(falseHot).toBeDefined()
    expect(falseHot?.rawHeatBand).toMatch(/HOT|WARM/)
    expect(falseHot?.governanceState).toBe("REVIEW_REQUIRED")
    expect(falseHot?.governanceOverrideApplied).toBe(true)
    expect(falseHot?.pass).toBe(true)

    expect(structuralFatal).toBeDefined()
    expect(structuralFatal?.finalClassification).toBe("NO_DEAL")
    expect(structuralFatal?.fatalRisk).toBe(true)
    expect(structuralFatal?.governanceOverrideApplied).toBe(true)
    expect(structuralFatal?.pass).toBe(true)
  })

  it("passes the required edge-case validations", () => {
    expect(validationRun.edgeCaseResults.every((result) => result.pass)).toBe(true)
  })

  it("generates an in-memory pass/fail matrix", () => {
    expect(validationRun.scenarioResults.every((result) => typeof result.pass === "boolean")).toBe(
      true
    )
    expect(validationRun.passed + validationRun.failed).toBe(validationRun.totalScenarios)
  })

  it("passes all 15 calibrated scenarios", () => {
    expect(validationRun.passed).toBe(PHASE2_EXPECTED_SCENARIO_COUNT)
    expect(validationRun.failed).toBe(0)
    expect(validationRun.scenarioResults.every((result) => result.pass)).toBe(true)
  })

  it("never leaves a BLOCKED or REVIEW_REQUIRED scenario as final HOT", () => {
    const invalidHotScenarios = validationRun.scenarioResults.flatMap((scenario) => {
      if (
        !scenario.actualOutput ||
        scenario.actualOutput.governance.state === "PASS" ||
        scenario.actualOutput.governance.finalClassification !== "HOT"
      ) {
        return []
      }

      return [scenario.scenarioId]
    })

    expect(invalidHotScenarios).toEqual([])
  })
})
