import { describe, expect, it } from "vitest"
import {
  loadPhase2Fixtures,
  PHASE2_EXPECTED_SCENARIO_COUNT,
} from "@/lib/validation/load-phase2-fixtures"
import { runPhase2Validation } from "@/lib/validation/run-phase2-validation"

describe("phase2 live review runtime suite", () => {
  it("executes the locked 15-scenario suite for the live review route", () => {
    const fixtures = loadPhase2Fixtures()
    const validationRun = runPhase2Validation(fixtures)

    expect(validationRun.totalScenarios).toBe(PHASE2_EXPECTED_SCENARIO_COUNT)
    expect(validationRun.passed).toBe(PHASE2_EXPECTED_SCENARIO_COUNT)
    expect(validationRun.failed).toBe(0)
    expect(validationRun.scenarioResults.map((scenario) => scenario.scenarioId)).toEqual([
      "phase2-001",
      "phase2-002",
      "phase2-003",
      "phase2-004",
      "phase2-005",
      "phase2-006",
      "phase2-007",
      "phase2-008",
      "phase2-009",
      "phase2-010",
      "phase2-011",
      "phase2-012",
      "phase2-013",
      "phase2-014",
      "phase2-015",
    ])
  })
})
