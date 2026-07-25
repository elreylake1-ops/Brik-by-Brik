import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { composeDealFormulationViewModel } from "@/lib/deal-formulation/compose-deal-formulation-view-model"
import { selectLatestInvestorSummaryOffer } from "@/lib/investor-summary/select-latest-investor-summary-offer"
import type { ComposeDealFormulationInput } from "@/types/deal-formulation"
import type { DealOfferRecord } from "@/lib/operator-command/deal-offers-repository"

function makeOfferRecord(overrides: Partial<DealOfferRecord> = {}): DealOfferRecord {
  return {
    id: "offer-001",
    deal_id: "deal-001",
    offer_amount: 118000,
    offer_type: "INITIAL",
    offer_status: "PENDING",
    offer_rationale: "Initial offer",
    seller_response: null,
    created_at: "2026-07-01T09:00:00.000Z",
    ...overrides,
  }
}

function buildInput(overrides: Partial<ComposeDealFormulationInput> = {}): ComposeDealFormulationInput {
  const latestOffer =
    overrides.latestOffer !== undefined
      ? overrides.latestOffer
      : selectLatestInvestorSummaryOffer([
          makeOfferRecord(),
          makeOfferRecord({
            id: "offer-older",
            offer_amount: 140000,
            offer_status: "ACCEPTED",
            created_at: "2026-06-30T09:00:00.000Z",
          }),
        ])

  return {
    savedDeal: {
      dealId: "deal-001",
      address: "1 Lake View Road",
      refurbishmentCost: 18000,
      classification: "CONDITIONAL",
      capitalProtectionState: "PROTECTED",
      ...(overrides.savedDeal ?? {}),
    },
    engineValues: {
      stampDuty: 3600,
      legalCosts: 2000,
      saleCosts: 3000,
      financeCost: 12600,
      totalInvestment: 166200,
      projectedProfit: 33800,
      profitMargin: 16.9,
      trueMao: {
        fifteenPercent: 123800,
        twentyPercent: 113800,
        twentyFivePercent: 103800,
        ...(overrides.engineValues?.trueMao ?? {}),
      },
      verdictStatus: "CONDITIONAL",
      strategyRecommendation: "FLIP_ONLY_OR_RENEGOTIATE",
      ...overrides.engineValues,
    },
    investorSummary: {
      purchasePrice: 120000,
      gdvRange: {
        downside: 180000,
        realistic: 200000,
        strong: 220000,
        ...(overrides.investorSummary?.gdvRange ?? {}),
      },
      recommendedNextAction: "Review lender criteria and solicitor evidence",
      ...overrides.investorSummary,
    },
    latestOffer,
    canonicalWarnings: overrides.canonicalWarnings ?? [
      "Deterministic governance remains authoritative.",
      "Manual review remains required before progression.",
    ],
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue)
    }
  }

  return value
}

describe("composeDealFormulationViewModel", () => {
  it("maps canonical identity, financial values, decision values, and latest offer unchanged", () => {
    const input = buildInput()
    const result = composeDealFormulationViewModel(input)

    expect(result.identity).toEqual({
      dealId: "deal-001",
      address: "1 Lake View Road",
    })

    expect(result.financialSummary.purchasePrice.amount).toBe(120000)
    expect(result.financialSummary.gdvRealistic.amount).toBe(200000)
    expect(result.financialSummary.gdvDownside.amount).toBe(180000)
    expect(result.financialSummary.gdvStrong.amount).toBe(220000)
    expect(result.financialSummary.refurbishmentCost.amount).toBe(18000)
    expect(result.financialSummary.stampDuty.amount).toBe(3600)
    expect(result.financialSummary.legalCosts.amount).toBe(2000)
    expect(result.financialSummary.saleCosts.amount).toBe(3000)
    expect(result.financialSummary.financeCost.amount).toBe(12600)
    expect(result.financialSummary.totalInvestment.amount).toBe(166200)
    expect(result.financialSummary.projectedProfit.amount).toBe(33800)
    expect(result.financialSummary.profitMargin).toBe(16.9)

    expect(result.decision).toEqual({
      verdictStatus: "CONDITIONAL",
      classification: "CONDITIONAL",
      capitalProtectionState: "PROTECTED",
      strategyRecommendation: "FLIP_ONLY_OR_RENEGOTIATE",
      recommendedNextAction: "Review lender criteria and solicitor evidence",
    })

    expect(result.offerPosition.latestRecordedOffer).toBe(118000)
    expect(result.offerPosition.latestOfferStatus).toBe("PENDING")
  })

  it("preserves all three canonical True MAO bands and never creates a singular selected amount", () => {
    const result = composeDealFormulationViewModel(buildInput())

    expect(result.trueMao.fifteenPercent.amount).toBe(123800)
    expect(result.trueMao.twentyPercent.amount).toBe(113800)
    expect(result.trueMao.twentyFivePercent.amount).toBe(103800)
    expect(result.trueMao.selectedAmount).toBeNull()
    expect(result.trueMao.selectedBand).toBeNull()
    expect(result.trueMao.sourceLabel).toBe("Canonical deterministic True MAO bands")
  })

  it("keeps ROI unavailable and acquisition costs unavailable under the audited rule", () => {
    const result = composeDealFormulationViewModel(buildInput())

    expect(result.financialSummary.roi).toBeNull()
    expect(result.financialSummary.acquisitionCosts).toEqual({
      amount: null,
      availability: "UNAVAILABLE",
      unavailableReason: "No canonical acquisition-cost aggregate exists.",
    })
    expect(result.warnings.unavailableFields).toContain(
      "ROI is not available from the current canonical engine output."
    )
  })

  it("does not turn missing acquisition-cost components into zero", () => {
    const result = composeDealFormulationViewModel(
      buildInput({
        engineValues: {
          stampDuty: null,
          legalCosts: null,
          saleCosts: null,
        },
      })
    )

    expect(result.financialSummary.stampDuty.amount).toBeNull()
    expect(result.financialSummary.legalCosts.amount).toBeNull()
    expect(result.financialSummary.saleCosts.amount).toBeNull()
    expect(result.financialSummary.acquisitionCosts.amount).toBeNull()
  })

  it("keeps unsupported offer-ladder fields unavailable and does not infer final or walk-away offers", () => {
    const result = composeDealFormulationViewModel(buildInput())

    expect(result.offerPosition.openingOffer).toBeNull()
    expect(result.offerPosition.targetOffer).toBeNull()
    expect(result.offerPosition.finalOffer).toBeNull()
    expect(result.offerPosition.walkAwayAmount).toBeNull()
    expect(result.offerPosition.walkAwayThreshold).toBeNull()
    expect(result.offerPosition.unavailableReasons).toEqual([
      "No canonical opening-offer source exists.",
      "No canonical target-offer source exists.",
      "No canonical final-offer source exists.",
      "No canonical walk-away amount exists.",
      "No canonical walk-away threshold exists.",
    ])
  })

  it("keeps no-offer as valid null state without converting to zero", () => {
    const result = composeDealFormulationViewModel(
      buildInput({
        latestOffer: null,
      })
    )

    expect(result.offerPosition.latestRecordedOffer).toBeNull()
    expect(result.offerPosition.latestOfferStatus).toBeNull()
    expect(result.warnings.unavailableFields).toContain("Latest recorded offer unavailable.")
  })

  it("preserves missing engine-result values as null and never converts missing money into zero", () => {
    const result = composeDealFormulationViewModel(
      buildInput({
        engineValues: {
          stampDuty: null,
          legalCosts: null,
          saleCosts: null,
          financeCost: null,
          totalInvestment: null,
          projectedProfit: null,
          profitMargin: null,
          trueMao: {
            fifteenPercent: null,
            twentyPercent: null,
            twentyFivePercent: null,
          },
          verdictStatus: null,
          strategyRecommendation: null,
        },
        investorSummary: {
          purchasePrice: null,
          gdvRange: {
            downside: null,
            realistic: null,
            strong: null,
          },
          recommendedNextAction: null,
        },
        savedDeal: {
          refurbishmentCost: null,
          classification: null,
          capitalProtectionState: null,
        },
      })
    )

    expect(result.financialSummary.purchasePrice.amount).toBeNull()
    expect(result.financialSummary.financeCost.amount).toBeNull()
    expect(result.financialSummary.totalInvestment.amount).toBeNull()
    expect(result.financialSummary.projectedProfit.amount).toBeNull()
    expect(result.financialSummary.profitMargin).toBeNull()
    expect(result.trueMao.fifteenPercent.amount).toBeNull()
    expect(result.decision.verdictStatus).toBeNull()
    expect(result.decision.classification).toBeNull()
    expect(result.decision.strategyRecommendation).toBeNull()
    expect(result.decision.recommendedNextAction).toBeNull()
    expect(result.warnings.unavailableFields).not.toContain("$0")
  })

  it("keeps classification and verdict separate and does not substitute verdict for missing classification", () => {
    const result = composeDealFormulationViewModel(
      buildInput({
        savedDeal: {
          classification: null,
        },
        engineValues: {
          verdictStatus: "GO",
        },
      })
    )

    expect(result.decision.verdictStatus).toBe("GO")
    expect(result.decision.classification).toBeNull()
  })

  it("keeps canonical warnings stable and lists unsupported fields as unavailable", () => {
    const result = composeDealFormulationViewModel(
      buildInput({
        canonicalWarnings: [
          "Warning A",
          "Warning B",
          "Warning A",
        ],
      })
    )

    expect(result.warnings.canonicalWarnings).toEqual(["Warning A", "Warning B"])
    expect(result.warnings.unavailableFields).toContain(
      "No canonical opening-offer source exists."
    )
    expect(result.warnings.unavailableFields).toContain(
      "ROI is not available from the current canonical engine output."
    )
  })

  it("returns deeply equal output on repeated calls and does not mutate input", () => {
    const input = deepFreeze(buildInput())

    const first = composeDealFormulationViewModel(input)
    const second = composeDealFormulationViewModel(input)

    expect(second).toEqual(first)
    expect(input.engineValues.trueMao.twentyPercent).toBe(113800)
    expect(input.canonicalWarnings).toEqual([
      "Deterministic governance remains authoritative.",
      "Manual review remains required before progression.",
    ])
  })

  it("advisory and workflow-facing differences do not alter financial output", () => {
    const base = composeDealFormulationViewModel(buildInput())
    const variant = composeDealFormulationViewModel(
      buildInput({
        canonicalWarnings: [
          "Investor Shield blocked progression.",
          "Professional readiness remains advisory.",
          "Evidence Lite remains informational.",
        ],
        investorSummary: {
          recommendedNextAction: "Use advisory route only",
        },
        latestOffer: makeOfferRecord({
          id: "offer-variant",
          offer_amount: 99000,
          offer_status: "DRAFT",
        }) as ReturnType<typeof selectLatestInvestorSummaryOffer>,
      })
    )

    expect(variant.financialSummary).toEqual(base.financialSummary)
    expect(variant.trueMao).toEqual(base.trueMao)
  })

  it("does not require repository, database, or environment access", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "lib/deal-formulation/compose-deal-formulation-view-model.ts"),
      "utf8"
    )

    expect(source).not.toContain("async function")
    expect(source).not.toContain("@/lib/db/")
    expect(source).not.toContain("process.env")
    expect(source).not.toContain("fetch(")
    expect(source).not.toContain("query(")
    expect(source).not.toContain("createOffer(")
    expect(source).not.toContain("updateOffer")
    expect(source).not.toContain("SavedDealRepository")
  })
})
