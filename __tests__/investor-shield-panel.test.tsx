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
    expect(html).toContain("Advisory only")
    expect(html).toContain("Cannot satisfy hard gates")
    expect(html).toContain("Protected Movement")
    expect(html).toContain("Protected movement blocked.")
    expect(html).toContain("Pipeline state was not changed.")
    expect(html).toContain("Resolve or validly waive required gates before progressing.")
    expect(html).toContain("Task Recommendations")
    expect(html).toContain("Recommended action")
    expect(html).toContain("Linked due diligence gate: SOLD_COMPS")
    expect(html).toContain("Duplicate-safe task recommendation")
    expect(html).toContain("This recommendation does not satisfy the gate by itself.")
    expect(html).toContain("Manual Review / Waiver")
    expect(html).toContain("No waived gates recorded.")
    expect(html).toContain("Pipeline mutation prevented: Yes")
    expect(html).toContain("Advisory Signals")
    expect(html).toContain("Sold Comparables")
    expect(html).toContain("Required Gate")
    expect(html).toContain('Blocking state: <span class="font-semibold text-red-700">Blocking</span>')
    expect(html).toContain("Missing evidence warnings")
    expect(html).not.toContain("Approve")
    expect(html).not.toContain("Waive gate")
    expect(html).not.toContain("Upload Evidence")
    expect(html).not.toContain("Move Pipeline")
    expect(html).not.toContain("Create Task")
    expect(html).not.toContain("Resolve Task")
  })

  it("renders waiver detail without softening the gate state", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldPanel model={waiverVisibilityFixture} />
    )

    expect(html).toContain("Solicitor Review")
    expect(html).toContain("Waived gate")
    expect(html).toContain("Waiver status: Active")
    expect(html).toContain("Solicitor review accepted under controlled waiver.")
    expect(html).toContain("Waiver does not equal satisfied evidence.")
    expect(html).toContain("Review waiver reason before relying on progression.")
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
    const advisorySectionStart = html.indexOf("Advisory Signals")
    const advisorySection = advisorySectionStart >= 0 ? html.slice(advisorySectionStart) : html

    expect(html).toContain("Advisory Signals")
    expect(html).toContain("AI Visual Review")
    expect(html).not.toContain("Rental Demand Advisory")
    expect(advisorySection).not.toContain("Required Gate")
  })

  it("renders deterministic governance before advisory signals", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldPanel model={blockedRequiredGateFixture} />
    )

    const deterministicIndex = html.indexOf("Deterministic Governance")
    const requiredGateIndex = html.indexOf("Required Gates")
    const protectedMovementIndex = html.indexOf("Protected Movement")
    const taskIndex = html.indexOf("Task Recommendations")
    const waiverIndex = html.indexOf("Manual Review / Waiver")
    const advisoryIndex = html.indexOf("Advisory Signals")

    expect(deterministicIndex).toBeGreaterThan(-1)
    expect(requiredGateIndex).toBeGreaterThan(deterministicIndex)
    expect(protectedMovementIndex).toBeGreaterThan(requiredGateIndex)
    expect(taskIndex).toBeGreaterThan(protectedMovementIndex)
    expect(waiverIndex).toBeGreaterThan(taskIndex)
    expect(advisoryIndex).toBeGreaterThan(waiverIndex)
  })

  it("renders protected movement before task recommendations", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldPanel model={blockedRequiredGateFixture} />
    )

    expect(html).toContain("Protected Movement")
    expect(html).toContain("Protected movement blocked.")
    expect(html).toContain("Pipeline state was not changed.")
    expect(html).toContain("Resolve or validly waive required gates before progressing.")
    expect(html).toContain("Recommended action")
    expect(html.indexOf("Protected Movement")).toBeLessThan(
      html.indexOf("Task Recommendations")
    )
  })
})
