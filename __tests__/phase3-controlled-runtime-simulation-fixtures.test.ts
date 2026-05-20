import { describe, expect, it } from "vitest"
import { CONTROLLED_RUNTIME_SIMULATION_FIXTURES } from "./fixtures/phase3-enforcement/controlled-runtime-simulation-fixtures"

const REQUIRED_SCENARIOS = [
  "clean_scenario_passes",
  "workflow_tries_to_override_reject",
  "advisory_tries_to_soften_fatal",
  "human_override_missing_reason",
  "repeated_escalation_loop",
  "sandbox_prevents_mutation",
  "governance_version_present",
  "precedence_matrix_resolves",
  "telemetry_increments_after_violation",
  "advisory_drift_detected",
] as const

describe("Phase 3A-4 controlled runtime simulation fixtures", () => {
  it("all 10 required scenarios exist", () => {
    const scenarioIds = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.map((fixture) => fixture.input.scenarioId)
    for (const scenario of REQUIRED_SCENARIOS) {
      expect(scenarioIds).toContain(scenario)
    }
    expect(CONTROLLED_RUNTIME_SIMULATION_FIXTURES).toHaveLength(10)
  })

  it("all fixture ids are unique", () => {
    const ids = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.map((fixture) => fixture.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every fixture uses runtimeMode fixture_only or sandbox_only", () => {
    const allowed = ["fixture_only", "sandbox_only"]
    for (const fixture of CONTROLLED_RUNTIME_SIMULATION_FIXTURES) {
      expect(allowed).toContain(fixture.input.runtimeMode)
      expect(allowed).toContain(fixture.expectedOutput.runtimeMode)
    }
  })

  it("no fixture contains forbidden runtime/live fields", () => {
    const forbiddenKeys = [
      "liveApi",
      "apiUrl",
      "database",
      "persistence",
      "aiProvider",
      "scraping",
      "crm",
      "mutation",
      "integration",
    ]

    for (const fixture of CONTROLLED_RUNTIME_SIMULATION_FIXTURES) {
      const serialized = JSON.stringify(fixture)
      for (const forbidden of forbiddenKeys) {
        expect(serialized).not.toContain(`"${forbidden}"`)
      }
    }
  })

  it("every fixture includes governanceVersion", () => {
    for (const fixture of CONTROLLED_RUNTIME_SIMULATION_FIXTURES) {
      expect(fixture.input.governanceVersion.length).toBeGreaterThan(0)
      expect(fixture.expectedOutput.governanceVersion.length).toBeGreaterThan(0)
    }
  })

  it("every fixture includes expectedOutput with required shape", () => {
    const requiredKeys = [
      "simulationId",
      "runtimeMode",
      "governanceVersion",
      "scenarioName",
      "enforcementOutcome",
      "conflictDetected",
      "driftDetected",
      "loopBreakerTriggered",
      "telemetrySummary",
      "safeFailAction",
      "advisoryOnly",
    ]

    for (const fixture of CONTROLLED_RUNTIME_SIMULATION_FIXTURES) {
      const outputKeys = Object.keys(fixture.expectedOutput)
      for (const key of requiredKeys) {
        expect(outputKeys).toContain(key)
      }
    }
  })

  it("all fixtures are advisory-safe and do not weaken deterministic outcomes", () => {
    for (const fixture of CONTROLLED_RUNTIME_SIMULATION_FIXTURES) {
      expect(fixture.expectedOutput.advisoryOnly).toBe(true)
      if (fixture.input.deterministicState === "REJECT" || fixture.input.deterministicState === "FATAL") {
        expect(["blocked", "safe_failed", "escalated", "drift_detected"]).toContain(
          fixture.expectedOutput.expectedResult
        )
      }
    }
  })

  it("clean scenario does not falsely block", () => {
    const clean = CONTROLLED_RUNTIME_SIMULATION_FIXTURES.find(
      (fixture) => fixture.input.scenarioId === "clean_scenario_passes"
    )
    expect(clean).toBeDefined()
    expect(clean?.expectedOutput.expectedResult).toBe("pass")
    expect(clean?.expectedOutput.enforcementOutcome).toBe("passed")
  })

  it("override/softening/drift/loop scenarios fail safely as expected", () => {
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
    expect(override?.expectedOutput.expectedResult).toBe("escalated")
    expect(loop?.expectedOutput.expectedResult).toBe("loop_breaker_triggered")
    expect(drift?.expectedOutput.expectedResult).toBe("drift_detected")
  })
})
