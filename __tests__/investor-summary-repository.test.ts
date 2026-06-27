import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DealOfferRecord } from "@/lib/operator-command/deal-offers-repository"
import type { DealTaskRecord } from "@/lib/operator-command/deal-tasks-repository"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"

const {
  getSavedDealByIdMock,
  loadAndEvaluateInvestorShieldMock,
  listTasksForDealMock,
  listOffersForDealMock,
  composeInvestorSummaryViewModelMock,
} = vi.hoisted(() => ({
  getSavedDealByIdMock: vi.fn(),
  loadAndEvaluateInvestorShieldMock: vi.fn(),
  listTasksForDealMock: vi.fn(),
  listOffersForDealMock: vi.fn(),
  composeInvestorSummaryViewModelMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: getSavedDealByIdMock,
}))

vi.mock("@/lib/investor-shield/investor-shield-read-model", () => ({
  loadAndEvaluateInvestorShield: loadAndEvaluateInvestorShieldMock,
}))

vi.mock("@/lib/operator-command/deal-tasks-repository", () => ({
  listTasksForDeal: listTasksForDealMock,
}))

vi.mock("@/lib/operator-command/deal-offers-repository", () => ({
  listOffersForDeal: listOffersForDealMock,
}))

vi.mock("@/lib/investor-summary/compose-investor-summary-view-model", () => ({
  composeInvestorSummaryViewModel: composeInvestorSummaryViewModelMock,
}))

import { getInvestorSummaryForDeal } from "@/lib/investor-summary/investor-summary-repository"

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
    created_at: "2026-06-27T00:00:00.000Z",
    updated_at: "2026-06-27T00:00:00.000Z",
    archived_at: null,
    address: "1 Lake View Road",
    listing_url: null,
    purchase_price: 125000,
    gdv_realistic: 165000,
    refurb_cost: 18000,
    classification: "CONDITIONAL",
    governance_state: "MANUAL_REVIEW_REQUIRED",
    capital_protection_state: "PROTECTED",
    pipeline_state: "UNDER_ANALYSIS",
    engine_result_json: {
      dueDiligence: {
        gdvRange: {
          downside: 150000,
          realistic: 165000,
          strong: 180000,
        },
      },
      deal: {
        trueMao: {
          fifteenPercent: 123800,
          twentyPercent: 113800,
          twentyFivePercent: 103800,
        },
      },
    },
    risk_summary_json: {},
    next_action: "Review title evidence",
    ...overrides,
  }
}

const sampleShield: InvestorShieldEnforcementResult = {
  dealId: "deal-123",
  overallStatus: "BLOCKED",
  progressionDecision: "BLOCKED",
  canProgress: false,
  blockingGateKeys: ["TITLE", "REFURB_CERTAINTY"],
  cautionGateKeys: ["LEASEHOLD"],
  missingEvidenceGateKeys: ["TITLE", "REFURB_CERTAINTY"],
  manualOverrideRequired: true,
  advisoryOnlyEvidenceWarnings: [],
  taskRecommendations: [
    {
      gateKey: "TITLE",
      type: "REQUEST_EVIDENCE",
      title: "Collect title pack",
      reason: "Title evidence is missing.",
      severity: "BLOCKER",
      source: "system_default",
      idempotencyKey: "title-1",
    },
  ],
  blockingReasons: ["REQUIRED_GATE_MISSING"],
}

describe("getInvestorSummaryForDeal", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getSavedDealByIdMock.mockResolvedValue(makeSavedDealRecord())
    loadAndEvaluateInvestorShieldMock.mockResolvedValue(sampleShield)
    listTasksForDealMock.mockResolvedValue([])
    listOffersForDealMock.mockResolvedValue([])
    composeInvestorSummaryViewModelMock.mockReturnValue({ id: "summary" })
  })

  it("returns null for blank deal ids and does not load dependencies", async () => {
    await expect(getInvestorSummaryForDeal("   ")).resolves.toBeNull()

    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(loadAndEvaluateInvestorShieldMock).not.toHaveBeenCalled()
    expect(listTasksForDealMock).not.toHaveBeenCalled()
    expect(listOffersForDealMock).not.toHaveBeenCalled()
    expect(composeInvestorSummaryViewModelMock).not.toHaveBeenCalled()
  })

  it("returns null when the saved deal is missing and does not start downstream reads", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    await expect(getInvestorSummaryForDeal(" deal-404 ")).resolves.toBeNull()

    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-404")
    expect(loadAndEvaluateInvestorShieldMock).not.toHaveBeenCalled()
    expect(listTasksForDealMock).not.toHaveBeenCalled()
    expect(listOffersForDealMock).not.toHaveBeenCalled()
    expect(composeInvestorSummaryViewModelMock).not.toHaveBeenCalled()
  })

  it("loads shield, tasks, and offers only after saved deal existence is confirmed", async () => {
    const shieldGate = deferred<InvestorShieldEnforcementResult>()
    const tasksGate = deferred<readonly DealTaskRecord[]>()
    const offersGate = deferred<readonly DealOfferRecord[]>()

    getSavedDealByIdMock.mockResolvedValueOnce(
      makeSavedDealRecord({
        engine_result_json: {
          dueDiligence: {
            gdvRange: {
              downside: 150000,
              realistic: 165000,
              strong: 180000,
            },
          },
          deal: {
            trueMao: {
              fifteenPercent: 123800,
              twentyPercent: 113800,
              twentyFivePercent: 103800,
            },
          },
        },
      })
    )
    loadAndEvaluateInvestorShieldMock.mockReturnValueOnce(shieldGate.promise)
    listTasksForDealMock.mockReturnValueOnce(tasksGate.promise)
    listOffersForDealMock.mockReturnValueOnce(offersGate.promise)

    const summaryPromise = getInvestorSummaryForDeal("  deal-123  ")
    await Promise.resolve()

    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-123")
    expect(loadAndEvaluateInvestorShieldMock).toHaveBeenCalledWith("deal-123")
    expect(listTasksForDealMock).toHaveBeenCalledWith("deal-123")
    expect(listOffersForDealMock).toHaveBeenCalledWith("deal-123")
    expect(composeInvestorSummaryViewModelMock).not.toHaveBeenCalled()

    shieldGate.resolve(sampleShield)
    tasksGate.resolve([])
    offersGate.resolve([])
    await summaryPromise
  })

  it("passes canonical saved-deal values, shield summary input, tasks, and offers to the composer", async () => {
    const taskRecords: readonly DealTaskRecord[] = [
      {
        id: "task-1",
        deal_id: "deal-123",
        task_title: "Collect title pack",
        task_type: "DUE_DILIGENCE",
        task_status: "OPEN",
        priority: "HIGH",
        due_date: null,
        blocker_reason: null,
        created_at: "2026-06-27T01:00:00.000Z",
        completed_at: null,
      },
    ]
    const offerRecords: readonly DealOfferRecord[] = [
      {
        id: "offer-1",
        deal_id: "deal-123",
        offer_amount: 118000,
        offer_type: "INITIAL",
        offer_status: "PENDING",
        offer_rationale: "Initial offer",
        seller_response: null,
        created_at: "2026-06-27T02:00:00.000Z",
      },
    ]

    getSavedDealByIdMock.mockResolvedValueOnce(
      makeSavedDealRecord({
        next_action: "  Persisted next action  ",
      })
    )
    loadAndEvaluateInvestorShieldMock.mockResolvedValueOnce(sampleShield)
    listTasksForDealMock.mockResolvedValueOnce(taskRecords)
    listOffersForDealMock.mockResolvedValueOnce(offerRecords)

    const result = await getInvestorSummaryForDeal("deal-123")

    expect(composeInvestorSummaryViewModelMock).toHaveBeenCalledWith({
      savedDeal: {
        dealId: "deal-123",
        address: "1 Lake View Road",
        purchasePrice: 125000,
        classification: "CONDITIONAL",
        capitalProtectionState: "PROTECTED",
        persistedNextAction: "  Persisted next action  ",
      },
      canonicalValues: {
        gdvRange: {
          downside: 150000,
          realistic: 165000,
          strong: 180000,
        },
        trueMao: {
          fifteenPercent: 123800,
          twentyPercent: 113800,
          twentyFivePercent: 103800,
        },
      },
      investorShield: {
        overallStatus: "BLOCKED",
        missingEvidenceCount: 2,
        blockedGates: [
          { gateKey: "TITLE", label: "Title Review", gateType: "required" },
          { gateKey: "REFURB_CERTAINTY", label: "Refurb Certainty", gateType: "required" },
        ],
        fallbackRecommendedActionTitle: "Collect title pack",
      },
      taskRecords,
      offerRecords,
    })
    expect(result).toEqual({ id: "summary" })
  })

  it("preserves null canonical values when the engine JSON is missing or malformed", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(
      makeSavedDealRecord({
        engine_result_json: {
          dueDiligence: null,
          deal: { trueMao: { fifteenPercent: "bad" } },
        },
      })
    )
    loadAndEvaluateInvestorShieldMock.mockResolvedValueOnce(sampleShield)

    await getInvestorSummaryForDeal("deal-123")

    expect(composeInvestorSummaryViewModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalValues: {
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
        },
      })
    )
  })

  it("propagates infrastructure failures from the saved deal lookup", async () => {
    getSavedDealByIdMock.mockRejectedValueOnce(new Error("saved deal failed"))

    await expect(getInvestorSummaryForDeal("deal-123")).rejects.toThrow("saved deal failed")

    expect(loadAndEvaluateInvestorShieldMock).not.toHaveBeenCalled()
    expect(listTasksForDealMock).not.toHaveBeenCalled()
    expect(listOffersForDealMock).not.toHaveBeenCalled()
    expect(composeInvestorSummaryViewModelMock).not.toHaveBeenCalled()
  })

  it("propagates downstream infrastructure failures without returning a partial summary", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(makeSavedDealRecord())
    loadAndEvaluateInvestorShieldMock.mockRejectedValueOnce(new Error("shield failed"))
    listTasksForDealMock.mockResolvedValueOnce([])
    listOffersForDealMock.mockResolvedValueOnce([])

    await expect(getInvestorSummaryForDeal("deal-123")).rejects.toThrow("shield failed")

    expect(composeInvestorSummaryViewModelMock).not.toHaveBeenCalled()
  })
})
