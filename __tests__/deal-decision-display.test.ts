import { describe, expect, it } from "vitest"
import {
  CALCULATION_CONFIDENCE_HELP,
  CALCULATION_CONFIDENCE_LABEL,
  getDealDecisionDisplay,
} from "@/lib/display/deal-decision-display"

describe("client-facing deal decision display guard", () => {
  it("profit margin 1.41% returns marginal renegotiate messaging", () => {
    const display = getDealDecisionDisplay({
      profit: 2825,
      profitMargin: 0.0141,
      engineVerdictStatus: "CONDITIONAL",
      engineVerdictReason: "Projected profit is positive and purchase is within 15% MAO, but outside 20% target band.",
      capitalProtectionStatus: "HIGH_RISK",
    })

    expect(display.statusLabel).toBe("MARGINAL")
    expect(display.actionLabel).toBe("Renegotiate")
    expect(display.summary).toContain("Thin profit buffer")
    expect(display.warning).toBe(
      "Profit margin is below 5%. Renegotiate purchase price or verify GDV/refurb assumptions before proceeding."
    )
  })

  it("negative profit returns no-go reject messaging", () => {
    const display = getDealDecisionDisplay({
      profit: -5000,
      profitMargin: -0.02,
      engineVerdictStatus: "NO-GO",
      engineVerdictReason: "Purchase exceeds MAO bands and/or projected profit is non-positive.",
      capitalProtectionStatus: "NO_DEAL",
    })

    expect(display.statusLabel).toBe("NO-GO")
    expect(display.actionLabel).toBe("Reject")
  })

  it("healthy 20% margin does not show thin-margin warning", () => {
    const display = getDealDecisionDisplay({
      profit: 40000,
      profitMargin: 0.2,
      engineVerdictStatus: "GO",
      engineVerdictReason: "Projected profit is positive and purchase is within 20% target MAO.",
      capitalProtectionStatus: "SAFE",
    })

    expect(display.statusLabel).toBe("GO")
    expect(display.warning).toBeUndefined()
  })

  it("confidence label copy no longer implies deal quality", () => {
    expect(CALCULATION_CONFIDENCE_LABEL).toBe("Calculation Confidence")
    expect(CALCULATION_CONFIDENCE_HELP).toContain("not a deal-quality recommendation")
  })
})
