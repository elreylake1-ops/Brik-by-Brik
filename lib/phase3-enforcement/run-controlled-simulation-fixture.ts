import {
  type ControlledSimulationFixture,
  type ControlledSimulationRunResult,
  type ControlledSimulationRunSummary,
} from "@/types/phase3-enforcement"

import { validateControlledSimulationFixture } from "@/lib/phase3-enforcement/validate-controlled-simulation-fixture"

export function runControlledSimulationFixture(
  fixture: ControlledSimulationFixture
): ControlledSimulationRunResult {
  const validation = validateControlledSimulationFixture(fixture)

  if (!validation.valid) {
    return {
      valid: false,
      simulationId: fixture.input.simulationId,
      scenarioId: fixture.input.scenarioId,
      output: null,
      errors: [...validation.errors],
      warnings: [...validation.warnings],
    }
  }

  return {
    valid: true,
    simulationId: fixture.input.simulationId,
    scenarioId: fixture.input.scenarioId,
    output: fixture.expectedOutput,
    errors: [],
    warnings: [...validation.warnings],
  }
}

export function runControlledSimulationFixtures(
  fixtures: readonly ControlledSimulationFixture[]
): ControlledSimulationRunSummary {
  const validation = validateControlledSimulationFixture(fixtures)
  const results = fixtures.map((fixture) => runControlledSimulationFixture(fixture))
  const passedCount = results.filter((result) => result.valid).length
  const failedCount = results.length - passedCount

  return {
    valid: validation.valid && failedCount === 0,
    fixtureCount: fixtures.length,
    passedCount,
    failedCount,
    results,
    errors: [...validation.errors],
    warnings: [...validation.warnings],
  }
}