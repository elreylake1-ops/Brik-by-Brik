// Phase 3A-3 Step 5 — Pure Authority Enforcement Engine Tests
// Advisory-only. No runtime enforcement is wired to any app flow.
// Tests confirm deterministic scenario evaluation, fixture-exact output, and advisory boundary.

import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { evaluatePhase3AuthorityEnforcementScenario } from "../lib/engine/phase3-authority-enforcement"
import { validatePhase3EnforcementResult } from "../lib/engine/phase3-enforcement-contract"
import type { Phase3EnforcementScenario, Phase3EnforcementResult } from "../types/phase3-enforcement"

const FIXTURE_BASE = join(__dirname, "fixtures", "phase3-enforcement-engine")

function loadEngineFixture(name: string): Phase3EnforcementResult {
  return JSON.parse(readFileSync(join(FIXTURE_BASE, name), "utf-8")) as Phase3EnforcementResult
}

// --- Scenario inputs (inline — deterministic, no external dependencies) ---

const SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE: Phase3EnforcementScenario = {
  scenarioId: "advisory-overrides-governance",
  attemptedLayer: "evidence_advisory",
  protectedAuthority: "deterministic_governance",
  attemptedAction: "evidence hint attempted to override finalClassification to proceed_candidate",
  violationType: "advisory_overrides_governance",
  detectedBy: "authority_enforcement_engine",
  severity: "fatal",
  safeFailAction: "block_advisory_upgrade",
  advisoryOnly: true,
}

const SCENARIO_WORKFLOW_OVERRIDES_CAPITAL_PROTECTION: Phase3EnforcementScenario = {
  scenarioId: "workflow-overrides-capital-protection",
  attemptedLayer: "workflow_orchestration",
  protectedAuthority: "capital_protection",
  attemptedAction: "orchestrator attempted to set globalDealState to proceed_candidate on NO_DEAL result",
  violationType: "workflow_overrides_capital_protection",
  detectedBy: "state_hierarchy_enforcement",
  severity: "fatal",
  safeFailAction: "preserve_deterministic_result",
  advisoryOnly: true,
}

const SCENARIO_ESCALATION_DOWNGRADE: Phase3EnforcementScenario = {
  scenarioId: "escalation-downgrade",
  attemptedLayer: "evidence_advisory",
  protectedAuthority: "capital_protection",
  attemptedAction: "merge layer attempted to replace capital_protection route with valuation_review",
  violationType: "merged_output_downgrades_escalation",
  detectedBy: "escalation_priority_engine",
  severity: "fatal",
  safeFailAction: "preserve_deterministic_result",
  advisoryOnly: true,
}

const SCENARIO_UI_SOFTENS_FATAL: Phase3EnforcementScenario = {
  scenarioId: "ui-softens-fatal-classification",
  attemptedLayer: "ui_presentation",
  protectedAuthority: "capital_protection",
  attemptedAction: "review surface rendered NO_DEAL without prominent capital protection warning",
  violationType: "ui_softens_fatal_classification",
  detectedBy: "ui_governance_enforcement",
  severity: "high",
  safeFailAction: "increase_review_burden",
  advisoryOnly: true,
}

const SCENARIO_CLEAN: Phase3EnforcementScenario = {
  scenarioId: "clean-governance-self-check",
  attemptedLayer: "deterministic_governance",
  protectedAuthority: "deterministic_governance",
  attemptedAction: "deterministic governance layer validates its own final classification output",
  violationType: "advisory_overrides_governance",
  detectedBy: "authority_enforcement_engine",
  severity: "low",
  safeFailAction: "block_advisory_upgrade",
  advisoryOnly: true,
}

// --- Exact fixture comparison tests ---

describe("evaluatePhase3AuthorityEnforcementScenario — exact fixture output", () => {
  it("advisory overrides governance matches locked fixture", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    const expected = loadEngineFixture("advisory-overrides-governance-enforcement.json")
    expect(result).toEqual(expected)
  })

  it("workflow overrides capital protection matches locked fixture", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_WORKFLOW_OVERRIDES_CAPITAL_PROTECTION)
    const expected = loadEngineFixture("workflow-overrides-capital-protection-enforcement.json")
    expect(result).toEqual(expected)
  })

  it("escalation downgrade matches locked fixture", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ESCALATION_DOWNGRADE)
    const expected = loadEngineFixture("escalation-downgrade-enforcement.json")
    expect(result).toEqual(expected)
  })

  it("UI softens fatal classification matches locked fixture", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_UI_SOFTENS_FATAL)
    const expected = loadEngineFixture("ui-softens-fatal-classification-enforcement.json")
    expect(result).toEqual(expected)
  })

  it("clean scenario matches locked fixture", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_CLEAN)
    const expected = loadEngineFixture("clean-enforcement-scenario.json")
    expect(result).toEqual(expected)
  })
})

// --- Validation helper integration ---

describe("evaluatePhase3AuthorityEnforcementScenario — validation passes", () => {
  const scenarios: Array<{ label: string; scenario: Phase3EnforcementScenario }> = [
    { label: "advisory overrides governance", scenario: SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE },
    { label: "workflow overrides capital protection", scenario: SCENARIO_WORKFLOW_OVERRIDES_CAPITAL_PROTECTION },
    { label: "escalation downgrade", scenario: SCENARIO_ESCALATION_DOWNGRADE },
    { label: "UI softens fatal classification", scenario: SCENARIO_UI_SOFTENS_FATAL },
    { label: "clean scenario", scenario: SCENARIO_CLEAN },
  ]

  for (const { label, scenario } of scenarios) {
    it(`engine output for "${label}" passes validatePhase3EnforcementResult`, () => {
      const result = evaluatePhase3AuthorityEnforcementScenario(scenario)
      const validation = validatePhase3EnforcementResult(result)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(validation.advisoryOnly).toBe(true)
    })
  }
})

// --- Violation behavior ---

describe("evaluatePhase3AuthorityEnforcementScenario — violation behavior", () => {
  it("advisory override returns blocked outcome", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    expect(result.valid).toBe(false)
    expect(result.outcome).toBe("blocked")
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].violationType).toBe("advisory_overrides_governance")
  })

  it("workflow override of capital protection returns blocked outcome", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_WORKFLOW_OVERRIDES_CAPITAL_PROTECTION)
    expect(result.valid).toBe(false)
    expect(result.outcome).toBe("blocked")
    expect(result.violations[0].protectedAuthority).toBe("capital_protection")
  })

  it("escalation downgrade returns blocked outcome", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ESCALATION_DOWNGRADE)
    expect(result.valid).toBe(false)
    expect(result.outcome).toBe("blocked")
  })

  it("UI softening fatal classification returns review_required outcome", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_UI_SOFTENS_FATAL)
    expect(result.valid).toBe(false)
    expect(result.outcome).toBe("review_required")
  })

  it("fatal violation does not return passed outcome", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    expect(result.outcome).not.toBe("passed")
    expect(result.valid).toBe(false)
  })

  it("high severity violation does not return passed outcome", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_UI_SOFTENS_FATAL)
    expect(result.outcome).not.toBe("passed")
    expect(result.valid).toBe(false)
  })

  it("violation record carries advisoryOnly true", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    expect(result.violations[0].advisoryOnly).toBe(true)
  })

  it("violation safeFailAction is present in result.safeFailActions", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    expect(result.safeFailActions).toContain(result.violations[0].safeFailAction)
  })

  it("violationId is deterministic from scenarioId", () => {
    const r1 = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    const r2 = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    expect(r1.violations[0].violationId).toBe(r2.violations[0].violationId)
    expect(r1.violations[0].violationId).toBe("v-advisory-overrides-governance")
  })
})

// --- Clean scenario ---

describe("evaluatePhase3AuthorityEnforcementScenario — clean scenario", () => {
  it("clean scenario returns passed outcome", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_CLEAN)
    expect(result.valid).toBe(true)
    expect(result.outcome).toBe("passed")
    expect(result.violations).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.safeFailActions).toHaveLength(0)
    expect(result.advisoryOnly).toBe(true)
  })
})

// --- Immutability and determinism ---

describe("evaluatePhase3AuthorityEnforcementScenario — immutability and determinism", () => {
  it("does not mutate scenario input", () => {
    const snapshot = JSON.stringify(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    expect(JSON.stringify(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)).toBe(snapshot)
  })

  it("produces identical output on repeated calls (deterministic)", () => {
    const first = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    const second = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    expect(first).toEqual(second)
  })

  it("clean scenario is deterministic", () => {
    const first = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_CLEAN)
    const second = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_CLEAN)
    expect(first).toEqual(second)
  })
})

// --- Output field boundary ---

describe("evaluatePhase3AuthorityEnforcementScenario — output field boundary", () => {
  it("output carries no timestamps or random fields", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    const forbidden = ["timestamp", "createdAt", "updatedAt", "id", "random", "uuid", "nonce"]
    for (const key of forbidden) {
      expect(Object.keys(result)).not.toContain(key)
    }
  })

  it("output carries no API, database, or AI fields", () => {
    const result = evaluatePhase3AuthorityEnforcementScenario(SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE)
    const forbidden = ["api", "database", "aiModel", "routeHandler", "handler", "fetch", "persist"]
    for (const key of forbidden) {
      expect(Object.keys(result)).not.toContain(key)
    }
  })

  it("all outputs carry advisoryOnly true", () => {
    const scenarios = [
      SCENARIO_ADVISORY_OVERRIDES_GOVERNANCE,
      SCENARIO_WORKFLOW_OVERRIDES_CAPITAL_PROTECTION,
      SCENARIO_ESCALATION_DOWNGRADE,
      SCENARIO_UI_SOFTENS_FATAL,
      SCENARIO_CLEAN,
    ]
    for (const scenario of scenarios) {
      const result = evaluatePhase3AuthorityEnforcementScenario(scenario)
      expect(result.advisoryOnly).toBe(true)
    }
  })
})

// --- Engine export surface ---

describe("phase3-authority-enforcement module export surface", () => {
  it("does not export apply, enforce, wire, or mutate functions", async () => {
    const mod = await import("../lib/engine/phase3-authority-enforcement")
    const keys = Object.keys(mod)
    const forbidden = ["apply", "enforce", "wire", "mutate", "persist", "handler", "execute"]
    for (const f of forbidden) {
      expect(keys).not.toContain(f)
    }
  })
})
