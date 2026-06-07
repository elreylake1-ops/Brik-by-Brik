import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import InvestorShieldGateSummaryPanel from "@/components/InvestorShieldGateSummaryPanel"
import type { InvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"

function makeModel(overrides: Partial<InvestorShieldUiModel> = {}): InvestorShieldUiModel {
  return {
    dealId: "deal-panel-1",
    overallStatus: "CAUTION",
    progressionDecision: "NEEDS_REVIEW",
    canProgress: false,
    blockingGateKeys: ["TITLE"],
    cautionGateKeys: ["REFURB_CERTAINTY", "RENTAL_DEMAND"],
    missingEvidenceGateKeys: ["REFURB_CERTAINTY"],
    advisoryWarnings: ["AI visual review is advisory-only."],
    manualOverrideRequired: false,
    taskRecommendations: [],
    protectedMovementExplanation: undefined,
    gateSummaries: [
      {
        key: "TITLE",
        label: "Title Review",
        description: "Requires title review.",
        requiredLabel: "Required",
        status: "FAILED",
        severity: "BLOCKER",
        confidence: "LOW",
        evidenceCount: 1,
        missingEvidenceSummary: ["TITLE_DOCUMENT"],
        shortExplanation: "Title review found an unresolved issue.",
        recommendedNextAction: "Review title gate",
        advisoryOnly: false,
      },
      {
        key: "REFURB_CERTAINTY",
        label: "Refurb Certainty",
        description: "Requires hard refurbishment evidence.",
        requiredLabel: "Advisory",
        status: "WEAK",
        severity: "CAUTION",
        confidence: "MEDIUM",
        evidenceCount: 2,
        missingEvidenceSummary: ["ROOM_MEASUREMENT"],
        shortExplanation: "Current evidence is weak.",
        recommendedNextAction: "Obtain builder quote",
        advisoryOnly: true,
        subGates: [
          {
            key: "AI_VISUAL_REVIEW_ADVISORY",
            label: "AI Visual Review Advisory",
            description: "Advisory AI review only.",
            requiredLabel: "Advisory",
            status: "SATISFIED",
            severity: "CAUTION",
            confidence: "LOW",
            evidenceCount: 1,
            missingEvidenceSummary: [],
            shortExplanation: "AI visual review is advisory only.",
            recommendedNextAction: "Use as supporting review only",
            advisoryOnly: true,
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe("investor shield gate summary panel", () => {
  it("renders title, overall status, counts, and all provided gate rows", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldGateSummaryPanel model={makeModel()} />
    )

    expect(html).toContain("Investor Shield")
    expect(html).toContain("Overall Status: CAUTION")
    expect(html).toContain("Progression Decision: NEEDS_REVIEW")
    expect(html).toContain("Cannot progress")
    expect(html).toContain("Blocking Gates")
    expect(html).toContain(">1<")
    expect(html).toContain("Caution Gates")
    expect(html).toContain(">2<")
    expect(html).toContain("Missing Evidence Gates")
    expect(html).toContain("Advisory Warnings")
    expect(html).toContain("Title Review")
    expect(html).toContain("Refurb Certainty")
    expect(html).toContain("Review title gate")
    expect(html).toContain("Obtain builder quote")
    expect(html).toContain("Missing evidence: TITLE_DOCUMENT")
    expect(html).toContain("Missing evidence ROOM_MEASUREMENT")
    expect(html).toContain("AI Visual Review Advisory")
    expect(html).toContain("AI visual review is advisory only.")
    expect(html).toContain("Next: Review title gate")
    expect(html).toContain("Next: Obtain builder quote")
  })

  it("renders Required and Advisory labels", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldGateSummaryPanel model={makeModel()} />
    )

    expect(html).toContain("Required")
    expect(html).toContain("Advisory")
  })

  it("does not render upload, edit, waiver, or task creation buttons", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldGateSummaryPanel model={makeModel()} />
    )

    expect(html).not.toContain("<button")
    expect(html).not.toContain("Upload")
    expect(html).not.toContain("Edit")
    expect(html).not.toContain("Waive")
    expect(html).not.toContain("Create Task")
  })

  it("handles an empty gate list safely", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldGateSummaryPanel model={makeModel({ gateSummaries: [] })} />
    )

    expect(html).toContain("No Investor Shield gates available.")
  })

  it("renders compact missing evidence and advisory sub-gate labels", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldGateSummaryPanel model={makeModel()} />
    )

    expect(html).toContain("Missing evidence: TITLE_DOCUMENT")
    expect(html).toContain("AI Visual Review Advisory")
    expect(html).toContain("Advisory")
  })
})
