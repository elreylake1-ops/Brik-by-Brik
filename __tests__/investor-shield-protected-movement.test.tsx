import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import InvestorShieldProtectedMovement from "@/components/InvestorShieldProtectedMovement"
import {
  blockedRequiredGateFixture,
  clearedRequiredGatesFixture,
} from "./fixtures/investor-shield-ui-fixtures"

describe("InvestorShieldProtectedMovement", () => {
  it("renders strong blocked copy when movement is prevented", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldProtectedMovement movement={blockedRequiredGateFixture.protectedMovement} />
    )

    expect(html).toContain("Protected movement blocked.")
    expect(html).toContain("Pipeline state was not changed.")
    expect(html).toContain("Resolve or validly waive required gates before progressing.")
    expect(html).toContain("Blocking gate keys: SOLD_COMPS")
    expect(html).toContain("Pipeline mutation prevented: Yes")
    expect(html).not.toContain("Move Pipeline")
    expect(html).not.toContain("Continue Anyway")
  })

  it("renders neutral allowed copy when movement is allowed", () => {
    const html = renderToStaticMarkup(
      <InvestorShieldProtectedMovement movement={clearedRequiredGatesFixture.protectedMovement} />
    )

    expect(html).toContain("Protected movement currently allowed based on available gate status.")
    expect(html).toContain("Movement allowed: Yes")
    expect(html).toContain("Pipeline mutation prevented: No")
    expect(html).toContain("Blocking gate keys: None")
    expect(html).not.toContain("Pipeline state was not changed.")
    expect(html).not.toContain("Move Pipeline")
    expect(html).not.toContain("Approve")
  })
})
