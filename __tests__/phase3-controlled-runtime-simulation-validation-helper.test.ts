import { describe, expect, it } from "vitest"

import { validateControlledSimulationFixture } from "@/lib/phase3-enforcement/validate-controlled-simulation-fixture"
import { CONTROLLED_RUNTIME_SIMULATION_FIXTURES } from "./fixtures/phase3-enforcement/controlled-runtime-simulation-fixtures"

describe("phase 3a-4 controlled runtime simulation fixture validation helper", () => {
  it("validates the existing full fixture set as valid", () => {
    const result = validateControlledSimulationFixture(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.fixtureCount).toBe(10)
  })

  it("returns all 10 scenario ids", () => {
    const result = validateControlledSimulationFixture(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    expect(result.scenarioIds).toHaveLength(10)
    expect(new Set(result.scenarioIds).size).toBe(10)
  })

  it("detects duplicate fixture ids if validating an array", () => {
    const duplicateFixtures = [
      CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0],
      { ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[1], id: CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0].id },
    ]

    const result = validateControlledSimulationFixture(duplicateFixtures)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes("duplicate id"))).toBe(true)
  })

  it("detects missing governanceVersion", () => {
    const fixture = {
      ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0],
      input: { ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0].input, governanceVersion: "" },
    }

    const result = validateControlledSimulationFixture(fixture)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes("missing input.governanceVersion"))).toBe(true)
  })

  it("detects simulationId mismatch between input and expectedOutput", () => {
    const fixture = {
      ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0],
      expectedOutput: {
        ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0].expectedOutput,
        simulationId: "sim-mismatch",
      },
    }

    const result = validateControlledSimulationFixture(fixture)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes("simulationId mismatch"))).toBe(true)
  })

  it("detects forbidden live/runtime keys nested anywhere inside a fixture", () => {
    const fixture = {
      ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0],
      input: {
        ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0].input,
        notes: "nested forbidden keys test",
      },
      lockedBoundaryNotes: [...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0].lockedBoundaryNotes],
      expectedOutput: {
        ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0].expectedOutput,
      },
      nested: {
        deeper: {
          externalService: "forbidden",
        },
      },
    }

    const result = validateControlledSimulationFixture(fixture as never)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes("forbidden key detected"))).toBe(true)
  })

  it("confirms helper does not mutate fixture input", () => {
    const before = JSON.stringify(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    validateControlledSimulationFixture(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const after = JSON.stringify(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    expect(after).toBe(before)
  })

  it("confirms clean scenario remains non-blocking in expected output", () => {
    const clean = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (fixture) => fixture.input.scenarioId === "clean_scenario_passes"
    )

    expect(clean).toBeDefined()
    expect(clean?.expectedOutput.expectedResult).toBe("pass")
    expect(clean?.expectedOutput.enforcementOutcome).toBe("passed")
  })

  it("confirms override/softening/drift/loop fixtures remain safe-fail aligned", () => {
    const softening = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (fixture) => fixture.input.scenarioId === "advisory_tries_to_soften_fatal"
    )
    const override = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (fixture) => fixture.input.scenarioId === "human_override_missing_reason"
    )
    const loop = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (fixture) => fixture.input.scenarioId === "repeated_escalation_loop"
    )
    const drift = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (fixture) => fixture.input.scenarioId === "advisory_drift_detected"
    )

    expect(softening?.expectedOutput.expectedResult).toBe("safe_failed")
    expect(["blocked", "escalated", "safe_failed"]).toContain(override?.expectedOutput.expectedResult)
    expect(loop?.expectedOutput.expectedResult).toBe("loop_breaker_triggered")
    expect(drift?.expectedOutput.expectedResult).toBe("drift_detected")
  })
})