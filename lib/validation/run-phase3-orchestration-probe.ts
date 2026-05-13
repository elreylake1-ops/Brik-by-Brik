import { mapPhase2OutputToPhase3Snapshot } from "@/lib/engine/phase3-adapter"
import { buildPhase3Orchestration } from "@/lib/engine/phase3-orchestrator"
import { loadPhase2Fixtures } from "@/lib/validation/load-phase2-fixtures"
import { runPhase2Validation } from "@/lib/validation/run-phase2-validation"
import type { Phase2ValidationRunResult } from "@/types/phase2-validation"
import type {
  Phase3DeterministicSnapshot,
  Phase3OrchestrationOutput,
} from "@/types/phase3-orchestration"

export type Phase3OrchestrationProbeScenarioResult = {
  scenarioId: string
  name: string
  phase2Pass: boolean
  phase2GovernanceState: string
  phase2FinalClassification: string
  snapshot: Phase3DeterministicSnapshot
  orchestration: Phase3OrchestrationOutput
}

export type Phase3OrchestrationProbeResult = {
  totalScenarios: number
  passed: number
  failed: number
  engineVersion: string
  scenarios: Phase3OrchestrationProbeScenarioResult[]
}

export function buildPhase3OrchestrationProbeFromValidationRun(
  validationRun: Phase2ValidationRunResult
): Phase3OrchestrationProbeResult {
  const scenarios = validationRun.scenarioResults.map((result) => {
    if (!result.actualOutput) {
      throw new Error(
        `Phase 3 orchestration probe requires full actualOutput. Missing for scenario ${result.scenarioId}.`
      )
    }

    const snapshot = mapPhase2OutputToPhase3Snapshot(result.actualOutput)
    const orchestration = buildPhase3Orchestration({
      deterministicResult: snapshot,
    })

    return {
      scenarioId: result.scenarioId,
      name: result.name,
      phase2Pass: result.pass,
      phase2GovernanceState: result.actualOutput.governance.state,
      phase2FinalClassification: result.actualOutput.governance.finalClassification,
      snapshot,
      orchestration,
    }
  })

  return {
    totalScenarios: validationRun.totalScenarios,
    passed: validationRun.passed,
    failed: validationRun.failed,
    engineVersion: validationRun.engineVersion,
    scenarios,
  }
}

export function runPhase3OrchestrationProbe(): Phase3OrchestrationProbeResult {
  const fixtures = loadPhase2Fixtures()
  const validationRun = runPhase2Validation(fixtures)

  return buildPhase3OrchestrationProbeFromValidationRun(validationRun)
}
