import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import InvestorShieldPanel from "@/components/InvestorShieldPanel"
import { blockedRequiredGateFixture } from "./fixtures/investor-shield-ui-fixtures"

describe("InvestorShieldPanel", () => {
  it("renders a static read-only shell without mutation controls", () => {
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
    expect(html).not.toContain("Approve")
    expect(html).not.toContain("Waive gate")
    expect(html).not.toContain("Upload Evidence")
    expect(html).not.toContain("Move Pipeline")
    expect(html).not.toContain("Create Task")
  })
})
