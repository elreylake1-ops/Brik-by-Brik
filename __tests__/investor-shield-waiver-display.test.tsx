import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import InvestorShieldWaiverDisplay from "@/components/InvestorShieldWaiverDisplay"
import { waiverVisibilityFixture } from "./fixtures/investor-shield-ui-fixtures"
import type { WaiverDisplay } from "@/types/investor-shield-ui"

describe("InvestorShieldWaiverDisplay", () => {
  it("renders waiver status, reason, metadata, and distinct copy", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldWaiverDisplay waiver={waiverVisibilityFixture.waiverSummary} />
    )

    expect(html).toContain("Waived gate")
    expect(html).toContain("Waiver status: Active")
    expect(html).toContain("Waiver reason: Solicitor review accepted under controlled waiver.")
    expect(html).toContain("Waived by: compliance-review")
    expect(html).toContain("Waived at: 2026-06-09T00:00:00.000Z")
    expect(html).toContain("Waiver does not equal satisfied evidence.")
    expect(html).toContain("Review waiver reason before relying on progression.")
    expect(html).not.toContain("Approve")
    expect(html).not.toContain("Create Waiver")
    expect(html).not.toContain("Remove Waiver")
  })

  it("renders a safe empty state when no waiver exists", () => {
    const waiver: WaiverDisplay = { isWaived: false }
    const html = renderToStaticMarkup(<InvestorShieldWaiverDisplay waiver={waiver} />)

    expect(html).toContain("No waived gates recorded.")
    expect(html).not.toContain("Waived gate")
  })
})
