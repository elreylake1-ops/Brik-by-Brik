import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { DealFormulationViewModel } from "@/types/deal-formulation"
import type { LoadInvestorReviewPageModelResult } from "@/lib/investor-review/load-investor-review-page-model"
import type { InvestorReviewReadyViewModel } from "@/lib/investor-review/investor-review-view-model"
import { mapPdfEvidencePackToInvestorReview } from "@/lib/investor-review/map-pdf-evidence-pack-to-investor-review"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { ProfessionalEvidenceGatewayViewModel } from "@/types/professional-evidence-gateway"
import { PDF_EVIDENCE_PACK_BLOCKED_FIXTURE } from "./fixtures/pdf-evidence-pack-fixtures"

const { loadInvestorReviewPageModelMock, notFoundMock } = vi.hoisted(() => ({
  loadInvestorReviewPageModelMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

vi.mock("@/lib/investor-review/load-investor-review-page-model", () => ({
  loadInvestorReviewPageModel: loadInvestorReviewPageModelMock,
}))

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}))

import InvestorReviewPage from "../app/saved-deals/[id]/review/page"
import InvestorReviewLoading from "../app/saved-deals/[id]/review/loading"
import InvestorReviewNotFoundDocument from "../app/saved-deals/[id]/review/not-found"

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

function makeSampleGatewayViewModel(): ProfessionalEvidenceGatewayViewModel {
  return {
    savedDealId: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId,
    gates: [],
    sections: [],
    decisionLock: {
      savedDealId: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId,
      finalDecisionLockStatus: "LOCKED",
      lockReason: "Professional evidence remains display-only.",
      linkedGateAreas: [],
      linkedEvidenceIds: [],
    },
    readinessPresentation: {
      state: "MISSING",
      displayLabel: "Professional evidence missing",
      supportingSummary: "No compatible professional evidence is currently available for review.",
      authorityNotice:
        "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
    },
    professionalGateStatus: "NOT_STARTED",
    professionalReadiness: "NOT_READY",
    reviewSource: "OPERATOR_NOTE",
    requiredEvidenceSummary: "Professional evidence review required",
    professionalConfirmationSummary:
      "Professional confirmation requires explicit compatible qualifying source",
    recommendedNextAction: "Request compatible professional source confirmation",
    linkedEvidenceCommandEvidenceId: null,
  }
}

function makeSampleDealFormulationViewModel(): DealFormulationViewModel {
  return {
    identity: {
      dealId: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId,
      address: "12 Lake View Road, Leeds",
    },
    financialSummary: {
      purchasePrice: { amount: 125000, availability: "AVAILABLE", unavailableReason: null },
      gdvRealistic: { amount: 200000, availability: "AVAILABLE", unavailableReason: null },
      gdvDownside: { amount: 180000, availability: "AVAILABLE", unavailableReason: null },
      gdvStrong: { amount: 220000, availability: "AVAILABLE", unavailableReason: null },
      refurbishmentCost: { amount: 25000, availability: "AVAILABLE", unavailableReason: null },
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
      classification: "MARGINAL",
      capitalProtectionState: "CAUTION",
      strategyRecommendation: "FLIP_ONLY_OR_RENEGOTIATE",
      recommendedNextAction: "Review title and refurb evidence",
    },
    warnings: {
      canonicalWarnings: [],
      unavailableFields: [
        "ROI is not available from the current canonical engine output.",
      ],
    },
  }
}

function makeSampleViewModel(): InvestorReviewReadyViewModel {
  const viewModel = mapPdfEvidencePackToInvestorReview({
    pack: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
    savedDeal: makeSavedDealRecord({ id: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId }),
  })

  return {
    ...viewModel,
    dealFormulation: makeSampleDealFormulationViewModel(),
    professionalEvidenceGateway: makeSampleGatewayViewModel(),
  }
}

describe("InvestorReviewPage", () => {
  beforeEach(() => {
    loadInvestorReviewPageModelMock.mockReset()
    notFoundMock.mockClear()
  })

  describe("ready state", () => {
    it("passes the route id to the loader exactly once and renders the document", async () => {
      const viewModel = makeSampleViewModel()
      loadInvestorReviewPageModelMock.mockResolvedValueOnce({
        status: "ready",
        viewModel,
      } satisfies LoadInvestorReviewPageModelResult)

      const element = await InvestorReviewPage({
        params: Promise.resolve({ id: "deal-123" }),
      })
      const html = renderToStaticMarkup(element)

      expect(loadInvestorReviewPageModelMock).toHaveBeenCalledTimes(1)
      expect(loadInvestorReviewPageModelMock).toHaveBeenCalledWith("deal-123")
      expect(html).toContain("Brik by Brik Investor Review")
      expect(html).toContain("£113,800.00")
      expect(html).toContain("Required hard gates")
      expect(html).toContain("Advisory and caution gates")
      expect(html).toContain("Deal Formulation")
      expect(html).toContain("Canonical saved-deal financial position and decision support.")
      expect(html).toContain(
        "Values shown here are read-only canonical outputs. Unsupported values remain unavailable and are not estimated."
      )
      expect(html).toContain("Professional Evidence Gateway")
      expect(html).toContain(
        "Read-only professional decision support. This section does not satisfy, waive, approve, or override Investor Shield requirements."
      )
      expect(html).toContain("Professional evidence missing")
      expect(html).toContain(
        "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements."
      )
      expect(html).toContain(
        "Evidence Lite is read-only evidence notes. It is informational only and does not satisfy, waive, approve, or override Investor Shield requirements."
      )
      expect(html).not.toContain("Professional Evidence Gateway Proof")
      expect(notFoundMock).not.toHaveBeenCalled()
    })

    it("renders no mutation, print, PDF, or download controls", async () => {
      loadInvestorReviewPageModelMock.mockResolvedValueOnce({
        status: "ready",
        viewModel: makeSampleViewModel(),
      } satisfies LoadInvestorReviewPageModelResult)

      const element = await InvestorReviewPage({
        params: Promise.resolve({ id: "deal-123" }),
      })
      const html = renderToStaticMarkup(element)

      expect(html).not.toContain("<button")
      expect(html).not.toContain("<form")
      expect(html.toLowerCase()).not.toContain("download")
      expect(html.toLowerCase()).not.toContain("print</")
    })
  })

  describe("not_found state", () => {
    it("calls notFound() and does not render the document or unavailable state", async () => {
      loadInvestorReviewPageModelMock.mockResolvedValueOnce({
        status: "not_found",
      } satisfies LoadInvestorReviewPageModelResult)

      await expect(
        InvestorReviewPage({ params: Promise.resolve({ id: "deal-404" }) })
      ).rejects.toThrow("NEXT_NOT_FOUND")

      expect(notFoundMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("unavailable state", () => {
    it("renders the safe unavailable heading without calling notFound()", async () => {
      loadInvestorReviewPageModelMock.mockResolvedValueOnce({
        status: "unavailable",
      } satisfies LoadInvestorReviewPageModelResult)

      const element = await InvestorReviewPage({
        params: Promise.resolve({ id: "deal-123" }),
      })
      const html = renderToStaticMarkup(element)

      expect(html).toContain("Investor review temporarily unavailable")
      expect(notFoundMock).not.toHaveBeenCalled()
      expect(html).not.toContain("Brik by Brik Investor Review")
      expect(html).not.toContain("Required hard gates")
    })

    it("exposes no internal, SQL, environment, Supabase, or Vercel detail", async () => {
      loadInvestorReviewPageModelMock.mockResolvedValueOnce({
        status: "unavailable",
      } satisfies LoadInvestorReviewPageModelResult)

      const element = await InvestorReviewPage({
        params: Promise.resolve({ id: "deal-123" }),
      })
      const html = renderToStaticMarkup(element)

      const forbidden = ["SELECT", "postgres", "supabase", "vercel", "stack trace", "DATABASE_URL"]
      for (const term of forbidden) {
        expect(html.toLowerCase()).not.toContain(term.toLowerCase())
      }
      expect(html).not.toContain("<button")
      expect(html).not.toContain("<form")
    })
  })

  describe("loading state", () => {
    it("renders a stable skeleton with safe busy semantics and no fabricated data", () => {
      const html = renderToStaticMarkup(<InvestorReviewLoading />)

      expect(html).toContain("aria-busy=\"true\"")
      expect(html).toContain("Preparing investor review")
      expect(html).not.toContain("£")
      expect(html).not.toContain("No Evidence Lite records")
      expect(html).not.toContain("No active tasks")
      expect(html).not.toContain("No offers")
      expect(html).not.toContain("<button")
      expect(html).not.toContain("<form")
      expect(html.toLowerCase()).not.toContain("download")
      expect(html.toLowerCase()).not.toContain("upload")
    })
  })

  describe("not-found document", () => {
    it("renders the safe not-found heading and body without internal detail", () => {
      const html = renderToStaticMarkup(<InvestorReviewNotFoundDocument />)

      expect(html).toContain("Investor review not found")
      expect(html).toContain("No report has been generated.")
      expect(html).not.toContain("<button")
      expect(html).not.toContain("<form")
      const forbidden = ["SELECT", "postgres", "supabase", "vercel", "stack trace"]
      for (const term of forbidden) {
        expect(html.toLowerCase()).not.toContain(term.toLowerCase())
      }
    })
  })

  describe("structural safety", () => {
    it("does not use the 'use client' directive", () => {
      const source = readFileSync(
        path.resolve(process.cwd(), "app/saved-deals/[id]/review/page.tsx"),
        "utf8"
      )

      expect(source).not.toContain("use client")
      expect(source).not.toContain("useState")
      expect(source).not.toContain("useEffect")
      expect(source).not.toContain("fetch(")
    })
  })
})
