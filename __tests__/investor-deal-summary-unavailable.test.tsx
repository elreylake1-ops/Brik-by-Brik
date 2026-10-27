import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import InvestorDealSummaryUnavailable from "@/components/investor-summary/InvestorDealSummaryUnavailable"

describe("InvestorDealSummaryUnavailable", () => {
  it("offers a return link for the current saved deal", () => {
    const html = renderToStaticMarkup(<InvestorDealSummaryUnavailable dealId="deal-123" />)

    expect(html).toContain('href="/saved-deals/deal-123"')
    expect(html).toContain("Back to Saved Deal")
  })
})
