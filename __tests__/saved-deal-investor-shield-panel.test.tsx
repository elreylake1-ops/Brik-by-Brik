import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import SavedDealInvestorShieldPanel from "@/components/SavedDealInvestorShieldPanel"
import type { InvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"

function makeInvestorShieldModel(overrides: Partial<InvestorShieldUiModel> = {}): InvestorShieldUiModel {
  return {
    overallStatus: "BLOCKED",
    progressionDecision: "BLOCKED",
    canProgress: false,
    blockingGateKeys: ["SOLD_COMPS"],
    cautionGateKeys: [],
    missingEvidenceGateKeys: ["SOLD_COMPS"],
    advisoryWarnings: ["AI visual review is advisory only."],
    manualOverrideRequired: true,
    taskRecommendations: [
      {
        gateKey: "SOLD_COMPS",
        title: "Request sold comparables",
        reason: "Collect sold comparables before moving forward.",
        severity: "BLOCKER",
        source: "system_default",
        idempotencyKey: "task-block-sold-comps",
      },
    ],
    gateSummaries: [
      {
        key: "SOLD_COMPS",
        label: "Sold Comparables",
        description: "Required sold comparables.",
        requiredLabel: "Required",
        status: "FAILED",
        severity: "BLOCKER",
        confidence: "LOW",
        evidenceCount: 0,
        missingEvidenceSummary: ["Sold comparables are missing."],
        shortExplanation: "Required evidence is missing.",
        recommendedNextAction: "Request sold comparables",
        advisoryOnly: false,
        updatedAt: "2026-06-09T00:00:00.000Z",
      },
      {
        key: "RENTAL_DEMAND",
        label: "Rental Demand Advisory",
        description: "Advisory market signal only.",
        requiredLabel: "Advisory",
        status: "NOT_STARTED",
        severity: "INFO",
        confidence: "UNKNOWN",
        evidenceCount: 0,
        missingEvidenceSummary: [],
        shortExplanation: "Advisory only.",
        advisoryOnly: true,
        updatedAt: "2026-06-09T00:00:00.000Z",
      },
    ],
    ...overrides,
  }
}

describe("SavedDealInvestorShieldPanel", () => {
  it("binds the read-only model and renders the static panel", () => {
    const html = renderToStaticMarkup(
      <SavedDealInvestorShieldPanel
        deal={{
          id: "deal-1",
          pipeline_state: "UNDER_ANALYSIS",
          classification: "Marginal",
          governance_state: "LOCKED",
          capital_protection_state: "PROTECTED",
        }}
        investorShieldModel={makeInvestorShieldModel()}
      />
    )

    expect(html).toContain("Read-only saved deal binding")
    expect(html).toContain("Status: BLOCKED")
    expect(html).toContain("Blocked or incomplete")
    expect(html).toContain("Deterministic Governance")
    expect(html).toContain("Required Gates")
    expect(html).toContain("Advisory Signals")
    expect(html).toContain("Protected Movement")
    expect(html).toContain("Protected movement blocked.")
    expect(html).toContain("Pipeline state was not changed.")
    expect(html).toContain("Recommended action")
    expect(html).toContain("Linked due diligence gate: SOLD_COMPS")
    expect(html).toContain("Sold Comparables")
    expect(html).toContain("AI visual review is advisory only.")
    expect(html).toContain("No waived gates recorded.")
  })

  it("renders a safe blocked fallback when the investor shield model is missing", () => {
    const html = renderToStaticMarkup(
      <SavedDealInvestorShieldPanel
        deal={{
          id: "deal-1",
          pipeline_state: "UNDER_ANALYSIS",
          classification: "Marginal",
          governance_state: "LOCKED",
          capital_protection_state: "PROTECTED",
        }}
        investorShieldModel={null}
      />
    )

    expect(html).toContain("Status: BLOCKED")
    expect(html).toContain("Blocked or incomplete")
    expect(html).toContain("Deterministic Governance")
    expect(html).toContain("Protected Movement")
    expect(html).toContain("No required gates to display.")
    expect(html).toContain("No advisory signals to display.")
    expect(html).toContain("No task recommendations.")
    expect(html).toContain("No waived gates recorded.")
    expect(html).not.toContain("Approve")
    expect(html).not.toContain("Create Task")
    expect(html).not.toContain("Move Pipeline")
  })

  it("renders a safe prompt when no saved deal is selected", () => {
    const html = renderToStaticMarkup(
      <SavedDealInvestorShieldPanel deal={null} investorShieldModel={null} />
    )

    expect(html).toContain("Select a saved deal to view read-only Investor Shield status.")
    expect(html).not.toContain("Deterministic Governance")
  })
})
