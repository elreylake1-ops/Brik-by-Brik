import { describe, expect, it } from "vitest"
import {
  INVESTOR_SHIELD_BLOCKING_REASONS,
  INVESTOR_SHIELD_OVERALL_STATUSES,
  INVESTOR_SHIELD_PROGRESSION_DECISIONS,
  INVESTOR_SHIELD_TASK_RECOMMENDATION_TYPES,
  type InvestorShieldEnforcementResult,
} from "@/types/investor-shield-enforcement"

function expectNoDuplicates(values: readonly string[]) {
  expect(new Set(values).size).toBe(values.length)
}

describe("investor shield enforcement contracts", () => {
  it("exports the required overall statuses and progression decisions", () => {
    expect(INVESTOR_SHIELD_OVERALL_STATUSES).toEqual(["CLEAR", "CAUTION", "BLOCKED"])
    expect(INVESTOR_SHIELD_PROGRESSION_DECISIONS).toEqual([
      "CAN_PROGRESS",
      "NEEDS_REVIEW",
      "BLOCKED",
    ])
  })

  it("exports the required blocking reasons and task recommendation types", () => {
    expect(INVESTOR_SHIELD_BLOCKING_REASONS).toEqual([
      "REQUIRED_GATE_MISSING",
      "BLOCKER_GATE_FAILED",
      "FATAL_RISK_FLAG",
      "MANUAL_OVERRIDE_REQUIRED",
      "ADVISORY_ONLY_EVIDENCE_INSUFFICIENT",
      "REFURB_CERTAINTY_INSUFFICIENT",
      "DETERMINISTIC_REJECT_DOMINATES",
    ])

    expect(INVESTOR_SHIELD_TASK_RECOMMENDATION_TYPES).toEqual([
      "REQUEST_EVIDENCE",
      "REVIEW_GATE",
      "OBTAIN_BUILDER_QUOTE",
      "OBTAIN_BUILDER_CONTRACT",
      "REQUEST_SPECIALIST_SURVEY",
      "REVIEW_SOLICITOR_FEEDBACK",
      "VERIFY_RENTAL_DEMAND",
      "REVIEW_LENDER_CRITERIA",
    ])
  })

  it("does not export duplicate enum-like values", () => {
    expectNoDuplicates(INVESTOR_SHIELD_OVERALL_STATUSES)
    expectNoDuplicates(INVESTOR_SHIELD_PROGRESSION_DECISIONS)
    expectNoDuplicates(INVESTOR_SHIELD_BLOCKING_REASONS)
    expectNoDuplicates(INVESTOR_SHIELD_TASK_RECOMMENDATION_TYPES)
  })

  it("supports composing an enforcement result with string deal ids", () => {
    const result: InvestorShieldEnforcementResult = {
      dealId: "saved-deal-text-id-001",
      overallStatus: "BLOCKED",
      progressionDecision: "BLOCKED",
      canProgress: false,
      blockingGateKeys: ["TITLE", "REFURB_CERTAINTY"],
      cautionGateKeys: ["LEASEHOLD"],
      missingEvidenceGateKeys: ["REFURB_CERTAINTY"],
      manualOverrideRequired: true,
      advisoryOnlyEvidenceWarnings: [
        "AI advisory evidence cannot satisfy hard evidence gates alone.",
      ],
      taskRecommendations: [
        {
          gateKey: "REFURB_CERTAINTY",
          subGateKey: "BUILDER_QUOTE_EVIDENCE",
          type: "OBTAIN_BUILDER_QUOTE",
          title: "Obtain builder quote evidence",
          reason: "Refurb certainty remains insufficient without builder quote evidence.",
          severity: "BLOCKER",
          source: "system_default",
          idempotencyKey: "saved-deal-text-id-001:REFURB_CERTAINTY:OBTAIN_BUILDER_QUOTE",
        },
      ],
      blockingReasons: [
        "REFURB_CERTAINTY_INSUFFICIENT",
        "DETERMINISTIC_REJECT_DOMINATES",
      ],
      deterministicDominanceNote:
        "Investor Shield may add caution or blocking, but it cannot soften deterministic rejection.",
      evaluatedAt: "2026-06-05T00:00:00.000Z",
    }

    expect(result.dealId).toBe("saved-deal-text-id-001")
    expect(result.blockingReasons).toContain("DETERMINISTIC_REJECT_DOMINATES")
  })
})
