import { describe, expect, it } from "vitest"
import {
  CALCULATION_CONFIDENCE_HELP,
  CALCULATION_CONFIDENCE_LABEL,
  getDealDecisionDisplay,
  getTechnicalVerdictDetail,
} from "@/lib/display/deal-decision-display"

describe("client-facing deal decision display guard", () => {
  it("clean strong deal with no warnings stays go proceed", () => {
    const display = getDealDecisionDisplay({
      profit: 40000,
      profitMargin: 20,
      engineVerdictStatus: "GO",
      engineVerdictReason: "Projected profit is positive and purchase is within 20% target MAO.",
      capitalProtectionStatus: "SAFE",
      warnings: [],
    })

    expect(display.statusLabel).toBe("GO")
    expect(display.actionLabel).toBe("Proceed")
    expect(display.warning).toBeUndefined()
  })

  it("clean strong deal with missing task template warning becomes conditional verify scope", () => {
    const display = getDealDecisionDisplay({
      profit: 40000,
      profitMargin: 20,
      engineVerdictStatus: "GO",
      engineVerdictReason: "Projected profit is positive and purchase is within 20% target MAO.",
      capitalProtectionStatus: "SAFE",
      warnings: [
        'Scope "refresh" for "kitchen" has no task templates in Phase 1A. Cost not included. Add templates to task-cost-library.ts.',
      ],
    })

    expect(display.statusLabel).toBe("CONDITIONAL")
    expect(display.actionLabel).toBe("Verify Scope")
    expect(display.warning).toBe(
      "Selected refurb scope has no cost template, so refurb cost may be understated. Validate scope and cost before offer."
    )
  })

  it("positive 1.38% margin uses thin-margin warning", () => {
    const display = getDealDecisionDisplay({
      profit: 2760,
      profitMargin: 1.38,
      engineVerdictStatus: "NO-GO",
      engineVerdictReason: "Purchase exceeds MAO target even though projected profit remains positive.",
      capitalProtectionStatus: "NO_DEAL",
      warnings: [
        'Scope "refresh" for "kitchen" has no task templates in Phase 1A. Cost not included. Add templates to task-cost-library.ts.',
      ],
    })

    expect(display.statusLabel).toBe("MARGINAL")
    expect(display.actionLabel).toBe("Renegotiate")
    expect(display.summary).toContain("Thin profit buffer")
    expect(display.warning).toBe(
      "Profit margin is below 5%. Renegotiate purchase price or verify GDV/refurb assumptions before proceeding."
    )
    expect(display.additionalWarnings).toContain(
      "Selected refurb scope has no cost template, so refurb cost may be understated. Validate scope and cost before offer."
    )
  })

  it("ratio-style 1.41% margin still returns marginal renegotiate messaging", () => {
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

  it("negative profit uses the negative-profit warning, not the thin-margin warning", () => {
    const display = getDealDecisionDisplay({
      profit: -5000,
      profitMargin: -2,
      engineVerdictStatus: "NO-GO",
      engineVerdictReason: "Purchase exceeds MAO bands and/or projected profit is non-positive.",
      capitalProtectionStatus: "NO_DEAL",
      warnings: [
        'Scope "partial" for "bathroom" has no task templates in Phase 1A. Cost not included. Add templates to task-cost-library.ts.',
      ],
    })

    expect(display.statusLabel).toBe("NO-GO")
    expect(display.actionLabel).toBe("Reject")
    expect(display.warning).toBe(
      "Projected profit is negative. Reject this deal unless purchase price, GDV, or refurb assumptions materially change."
    )
    expect(display.warning).not.toContain("below 5%")
    expect(display.additionalWarnings).toContain(
      "Selected refurb scope has no cost template, so refurb cost may be understated. Validate scope and cost before offer."
    )
  })

  it("9.08% margin uses caution messaging", () => {
    const display = getDealDecisionDisplay({
      profit: 18160,
      profitMargin: 9.08,
      engineVerdictStatus: "CONDITIONAL",
      engineVerdictReason: "Margin is positive but not yet strong enough for a clean proceed decision.",
      capitalProtectionStatus: "SAFE",
    })

    expect(display.statusLabel).toBe("CAUTION")
    expect(display.actionLabel).toBe("Needs Stronger Buffer")
    expect(display.warning).toBeUndefined()
  })

  it("19% margin with high capital exposure stays conditional with capital warning", () => {
    const display = getDealDecisionDisplay({
      profit: 38000,
      profitMargin: 19,
      engineVerdictStatus: "GO",
      engineVerdictReason: "Profit is attractive but funding exposure remains elevated.",
      capitalProtectionStatus: "HIGH_RISK",
    })

    expect(display.statusLabel).toBe("CONDITIONAL")
    expect(display.actionLabel).toBe("Proceed With Caution")
    expect(display.warning).toBe(
      "Projected profit is positive, but capital exposure is above the preferred safe threshold. Proceed only with verified GDV, refurb, and exit assumptions."
    )
  })

  it("strong margin with safe capital does not show warning", () => {
    const display = getDealDecisionDisplay({
      profit: 40000,
      profitMargin: 20,
      engineVerdictStatus: "GO",
      engineVerdictReason: "Projected profit is positive and purchase is within 20% target MAO.",
      capitalProtectionStatus: "SAFE",
    })

    expect(display.statusLabel).toBe("GO")
    expect(display.warning).toBeUndefined()
  })

  it("heavy refurb exposure warning text is available", () => {
    const display = getDealDecisionDisplay({
      profit: 22000,
      profitMargin: 11,
      engineVerdictStatus: "CONDITIONAL",
      engineVerdictReason: "Scope is larger than a light-touch refurb.",
      capitalProtectionStatus: "SAFE",
      riskFlags: ["High refurb exposure"],
    })

    expect(display.additionalWarnings).toContain(
      "Refurb cost is high relative to GDV. Validate builder quote, scope, and contingency before offer."
    )
  })

  it("confidence label copy no longer implies deal quality", () => {
    expect(CALCULATION_CONFIDENCE_LABEL).toBe("Calculation Confidence")
    expect(CALCULATION_CONFIDENCE_HELP).toContain("not a deal-quality recommendation")
  })

  it("keeps the original engine verdict available as secondary technical detail", () => {
    expect(
      getTechnicalVerdictDetail(
        "NO-GO",
        "Purchase exceeds MAO target even though projected profit remains positive."
      )
    ).toBe(
      "Engine verdict: NO-GO. Purchase exceeds MAO target even though projected profit remains positive."
    )
  })
})
