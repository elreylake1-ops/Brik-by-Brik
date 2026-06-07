import { describe, expect, it } from "vitest"
import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import { buildInvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"
import type {
  EvidenceItem,
  InvestorShieldCheck,
} from "@/types/investor-shield"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"

function makeChecks(): readonly InvestorShieldCheck[] {
  return INVESTOR_SHIELD_DEFAULT_GATES.map((gate) => ({
    dealId: "deal-ui-1",
    gateKey: gate.key,
    status:
      gate.key === "TITLE"
        ? "FAILED"
        : gate.key === "SOLICITOR_FEEDBACK"
          ? "WAIVED"
          : "SATISFIED",
    severity:
      gate.key === "TITLE"
        ? "BLOCKER"
        : gate.key === "SOLICITOR_FEEDBACK"
          ? "BLOCKER"
          : gate.defaultSeverity,
    confidence: gate.key === "REFURB_CERTAINTY" ? "MEDIUM" : "HIGH",
    requiredEvidence: gate.evidenceTypes,
    summary:
      gate.key === "SOLICITOR_FEEDBACK"
        ? "Solicitor feedback was waived for this preview."
        : `${gate.label} summary`,
    updatedAt: "2026-06-06T00:00:00.000Z",
  }))
}

function makeEvidenceItems(): readonly EvidenceItem[] {
  return [
    {
      dealId: "deal-ui-1",
      gateKey: "SOLD_COMPS",
      evidenceType: "SOLD_COMPARABLE",
      source: "document",
      confidence: "HIGH",
      label: "Comparable pack",
    },
    {
      dealId: "deal-ui-1",
      gateKey: "TITLE",
      evidenceType: "TITLE_DOCUMENT",
      source: "document",
      confidence: "HIGH",
      label: "Title register",
    },
    {
      dealId: "deal-ui-1",
      gateKey: "REFURB_CERTAINTY",
      subGateKey: "MEDIA_EVIDENCE_PACK",
      evidenceType: "REFURB_PHOTO",
      source: "media",
      confidence: "MEDIUM",
      label: "Front room photo",
    },
    {
      dealId: "deal-ui-1",
      gateKey: "REFURB_CERTAINTY",
      subGateKey: "MEDIA_EVIDENCE_PACK",
      evidenceType: "REFURB_VIDEO",
      source: "media",
      confidence: "MEDIUM",
      label: "Walkthrough video",
    },
    {
      dealId: "deal-ui-1",
      gateKey: "REFURB_CERTAINTY",
      subGateKey: "AI_VISUAL_REVIEW_ADVISORY",
      evidenceType: "REFURB_PHOTO",
      source: "ai_advisory",
      confidence: "LOW",
      label: "AI note",
      advisoryOnly: true,
    },
    {
      dealId: "deal-ui-1",
      gateKey: "REFURB_CERTAINTY",
      subGateKey: "BUILDER_QUOTE_EVIDENCE",
      evidenceType: "BUILDER_QUOTE",
      source: "professional",
      confidence: "HIGH",
      label: "Builder quote",
    },
  ]
}

function makeEnforcementResult(): InvestorShieldEnforcementResult {
  return {
    dealId: "deal-ui-1",
    overallStatus: "CAUTION",
    progressionDecision: "NEEDS_REVIEW",
    canProgress: false,
    blockingGateKeys: ["TITLE"],
    cautionGateKeys: ["REFURB_CERTAINTY", "RENTAL_DEMAND"],
    missingEvidenceGateKeys: ["REFURB_CERTAINTY", "RENTAL_DEMAND"],
    manualOverrideRequired: true,
    advisoryOnlyEvidenceWarnings: [
      "REFURB_CERTAINTY: advisory-only evidence can support review but cannot satisfy hard evidence alone.",
    ],
    taskRecommendations: [
      {
        gateKey: "REFURB_CERTAINTY",
        subGateKey: "BUILDER_QUOTE_EVIDENCE",
        type: "OBTAIN_BUILDER_QUOTE",
        title: "Obtain builder quote",
        reason: "Refurb certainty needs stronger builder evidence.",
        severity: "BLOCKER",
        source: "system_default",
        idempotencyKey:
          "investor-shield:deal-ui-1:REFURB_CERTAINTY:OBTAIN_BUILDER_QUOTE",
      },
      {
        gateKey: "TITLE",
        type: "REVIEW_GATE",
        title: "Review title gate",
        reason: "Title requires follow-up review.",
        severity: "BLOCKER",
        source: "system_default",
        idempotencyKey: "investor-shield:deal-ui-1:TITLE:REVIEW_GATE",
      },
    ],
    blockingReasons: ["BLOCKER_GATE_FAILED", "MANUAL_OVERRIDE_REQUIRED"],
    deterministicDominanceNote:
      "Investor Shield may add caution or blocking, but it cannot soften deterministic rejection.",
    evaluatedAt: "2026-06-06T00:00:00.000Z",
  }
}

describe("investor shield ui adapter", () => {
  it("builds a UI model for all default gates", () => {
    const model = buildInvestorShieldUiModel({
      dealId: "deal-ui-1",
      checks: makeChecks(),
      evidenceItems: makeEvidenceItems(),
      enforcementResult: makeEnforcementResult(),
      manualOverrides: [
        {
          dealId: "deal-ui-1",
          gateKey: "SOLICITOR_FEEDBACK",
          reason: "Solicitor issue logged and reviewed before progression.",
        },
      ],
    })

    expect(model.gateSummaries).toHaveLength(INVESTOR_SHIELD_DEFAULT_GATES.length)
    expect(model.gateSummaries.map((gate) => gate.key)).toEqual(
      INVESTOR_SHIELD_DEFAULT_GATES.map((gate) => gate.key)
    )
  })

  it("marks all top-level gates as Required and AI visual review as Advisory", () => {
    const model = buildInvestorShieldUiModel({
      dealId: "deal-ui-1",
      checks: makeChecks(),
      evidenceItems: makeEvidenceItems(),
      enforcementResult: makeEnforcementResult(),
      manualOverrides: [
        {
          dealId: "deal-ui-1",
          gateKey: "SOLICITOR_FEEDBACK",
          reason: "Solicitor issue logged and reviewed before progression.",
        },
      ],
    })

    expect(model.gateSummaries.every((gate) => gate.requiredLabel === "Required")).toBe(true)

    const refurbGate = model.gateSummaries.find((gate) => gate.key === "REFURB_CERTAINTY")
    const aiSubGate = refurbGate?.subGates?.find(
      (subGate) => subGate.key === "AI_VISUAL_REVIEW_ADVISORY"
    )

    expect(aiSubGate?.requiredLabel).toBe("Advisory")
    expect(aiSubGate?.advisoryOnly).toBe(true)
  })

  it("computes evidence counts and missing evidence summaries correctly", () => {
    const model = buildInvestorShieldUiModel({
      dealId: "deal-ui-1",
      checks: makeChecks(),
      evidenceItems: makeEvidenceItems(),
      enforcementResult: makeEnforcementResult(),
      manualOverrides: [
        {
          dealId: "deal-ui-1",
          gateKey: "SOLICITOR_FEEDBACK",
          reason: "Solicitor issue logged and reviewed before progression.",
        },
      ],
    })

    const soldComps = model.gateSummaries.find((gate) => gate.key === "SOLD_COMPS")
    const refurbGate = model.gateSummaries.find((gate) => gate.key === "REFURB_CERTAINTY")
    const builderQuoteSubGate = refurbGate?.subGates?.find(
      (subGate) => subGate.key === "BUILDER_QUOTE_EVIDENCE"
    )

    expect(soldComps?.evidenceCount).toBe(1)
    expect(soldComps?.missingEvidenceSummary).toEqual([])
    expect(refurbGate?.evidenceCount).toBe(4)
    expect(refurbGate?.missingEvidenceSummary).toEqual([
      "ROOM_MEASUREMENT",
      "SPECIALIST_SURVEY",
    ])
    expect(builderQuoteSubGate?.evidenceCount).toBe(1)
    expect(builderQuoteSubGate?.missingEvidenceSummary).toEqual([
      "BUILDER_PROPOSAL",
      "BUILDER_CONTRACT",
    ])
  })

  it("preserves blocking, caution, missing evidence, advisory warnings, and task recommendations", () => {
    const model = buildInvestorShieldUiModel({
      dealId: "deal-ui-1",
      checks: makeChecks(),
      evidenceItems: makeEvidenceItems(),
      enforcementResult: makeEnforcementResult(),
      manualOverrides: [
        {
          dealId: "deal-ui-1",
          gateKey: "SOLICITOR_FEEDBACK",
          reason: "Solicitor issue logged and reviewed before progression.",
        },
      ],
    })

    expect(model.blockingGateKeys).toEqual(["TITLE"])
    expect(model.cautionGateKeys).toEqual(["REFURB_CERTAINTY", "RENTAL_DEMAND"])
    expect(model.missingEvidenceGateKeys).toEqual(["REFURB_CERTAINTY", "RENTAL_DEMAND"])
    expect(model.advisoryWarnings).toEqual([
      "REFURB_CERTAINTY: advisory-only evidence can support review but cannot satisfy hard evidence alone.",
    ])
    expect(model.taskRecommendations).toEqual([
      {
        title: "Obtain builder quote",
        reason: "Refurb certainty needs stronger builder evidence.",
        gateKey: "REFURB_CERTAINTY",
        subGateKey: "BUILDER_QUOTE_EVIDENCE",
        severity: "BLOCKER",
        priority: "HIGH",
        source: "system_default",
      },
      {
        title: "Review title gate",
        reason: "Title requires follow-up review.",
        gateKey: "TITLE",
        subGateKey: undefined,
        severity: "BLOCKER",
        priority: "HIGH",
        source: "system_default",
      },
    ])
    expect(model.manualOverrideRequired).toBe(true)
    expect(
      model.gateSummaries.find((gate) => gate.key === "SOLICITOR_FEEDBACK")?.waiverReason
    ).toBe("Solicitor issue logged and reviewed before progression.")
    expect(model.protectedMovementExplanation).toBe(
      "Investor Shield may add caution or blocking, but it cannot soften deterministic rejection."
    )
  })

  it("does not crash on unknown gate-shaped input and does not mutate inputs", () => {
    const enforcementResult = makeEnforcementResult()
    const checks = [
      ...makeChecks(),
      {
        dealId: "deal-ui-1",
        gateKey: "UNKNOWN_GATE" as never,
        status: "REQUIRED",
        severity: "CAUTION",
        confidence: "UNKNOWN",
        requiredEvidence: [],
      },
    ] satisfies readonly InvestorShieldCheck[]
    const evidenceItems = [
      ...makeEvidenceItems(),
      {
        dealId: "deal-ui-1",
        gateKey: "UNKNOWN_GATE" as never,
        evidenceType: "OTHER",
        source: "document",
        confidence: "LOW",
        label: "Unknown gate evidence",
      },
    ] satisfies readonly EvidenceItem[]
    const before = JSON.parse(
      JSON.stringify({
        checks,
        evidenceItems,
        enforcementResult,
      })
    )

    const model = buildInvestorShieldUiModel({
      dealId: "deal-ui-1",
      checks,
      evidenceItems,
      enforcementResult,
      manualOverrides: [
        {
          dealId: "deal-ui-1",
          gateKey: "SOLICITOR_FEEDBACK",
          reason: "Solicitor issue logged and reviewed before progression.",
        },
      ],
    })

    expect(model.gateSummaries).toHaveLength(INVESTOR_SHIELD_DEFAULT_GATES.length)
    expect({
      checks,
      evidenceItems,
      enforcementResult,
    }).toEqual(before)
  })

  it("returns identical output for repeated identical input", () => {
    const input = {
      dealId: "deal-ui-1",
      checks: makeChecks(),
      evidenceItems: makeEvidenceItems(),
      enforcementResult: makeEnforcementResult(),
    }

    expect(buildInvestorShieldUiModel(input)).toEqual(
      buildInvestorShieldUiModel(input)
    )
  })
})
