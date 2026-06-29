import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import InvestorReviewDocument from "@/components/investor-review/InvestorReviewDocument"
import { mapPdfEvidencePackToInvestorReview } from "@/lib/investor-review/map-pdf-evidence-pack-to-investor-review"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import {
  PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
  PDF_EVIDENCE_PACK_EMPTY_FIXTURE,
} from "./fixtures/pdf-evidence-pack-fixtures"

function makeSavedDealRecord(overrides: Partial<SavedDealRecord> = {}): SavedDealRecord {
  return {
    id: "saved-deal-review-001",
    created_at: "2026-06-20T09:00:00.000Z",
    updated_at: "2026-06-20T09:05:00.000Z",
    archived_at: null,
    address: "22 Canonical Street, Leeds",
    listing_url: null,
    purchase_price: 125000,
    gdv_realistic: 200000,
    refurb_cost: 25000,
    classification: "STRONG_DEAL",
    governance_state: "MANUAL_REVIEW_REQUIRED",
    capital_protection_state: "PROTECTED",
    pipeline_state: "UNDER_ANALYSIS",
    engine_result_json: {},
    risk_summary_json: {},
    next_action: "Review lender criteria and solicitor evidence",
    ...overrides,
  }
}

function renderDocument() {
  const viewModel = mapPdfEvidencePackToInvestorReview({
    pack: {
      ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
      investorShield: {
        ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorShield,
        cautionGateKeys: ["RENTAL_DEMAND"],
        advisoryOnlyEvidenceWarnings: ["AI advisory evidence cannot satisfy hard gates."],
      },
    },
    savedDeal: makeSavedDealRecord({ id: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId }),
  })

  return renderToStaticMarkup(<InvestorReviewDocument viewModel={viewModel} />)
}

describe("InvestorReviewDocument", () => {
  it("renders the locked report structure and key canonical values", () => {
    const html = renderDocument()

    expect(html).toContain("Brik by Brik Investor Review")
    expect(html).toContain("INTERNAL USE ONLY")
    expect(html).toContain("12 Lake View Road, Leeds")
    expect(html).toContain("MARGINAL")
    expect(html).toContain("MANUAL_REVIEW_REQUIRED")
    expect(html).toContain("CAUTION")
    expect(html).toContain("UNDER_ANALYSIS")
    expect(html).toContain("£113,800.00")
    expect(html).toContain("BLOCKED")
    expect(html).toContain("Review title and refurb evidence")
  })

  it("renders the locked semantic section order", () => {
    const html = renderDocument()

    const expectedOrder = [
      "Property and deal overview",
      "Investment summary",
      "Decision and capital-protection status",
      "Required hard gates",
      "Advisory and caution gates",
      "Evidence Lite notes",
      "Missing evidence and blockers",
      "Tasks and offers",
      "Recommended next action",
      "Footer",
    ]

    let previousIndex = -1
    for (const heading of expectedOrder) {
      const currentIndex = html.indexOf(heading)
      expect(currentIndex).toBeGreaterThan(previousIndex)
      previousIndex = currentIndex
    }
  })

  it("keeps required and advisory sections separate and preserves non-success blocked and missing semantics", () => {
    const html = renderDocument()

    expect(html.indexOf("Required hard gates")).toBeLessThan(html.indexOf("Advisory and caution gates"))
    expect(html).toContain("Title Review")
    expect(html).toContain("Rental Demand")
    expect(html).toContain("AI advisory evidence cannot satisfy hard gates.")
    expect(html).toContain("MISSING")
    expect(html).toContain("Not reviewed")
    expect(html).not.toContain("MISSING</span></div></div><dl")
    expect(html).toContain("border-amber-200 bg-amber-50 text-amber-900")
  })

  it("always renders the Evidence Lite separation notice and omits missing reviewer notes", () => {
    const html = renderDocument()

    expect(html).toContain(
      "Evidence Lite is informational and does not by itself satisfy, waive, approve, or override Investor Shield requirements."
    )
    expect(html).not.toContain("Reviewer note:")
  })

  it("renders locked empty states and no mutation or PDF controls", () => {
    const viewModel = mapPdfEvidencePackToInvestorReview({
      pack: PDF_EVIDENCE_PACK_EMPTY_FIXTURE,
      savedDeal: makeSavedDealRecord({ id: PDF_EVIDENCE_PACK_EMPTY_FIXTURE.meta.savedDealId }),
    })

    const html = renderToStaticMarkup(<InvestorReviewDocument viewModel={viewModel} />)

    expect(html).toContain("No Evidence Lite records are currently attached to this deal.")
    expect(html).toContain("No active tasks are currently recorded for this deal.")
    expect(html).toContain("No offers are currently recorded for this deal.")
    expect(html).not.toContain("<button")
    expect(html).not.toContain("Download")
    expect(html).not.toContain("Print")
    expect(html).not.toContain("Approve")
    expect(html).not.toContain("Delete")
  })

  it("uses safe wrapping classes for long ids and notes and requires no client-only behavior", () => {
    const html = renderDocument()

    expect(html).toContain("break-all")
    expect(html).toContain("break-words")
    expect(html).not.toContain("use client")
  })
})
