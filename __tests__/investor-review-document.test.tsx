import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import InvestorReviewDocument from "@/components/investor-review/InvestorReviewDocument"
import type { DealFormulationViewModel } from "@/types/deal-formulation"
import type { InvestorReviewReadyViewModel } from "@/lib/investor-review/investor-review-view-model"
import { mapPdfEvidencePackToInvestorReview } from "@/lib/investor-review/map-pdf-evidence-pack-to-investor-review"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { ProfessionalEvidenceGatewayViewModel } from "@/types/professional-evidence-gateway"
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

function makeProfessionalEvidenceGatewayViewModel(
  overrides: Partial<ProfessionalEvidenceGatewayViewModel> = {}
): ProfessionalEvidenceGatewayViewModel {
  const defaultGate = {
    savedDealId: "saved-deal-review-001",
    professionalGateArea: "SOLICITOR_REVIEW",
    linkedInvestorShieldGate: "TITLE",
    professionalGateStatus: "CONFIRMED",
    professionalReadiness: "PROFESSIONALLY_CONFIRMED",
    reviewSource: "SOLICITOR",
    reviewState: "PROFESSIONAL_CONFIRMED",
    blockerImpact: "DOES_NOT_BLOCK",
    evidenceStrength: "STRONG",
    requiredEvidenceSummary: "Solicitor title evidence is visible for review.",
    professionalConfirmationSummary: "Solicitor has confirmed title review evidence.",
    recommendedNextAction: "Keep solicitor title evidence visible for review.",
    expiryOrReviewDate: "2026-08-01",
    linkedEvidenceCommandEvidenceId: "gateway-evi-001",
    linkedEvidenceIds: ["gateway-evi-001"],
  } satisfies ProfessionalEvidenceGatewayViewModel["gates"][number]

  const gates = overrides.gates ?? [defaultGate]

  return {
    savedDealId: "saved-deal-review-001",
    gates,
    sections: [],
    decisionLock: {
      savedDealId: "saved-deal-review-001",
      finalDecisionLockStatus: "MANUAL_REVIEW_REQUIRED",
      lockReason: "Professional evidence remains display-only for manual review.",
      linkedGateAreas: gates.map((gate) => gate.professionalGateArea),
      linkedEvidenceIds: gates.flatMap((gate) => gate.linkedEvidenceIds),
    },
    readinessPresentation: {
      state: "PROFESSIONALLY_CONFIRMED",
      displayLabel: "Professionally confirmed",
      supportingSummary: defaultGate.professionalConfirmationSummary,
      authorityNotice:
        "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
    },
    professionalGateStatus: "CONFIRMED",
    professionalReadiness: "PROFESSIONALLY_CONFIRMED",
    reviewSource: "SOLICITOR",
    requiredEvidenceSummary: defaultGate.requiredEvidenceSummary,
    professionalConfirmationSummary: defaultGate.professionalConfirmationSummary,
    recommendedNextAction: defaultGate.recommendedNextAction,
    linkedEvidenceCommandEvidenceId: defaultGate.linkedEvidenceCommandEvidenceId,
    ...overrides,
  }
}

function makeDealFormulationViewModel(): DealFormulationViewModel {
  return {
    identity: {
      dealId: "saved-deal-review-001",
      address: "22 Canonical Street, Leeds",
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
      projectedProfit: { amount: -1200, availability: "AVAILABLE", unavailableReason: null },
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
      verdictStatus: "NO-GO",
      classification: "STRONG_DEAL",
      capitalProtectionState: "HIGH_RISK",
      strategyRecommendation: "FLIP_ONLY_OR_RENEGOTIATE",
      recommendedNextAction: "Review lender criteria and solicitor evidence",
    },
    warnings: {
      canonicalWarnings: [],
      unavailableFields: [
        "ROI is not available from the current canonical engine output.",
        "No canonical opening-offer source exists.",
        "No canonical target-offer source exists.",
      ],
    },
  }
}

function attachModels(
  viewModel: ReturnType<typeof mapPdfEvidencePackToInvestorReview>,
  overrides: Partial<ProfessionalEvidenceGatewayViewModel> = {}
): InvestorReviewReadyViewModel {
  return {
    ...viewModel,
    dealFormulation: makeDealFormulationViewModel(),
    professionalEvidenceGateway: makeProfessionalEvidenceGatewayViewModel(overrides),
  }
}

function renderDocument() {
  const baseViewModel = mapPdfEvidencePackToInvestorReview({
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

  return renderToStaticMarkup(<InvestorReviewDocument viewModel={attachModels(baseViewModel)} />)
}

describe("InvestorReviewDocument", () => {
  it("renders locked report structure, canonical review values, and Deal Formulation", () => {
    const html = renderDocument()

    expect(html).toContain("Brik by Brik Investor Review")
    expect(html).toContain("INTERNAL USE ONLY")
    expect(html).toContain("Investor decision support")
    expect(html).toContain("12 Lake View Road, Leeds")
    expect(html).toContain("MARGINAL")
    expect(html).toContain("Manual Review Required")
    expect(html).toContain("CAUTION")
    expect(html).toContain("Under Analysis")
    expect(html).toContain("Deal Formulation")
    expect(html).toContain("Canonical saved-deal financial position and decision support.")
    expect(html).toContain(
      "Values shown here are read-only canonical outputs. Unsupported values remain unavailable and are not estimated."
    )
    expect(html).toContain("£113,800.00")
    expect(html).toContain("NO-GO")
    expect(html).toContain("Review title and refurb evidence")
  })

  it("renders locked semantic section order with Deal Formulation before shield/evidence sections", () => {
    const html = renderDocument()

    const expectedOrder = [
      "Property and deal overview",
      "Investment summary",
      "Deal Formulation",
      "Decision and capital-protection status",
      "Required hard gates",
      "Advisory and caution gates",
      "Professional Evidence Gateway",
      "Evidence Lite records",
      "Missing evidence and blockers",
      "Tasks and offers",
      "Recommended next action",
      "Footer",
    ]

    for (const heading of expectedOrder) {
      expect(html).toContain(heading)
    }

    expect(html.indexOf("Investment summary")).toBeLessThan(html.indexOf("Deal Formulation"))
    expect(html.indexOf("Deal Formulation")).toBeLessThan(
      html.indexOf("Decision and capital-protection status")
    )
    expect(html.indexOf("Professional Evidence Gateway")).toBeLessThan(
      html.indexOf("Evidence Lite records")
    )
  })

  it("preserves Evidence Lite, Professional Gateway, and advisory separation notices", () => {
    const html = renderDocument()

    expect(html).toContain(
      "No single investor-facing True MAO band has been selected in the current canonical model."
    )
    expect(html).toContain("No canonical monetary offer ladder currently exists.")
    expect(html).toContain("No canonical acquisition-cost aggregate currently exists.")
    expect(html).toContain("ROI is not available from the current canonical engine output.")
    expect(html).toContain(
      "Evidence supports review but does not automatically satisfy Investor Shield hard gates, waive requirements, approve progression, or replace professional confirmation."
    )
    expect(html).toContain(
      "Read-only professional decision support. This section does not satisfy, waive, approve, or override Investor Shield requirements."
    )
    expect(html).toContain("Professionally confirmed")
    expect(html).toContain(
      "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements."
    )
    expect(html).not.toContain("Professional Evidence Gateway Proof")
    expect(html).not.toContain("Read-only dev/demo proof")
  })

  it("renders structured Evidence Command fields with stable test hooks", () => {
    const baseViewModel = mapPdfEvidencePackToInvestorReview({
      pack: {
        ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
        evidenceIndex: [
          {
            ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.evidenceIndex[0],
            evidenceCommandType: "PHOTO_EVIDENCE",
            linkedInvestorShieldGate: "DAMP_STRUCTURAL",
            linkedProfessionalGate: "SURVEYOR_REPORT",
            evidenceSummary: "Captured site photo set",
            evidenceStatus: "RECEIVED",
            evidenceStrength: "STRONG",
            reviewState: "PROFESSIONAL_CONFIRMED",
            blockerImpact: "CAUTION_ONLY",
            recommendedNextAction: "Review survey photos",
            expiryOrUpdateDate: "2026-06-30T09:00:00.000Z",
            source: "mobile_capture",
            mobileCaptureNote: "Captured on site",
          },
        ],
      },
      savedDeal: makeSavedDealRecord({ id: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId }),
    })
    const html = renderToStaticMarkup(
      <InvestorReviewDocument viewModel={attachModels(baseViewModel)} />
    )

    expect(html).toContain("data-testid=\"investor-review-evidence-row-evi-pdf-blocked-001\"")
    expect(html).toContain(
      "data-testid=\"investor-review-evidence-row-evi-pdf-blocked-001-field-linked-investor-shield-gate\""
    )
    expect(html).toContain("Photo evidence")
    expect(html).toContain("Damp and Structural Review")
    expect(html).toContain("Surveyor report")
    expect(html).toContain("Strong")
    expect(html).toContain("Caution only")
    expect(html).toContain("Review survey photos")
    expect(html).toContain("2026-06-30 09:00 UTC")
    expect(html).toContain("mobile_capture")
    expect(html).toContain("Captured on site")
    expect(html).not.toContain("PHOTO_EVIDENCE")
  })

  it("renders locked empty states and no mutation or PDF controls", () => {
    const baseViewModel = mapPdfEvidencePackToInvestorReview({
      pack: PDF_EVIDENCE_PACK_EMPTY_FIXTURE,
      savedDeal: makeSavedDealRecord({ id: PDF_EVIDENCE_PACK_EMPTY_FIXTURE.meta.savedDealId }),
    })
    const html = renderToStaticMarkup(
      <InvestorReviewDocument
        viewModel={attachModels(baseViewModel, {
          gates: [],
          decisionLock: {
            savedDealId: PDF_EVIDENCE_PACK_EMPTY_FIXTURE.meta.savedDealId,
            finalDecisionLockStatus: "LOCKED",
            lockReason: "Professional evidence remains display-only.",
            linkedGateAreas: [],
            linkedEvidenceIds: [],
          },
          readinessPresentation: {
            state: "MISSING",
            displayLabel: "Professional evidence missing",
            supportingSummary:
              "No compatible professional evidence is currently available for review.",
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
        })}
      />
    )

    expect(html).toContain("No compatible professional evidence is currently available for review.")
    expect(html).toContain("Professional evidence missing")
    expect(html).toContain("No offers are currently recorded for this deal.")
    expect(html).toContain("No Evidence Lite records are currently attached to this deal.")
    expect(html).toContain("No active tasks are currently recorded for this deal.")
    expect(html).not.toContain("<button")
    expect(html).not.toContain("Download")
    expect(html).not.toContain("Print")
    expect(html).not.toContain("Approve")
  })

  it("normalizes solicitor naming and keeps missing/unreviewed clarification", () => {
    const baseViewModel = mapPdfEvidencePackToInvestorReview({
      pack: {
        ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
        investorShield: {
          ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorShield,
          blockingGateKeys: ["SOLICITOR_REVIEW"],
          missingEvidenceGateKeys: ["SOLICITOR_REVIEW"],
          taskRecommendations: [
            {
              gateKey: "SOLICITOR_REVIEW",
              type: "REQUEST_EVIDENCE",
              title: "Review solicitor feedback",
              reason: "Solicitor feedback is still missing.",
              severity: "BLOCKER",
              source: "system_default",
              idempotencyKey:
                "investor-shield:test-solicitor:SOLICITOR_REVIEW:REQUEST_EVIDENCE",
            },
          ],
        },
        investorSummary: {
          ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorSummary,
          investorShield: {
            ...PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorSummary.investorShield,
            blockedGates: [
              {
                gateKey: "SOLICITOR_REVIEW",
                label: "Solicitor Review",
                gateType: "required",
                blockerReason: "Solicitor review evidence remains outstanding.",
              },
            ],
          },
          recommendedNextAction: {
            source: "INVESTOR_SHIELD_FALLBACK",
            actionText: "Review solicitor feedback",
          },
        },
        evidenceIndex: [
          {
            evidenceId: "evi-solicitor-review-001",
            evidenceType: "SOLICITOR_REVIEW",
            title: "Solicitor review note",
            description: "Awaiting solicitor sign-off.",
            provenanceLabel: "Evidence Lite",
            capturedAt: "2026-06-12T09:00:00.000Z",
            reviewedAt: null,
            reviewStatus: "MISSING",
            relatedGateIds: ["SOLICITOR_REVIEW"],
            controlledReferenceState: "MISSING",
            controlledReferenceLabel: null,
          },
        ],
      },
      savedDeal: makeSavedDealRecord({ id: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.meta.savedDealId }),
    })
    const html = renderToStaticMarkup(
      <InvestorReviewDocument
        viewModel={attachModels(baseViewModel, {
          gates: [],
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
            supportingSummary:
              "No compatible professional evidence is currently available for review.",
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
        })}
      />
    )

    expect(html).toContain("Solicitor Review")
    expect(html).not.toContain("SOLICITOR_REVIEW")
    expect(html).not.toContain("Solicitor Feedback")
    expect(html).toContain(
      "Evidence record present, but not reviewed and not sufficient to satisfy gate."
    )
    expect(html).toContain("MISSING")
    expect(html).toContain("Not reviewed")
  })

  it("does not render raw canonical gate ids or raw AI advisory sub-gate key", () => {
    const html = renderDocument()

    for (const identifier of [
      "REFURB_CERTAINTY",
      "BUILDER_PROPOSAL_CONTRACT",
      "DAMP_STRUCTURAL",
      "LENDER_CRITERIA",
      "PLANNING_BUILDING_CONTROL",
      "SOLD_COMPS",
      "AI_VISUAL_REVIEW_ADVISORY",
    ]) {
      expect(html).not.toContain(identifier)
    }

    expect(html).toContain("Refurb Certainty")
    expect(html).toContain(
      "AI-assisted visual review is advisory only and cannot replace human, professional, builder, document, or measurement evidence."
    )
  })

  it("humanizes underscore-separated values but keeps single-word status values", () => {
    const html = renderDocument()

    expect(html).toContain("Manual Review Required")
    expect(html).toContain("Under Analysis")
    expect(html).not.toContain("MANUAL_REVIEW_REQUIRED")
    expect(html).not.toContain("UNDER_ANALYSIS")
    expect(html).toContain("MARGINAL")
    expect(html).toContain("BLOCKED")
    expect(html).toContain("CAUTION")
  })

  it("keeps blocked progression and Deal Formulation adverse values on negative tone", () => {
    const html = renderDocument()

    expect(html).toContain(
      '<div class="rounded-xl border px-4 py-3 border-red-200 bg-red-50 text-red-900"><p class="text-xs uppercase tracking-wide opacity-80">Progression decision</p><p class="mt-1 break-words text-sm font-semibold">BLOCKED</p></div>'
    )
    expect(html).toContain(
      '<div data-testid="deal-formulation-verdict" class="rounded-xl border px-4 py-3 border-red-200 bg-red-50 text-red-900"><p class="text-xs uppercase tracking-wide opacity-80">Verdict</p><p class="mt-1 break-words text-sm font-semibold">NO-GO</p></div>'
    )
    expect(html).toContain(
      '<div data-testid="deal-formulation-projected-profit" class="rounded-xl border px-4 py-3 border-red-200 bg-red-50 text-red-900"><p class="text-xs uppercase tracking-wide opacity-80">Projected profit</p><p class="mt-1 break-words text-sm font-semibold">-£1,200.00</p></div>'
    )
  })

  it("uses safe wrapping classes and requires no client-only behavior", () => {
    const html = renderDocument()

    expect(html).toContain("break-all")
    expect(html).toContain("break-words")
    expect(html).not.toContain("use client")
  })
})
