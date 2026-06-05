import { describe, expect, it } from "vitest"
import { buildDefaultInvestorShieldChecks } from "@/lib/investor-shield/default-checks"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import type {
  EvidenceItem,
  InvestorShieldCheck,
  ManualOverride,
} from "@/types/investor-shield"
import type { InvestorShieldEvaluationInput } from "@/types/investor-shield-enforcement"

const DEAL_ID = "saved-deal-text-id-4c2"

function makeChecks(overrides: Partial<InvestorShieldCheck>[]): readonly InvestorShieldCheck[] {
  const base = buildDefaultInvestorShieldChecks(DEAL_ID)

  return base.map((check) => {
    const override = overrides.find((candidate) => candidate.gateKey === check.gateKey)

    return {
      ...check,
      status: "SATISFIED",
      confidence: "HIGH",
      ...override,
    }
  })
}

function makeEvidence(): readonly EvidenceItem[] {
  return INVESTOR_SHIELD_DEFAULT_GATES.flatMap((gate) => {
    const evidenceTypes =
      gate.key === "REFURB_CERTAINTY"
        ? (["REFURB_PHOTO", "ROOM_MEASUREMENT"] as const)
        : gate.evidenceTypes.slice(0, 1)

    return evidenceTypes.map((evidenceType, index) => ({
      dealId: DEAL_ID,
      gateKey: gate.key,
      evidenceType,
      source: index === 0 ? "document" : "professional",
      confidence: "HIGH" as const,
      label: `${gate.key}-${evidenceType}`,
    }))
  })
}

function makeInput(overrides?: Partial<InvestorShieldEvaluationInput>): InvestorShieldEvaluationInput {
  return {
    dealId: DEAL_ID,
    checks: makeChecks([]),
    evidenceItems: makeEvidence(),
    riskFlags: [],
    manualOverrides: [],
    ...overrides,
  }
}

describe("evaluateInvestorShield", () => {
  it("returns CLEAR and CAN_PROGRESS when all gates are satisfied", () => {
    const result = evaluateInvestorShield(makeInput())

    expect(result.overallStatus).toBe("CLEAR")
    expect(result.progressionDecision).toBe("CAN_PROGRESS")
    expect(result.canProgress).toBe(true)
    expect(result.blockingReasons).toEqual([])
  })

  it("treats required blocker gates as blocked and caution gates as review", () => {
    const checks = makeChecks([
      { gateKey: "SOLD_COMPS", status: "REQUIRED", severity: "BLOCKER" },
      { gateKey: "LEASEHOLD", status: "REQUIRED", severity: "CAUTION" },
    ])

    const result = evaluateInvestorShield(makeInput({ checks }))

    expect(result.overallStatus).toBe("BLOCKED")
    expect(result.blockingGateKeys).toContain("SOLD_COMPS")
    expect(result.cautionGateKeys).toContain("LEASEHOLD")
    expect(result.missingEvidenceGateKeys).toEqual(
      expect.arrayContaining(["SOLD_COMPS", "LEASEHOLD"])
    )
    expect(result.blockingReasons).toContain("REQUIRED_GATE_MISSING")
  })

  it("blocks progression when a blocker gate fails", () => {
    const checks = makeChecks([{ gateKey: "TITLE", status: "FAILED", severity: "BLOCKER" }])

    const result = evaluateInvestorShield(makeInput({ checks }))

    expect(result.overallStatus).toBe("BLOCKED")
    expect(result.progressionDecision).toBe("BLOCKED")
    expect(result.blockingGateKeys).toContain("TITLE")
    expect(result.blockingReasons).toContain("BLOCKER_GATE_FAILED")
  })

  it("creates caution and builder quote recommendation for weak refurb certainty", () => {
    const checks = makeChecks([{ gateKey: "REFURB_CERTAINTY", status: "WEAK", severity: "BLOCKER" }])
    const evidenceItems = makeEvidence().concat({
      dealId: DEAL_ID,
      gateKey: "REFURB_CERTAINTY",
      evidenceType: "ROOM_MEASUREMENT",
      source: "professional",
      confidence: "MEDIUM",
      label: "room-measurement",
    })

    const result = evaluateInvestorShield(makeInput({ checks, evidenceItems }))

    expect(result.overallStatus).toBe("CAUTION")
    expect(result.cautionGateKeys).toContain("REFURB_CERTAINTY")
    expect(result.taskRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateKey: "REFURB_CERTAINTY",
          type: "OBTAIN_BUILDER_QUOTE",
          idempotencyKey: "investor-shield:saved-deal-text-id-4c2:REFURB_CERTAINTY:OBTAIN_BUILDER_QUOTE",
        }),
      ])
    )
  })

  it("does not allow advisory-only evidence to satisfy hard evidence gates alone", () => {
    const advisoryOnlyEvidence: readonly EvidenceItem[] = [
      {
        dealId: DEAL_ID,
        gateKey: "TITLE",
        evidenceType: "TITLE_DOCUMENT",
        source: "ai_advisory",
        confidence: "LOW",
        label: "ai-title",
        advisoryOnly: true,
      },
    ]

    const checks = makeChecks([{ gateKey: "TITLE", status: "SATISFIED", severity: "BLOCKER" }])
    const result = evaluateInvestorShield(
      makeInput({ checks, evidenceItems: advisoryOnlyEvidence })
    )

    expect(result.overallStatus).toBe("BLOCKED")
    expect(result.blockingReasons).toContain("ADVISORY_ONLY_EVIDENCE_INSUFFICIENT")
    expect(result.advisoryOnlyEvidenceWarnings[0]).toContain("TITLE")
  })

  it("requires a manual override reason for waived blocker gates", () => {
    const checks = makeChecks([
      { gateKey: "SOLICITOR_FEEDBACK", status: "WAIVED", severity: "BLOCKER" },
    ])

    const result = evaluateInvestorShield(makeInput({ checks }))

    expect(result.overallStatus).toBe("BLOCKED")
    expect(result.manualOverrideRequired).toBe(true)
    expect(result.blockingReasons).toContain("MANUAL_OVERRIDE_REQUIRED")
  })

  it("keeps waived gates under caution even when a manual override reason exists", () => {
    const checks = makeChecks([
      { gateKey: "SOLICITOR_FEEDBACK", status: "WAIVED", severity: "BLOCKER" },
    ])
    const manualOverrides: readonly ManualOverride[] = [
      {
        dealId: DEAL_ID,
        gateKey: "SOLICITOR_FEEDBACK",
        reason: "Solicitor note captured and accepted for controlled progression.",
      },
    ]

    const result = evaluateInvestorShield(makeInput({ checks, manualOverrides }))

    expect(result.overallStatus).toBe("CAUTION")
    expect(result.progressionDecision).toBe("NEEDS_REVIEW")
    expect(result.cautionGateKeys).toContain("SOLICITOR_FEEDBACK")
    expect(result.blockingReasons).not.toContain("MANUAL_OVERRIDE_REQUIRED")
  })

  it("treats deterministic reject as dominant even when all gates are satisfied", () => {
    const result = evaluateInvestorShield(
      makeInput({ deterministicDealStatus: "REJECT" })
    )

    expect(result.overallStatus).toBe("BLOCKED")
    expect(result.progressionDecision).toBe("BLOCKED")
    expect(result.canProgress).toBe(false)
    expect(result.blockingReasons).toContain("DETERMINISTIC_REJECT_DOMINATES")
    expect(result.deterministicDominanceNote).toBeTruthy()
  })

  it("returns deterministic idempotency keys and identical output for identical input", () => {
    const checks = makeChecks([{ gateKey: "LENDER_CRITERIA", status: "REQUIRED", severity: "BLOCKER" }])
    const input = makeInput({ checks, evaluatedAt: "2026-06-05T00:00:00.000Z" })

    const first = evaluateInvestorShield(input)
    const second = evaluateInvestorShield(input)

    expect(first).toEqual(second)
    expect(first.taskRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idempotencyKey: "investor-shield:saved-deal-text-id-4c2:LENDER_CRITERIA:REVIEW_LENDER_CRITERIA",
        }),
      ])
    )
  })
})
