import { describe, expect, it } from "vitest"
import type {
  EvidenceOrchestrationHint,
  EvidenceOrchestrationHints,
} from "@/types/phase3-evidence"

function makeHint(overrides?: Partial<EvidenceOrchestrationHint>): EvidenceOrchestrationHint {
  return {
    id: "hint-1",
    evidenceItemId: "ev-1",
    category: "comparable_evidence",
    trigger: "missing_evidence",
    severity: "high",
    suggestedTaskCategory: "evidence",
    suggestedTaskPriority: "high",
    suggestedEscalationRoute: "evidence_gap",
    summary: "Comparable evidence is missing and requires manual review.",
    advisoryOnly: true,
    ...overrides,
  }
}

describe("phase3 evidence orchestration hint contracts", () => {
  it("supports a valid missing evidence hint", () => {
    const hint = makeHint()

    expect(hint.trigger).toBe("missing_evidence")
    expect(hint.category).toBe("comparable_evidence")
    expect(hint.advisoryOnly).toBe(true)
  })

  it("supports a valid weak comparable evidence hint", () => {
    const hint = makeHint({
      id: "hint-weak-comp",
      trigger: "weak_evidence",
      severity: "medium",
      category: "comparable_evidence",
      suggestedEscalationRoute: "valuation_review",
      summary: "Comparable evidence is weak and should be challenged.",
    })

    expect(hint.trigger).toBe("weak_evidence")
    expect(hint.suggestedEscalationRoute).toBe("valuation_review")
  })

  it("supports a valid conflicting legal evidence hint", () => {
    const hint = makeHint({
      id: "hint-conflict-legal",
      category: "legal_survey_evidence",
      trigger: "conflicting_evidence",
      severity: "high",
      suggestedTaskCategory: "manual_review",
      suggestedEscalationRoute: "legal_review",
      summary: "Legal evidence conflict requires manual legal review.",
    })

    expect(hint.trigger).toBe("conflicting_evidence")
    expect(hint.suggestedEscalationRoute).toBe("legal_review")
  })

  it("supports a valid reserved source review hint", () => {
    const hint = makeHint({
      id: "hint-reserved-source",
      category: "system_generated_evidence",
      trigger: "reserved_source_review",
      severity: "medium",
      suggestedTaskCategory: "manual_review",
      suggestedTaskPriority: "medium",
      suggestedEscalationRoute: "manual_review",
      warnings: ["reserved source label only: future_ai_extracted"],
      summary: "Reserved source label requires manual confirmation.",
    })

    expect(hint.trigger).toBe("reserved_source_review")
    expect(hint.warnings).toEqual(["reserved source label only: future_ai_extracted"])
  })

  it("supports a valid accepted evidence awareness hint", () => {
    const hint = makeHint({
      id: "hint-accepted-awareness",
      category: "operator_note",
      trigger: "accepted_evidence_awareness",
      severity: "low",
      suggestedTaskCategory: "limitations_awareness",
      suggestedTaskPriority: "low",
      suggestedEscalationRoute: "none",
      summary: "Accepted evidence is awareness-only and non-decisioning.",
    })

    expect(hint.trigger).toBe("accepted_evidence_awareness")
    expect(hint.suggestedTaskCategory).toBe("limitations_awareness")
  })

  it("supports an EvidenceOrchestrationHints bundle shape", () => {
    const hints: EvidenceOrchestrationHints = {
      tasks: [
        makeHint({ id: "hint-a" }),
        makeHint({
          id: "hint-b",
          category: "lender_refinance_evidence",
          trigger: "missing_evidence",
          suggestedEscalationRoute: "lender_review",
          summary: "Lender evidence missing and requires review.",
        }),
      ],
      escalationRoutes: ["evidence_gap", "lender_review"],
      warnings: ["review required before confidence can be upgraded"],
      reviewRequired: true,
      advisoryOnly: true,
    }

    expect(hints.tasks).toHaveLength(2)
    expect(hints.reviewRequired).toBe(true)
    expect(hints.advisoryOnly).toBe(true)
  })

  it("keeps advisoryOnly true on hints and bundle", () => {
    const hint = makeHint({ id: "hint-advisory-only" })
    const hints: EvidenceOrchestrationHints = {
      tasks: [hint],
      escalationRoutes: ["manual_review"],
      warnings: [],
      reviewRequired: false,
      advisoryOnly: true,
    }

    expect(hint.advisoryOnly).toBe(true)
    expect(hints.advisoryOnly).toBe(true)
  })

  it("does not imply deterministic approval", () => {
    const hint = makeHint({
      id: "hint-no-approval",
      trigger: "accepted_evidence_awareness",
      summary: "Accepted evidence remains advisory and non-decisioning.",
    })

    expect("finalClassification" in hint).toBe(false)
    expect("governanceState" in hint).toBe(false)
  })

  it("keeps escalation routes as suggestions only", () => {
    const hints: EvidenceOrchestrationHints = {
      tasks: [
        makeHint({
          id: "hint-escalation-suggestion",
          suggestedEscalationRoute: "valuation_review",
          summary: "Suggested valuation review route only.",
        }),
      ],
      escalationRoutes: ["valuation_review"],
      warnings: [],
      reviewRequired: true,
      advisoryOnly: true,
    }

    expect(hints.escalationRoutes).toEqual(["valuation_review"])
    expect("governanceEscalationRoute" in hints).toBe(false)
  })
})
