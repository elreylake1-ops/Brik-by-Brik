import { describe, expect, it } from "vitest"

import { formatControlledSimulationReport } from "@/lib/phase3-enforcement/format-controlled-simulation-report"
import { runControlledSimulationFixture, runControlledSimulationFixtures } from "@/lib/phase3-enforcement/run-controlled-simulation-fixture"
import { CONTROLLED_RUNTIME_SIMULATION_FIXTURES } from "./fixtures/phase3-enforcement/controlled-runtime-simulation-fixtures"

describe("phase 3a-4 controlled simulation report formatter", () => {
  it("formats a successful full fixture run", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const report = formatControlledSimulationReport(summary)
    expect(report.valid).toBe(true)
  })

  it("report has fixtureCount 10", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const report = formatControlledSimulationReport(summary)
    expect(report.fixtureCount).toBe(10)
  })

  it("passedCount 10 and failedCount 0 for current fixtures", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const report = formatControlledSimulationReport(summary)
    expect(report.passedCount).toBe(10)
    expect(report.failedCount).toBe(0)
  })

  it("includes all 10 scenario ids", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const report = formatControlledSimulationReport(summary)
    expect(report.scenarioIds).toHaveLength(10)
    expect(new Set(report.scenarioIds).size).toBe(10)
  })

  it("includes one report item per result", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const report = formatControlledSimulationReport(summary)
    expect(report.items).toHaveLength(summary.results.length)
  })

  it("report item preserves enforcementOutcome and expectedResult", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const report = formatControlledSimulationReport(summary)

    report.items.forEach((item, index) => {
      expect(item.enforcementOutcome).toBe(summary.results[index].output?.enforcementOutcome)
      expect(item.expectedResult).toBe(summary.results[index].output?.expectedResult)
    })
  })

  it("summary string is deterministic", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const report = formatControlledSimulationReport(summary)
    expect(report.summary).toBe("Controlled simulation completed: 10/10 scenarios passed fixture expectations.")
  })

  it("repeated formatting returns equal output", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const first = formatControlledSimulationReport(summary)
    const second = formatControlledSimulationReport(summary)
    expect(second).toEqual(first)
  })

  it("formatter does not mutate run summary", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const before = JSON.stringify(summary)
    formatControlledSimulationReport(summary)
    const after = JSON.stringify(summary)
    expect(after).toBe(before)
  })

  it("invalid runner summary produces failed report", () => {
    const invalidFixture = {
      ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0],
      input: {
        ...CONTROLLED_RUNTIME_SIMULATION_FIXTURES[0].input,
        governanceVersion: "",
      },
    }

    const invalidResult = runControlledSimulationFixture(invalidFixture)
    const invalidSummary = {
      valid: false,
      fixtureCount: 1,
      passedCount: 0,
      failedCount: 1,
      results: [invalidResult],
      errors: [...invalidResult.errors],
      warnings: [...invalidResult.warnings],
    }

    const report = formatControlledSimulationReport(invalidSummary)
    expect(report.valid).toBe(false)
    expect(report.failedCount).toBe(1)
    expect(report.items[0].status).toBe("fail")
    expect(report.summary).toBe(
      "Controlled simulation completed with failures: 0/1 scenarios passed fixture expectations."
    )
  })

  it("no forbidden runtime/live keys are introduced", () => {
    const summary = runControlledSimulationFixtures(CONTROLLED_RUNTIME_SIMULATION_FIXTURES)
    const report = formatControlledSimulationReport(summary)
    const serialized = JSON.stringify(report)
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