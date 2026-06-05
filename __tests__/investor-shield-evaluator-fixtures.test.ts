import { describe, expect, it } from "vitest"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import {
  INVESTOR_SHIELD_EVALUATOR_DETERMINISM_FIXTURE,
  INVESTOR_SHIELD_EVALUATOR_FIXTURES,
} from "./fixtures/investor-shield-evaluator-fixtures"

describe("investor shield evaluator fixtures", () => {
  it("covers all required named scenarios", () => {
    expect(INVESTOR_SHIELD_EVALUATOR_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "all_gates_satisfied",
      "missing_sold_comps",
      "failed_title_blocker",
      "weak_refurb_certainty",
      "refurb_ai_advisory_only",
      "refurb_with_builder_quote_hard_evidence",
      "manual_waiver_without_reason",
      "manual_waiver_with_reason",
      "rental_demand_caution_only",
      "deterministic_no_go_dominates",
      "duplicate_refurb_advisory_evidence",
      "unknown_gate_ignored",
      "missing_check_record_for_blocker_gate",
    ])
  })

  it("all fixture ids are unique", () => {
    const ids = INVESTOR_SHIELD_EVALUATOR_FIXTURES.map((fixture) => fixture.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const fixture of INVESTOR_SHIELD_EVALUATOR_FIXTURES) {
    it(`matches expected output for ${fixture.name}`, () => {
      const result = evaluateInvestorShield(fixture.input)

      expect(result.overallStatus).toBe(fixture.expected.overallStatus)
      expect(result.progressionDecision).toBe(fixture.expected.progressionDecision)
      expect(result.canProgress).toBe(fixture.expected.canProgress)
      expect(result.blockingReasons).toEqual(fixture.expected.blockingReasons)
      expect(result.blockingGateKeys).toEqual(fixture.expected.blockingGateKeys)
      expect(result.cautionGateKeys).toEqual(fixture.expected.cautionGateKeys)
      expect(result.missingEvidenceGateKeys).toEqual(fixture.expected.missingEvidenceGateKeys)
      expect(result.taskRecommendations).toEqual(fixture.expected.taskRecommendations)
      expect(result.advisoryOnlyEvidenceWarnings).toEqual(
        fixture.expected.advisoryOnlyEvidenceWarnings
      )
      expect(result.deterministicDominanceNote).toBe(
        fixture.expected.deterministicDominanceNote
      )
    })
  }

  it("duplicate advisory evidence does not duplicate warnings or recommendations", () => {
    const duplicateScenario = INVESTOR_SHIELD_EVALUATOR_FIXTURES.find(
      (fixture) => fixture.id === "duplicate_refurb_advisory_evidence"
    )

    const result = evaluateInvestorShield(duplicateScenario!.input)

    expect(result.advisoryOnlyEvidenceWarnings).toHaveLength(1)
    expect(result.taskRecommendations).toHaveLength(0)
  })

  it("repeated evaluation remains deterministic for identical input", () => {
    const first = evaluateInvestorShield(INVESTOR_SHIELD_EVALUATOR_DETERMINISM_FIXTURE)
    const second = evaluateInvestorShield(INVESTOR_SHIELD_EVALUATOR_DETERMINISM_FIXTURE)

    expect(first).toEqual(second)
  })
})
