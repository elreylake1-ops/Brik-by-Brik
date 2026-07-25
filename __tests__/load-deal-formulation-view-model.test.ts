import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { InvestorSummaryViewModel } from "@/types/investor-summary"

const {
  getSavedDealByIdMock,
  getInvestorSummaryForDealMock,
  composeDealFormulationViewModelSpy,
} = vi.hoisted(() => ({
  getSavedDealByIdMock: vi.fn(),
  getInvestorSummaryForDealMock: vi.fn(),
  composeDealFormulationViewModelSpy: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: getSavedDealByIdMock,
}))

vi.mock("@/lib/investor-summary/investor-summary-repository", () => ({
  getInvestorSummaryForDeal: getInvestorSummaryForDealMock,
}))

vi.mock("@/lib/deal-formulation/compose-deal-formulation-view-model", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/deal-formulation/compose-deal-formulation-view-model")
  >("@/lib/deal-formulation/compose-deal-formulation-view-model")

  return {
    ...actual,
    composeDealFormulationViewModel: (input: Parameters<
      typeof actual.composeDealFormulationViewModel
    >[0]) => {
      composeDealFormulationViewModelSpy(input)
      return actual.composeDealFormulationViewModel(input)
    },
  }
})

import { loadDealFormulationViewModel } from "@/lib/deal-formulation/load-deal-formulation-view-model"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

function makeSavedDealRecord(overrides: Partial<SavedDealRecord> = {}): SavedDealRecord {
  return {
    id: "deal-123",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    archived_at: null,
    address: "1 Lake View Road",
    listing_url: null,
    purchase_price: 120000,
    gdv_realistic: 200000,
    refurb_cost: 18000,
    classification: "CONDITIONAL",
    governance_state: "MANUAL_REVIEW_REQUIRED",
    capital_protection_state: "PROTECTED",
    pipeline_state: "UNDER_ANALYSIS",
    engine_result_json: {
      dueDiligence: {
        inputs: {
          stampDuty: 3600,
          legalCosts: 2000,
          saleCosts: 3000,
        },
        decision: {
          strategyRecommendation: "FLIP_ONLY_OR_RENEGOTIATE",
        },
      },
      verdict: {
        status: "GO",
      },
      deal: {
        financeCost: {
          totalFinanceCost: 12600,
        },
        totalCost: 166200,
        profit: 33800,
        profitMargin: 16.9,
      },
    },
    risk_summary_json: {},
    next_action: "Review lender criteria and solicitor evidence",
    ...overrides,
  }
}

function makeInvestorSummary(overrides: Partial<InvestorSummaryViewModel> = {}): InvestorSummaryViewModel {
  return {
    deal: {
      dealId: "deal-123",
      address: "1 Lake View Road",
    },
    purchasePrice: 125000,
    gdvRange: {
      downside: 180000,
      realistic: 200000,
      strong: 220000,
    },
    trueMao: {
      fifteenPercent: 123800,
      twentyPercent: 113800,
      twentyFivePercent: 103800,
    },
    capitalProtectionState: "SAFE",
    classification: "MARGINAL",
    investorShield: {
      overallStatus: "BLOCKED",
      missingEvidenceCount: 2,
      blockedGates: [],
    },
    activeTasks: [],
    latestOffer: {
      offerId: "offer-1",
      amount: 118000,
      offerType: "INITIAL",
      offerStatus: "PENDING",
      rationale: "Initial offer",
      sellerResponse: null,
      createdAt: "2026-07-01T12:00:00.000Z",
    },
    recommendedNextAction: {
      source: "PERSISTED_NEXT_ACTION",
      actionText: "Review lender criteria and solicitor evidence",
    },
    ...overrides,
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

describe("loadDealFormulationViewModel", () => {
  beforeEach(() => {
    vi.resetAllMocks()

    getSavedDealByIdMock.mockResolvedValue(makeSavedDealRecord())
    getInvestorSummaryForDealMock.mockResolvedValue(makeInvestorSummary())
  })

  it("returns null for blank deal ids and triggers no dependency calls", async () => {
    await expect(loadDealFormulationViewModel("   ")).resolves.toBeNull()

    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(getInvestorSummaryForDealMock).not.toHaveBeenCalled()
    expect(composeDealFormulationViewModelSpy).not.toHaveBeenCalled()
  })

  it("trims deal id before loading and gates dependent calls on saved-deal existence", async () => {
    const savedDealGate = deferred<SavedDealRecord | null>()
    getSavedDealByIdMock.mockReturnValueOnce(savedDealGate.promise)

    const loadPromise = loadDealFormulationViewModel("  deal-123  ")
    await Promise.resolve()

    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-123")
    expect(getInvestorSummaryForDealMock).not.toHaveBeenCalled()
    expect(composeDealFormulationViewModelSpy).not.toHaveBeenCalled()

    savedDealGate.resolve(makeSavedDealRecord())
    await loadPromise

    expect(getInvestorSummaryForDealMock).toHaveBeenCalledWith("deal-123")
  })

  it("returns null when saved deal is missing and stops all dependent composition work", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    await expect(loadDealFormulationViewModel(" deal-404 ")).resolves.toBeNull()

    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-404")
    expect(getInvestorSummaryForDealMock).not.toHaveBeenCalled()
    expect(composeDealFormulationViewModelSpy).not.toHaveBeenCalled()
  })

  it("propagates saved-deal query failures", async () => {
    getSavedDealByIdMock.mockRejectedValueOnce(new Error("saved deal failed"))

    await expect(loadDealFormulationViewModel("deal-123")).rejects.toThrow("saved deal failed")

    expect(getInvestorSummaryForDealMock).not.toHaveBeenCalled()
    expect(composeDealFormulationViewModelSpy).not.toHaveBeenCalled()
  })

  it("reuses canonical investor summary values and extracts canonical engine-result values without recalculation", async () => {
    const result = await loadDealFormulationViewModel("deal-123")

    expect(composeDealFormulationViewModelSpy).toHaveBeenCalledTimes(1)
    expect(composeDealFormulationViewModelSpy).toHaveBeenCalledWith({
      savedDeal: {
        dealId: "deal-123",
        address: "1 Lake View Road",
        refurbishmentCost: 18000,
        classification: "CONDITIONAL",
        capitalProtectionState: "PROTECTED",
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
        },
        verdictStatus: "GO",
        strategyRecommendation: "FLIP_ONLY_OR_RENEGOTIATE",
      },
      investorSummary: {
        purchasePrice: 120000,
        gdvRange: {
          downside: 180000,
          realistic: 200000,
          strong: 220000,
        },
        recommendedNextAction: "Review lender criteria and solicitor evidence",
      },
      latestOffer: {
        offerId: "offer-1",
        amount: 118000,
        offerType: "INITIAL",
        offerStatus: "PENDING",
        rationale: "Initial offer",
        sellerResponse: null,
        createdAt: "2026-07-01T12:00:00.000Z",
      },
      canonicalWarnings: [],
    })

    expect(result).not.toBeNull()
    expect(result?.financialSummary.purchasePrice.amount).toBe(120000)
    expect(result?.financialSummary.refurbishmentCost.amount).toBe(18000)
    expect(result?.financialSummary.financeCost.amount).toBe(12600)
    expect(result?.financialSummary.totalInvestment.amount).toBe(166200)
    expect(result?.financialSummary.projectedProfit.amount).toBe(33800)
    expect(result?.financialSummary.profitMargin).toBe(16.9)
    expect(result?.financialSummary.roi).toBeNull()
    expect(result?.offerPosition.latestRecordedOffer).toBe(118000)
    expect(result?.offerPosition.openingOffer).toBeNull()
    expect(result?.trueMao.selectedAmount).toBeNull()
  })

  it("keeps optional missing and malformed canonical values unavailable without stopping composition", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(
      makeSavedDealRecord({
        purchase_price: "bad" as unknown as SavedDealRecord["purchase_price"],
        refurb_cost: "bad" as unknown as SavedDealRecord["refurb_cost"],
        engine_result_json: {
          dueDiligence: {
            inputs: {
              stampDuty: "bad",
              legalCosts: null,
            },
            decision: {
              strategyRecommendation: null,
            },
          },
          verdict: {},
          deal: {
            financeCost: {
              totalFinanceCost: "bad",
            },
            totalCost: null,
            profit: undefined,
            profitMargin: "bad",
          },
        } as SavedDealRecord["engine_result_json"],
      })
    )
    getInvestorSummaryForDealMock.mockResolvedValueOnce(
      makeInvestorSummary({
        gdvRange: {
          downside: null,
          realistic: null,
          strong: null,
        },
        trueMao: {
          fifteenPercent: null,
          twentyPercent: null,
          twentyFivePercent: null,
        },
        latestOffer: null,
        recommendedNextAction: {
          source: "UNAVAILABLE",
          actionText: null,
        },
      })
    )

    const result = await loadDealFormulationViewModel("deal-123")

    expect(result).not.toBeNull()
    expect(result?.financialSummary.purchasePrice.amount).toBeNull()
    expect(result?.financialSummary.refurbishmentCost.amount).toBeNull()
    expect(result?.financialSummary.stampDuty.amount).toBeNull()
    expect(result?.financialSummary.legalCosts.amount).toBeNull()
    expect(result?.financialSummary.financeCost.amount).toBeNull()
    expect(result?.financialSummary.totalInvestment.amount).toBeNull()
    expect(result?.financialSummary.projectedProfit.amount).toBeNull()
    expect(result?.financialSummary.profitMargin).toBeNull()
    expect(result?.trueMao.fifteenPercent.amount).toBeNull()
    expect(result?.offerPosition.latestRecordedOffer).toBeNull()
    expect(result?.decision.verdictStatus).toBeNull()
    expect(result?.decision.strategyRecommendation).toBeNull()
    expect(result?.decision.recommendedNextAction).toBeNull()
  })

  it("keeps persisted classification separate from verdict and uses canonical next action from investor summary", async () => {
    const result = await loadDealFormulationViewModel("deal-123")

    expect(result?.decision.classification).toBe("CONDITIONAL")
    expect(result?.decision.verdictStatus).toBe("GO")
    expect(result?.decision.recommendedNextAction).toBe(
      "Review lender criteria and solicitor evidence"
    )
  })

  it("propagates canonical investor summary dependency failures and prevents partial results", async () => {
    getInvestorSummaryForDealMock.mockRejectedValueOnce(new Error("shield failed"))

    await expect(loadDealFormulationViewModel("deal-123")).rejects.toThrow("shield failed")

    expect(composeDealFormulationViewModelSpy).not.toHaveBeenCalled()
  })

  it("does not mutate canonical inputs and produces stable repeated results", async () => {
    const savedDeal = deepFreeze(makeSavedDealRecord())
    const investorSummary = deepFreeze(makeInvestorSummary())
    const savedDealSnapshot = structuredClone(savedDeal)
    const investorSummarySnapshot = structuredClone(investorSummary)

    getSavedDealByIdMock.mockResolvedValue(savedDeal)
    getInvestorSummaryForDealMock.mockResolvedValue(investorSummary)

    const first = await loadDealFormulationViewModel("deal-123")
    const second = await loadDealFormulationViewModel("deal-123")

    expect(first).toEqual(second)
    expect(savedDeal).toEqual(savedDealSnapshot)
    expect(investorSummary).toEqual(investorSummarySnapshot)
  })

  it("keeps loader read-only and avoids duplicate latest-offer selection or direct advisory dependencies", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "lib/deal-formulation/load-deal-formulation-view-model.ts"),
      "utf8"
    )

    expect(source).toContain('from "@/lib/operator-command/saved-deals-repository"')
    expect(source).toContain('from "@/lib/investor-summary/investor-summary-repository"')
    expect(source).toContain('from "@/lib/deal-formulation/extract-deal-formulation-canonical-input"')
    expect(source).toContain('from "@/lib/deal-formulation/compose-deal-formulation-view-model"')
    expect(source).toContain("getSavedDealById")
    expect(source).toContain("getInvestorSummaryForDeal")
    expect(source).not.toContain("listOffersForDeal")
    expect(source).not.toContain("selectLatestInvestorSummaryOffer")
    expect(source).not.toContain("loadAndEvaluateInvestorShield")
    expect(source).not.toContain("evidence-lite")
    expect(source).not.toContain("professional-readiness")
    expect(source).not.toContain("createSavedDeal")
    expect(source).not.toContain("updateSavedDeal")
    expect(source).not.toContain("updateOffer")
    expect(source).not.toContain("createOffer")
    expect(source).not.toContain("process.env")
    expect(source).not.toContain("DATABASE_URL")
    expect(source).not.toContain("new Pool")
    expect(source).not.toContain("fetch(")
  })
})
