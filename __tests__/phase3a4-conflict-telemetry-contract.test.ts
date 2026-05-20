import { describe, expect, it } from "vitest"
import type { Phase3A4ConflictVisualization, Phase3A4EnforcementTelemetry } from "@/types/phase3-enforcement"
import * as enforcementContracts from "@/types/phase3-enforcement"

describe("Phase 3A-4 conflict visualization and telemetry contracts", () => {
  it("conflict types include workflow_governance_mismatch", () => {
    expect(enforcementContracts.PHASE3A4_CONFLICT_TYPES).toContain("workflow_governance_mismatch")
  })

  it("conflict types include capital_protection_scoring_conflict", () => {
    expect(enforcementContracts.PHASE3A4_CONFLICT_TYPES).toContain("capital_protection_scoring_conflict")
  })

  it("conflict types include fatal_risk_advisory_conflict", () => {
    expect(enforcementContracts.PHASE3A4_CONFLICT_TYPES).toContain("fatal_risk_advisory_conflict")
  })

  it("conflict visualization object shape is valid", () => {
    const conflict: Phase3A4ConflictVisualization = {
      conflictDetected: true,
      conflictType: "workflow_governance_mismatch",
      authoritativeWinner: "governance",
      blockedLayer: "workflow",
      reason: "Workflow attempted to outrank governance authority.",
      advisoryOnly: true,
    }
    expect(conflict.conflictDetected).toBe(true)
    expect(conflict.reason.length).toBeGreaterThan(0)
  })

  it("authoritative winner can be governance", () => {
    expect(enforcementContracts.PHASE3A4_CONFLICT_WINNERS).toContain("governance")
  })

  it("authoritative winner can be capital_protection", () => {
    expect(enforcementContracts.PHASE3A4_CONFLICT_WINNERS).toContain("capital_protection")
  })

  it("blocked layer can be workflow", () => {
    expect(enforcementContracts.PHASE3A4_BLOCKED_LAYERS).toContain("workflow")
  })

  it("blocked layer can be advisory_output", () => {
    expect(enforcementContracts.PHASE3A4_BLOCKED_LAYERS).toContain("advisory_output")
  })

  it("conflict visualization has advisoryOnly true", () => {
    const conflict: Phase3A4ConflictVisualization = {
      conflictDetected: true,
      conflictType: "fatal_risk_advisory_conflict",
      authoritativeWinner: "fatal_risk",
      blockedLayer: "advisory_output",
      reason: "Advisory output attempted to soften fatal risk signal.",
      advisoryOnly: true,
    }
    expect(conflict.advisoryOnly).toBe(true)
  })

  it("zero telemetry has all counts set to 0", () => {
    expect(enforcementContracts.PHASE3A4_ZERO_ENFORCEMENT_TELEMETRY.violationCount).toBe(0)
    expect(enforcementContracts.PHASE3A4_ZERO_ENFORCEMENT_TELEMETRY.blockedOverrideCount).toBe(0)
    expect(enforcementContracts.PHASE3A4_ZERO_ENFORCEMENT_TELEMETRY.escalationConflictCount).toBe(0)
    expect(enforcementContracts.PHASE3A4_ZERO_ENFORCEMENT_TELEMETRY.advisoryContainmentCount).toBe(0)
    expect(enforcementContracts.PHASE3A4_ZERO_ENFORCEMENT_TELEMETRY.manualReviewEscalations).toBe(0)
  })

  it("zero telemetry has loopBreakerTriggered false", () => {
    expect(enforcementContracts.PHASE3A4_ZERO_ENFORCEMENT_TELEMETRY.loopBreakerTriggered).toBe(false)
  })

  it("zero telemetry has advisoryOnly true", () => {
    expect(enforcementContracts.PHASE3A4_ZERO_ENFORCEMENT_TELEMETRY.advisoryOnly).toBe(true)
  })

  it("telemetry object shape allows positive counts for future reporting", () => {
    const telemetry: Phase3A4EnforcementTelemetry = {
      violationCount: 3,
      blockedOverrideCount: 2,
      escalationConflictCount: 1,
      advisoryContainmentCount: 4,
      loopBreakerTriggered: true,
      manualReviewEscalations: 2,
      advisoryOnly: true,
    }
    expect(telemetry.violationCount).toBeGreaterThan(0)
    expect(telemetry.advisoryContainmentCount).toBeGreaterThan(0)
  })

  it("no runtime fields exist on conflict and telemetry contracts", () => {
    const forbiddenFields = [
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
      "increment",
      "log",
      "save",
    ]

    const conflict: Phase3A4ConflictVisualization = {
      conflictDetected: true,
      conflictType: "deterministic_output_ai_conflict",
      authoritativeWinner: "deterministic_output",
      blockedLayer: "ai_commentary",
      reason: "AI commentary attempted to override deterministic output.",
      advisoryOnly: true,
    }

    for (const key of Object.keys(conflict)) {
      expect(forbiddenFields).not.toContain(key)
    }

    for (const key of Object.keys(enforcementContracts.PHASE3A4_ZERO_ENFORCEMENT_TELEMETRY)) {
      expect(forbiddenFields).not.toContain(key)
    }
  })

  it("no resolver/increment/logging function is exported", () => {
    expect("resolvePhase3A4Conflict" in enforcementContracts).toBe(false)
    expect("incrementPhase3A4Telemetry" in enforcementContracts).toBe(false)
    expect("logPhase3A4Telemetry" in enforcementContracts).toBe(false)
    expect("savePhase3A4Telemetry" in enforcementContracts).toBe(false)
  })
})
