import {
  type ControlledSimulationReport,
  type ControlledSimulationReportItem,
  type ControlledSimulationRunSummary,
  type SimulationScenarioId,
} from "@/types/phase3-enforcement"

function toReportItem(
  result: ControlledSimulationRunSummary["results"][number]
): ControlledSimulationReportItem {
  if (!result.output) {
    return {
      simulationId: result.simulationId,
      scenarioId: result.scenarioId,
      scenarioName: result.scenarioId,
      status: "fail",
      runtimeMode: "fixture_only",
      governanceVersion: "invalid_fixture",
      enforcementOutcome: "validation_failed",
      conflictDetected: false,
      driftDetected: false,
      loopBreakerTriggered: false,
      advisoryOnly: true,
      safeFailAction: "validation_failed",
      expectedResult: "safe_failed",
      errors: [...result.errors],
      warnings: [...result.warnings],
    }
  }

  return {
    simulationId: result.simulationId,
    scenarioId: result.scenarioId,
    scenarioName: result.output.scenarioName,
    status: result.valid ? "pass" : "fail",
    runtimeMode: result.output.runtimeMode,
    governanceVersion: result.output.governanceVersion,
    enforcementOutcome: result.output.enforcementOutcome,
    conflictDetected: result.output.conflictDetected,
    driftDetected: result.output.driftDetected,
    loopBreakerTriggered: result.output.loopBreakerTriggered,
    advisoryOnly: result.output.advisoryOnly,
    safeFailAction: result.output.safeFailAction,
    expectedResult: result.output.expectedResult,
    errors: [...result.errors],
    warnings: [...result.warnings],
  }
}

export function formatControlledSimulationReport(
  runSummary: ControlledSimulationRunSummary
): ControlledSimulationReport {
  const items = runSummary.results.map((result) => toReportItem(result))
  const scenarioIds: SimulationScenarioId[] = runSummary.results.map((result) => result.scenarioId)

  const summary =
    runSummary.failedCount === 0
      ? `Controlled simulation completed: ${runSummary.passedCount}/${runSummary.fixtureCount} scenarios passed fixture expectations.`
      : `Controlled simulation completed with failures: ${runSummary.passedCount}/${runSummary.fixtureCount} scenarios passed fixture expectations.`

  return {
    valid: runSummary.valid,
    fixtureCount: runSummary.fixtureCount,
    passedCount: runSummary.passedCount,
    failedCount: runSummary.failedCount,
    scenarioIds,
    items,
    errors: [...runSummary.errors],
    warnings: [...runSummary.warnings],
    summary,
  }
}