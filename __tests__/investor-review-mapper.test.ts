import { describe, expect, it } from "vitest"
import { mapPdfEvidencePackToInvestorReview } from "@/lib/investor-review/map-pdf-evidence-pack-to-investor-review"
import {
  INVESTOR_REVIEW_EMPTY_EVIDENCE_LITE_LABEL,
  INVESTOR_REVIEW_EMPTY_OFFERS_LABEL,
  INVESTOR_REVIEW_EMPTY_TASKS_LABEL,
  INVESTOR_REVIEW_EVIDENCE_LITE_NOTICE,
  INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
} from "@/lib/investor-review/investor-review-view-model"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import {
  PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
  PDF_EVIDENCE_PACK_EMPTY_FIXTURE,
  PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE,
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

describe("mapPdfEvidencePackToInvestorReview", () => {
  it("maps header values and takes governance and pipeline from the canonical saved deal", () => {
    const viewModel = mapPdfEvidencePackToInvestorReview({
      pack: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
      savedDeal: makeSavedDealRecord({
        id: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId,
        governance_state: "MANUAL_REVIEW_REQUIRED",
        pipeline_state: "UNDER_ANALYSIS",
      }),
    })

    expect(viewModel.header.title).toBe("Brik by Brik Investor Review")
    expect(viewModel.header.confidentialityLabel).toBe("INTERNAL USE ONLY")
    expect(viewModel.header.reviewPurpose).toBe("Investor decision support")
    expect(viewModel.header.dealId).toBe(PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId)
    expect(viewModel.header.generatedAt).toBe("2026-06-14 12:15 UTC")
    expect(viewModel.overview.governance.value).toBe("MANUAL_REVIEW_REQUIRED")
    expect(viewModel.overview.pipeline.value).toBe("UNDER_ANALYSIS")
    expect(viewModel.investmentSummary.trueMao20.value).toBe("£113,800.00")
    expect(viewModel.recommendedNextAction).toBe("Review title and refurb evidence")
    expect(viewModel.evidenceLiteRows[0]?.linkedGate).toBe("Title Review")
  })

  it("keeps required gates separate from advisory content and does not assign success to missing states", () => {
    const pack = {
      ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
      investorShield: {
        ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorShield,
        cautionGateKeys: ["RENTAL_DEMAND"],
        advisoryOnlyEvidenceWarnings: ["AI advisory evidence cannot satisfy hard gates."],
      },
    }

    const viewModel = mapPdfEvidencePackToInvestorReview({
      pack,
      savedDeal: makeSavedDealRecord({ id: pack.meta.savedDealId }),
    })

    const titleGate = viewModel.requiredGateRows.find((row) => row.gateKey === "TITLE")
    expect(titleGate).toBeDefined()
    expect(titleGate?.status).toBe("Blocked")
    expect(titleGate?.statusTone).not.toBe("success")
    expect(titleGate?.missingEvidenceState).toBe("Missing evidence recorded")

    expect(viewModel.advisoryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "caution-RENTAL_DEMAND",
          sourceLabel: "Caution gate",
          tone: "caution",
        }),
        expect.objectContaining({
          sourceLabel: "Canonical advisory warning",
          tone: "informational",
        }),
      ])
    )
  })

  it("maps Evidence Lite items as informational only and omits reviewer notes when unavailable", () => {
    const viewModel = mapPdfEvidencePackToInvestorReview({
      pack: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
      savedDeal: makeSavedDealRecord({ id: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId }),
    })

    expect(viewModel.evidenceLiteNotice).toBe(INVESTOR_REVIEW_EVIDENCE_LITE_NOTICE)
    expect(viewModel.evidenceLiteRows).toHaveLength(1)
    expect(viewModel.evidenceLiteRows[0]).toEqual(
      expect.objectContaining({
        status: "MISSING",
        statusTone: "caution",
        reviewedLabel: "Not reviewed",
        reviewedTone: "caution",
        reviewerNote: null,
        linkedGate: "Title Review",
      })
    )
  })

  it("normalizes the solicitor gate display key while keeping canonical SOLICITOR_FEEDBACK keying intact", () => {
    const pack = {
      ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
      investorShield: {
        ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorShield,
        blockingGateKeys: ["SOLICITOR_FEEDBACK"],
        missingEvidenceGateKeys: ["SOLICITOR_FEEDBACK"],
        taskRecommendations: [
          {
            gateKey: "SOLICITOR_FEEDBACK",
            type: "REQUEST_EVIDENCE",
            title: "Review solicitor feedback",
            reason: "Solicitor feedback is still missing.",
            severity: "BLOCKER",
            source: "system_default",
            idempotencyKey: "investor-shield:test-solicitor:SOLICITOR_FEEDBACK:REQUEST_EVIDENCE",
          },
        ],
      },
      investorSummary: {
        ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorSummary,
        investorShield: {
          ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorSummary.investorShield,
          blockedGates: [
            {
              gateKey: "SOLICITOR_FEEDBACK",
              label: "Solicitor Review",
              gateType: "required" as const,
              blockerReason: "Solicitor review evidence remains outstanding.",
            },
          ],
        },
      },
    }

    const viewModel = mapPdfEvidencePackToInvestorReview({
      pack,
      savedDeal: makeSavedDealRecord({ id: pack.meta.savedDealId }),
    })

    const solicitorRequiredGate = viewModel.requiredGateRows.find((row) => row.label === "Solicitor Review")
    expect(solicitorRequiredGate).toBeDefined()
    expect(solicitorRequiredGate?.gateKey).toBe("SOLICITOR_REVIEW")
    expect(solicitorRequiredGate?.status).toBe("Blocked")
    expect(solicitorRequiredGate?.missingEvidenceState).toBe("Missing evidence recorded")

    const solicitorBlockerRow = viewModel.blockerRows.find((row) => row.label === "Solicitor Review")
    expect(solicitorBlockerRow).toBeDefined()
    expect(solicitorBlockerRow?.gateKey).toBe("SOLICITOR_REVIEW")

    expect(viewModel.followUpRequirements).toContain("Complete Solicitor Review")
    expect(viewModel.followUpRequirements).not.toContain("Review solicitor feedback")

    const html = JSON.stringify(viewModel)
    expect(html).not.toContain("SOLICITOR_FEEDBACK")
    expect(html).not.toContain("Solicitor Feedback")
  })

  it("maps locked empty-state text and unavailable optional values without inventing zero values", () => {
    const emptyViewModel = mapPdfEvidencePackToInvestorReview({
      pack: PDF_EVIDENCE_PACK_EMPTY_FIXTURE,
      savedDeal: makeSavedDealRecord({ id: PDF_EVIDENCE_PACK_EMPTY_FIXTURE.meta.savedDealId }),
    })

    expect(emptyViewModel.evidenceLiteRows).toHaveLength(0)
    expect(emptyViewModel.emptyEvidenceLiteText).toBe(INVESTOR_REVIEW_EMPTY_EVIDENCE_LITE_LABEL)
    expect(emptyViewModel.tasks).toHaveLength(0)
    expect(emptyViewModel.emptyTasksText).toBe(INVESTOR_REVIEW_EMPTY_TASKS_LABEL)
    expect(emptyViewModel.latestOffer).toBeNull()
    expect(emptyViewModel.emptyOffersText).toBe(INVESTOR_REVIEW_EMPTY_OFFERS_LABEL)

    const unavailableViewModel = mapPdfEvidencePackToInvestorReview({
      pack: PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE,
      savedDeal: makeSavedDealRecord({
        id: PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE.meta.savedDealId,
        governance_state: "",
        pipeline_state: "",
      }),
    })

    expect(unavailableViewModel.overview.governance.value).toBe(INVESTOR_REVIEW_NOT_AVAILABLE_LABEL)
    expect(unavailableViewModel.overview.pipeline.value).toBe(INVESTOR_REVIEW_NOT_AVAILABLE_LABEL)
    expect(unavailableViewModel.investmentSummary.purchasePrice.value).toBe(INVESTOR_REVIEW_NOT_AVAILABLE_LABEL)
    expect(unavailableViewModel.investmentSummary.trueMao20.value).toBe(INVESTOR_REVIEW_NOT_AVAILABLE_LABEL)
  })

  it("passes through the generated timestamp and does not mutate canonical inputs", () => {
    const originalPack = structuredClone(PDF_EVIDENCE_PACK_BLOCKED_FIXTURE)
    const originalSavedDeal = makeSavedDealRecord({ id: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId })
    const originalSavedDealClone = structuredClone(originalSavedDeal)

    const viewModel = mapPdfEvidencePackToInvestorReview({
      pack: originalPack,
      savedDeal: originalSavedDeal,
    })

    expect(viewModel.header.generatedAt).toBe("2026-06-14 12:15 UTC")
    expect(originalPack).toEqual(PDF_EVIDENCE_PACK_BLOCKED_FIXTURE)
    expect(originalSavedDeal).toEqual(originalSavedDealClone)
  })
})
