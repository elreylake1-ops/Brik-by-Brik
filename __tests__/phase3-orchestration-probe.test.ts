import { describe, expect, it } from "vitest"
import { loadPhase2Fixtures } from "@/lib/validation/load-phase2-fixtures"
import {
  buildPhase3OrchestrationProbeFromValidationRun,
  runPhase3OrchestrationProbe,
} from "@/lib/validation/run-phase3-orchestration-probe"
import { runPhase2Validation } from "@/lib/validation/run-phase2-validation"

describe("phase3 live validation orchestration probe", () => {
  it("runs across all locked Phase 2 scenarios", () => {
    const probe = runPhase3OrchestrationProbe()

    expect(probe.totalScenarios).toBe(15)
    expect(probe.scenarios).toHaveLength(15)
  })

  it("produces Phase3DeterministicSnapshot and Phase3OrchestrationOutput for every scenario", () => {
    const probe = runPhase3OrchestrationProbe()

    for (const scenario of probe.scenarios) {
      expect(scenario.snapshot).toBeDefined()
      expect(scenario.orchestration).toBeDefined()
      expect(typeof scenario.snapshot.governanceState).toBe("string")
      expect(typeof scenario.orchestration.globalDealState).toBe("string")
    }
  })

  it("does not mutate Phase 2 actualOutput when building probe from an existing validation run", () => {
    const fixtures = loadPhase2Fixtures()
    const validationRun = runPhase2Validation(fixtures)
    const before = JSON.stringify(validationRun.scenarioResults.map((result) => result.actualOutput))

    buildPhase3OrchestrationProbeFromValidationRun(validationRun)

    const after = JSON.stringify(validationRun.scenarioResults.map((result) => result.actualOutput))
    expect(after).toBe(before)
  })

  it("does not introduce AI, scraping, CRM, or persistence fields in probe outputs", () => {
    const probe = runPhase3OrchestrationProbe()
    const serialized = JSON.stringify(probe).toLowerCase()

    expect(serialized).not.toContain("\"ai\"")
    expect(serialized).not.toContain("scrap")
    expect(serialized).not.toContain("crm")
    expect(serialized).not.toContain("persist")
  })

  it("is deterministic across repeated runs", () => {
    const first = runPhase3OrchestrationProbe()
    const second = runPhase3OrchestrationProbe()

    expect(first).toEqual(second)
  })

  it("maps no-deal scenarios to no_deal and capital_protection", () => {
    const probe = runPhase3OrchestrationProbe()
    const noDealScenarios = probe.scenarios.filter(
      (scenario) => scenario.phase2FinalClassification === "NO_DEAL"
    )

    expect(noDealScenarios.length).toBeGreaterThan(0)
    for (const scenario of noDealScenarios) {
      expect(scenario.orchestration.globalDealState).toBe("no_deal")
      expect(scenario.orchestration.governanceEscalationRoute).toBe("capital_protection")
    }
  })

  it("maps review-required scenarios to review_required with manual/evidence routing", () => {
    const probe = runPhase3OrchestrationProbe()
    const reviewScenarios = probe.scenarios.filter(
      (scenario) => scenario.phase2GovernanceState === "REVIEW_REQUIRED"
    )

    expect(reviewScenarios.length).toBeGreaterThan(0)
    const allowedRoutes = new Set([
      "manual_review",
      "evidence_gap",
      "valuation_review",
      "lender_review",
      "legal_review",
    ])

    for (const scenario of reviewScenarios) {
      expect(scenario.orchestration.globalDealState).toBe("review_required")
      expect(allowedRoutes.has(scenario.orchestration.governanceEscalationRoute)).toBe(true)
    }
  })
})
