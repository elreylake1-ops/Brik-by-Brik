import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import EngineAnalysisPanel from "@/components/EngineAnalysisPanel"
import type { DealInputs } from "@/types/deal"
import type { DealWithRefurbResult } from "@/lib/engine/analyze-deal-with-refurb"
import { calculateDueDiligence } from "@/lib/engine/due-diligence-engine"

function makeInputs(overrides: Partial<DealInputs> = {}): DealInputs {
  return {
    purchasePrice: 170000,
    gdv: 200000,
    refurbCost: 10000,
    stampDuty: 5000,
    legalCosts: 2000,
    saleCosts: 3000,
    bridgeTermMonths: 6,
    ...overrides,
  }
}

function makeResult(overrides: Partial<DealWithRefurbResult> = {}): DealWithRefurbResult {
  const inputs = makeInputs()
  const dueDiligence = calculateDueDiligence({
    purchasePrice: inputs.purchasePrice,
    gdvRealistic: inputs.gdv,
    refurbCost: inputs.refurbCost,
    stampDuty: inputs.stampDuty,
    legalCosts: inputs.legalCosts,
    saleCosts: inputs.saleCosts,
    bridgeTermMonths: inputs.bridgeTermMonths,
    bridgeInterestRateAnnual: 0.15,
    arrangementFeePercent: 0.02,
    exitFeePercent: 0.01,
  })

  return {
    deal: {
      totalCost: 197240,
      financeCost: {
        interest: 12750,
        arrangementFee: 3400,
        exitFee: 1700,
        totalFinanceCost: 17850,
      },
      profit: 2760,
      profitMargin: 1.38,
      trueMao: {
        fifteenPercent: 142150,
        twentyPercent: 132150,
        twentyFivePercent: 122150,
      },
    },
    refurbSource: "manual",
    dueDiligence,
    warnings: [],
    overridesApplied: [],
    assumptionsReport: [],
    verdict: {
      status: "NO-GO",
      reason: "Purchase exceeds MAO target even though projected profit remains positive.",
      checks: [],
    },
    confidence: {
      score: 92,
      band: "HIGH",
      factors: [],
    },
    ...overrides,
  }
}

describe("engine analysis panel display hierarchy", () => {
  it("uses marginal renegotiate as the primary strategy display for thin-margin positive-profit walkthroughs", () => {
    const html = renderToStaticMarkup(
      <EngineAnalysisPanel inputs={makeInputs()} result={makeResult()} />
    )

    expect(html).toContain("Client Safety Decision")
    expect(html).toContain("MARGINAL")
    expect(html).toContain("Renegotiate")
    expect(html).toContain("Decision Summary")
    expect(html).toContain("Marginal — renegotiate before proceeding")
    expect(html).toContain("Engine verdict: NO-GO by MAO target.")
  })

  it("keeps negative-profit walkthroughs as no-go reject in the primary display areas", () => {
    const html = renderToStaticMarkup(
      <EngineAnalysisPanel
        inputs={makeInputs()}
        result={makeResult({
          deal: {
            totalCost: 205000,
            financeCost: {
              interest: 12750,
              arrangementFee: 3400,
              exitFee: 1700,
              totalFinanceCost: 17850,
            },
            profit: -5000,
            profitMargin: -2.5,
            trueMao: {
              fifteenPercent: 142150,
              twentyPercent: 132150,
              twentyFivePercent: 122150,
            },
          },
          verdict: {
            status: "NO-GO",
            reason: "Purchase exceeds MAO bands and/or projected profit is non-positive.",
            checks: [],
          },
        })}
      />
    )

    expect(html).toContain("NO-GO")
    expect(html).toContain("Reject")
    expect(html).toContain("No-go — reject")
  })
})
