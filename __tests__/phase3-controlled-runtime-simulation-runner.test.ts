import { describe, expect, it } from "vitest"

import {
  runControlledSimulationFixture,
  runControlledSimulationFixtures,
} from "@/lib/phase3-enforcement/run-controlled-simulation-fixture"
import { CONTROLLED_RUNTIME_SIMULATION_FIXTURES } from "./fixtures/phase3-enforcement/controlled-runtime-simulation-fixtures"

describe("phase 3a-4 controlled runtime simulation fixture runner", () => {
  it("runs all existing fixtures successfully", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    expect(summary.valid).toBe(true)
    expect(summary.failedCount).toBe(0)
    expect(summary.passedCount).toBe(10)
  })

  it("returns 10 results", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    expect(summary.results).toHaveLength(10)
  })

  it("returns deterministic output matching fixture expectedOutput", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)

    summary.results.forEach((result, index) => {
      expect(result.output).toEqual(CONTROLLED_RUNTIME_SIMULATION_FIXTURES[index].expectedOutput)
      expect(result.simulationId).toBe(CONTROLLED_RUNTIME_SIMULATION_FIXTURES[index].input.simulationId)
      expect(result.scenarioId).toBe(CONTROLLED_RUNTIME_SIMULATION_FIXTURES[index].input.scenarioId)
    })
  })

  it("clean scenario passes without false block", () => {
    const fixture = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (item) => item.input.scenarioId === "clean_scenario_passes"
    )
    expect(fixture).toBeDefined()

    const result = runControlledSimulationFixture(fixture!)
    expect(result.valid).toBe(true)
    expect(result.output?.expectedResult).toBe("pass")
    expect(result.output?.enforcementOutcome).toBe("passed")
  })

  it("workflow override scenario blocks or safe-fails according to fixture expected output", () => {
    const fixture = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (item) => item.input.scenarioId === "workflow_tries_to_override_reject"
    )
    const result = runControlledSimulationFixture(fixture!)

    expect(result.output).toEqual(fixture?.expectedOutput)
    expect(["blocked", "safe_failed"]).toContain(result.output?.expectedResult)
  })

  it("advisory softening scenario blocks/escalates/safe-fails according to fixture expected output", () => {
    const fixture = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (item) => item.input.scenarioId === "advisory_tries_to_soften_fatal"
    )
    const result = runControlledSimulationFixture(fixture!)

    expect(result.output).toEqual(fixture?.expectedOutput)
    expect(["blocked", "escalated", "safe_failed"]).toContain(result.output?.expectedResult)
  })

  it("human override missing reason scenario fails closed according to fixture expected output", () => {
    const fixture = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (item) => item.input.scenarioId === "human_override_missing_reason"
    )
    const result = runControlledSimulationFixture(fixture!)

    expect(result.output).toEqual(fixture?.expectedOutput)
    expect(["blocked", "escalated", "safe_failed"]).toContain(result.output?.expectedResult)
  })

  it("repeated escalation loop triggers loop breaker according to fixture expected output", () => {
    const fixture = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (item) => item.input.scenarioId === "repeated_escalation_loop"
    )
    const result = runControlledSimulationFixture(fixture!)

    expect(result.output).toEqual(fixture?.expectedOutput)
    expect(result.output?.expectedResult).toBe("loop_breaker_triggered")
    expect(result.output?.loopBreakerTriggered).toBe(true)
  })

  it("governance drift scenario detects drift according to fixture expected output", () => {
    const fixture = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (item) => item.input.scenarioId === "advisory_drift_detected"
    )
    const result = runControlledSimulationFixture(fixture!)

    expect(result.output).toEqual(fixture?.expectedOutput)
    expect(result.output?.driftDetected).toBe(true)
    expect(result.output?.expectedResult).toBe("drift_detected")
  })

  it("invalid fixture returns valid:false and output:null", () => {
    const fixture = {
      ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0],
      input: {
        ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0].input,
        governanceVersion: "",
      },
    }

    const result = runControlledSimulationFixture(fixture)
    expect(result.valid).toBe(false)
    expect(result.output).toBeNull()
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it("runner does not mutate fixture input", () => {
    const before = JSON.stringify(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const after = JSON.stringify(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    expect(after).toBe(before)
  })

  it("repeated runs produce exactly equal outputs", () => {
    const first = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const second = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    expect(second).toEqual(first)
  })

  it("no runtime/live forbidden fields are introduced in outputs", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const serialized = JSON.stringify(summary)
    const forbiddenKeys = [
      "liveApi",
      "apiUrl",
      "database",
      "dbUrl",
      "persistence",
      "aiProvider",
      "scraping",
      "crm",
      "mutation",
      "integration",
      "externalService",
      "webhook",
      "runtimeWrite",
      "telemetryStorage",
    ]

    forbiddenKeys.forEach((key) => {
      expect(serialized).not.toContain(`\"${key}\"`)
    })
  })
})