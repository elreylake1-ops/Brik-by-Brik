import { readFileSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"
import type {
  Phase3A4GovernanceDriftDetection,
  Phase3A4GovernanceDriftFixtureCase,
} from "@/types/phase3-enforcement"
import * as enforcementContracts from "@/types/phase3-enforcement"

const FIXTURE_BASE = join(__dirname, "fixtures", "phase3a4-governance-drift")

function loadFixture(name: string): Phase3A4GovernanceDriftFixtureCase {
  return JSON.parse(readFileSync(join(FIXTURE_BASE, name), "utf-8")) as Phase3A4GovernanceDriftFixtureCase
}

describe("Phase 3A-4 governance drift contracts and fixtures", () => {
  it("drift types include all four required drift types", () => {
    expect(enforcementContracts.PHASE3A4_GOVERNANCE_DRIFT_TYPES).toEqual(
      expect.arrayContaining([
        "advisory_authority_drift",
        "ui_fatal_softening_drift",
        "workflow_reject_bypass_drift",
        "ai_governance_approval_drift",
      ])
    )
  })

  it("drift actions include block_and_log", () => {
    expect(enforcementContracts.PHASE3A4_GOVERNANCE_DRIFT_ACTIONS).toContain("block_and_log")
  })

  it("drift actions include preserve_deterministic_result", () => {
    expect(enforcementContracts.PHASE3A4_GOVERNANCE_DRIFT_ACTIONS).toContain("preserve_deterministic_result")
  })

  it("governance drift detection object shape is valid", () => {
    const detection: Phase3A4GovernanceDriftDetection = {
      driftDetected: true,
      driftType: "advisory_authority_drift",
      action: "block_and_log",
      reason: "Advisory output weakens deterministic risk.",
      protectedAuthority: "deterministic_governance",
      advisoryOnly: true,
    }
    expect(detection.advisoryOnly).toBe(true)
  })

  it("fixture cases load successfully", () => {
    const fixtures = [
      "advisory-authority-drift.json",
      "ui-fatal-softening-drift.json",
      "workflow-reject-bypass-drift.json",
      "ai-governance-approval-drift.json",
      "clean-no-drift.json",
    ]
    for (const fixture of fixtures) {
      const loaded = loadFixture(fixture)
      expect(loaded.caseId.length).toBeGreaterThan(0)
    }
  })

  it("advisory authority drift fixture has driftDetected true", () => {
    const fixture = loadFixture("advisory-authority-drift.json")
    expect(fixture.expectedDetection.driftDetected).toBe(true)
  })

  it("UI fatal softening fixture has driftDetected true", () => {
    const fixture = loadFixture("ui-fatal-softening-drift.json")
    expect(fixture.expectedDetection.driftDetected).toBe(true)
  })

  it("workflow reject bypass fixture has driftDetected true", () => {
    const fixture = loadFixture("workflow-reject-bypass-drift.json")
    expect(fixture.expectedDetection.driftDetected).toBe(true)
  })

  it("AI governance approval fixture has driftDetected true", () => {
    const fixture = loadFixture("ai-governance-approval-drift.json")
    expect(fixture.expectedDetection.driftDetected).toBe(true)
  })

  it("clean fixture has driftDetected false", () => {
    const fixture = loadFixture("clean-no-drift.json")
    expect(fixture.expectedDetection.driftDetected).toBe(false)
  })

  it("all fixture cases have advisoryOnly true", () => {
    const fixtures = [
      "advisory-authority-drift.json",
      "ui-fatal-softening-drift.json",
      "workflow-reject-bypass-drift.json",
      "ai-governance-approval-drift.json",
      "clean-no-drift.json",
    ]
    for (const fixture of fixtures) {
      const loaded = loadFixture(fixture)
      expect(loaded.advisoryOnly).toBe(true)
      expect(loaded.expectedDetection.advisoryOnly).toBe(true)
    }
  })

  it("no runtime fields exist in fixtures", () => {
    const forbidden = [
      "execute",
      "enforce",
      "apply",
      "mutate",
      "persist",
      "fetch",
      "api",
      "aiModel",
      "database",
      "routeHandler",
      "handler",
      "detect",
      "run",
      "log",
      "save",
    ]

    const fixtures = [
      "advisory-authority-drift.json",
      "ui-fatal-softening-drift.json",
      "workflow-reject-bypass-drift.json",
      "ai-governance-approval-drift.json",
      "clean-no-drift.json",
    ]

    for (const fixture of fixtures) {
      const loaded = loadFixture(fixture) as unknown as Record<string, unknown>
      const serialized = JSON.stringify(loaded)
      for (const key of forbidden) {
        expect(Object.keys(loaded)).not.toContain(key)
        expect(serialized).not.toContain(`"${key}"`)
      }
    }
  })

  it("no detection/runtime function is exported", () => {
    expect("detectPhase3A4GovernanceDrift" in enforcementContracts).toBe(false)
    expect("runPhase3A4GovernanceDriftDetection" in enforcementContracts).toBe(false)
    expect("logPhase3A4GovernanceDrift" in enforcementContracts).toBe(false)
  })
})
