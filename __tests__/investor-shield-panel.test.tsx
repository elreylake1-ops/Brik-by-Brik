import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import InvestorShieldPanel from "@/components/InvestorShieldPanel"
import {
  advisoryOnlyFixture,
  blockedRequiredGateFixture,
  waiverVisibilityFixture,
} from "./fixtures/investor-shield-ui-fixtures"
import type { InvestorShieldUiViewModel } from "@/types/investor-shield-ui"

describe("InvestorShieldPanel", () => {
  it("renders required gate rows and hides mutation controls", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldPanel model={blockedRequiredGateFixture} />
    )

    expect(html).toContain("Investor Shield / Due Diligence Lock")
    expect(html).toContain("Deterministic Governance")
    expect(html).toContain("Required Gates")
    expect(html).toContain("Advisory Signals")
    expect(html).toContain("Advisory only")
    expect(html).toContain("Protected Movement")
    expect(html).toContain("Task Recommendations")
    expect(html).toContain("Manual Review / Waiver")
    expect(html).toContain("Pipeline Mutation Prevented")
    expect(html).toContain("Sold Comparables")
    expect(html).toContain("Required Gate")
    expect(html).toContain('Blocking state: <span class="font-semibold text-red-700">Blocking</span>')
    expect(html).toContain("Missing evidence warnings")
    expect(html).not.toContain("Approve")
    expect(html).not.toContain("Waive gate")
    expect(html).not.toContain("Upload Evidence")
    expect(html).not.toContain("Move Pipeline")
    expect(html).not.toContain("Create Task")
  })

  it("renders waiver detail without softening the gate state", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldPanel model={waiverVisibilityFixture} />
    )

    expect(html).toContain("Solicitor Review")
    expect(html).toContain("Waiver active")
    expect(html).toContain("Solicitor review accepted under controlled waiver.")
    expect(html).toContain("distinct from satisfied evidence")
    expect(html).toContain('Manual review: <span class="font-semibold text-amber-700">Required</span>')
  })

  it("keeps advisory signals separate from required gate rows", () => {
    const advisoryGateModel: InvestorShieldUiViewModel = {
      ...advisoryOnlyFixture,
      gates: [
        ...advisoryOnlyFixture.gates,
        {
          gateKey: "RENTAL_DEMAND",
          label: "Rental Demand Advisory",
          gateType: "advisory",
          status: "advisory_only",
          evidenceStatus: "advisory_only",
          isBlocking: false,
          missingEvidenceWarnings: [],
          taskRecommendationIds: [],
          waiver: { isWaived: false },
          manualReviewRequired: false,
          displayPriority: 9,
          helperText: "Advisory content cannot satisfy hard evidence.",
        },
      ],
    }

    const html = renderToStaticMarkup(<InvestorShieldPanel model={advisoryGateModel} />)

    expect(html).toContain("Advisory Signals")
    expect(html).toContain("AI Visual Review")
    expect(html).not.toContain("Rental Demand Advisory")
  })
})
