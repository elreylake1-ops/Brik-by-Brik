import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import DealFormulationSection from "@/components/investor-review/DealFormulationSection"
import type { DealFormulationViewModel } from "@/types/deal-formulation"

function baseViewModel(): DealFormulationViewModel {
  return {
    identity: {
      dealId: "deal-123",
      address: "1 Lake View Road",
    },
    financialSummary: {
      purchasePrice: { amount: 120000, availability: "AVAILABLE", unavailableReason: null },
      gdvRealistic: { amount: 200000, availability: "AVAILABLE", unavailableReason: null },
      gdvDownside: { amount: 180000, availability: "AVAILABLE", unavailableReason: null },
      gdvStrong: { amount: 220000, availability: "AVAILABLE", unavailableReason: null },
      refurbishmentCost: { amount: 18000, availability: "AVAILABLE", unavailableReason: null },
      stampDuty: { amount: 3600, availability: "AVAILABLE", unavailableReason: null },
      legalCosts: { amount: 2000, availability: "AVAILABLE", unavailableReason: null },
      saleCosts: { amount: 3000, availability: "AVAILABLE", unavailableReason: null },
      acquisitionCosts: {
        amount: null,
        availability: "UNAVAILABLE",
        unavailableReason: "No canonical acquisition-cost aggregate exists.",
      },
      financeCost: { amount: 12600, availability: "AVAILABLE", unavailableReason: null },
      totalInvestment: { amount: 166200, availability: "AVAILABLE", unavailableReason: null },
      projectedProfit: { amount: 33800, availability: "AVAILABLE", unavailableReason: null },
      profitMargin: 16.9,
      roi: null,
    },
    trueMao: {
      fifteenPercent: { amount: 123800, availability: "AVAILABLE", unavailableReason: null },
      twentyPercent: { amount: 113800, availability: "AVAILABLE", unavailableReason: null },
      twentyFivePercent: { amount: 103800, availability: "AVAILABLE", unavailableReason: null },
      selectedAmount: null,
      selectedBand: null,
      sourceLabel: "Canonical deterministic True MAO bands",
    },
    offerPosition: {
      latestRecordedOffer: 118000,
      latestOfferStatus: "PENDING",
      openingOffer: null,
      targetOffer: null,
      finalOffer: null,
      walkAwayAmount: null,
      walkAwayThreshold: null,
      unavailableReasons: [
        "No canonical opening-offer source exists.",
        "No canonical target-offer source exists.",
        "No canonical final-offer source exists.",
        "No canonical walk-away amount exists.",
        "No canonical walk-away threshold exists.",
      ],
    },
    decision: {
      verdictStatus: "GO",
      classification: "CONDITIONAL",
      capitalProtectionState: "PROTECTED",
      strategyRecommendation: "FLIP_ONLY_OR_RENEGOTIATE",
      recommendedNextAction: "Review lender criteria and solicitor evidence",
    },
    warnings: {
      canonicalWarnings: [],
      unavailableFields: [
        "ROI is not available from the current canonical engine output.",
        "No canonical opening-offer source exists.",
      ],
    },
  }
}

describe("DealFormulationSection", () => {
  it("renders canonical financials, decision values, unavailable states, and authority copy", () => {
    const html = renderToStaticMarkup(<DealFormulationSection viewModel={baseViewModel()} />)

    expect(html).toContain("Deal Formulation")
    expect(html).toContain("Canonical saved-deal financial position and decision support.")
    expect(html).toContain(
      "Values shown here are read-only canonical outputs. Unsupported values remain unavailable and are not estimated."
    )
    expect(html).toContain("£120,000.00")
    expect(html).toContain("£200,000.00")
    expect(html).toContain("£18,000.00")
    expect(html).toContain("£12,600.00")
    expect(html).toContain("£166,200.00")
    expect(html).toContain("+£33,800.00")
    expect(html).toContain("16.90%")
    expect(html).toContain("25% profit target")
    expect(html).toContain("20% profit target")
    expect(html).toContain("15% profit target")
    expect(html).toContain(
      "No single investor-facing True MAO band has been selected in the current canonical model."
    )
    expect(html).toContain("No canonical acquisition-cost aggregate currently exists.")
    expect(html).toContain("ROI is not available from the current canonical engine output.")
    expect(html).toContain("No canonical monetary offer ladder currently exists.")
    expect(html).toContain("Verdict")
    expect(html).toContain("Persisted classification")
    expect(html).toContain("Capital protection")
    expect(html).toContain("Strategy recommendation")
    expect(html).toContain("Recommended next action")
    expect(html).not.toContain("<button")
    expect(html).not.toContain("<form")
  })

  it("renders no-offer empty state and never converts missing values into zero", () => {
    const base = baseViewModel()
    const html = renderToStaticMarkup(
      <DealFormulationSection
        viewModel={{
          ...base,
          financialSummary: {
            ...base.financialSummary,
            purchasePrice: {
              amount: null,
              availability: "UNAVAILABLE",
              unavailableReason: "Purchase price unavailable.",
            },
            financeCost: {
              amount: null,
              availability: "UNAVAILABLE",
              unavailableReason: "Finance cost unavailable.",
            },
            projectedProfit: {
              amount: null,
              availability: "UNAVAILABLE",
              unavailableReason: "Projected profit unavailable.",
            },
            profitMargin: null,
          },
          offerPosition: {
            ...base.offerPosition,
            latestRecordedOffer: null,
            latestOfferStatus: null,
          },
          decision: {
            ...base.decision,
            classification: null,
          },
        }}
      />
    )

    expect(html).toContain("Not available")
    expect(html).toContain("No offers are currently recorded for this deal.")
    expect(html).not.toContain("£0.00")
    expect(html).not.toContain(">0<")
  })

  it("keeps negative projected profit blocked, no selected True MAO, and mobile-safe wrapping classes", () => {
    const base = baseViewModel()
    const html = renderToStaticMarkup(
      <DealFormulationSection
        viewModel={{
          ...base,
          financialSummary: {
            ...base.financialSummary,
            projectedProfit: {
              amount: -1200,
              availability: "AVAILABLE",
              unavailableReason: null,
            },
          },
          decision: {
            ...base.decision,
            verdictStatus: "NO-GO",
          },
        }}
      />
    )

    expect(html).toContain("data-testid=\"deal-formulation-projected-profit\"")
    expect(html).toContain("data-testid=\"deal-formulation-verdict\"")
    expect(html).toContain("border-red-200 bg-red-50 text-red-900")
    expect(html).toContain("-£1,200.00")
    expect(html).not.toContain("Selected True MAO")
    expect(html).not.toContain("Walk-away offer")
    expect(html).toContain("break-words")
    expect(html).not.toContain("use client")
  })
})
