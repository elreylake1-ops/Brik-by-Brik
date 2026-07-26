import { mapPdfEvidencePackToInvestorReview } from "@/lib/investor-review/map-pdf-evidence-pack-to-investor-review"
import { mapInvestorReviewToDealSummary } from "@/lib/investor-summary/map-investor-review-to-deal-summary"
import type { InvestorReviewReadyViewModel } from "@/lib/investor-review/investor-review-view-model"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { DealFormulationViewModel } from "@/types/deal-formulation"
import type { InvestorDealSummaryViewModel } from "@/types/investor-deal-summary"
import type { ProfessionalEvidenceGatewayViewModel } from "@/types/professional-evidence-gateway"
import { PDF_EVIDENCE_PACK_BLOCKED_FIXTURE } from "./pdf-evidence-pack-fixtures"

export function makeSampleSavedDealRecord(
  overrides: Partial<SavedDealRecord> = {}
): SavedDealRecord {
  return {
    id: "saved-deal-summary-001",
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

export function makeSampleDealFormulationViewModel(): DealFormulationViewModel {
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
      canonicalWarnings: ["Manual review remains required before progression."],
      unavailableFields: ["ROI is not available from the current canonical engine output."],
    },
  }
}

export function makeSampleProfessionalEvidenceGatewayViewModel(): ProfessionalEvidenceGatewayViewModel {
  return {
    savedDealId: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId,
    gates: [
      {
        savedDealId: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId,
        professionalGateArea: "SOLICITOR_REVIEW",
        linkedInvestorShieldGate: "TITLE",
        professionalGateStatus: "RECEIVED",
        professionalReadiness: "READY_FOR_REVIEW",
        reviewSource: "SOLICITOR",
        reviewState: "RECEIVED_FOR_REVIEW",
        blockerImpact: "DOES_NOT_BLOCK",
        evidenceStrength: "MODERATE",
        requiredEvidenceSummary: "Solicitor title evidence is visible for review.",
        professionalConfirmationSummary: "Solicitor review remains advisory until confirmed.",
        recommendedNextAction: "Review solicitor evidence",
        expiryOrReviewDate: "2026-08-01",
        linkedEvidenceCommandEvidenceId: "gateway-evi-001",
        linkedEvidenceIds: ["gateway-evi-001"],
      },
    ],
    sections: [],
    decisionLock: {
      savedDealId: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId,
      finalDecisionLockStatus: "MANUAL_REVIEW_REQUIRED",
      lockReason: "Professional evidence remains display-only for manual review.",
      linkedGateAreas: ["SOLICITOR_REVIEW"],
      linkedEvidenceIds: ["gateway-evi-001"],
    },
    readinessPresentation: {
      state: "READY_FOR_REVIEW",
      displayLabel: "Ready for review",
      supportingSummary: "Compatible evidence is visible for professional review.",
      authorityNotice:
        "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
    },
    professionalGateStatus: "RECEIVED",
    professionalReadiness: "READY_FOR_REVIEW",
    reviewSource: "SOLICITOR",
    requiredEvidenceSummary: "Professional evidence review required",
    professionalConfirmationSummary:
      "Professional confirmation requires explicit compatible qualifying source",
    recommendedNextAction: "Request compatible professional source confirmation",
    linkedEvidenceCommandEvidenceId: "gateway-evi-001",
  }
}

export function makeSampleInvestorReviewReadyViewModel(): InvestorReviewReadyViewModel {
  const base = mapPdfEvidencePackToInvestorReview({
    pack: {
      ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
      investorShield: {
        ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorShield,
        cautionGateKeys: ["RENTAL_DEMAND"],
        advisoryOnlyEvidenceWarnings: ["AI advisory evidence cannot satisfy hard gates."],
      },
    },
    savedDeal: makeSampleSavedDealRecord({
      id: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId,
    }),
  })

  return {
    ...base,
    dealFormulation: makeSampleDealFormulationViewModel(),
    professionalEvidenceGateway: makeSampleProfessionalEvidenceGatewayViewModel(),
  }
}

export function makeSampleInvestorDealSummaryViewModel(): InvestorDealSummaryViewModel {
  const review = makeSampleInvestorReviewReadyViewModel()

  return mapInvestorReviewToDealSummary({
    review,
    generatedAt: review.header.generatedAt,
  })
}
