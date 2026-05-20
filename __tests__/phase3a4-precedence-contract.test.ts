import { describe, expect, it } from "vitest"
import * as enforcementContracts from "@/types/phase3-enforcement"

describe("Phase 3A-4 severity and precedence contracts", () => {
  it("severity tiers include info, warning, high, critical, fatal", () => {
    expect(enforcementContracts.PHASE3A4_SEVERITY_TIERS).toEqual([
      "info",
      "warning",
      "high",
      "critical",
      "fatal",
    ])
  })

  it("blocking severity tiers are critical and fatal only", () => {
    expect(enforcementContracts.PHASE3A4_BLOCKING_SEVERITY_TIERS).toEqual(["critical", "fatal"])
  })

  it("precedence matrix includes all required rules", () => {
    const ruleIds = enforcementContracts.PHASE3A4_PRECEDENCE_MATRIX.rules.map((rule) => rule.ruleId)
    expect(ruleIds).toEqual(
      expect.arrayContaining([
        "governance-beats-workflow",
        "capital-protection-beats-scoring",
        "fatal-risk-beats-advisory-output",
        "deterministic-classification-beats-evidence-hint",
        "deterministic-output-beats-ai-commentary",
        "authority-enforcement-beats-ui-presentation",
      ])
    )
  })

  it("every precedence rule has advisoryOnly true", () => {
    expect(enforcementContracts.PHASE3A4_PRECEDENCE_MATRIX.rules.every((rule) => rule.advisoryOnly)).toBe(true)
  })

  it("required precedence rules block progression", () => {
    expect(enforcementContracts.PHASE3A4_PRECEDENCE_MATRIX.rules.every((rule) => rule.blocksProgression)).toBe(true)
  })

  it("governance winner exists over workflow", () => {
    expect(
      enforcementContracts.PHASE3A4_PRECEDENCE_MATRIX.rules.some(
        (rule) => rule.winner === "governance" && rule.loser === "workflow"
      )
    ).toBe(true)
  })

  it("capital protection winner exists over scoring", () => {
    expect(
      enforcementContracts.PHASE3A4_PRECEDENCE_MATRIX.rules.some(
        (rule) => rule.winner === "capital_protection" && rule.loser === "scoring"
      )
    ).toBe(true)
  })

  it("fatal risk winner exists over advisory output", () => {
    expect(
      enforcementContracts.PHASE3A4_PRECEDENCE_MATRIX.rules.some(
        (rule) => rule.winner === "fatal_risk" && rule.loser === "advisory_output"
      )
    ).toBe(true)
  })

  it("deterministic classification winner exists over evidence hint", () => {
    expect(
      enforcementContracts.PHASE3A4_PRECEDENCE_MATRIX.rules.some(
        (rule) => rule.winner === "deterministic_classification" && rule.loser === "evidence_hint"
      )
    ).toBe(true)
  })

  it("deterministic output winner exists over AI commentary", () => {
    expect(
      enforcementContracts.PHASE3A4_PRECEDENCE_MATRIX.rules.some(
        (rule) => rule.winner === "deterministic_output" && rule.loser === "ai_commentary"
      )
    ).toBe(true)
  })

  it("authority enforcement winner exists over UI presentation", () => {
    expect(
      enforcementContracts.PHASE3A4_PRECEDENCE_MATRIX.rules.some(
        (rule) => rule.winner === "authority_enforcement" && rule.loser === "ui_presentation"
      )
    ).toBe(true)
  })

  it("no runtime fields exist in precedence rule contracts", () => {
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
    ]

    for (const rule of enforcementContracts.PHASE3A4_PRECEDENCE_MATRIX.rules) {
      for (const key of Object.keys(rule)) {
        expect(forbiddenFields).not.toContain(key)
      }
    }
  })

  it("no runtime resolver function is exported", () => {
    expect("resolvePhase3A4Precedence" in enforcementContracts).toBe(false)
    expect("applyPhase3A4Precedence" in enforcementContracts).toBe(false)
    expect("enforcePhase3A4Precedence" in enforcementContracts).toBe(false)
  })
})
