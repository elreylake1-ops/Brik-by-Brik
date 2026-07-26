import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import InvestorDealSummaryDocument from "@/components/investor-summary/InvestorDealSummaryDocument"
import { mapInvestorReviewToDealSummary } from "@/lib/investor-summary/map-investor-review-to-deal-summary"
import { makeSampleInvestorReviewReadyViewModel } from "./fixtures/investor-deal-summary-fixtures"

function renderDocument() {
  const review = makeSampleInvestorReviewReadyViewModel()
  const viewModel = mapInvestorReviewToDealSummary({
    review,
    generatedAt: "2026-07-26T00:00:00.000Z",
  })

  return renderToStaticMarkup(<InvestorDealSummaryDocument viewModel={viewModel} />)
}

describe("InvestorDealSummaryDocument", () => {
  it("renders header, confidentiality, non-reliance, property identity, executive decision fields, and financial values", () => {
    const html = renderDocument()

    expect(html).toContain("Brik by Brik Investor and Deal Summary")
    expect(html).toContain("INTERNAL INVESTOR DECISION SUPPORT")
    expect(html).toContain(
      "This summary is read-only investor decision support. It is not a valuation, legal advice, lending advice, or a substitute for professional due diligence."
    )
    expect(html).toContain("12 Lake View Road, Leeds")
    expect(html).toContain("GO")
    expect(html).toContain("MARGINAL")
    expect(html).toContain("Manual Review Required")
    expect(html).toContain("CAUTION")
    expect(html).toContain("Under Analysis")
    expect(html).toContain("BLOCKED")
    expect(html).toContain("Ready for review")
    expect(html).toContain("£125,000.00")
    expect(html).toContain("£200,000.00")
    expect(html).toContain("£12,600.00")
    expect(html).toContain("+£33,800.00")
    expect(html).toContain("16.90%")
  })

  it("renders exact section order, all True MAO bands equally, and unsupported values as unavailable", () => {
    const html = renderDocument()
    const expectedOrder = [
      "Executive decision snapshot",
      "Core financial position",
      "True MAO",
      "Offer position",
      "Unsupported values",
      "Investor Shield",
      "Professional readiness",
      "Evidence Lite",
      "Risks, blockers, and missing evidence",
      "Recommended next action",
      "Footer",
    ]

    for (const heading of expectedOrder) {
      expect(html).toContain(heading)
    }

    expect(html.indexOf("Executive decision snapshot")).toBeLessThan(
      html.indexOf("Core financial position")
    )
    expect(html.indexOf("True MAO")).toBeLessThan(html.indexOf("Offer position"))
    expect(html.indexOf("Investor Shield")).toBeLessThan(
      html.indexOf("Professional readiness")
    )
    expect(html).toContain("data-testid=\"summary-true-mao-25-profit-target\"")
    expect(html).toContain("data-testid=\"summary-true-mao-20-profit-target\"")
    expect(html).toContain("data-testid=\"summary-true-mao-15-profit-target\"")
    expect(html).toContain(
      "No single investor-facing True MAO band has been selected in the current canonical model."
    )
    expect(html).not.toContain("Selected True MAO")
    expect(html).toContain("Acquisition-cost aggregate")
    expect(html).toContain("ROI")
    expect(html).toContain("Not available")
    expect(html).toContain("No canonical acquisition-cost aggregate currently exists.")
    expect(html).toContain("ROI is not available from the current canonical engine output.")
  })

  it("renders negative profit with adverse styling, latest offer, shield separation, evidence rows, and footer notices", () => {
    const review = makeSampleInvestorReviewReadyViewModel()
    review.dealFormulation.financialSummary.projectedProfit = {
      amount: -1200,
      availability: "AVAILABLE",
      unavailableReason: null,
    }
    const html = renderToStaticMarkup(
      <InvestorDealSummaryDocument
        viewModel={mapInvestorReviewToDealSummary({
          review,
          generatedAt: "2026-07-26T00:00:00.000Z",
        })}
      />
    )

    expect(html).toContain("data-testid=\"summary-latest-offer-amount\"")
    expect(html).toContain("£118,000.00")
    expect(html).toContain("No canonical monetary offer ladder currently exists.")
    expect(html).toContain("data-testid=\"summary-shield-required-gates\"")
    expect(html).toContain("data-testid=\"summary-shield-advisory-gates\"")
    expect(html).toContain(
      "Investor Shield progression authority remains separate from Deal Formulation financial presentation."
    )
    expect(html).toContain(
      "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements."
    )
    expect(html).toContain(
      "Evidence Lite records are informational and do not constitute professional confirmation."
    )
    expect(html).toContain("data-testid=\"investor-deal-summary-evidence-row-evi-pdf-blocked-001\"")
    expect(html).toContain("Review title and refurb evidence")
    expect(html).toContain(
      "Investor Shield remains authoritative for application progression."
    )
    expect(html).toContain("Missing evidence must not be interpreted as completed verification.")
    expect(html).toContain("Unsupported values remain unavailable and are not estimated.")
    expect(html).toContain("border-red-200 bg-red-50 text-red-900")
    expect(html).toContain("-£1,200.00")
  })

  it("renders no-offer and empty Evidence Lite states, keeps missing optional money unavailable, and shows canonical risks only", () => {
    const review = makeSampleInvestorReviewReadyViewModel()
    review.dealFormulation.offerPosition.latestRecordedOffer = null
    review.dealFormulation.offerPosition.latestOfferStatus = null
    review.dealFormulation.financialSummary.saleCosts = {
      amount: null,
      availability: "UNAVAILABLE",
      unavailableReason: "Sale costs unavailable.",
    }
    review.dealFormulation.financialSummary.projectedProfit = {
      amount: null,
      availability: "UNAVAILABLE",
      unavailableReason: "Projected profit unavailable.",
    }
    review.dealFormulation.financialSummary.profitMargin = null
    review.evidenceLiteRows = []
    review.followUpRequirements = ["Solicitor title evidence remains outstanding."]
    review.blockerRows = [
      {
        gateKey: "TITLE",
        label: "Title review",
        blockerReason: "Solicitor evidence remains outstanding.",
      },
    ]

    const html = renderToStaticMarkup(
      <InvestorDealSummaryDocument
        viewModel={mapInvestorReviewToDealSummary({
          review,
          generatedAt: "2026-07-26T00:00:00.000Z",
        })}
      />
    )

    expect(html).toContain("No offers are currently recorded for this deal.")
    expect(html).toContain("No Evidence Lite records are currently attached to this deal.")
    expect(html).toContain("Sale costs unavailable.")
    expect(html).toContain("Projected profit unavailable.")
    expect(html).not.toContain("Â£0.00")
    expect(html).toContain("Manual review remains required before progression.")
    expect(html).toContain("Solicitor title evidence remains outstanding.")
    expect(html).toContain("Title review: Solicitor evidence remains outstanding.")
  })

  it("renders no mutation, PDF, print, download, or sharing controls and keeps safe wrapping classes", () => {
    const html = renderDocument()

    expect(html).not.toContain("<button")
    expect(html).not.toContain("<form")
    expect(html.toLowerCase()).not.toContain("download")
    expect(html.toLowerCase()).not.toContain("print</")
    expect(html.toLowerCase()).not.toContain("share")
    expect(html).not.toContain("use client")
    expect(html).toContain("break-all")
    expect(html).toContain("break-words")
  })
})
