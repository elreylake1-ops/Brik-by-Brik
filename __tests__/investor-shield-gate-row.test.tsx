import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import InvestorShieldGateRow from "@/components/InvestorShieldGateRow"
import {
  blockedRequiredGateFixture,
  manualReviewFixture,
  waiverVisibilityFixture,
} from "./fixtures/investor-shield-ui-fixtures"
import type { InvestorShieldGateDisplay } from "@/types/investor-shield-ui"

describe("InvestorShieldGateRow", () => {
  it("renders blocked required gate details with missing evidence and task references", () => {
    const gate = blockedRequiredGateFixture.gates[0] as InvestorShieldGateDisplay
    const html = renderToStaticMarkup(<InvestorShieldGateRow gate={gate} />)

    expect(html).toContain("Sold Comparables")
    expect(html).toContain("Required Gate")
    expect(html).toContain("Status: Blocked")
    expect(html).toContain("Evidence: Not provided")
    expect(html).toContain('Blocking state: <span class="font-semibold text-red-700">Blocking</span>')
    expect(html).toContain('Manual review: <span class="font-semibold text-amber-700">Required</span>')
    expect(html).toContain("Task recommendations: 1 (task-block-sold-comps)")
    expect(html).toContain("Missing evidence warnings")
    expect(html).toContain("Sold comparable evidence is required before progression.")
    expect(html).toContain("Required gate remains blocked.")
  })

  it("renders waiver reason distinctly from satisfied evidence", () => {
    const gate = waiverVisibilityFixture.gates[0] as InvestorShieldGateDisplay
    const html = renderToStaticMarkup(<InvestorShieldGateRow gate={gate} />)

    expect(html).toContain("Solicitor Review")
    expect(html).toContain("Waiver active")
    expect(html).toContain("Solicitor Review accepted under controlled waiver.")
    expect(html).toContain("distinct from satisfied evidence")
    expect(html).toContain('Manual review: <span class="font-semibold text-amber-700">Required</span>')
  })

  it("renders manual review indicators without implying approval", () => {
    const gate = manualReviewFixture.gates[0] as InvestorShieldGateDisplay
    const html = renderToStaticMarkup(<InvestorShieldGateRow gate={gate} />)

    expect(html).toContain("Manual review required")
    expect(html).toContain("Evidence: Weak")
    expect(html).toContain('Manual review: <span class="font-semibold text-amber-700">Required</span>')
    expect(html).not.toContain("Approval")
    expect(html).not.toContain("Approve")
  })
})
