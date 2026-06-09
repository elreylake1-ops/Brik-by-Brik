import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import InvestorShieldAdvisorySignal from "@/components/InvestorShieldAdvisorySignal"
import InvestorShieldAdvisoryList from "@/components/InvestorShieldAdvisoryList"
import { advisoryOnlyFixture } from "./fixtures/investor-shield-ui-fixtures"
import type { AdvisorySignalDisplay } from "@/types/investor-shield-ui"

describe("InvestorShieldAdvisorySignal", () => {
  it("renders advisory-only guidance without hard-gate styling", () => {
    const signal = advisoryOnlyFixture.advisorySignals[0] as AdvisorySignalDisplay
    const html = renderToStaticMarkup(<InvestorShieldAdvisorySignal signal={signal} />)

    expect(html).toContain("AI Visual Review")
    expect(html).toContain("Advisory only")
    expect(html).toContain("Source: ai_advisory")
    expect(html).toContain("Confidence: medium")
    expect(html).toContain("Cannot satisfy hard gates")
    expect(html).toContain("Advisory only; cannot satisfy the hard gate.")
    expect(html).not.toContain("Required Gate")
    expect(html).not.toContain("Evidence:")
    expect(html).not.toContain("Approve")
    expect(html).not.toContain("Waive")
  })
})

describe("InvestorShieldAdvisoryList", () => {
  it("renders advisory signals in a secondary read-only list", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldAdvisoryList signals={advisoryOnlyFixture.advisorySignals} />
    )

    expect(html).toContain("AI Visual Review")
    expect(html).toContain("Advisory only")
    expect(html).toContain("Cannot satisfy hard gates")
    expect(html).not.toContain("Required Gate")
  })
})
