import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as packComposerModule from "@/lib/pdf-evidence-pack/compose-pdf-evidence-pack"
import * as evidenceProjectionModule from "@/lib/pdf-evidence-pack/project-evidence-lite-record-to-pdf-evidence-item"
import * as summaryComposerModule from "@/lib/investor-summary/compose-investor-summary-view-model"
import type { DealOfferRecord } from "@/lib/operator-command/deal-offers-repository"
import type { DealTaskRecord } from "@/lib/operator-command/deal-tasks-repository"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { EvidenceLiteRecord } from "@/types/evidence-lite"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"

const {
  getSavedDealByIdMock,
  loadAndEvaluateInvestorShieldMock,
  listTasksForDealMock,
  listOffersForDealMock,
  listEvidenceLiteForDealMock,
} = vi.hoisted(() => ({
  getSavedDealByIdMock: vi.fn(),
  loadAndEvaluateInvestorShieldMock: vi.fn(),
  listTasksForDealMock: vi.fn(),
  listOffersForDealMock: vi.fn(),
  listEvidenceLiteForDealMock: vi.fn(),
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

vi.mock("@/lib/evidence-lite/evidence-lite-repository", () => ({
  listEvidenceLiteForDeal: listEvidenceLiteForDealMock,
}))

import { loadPdfEvidencePackForDeal } from "@/lib/pdf-evidence-pack/load-pdf-evidence-pack"

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
    next_action: "  Review title evidence  ",
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

const sampleTasks: readonly DealTaskRecord[] = [
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

const sampleOffers: readonly DealOfferRecord[] = [
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

const sampleEvidenceRecords: readonly EvidenceLiteRecord[] = [
  {
    id: "evidence_b",
    dealId: "deal-123",
    evidenceType: "TITLE_REVIEW",
    linkedGate: "TITLE",
    title: "Title pack",
    note: "Canonical title review note",
    status: "REVIEWED",
    reviewed: true,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T11:00:00.000Z",
  },
  {
    id: "evidence_a",
    dealId: "deal-123",
    evidenceType: "LENDER_NOTE",
    linkedGate: "LENDER_CRITERIA",
    title: "Lender criteria note",
    note: "Canonical lender criteria note",
    status: "RECORDED",
    reviewed: false,
    createdAt: "2026-06-22T09:00:00.000Z",
    updatedAt: "2026-06-22T09:30:00.000Z",
  },
]

const emptyShield: InvestorShieldEnforcementResult = {
  ...sampleShield,
  overallStatus: "CLEAR",
  progressionDecision: "CAN_PROGRESS",
  canProgress: true,
  blockingGateKeys: [],
  cautionGateKeys: [],
  missingEvidenceGateKeys: [],
  manualOverrideRequired: false,
  advisoryOnlyEvidenceWarnings: [],
  taskRecommendations: [],
  blockingReasons: [],
}

const expectedDisclaimerCodes = [
  "informational-decision-support",
  "not-legal-advice",
  "not-valuation",
  "not-structural-survey",
  "not-lender-approval",
  "not-planning-or-building-control-certificate",
  "not-solicitor-substitute",
  "data-may-be-incomplete-or-stale",
  "evidence-does-not-prove-gate-satisfaction",
  "manual-overrides-remain-visible",
] as const

describe("loadPdfEvidencePackForDeal", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    getSavedDealByIdMock.mockReset()
    loadAndEvaluateInvestorShieldMock.mockReset()
    listTasksForDealMock.mockReset()
    listOffersForDealMock.mockReset()
    listEvidenceLiteForDealMock.mockReset()

    getSavedDealByIdMock.mockResolvedValue(makeSavedDealRecord())
    loadAndEvaluateInvestorShieldMock.mockResolvedValue(sampleShield)
    listTasksForDealMock.mockResolvedValue(sampleTasks)
    listOffersForDealMock.mockResolvedValue(sampleOffers)
    listEvidenceLiteForDealMock.mockResolvedValue(sampleEvidenceRecords)
  })

  it("returns null for blank deal ids and does not start downstream reads", async () => {
    await expect(
      loadPdfEvidencePackForDeal({
        dealId: "   ",
        generatedAt: "2026-06-27T12:00:00.000Z",
        confidentialityLabel: "INTERNAL USE ONLY",
      })
    ).resolves.toBeNull()

    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(loadAndEvaluateInvestorShieldMock).not.toHaveBeenCalled()
    expect(listTasksForDealMock).not.toHaveBeenCalled()
    expect(listOffersForDealMock).not.toHaveBeenCalled()
    expect(listEvidenceLiteForDealMock).not.toHaveBeenCalled()
  })

  it("returns null when the saved deal is missing and stops before dependent reads", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    await expect(
      loadPdfEvidencePackForDeal({
        dealId: "  deal-404  ",
        generatedAt: "2026-06-27T12:00:00.000Z",
        confidentialityLabel: "INTERNAL USE ONLY",
      })
    ).resolves.toBeNull()

    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-404")
    expect(loadAndEvaluateInvestorShieldMock).not.toHaveBeenCalled()
    expect(listTasksForDealMock).not.toHaveBeenCalled()
    expect(listOffersForDealMock).not.toHaveBeenCalled()
    expect(listEvidenceLiteForDealMock).not.toHaveBeenCalled()
  })

  it("starts the post-gate reads concurrently and preserves canonical orchestration", async () => {
    const summaryComposerSpy = vi.spyOn(summaryComposerModule, "composeInvestorSummaryViewModel")
    const packComposerSpy = vi.spyOn(packComposerModule, "composePdfEvidencePack")
    const projectionSpy = vi.spyOn(
      evidenceProjectionModule,
      "projectEvidenceLiteRecordToPdfEvidenceItem"
    )

    const shieldGate = deferred<InvestorShieldEnforcementResult>()
    const tasksGate = deferred<readonly DealTaskRecord[]>()
    const offersGate = deferred<readonly DealOfferRecord[]>()
    const evidenceGate = deferred<readonly EvidenceLiteRecord[]>()

    getSavedDealByIdMock.mockResolvedValueOnce(
      makeSavedDealRecord({
        next_action: "  Review title evidence  ",
      })
    )
    loadAndEvaluateInvestorShieldMock.mockReturnValueOnce(shieldGate.promise)
    listTasksForDealMock.mockReturnValueOnce(tasksGate.promise)
    listOffersForDealMock.mockReturnValueOnce(offersGate.promise)
    listEvidenceLiteForDealMock.mockReturnValueOnce(evidenceGate.promise)

    const packPromise = loadPdfEvidencePackForDeal({
      dealId: "  deal-123  ",
      generatedAt: "2026-06-27T12:00:00.000Z",
      confidentialityLabel: "INTERNAL USE ONLY",
    })

    await Promise.resolve()

    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-123")
    expect(loadAndEvaluateInvestorShieldMock).toHaveBeenCalledWith("deal-123")
    expect(listTasksForDealMock).toHaveBeenCalledWith("deal-123")
    expect(listOffersForDealMock).toHaveBeenCalledWith("deal-123")
    expect(listEvidenceLiteForDealMock).toHaveBeenCalledWith("deal-123")
    expect(summaryComposerSpy).not.toHaveBeenCalled()
    expect(packComposerSpy).not.toHaveBeenCalled()

    shieldGate.resolve(sampleShield)
    tasksGate.resolve(sampleTasks)
    offersGate.resolve(sampleOffers)
    evidenceGate.resolve(sampleEvidenceRecords)

    const pack = await packPromise

    expect(summaryComposerSpy).toHaveBeenCalledWith({
      savedDeal: {
        dealId: "deal-123",
        address: "1 Lake View Road",
        purchasePrice: 125000,
        classification: "CONDITIONAL",
        capitalProtectionState: "PROTECTED",
        persistedNextAction: "  Review title evidence  ",
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
      taskRecords: sampleTasks,
      offerRecords: sampleOffers,
    })
    expect(projectionSpy.mock.calls.map(([record]) => record.id)).toEqual([
      "evidence_b",
      "evidence_a",
    ])
    expect(packComposerSpy).toHaveBeenCalledWith({
      generatedAt: "2026-06-27T12:00:00.000Z",
      confidentialityLabel: "INTERNAL USE ONLY",
      investorSummary: summaryComposerSpy.mock.results[0]?.value,
      investorShield: sampleShield,
      evidenceIndex: projectionSpy.mock.results.map((entry) => entry.value),
      disclaimers: expect.any(Array),
    })

    expect(pack.meta.savedDealId).toBe("deal-123")
    expect(pack.meta.generatedAt).toBe("2026-06-27T12:00:00.000Z")
    expect(pack.meta.confidentialityLabel).toBe("INTERNAL USE ONLY")
    expect(pack.identity).toEqual({ dealId: "deal-123", address: "1 Lake View Road" })
    expect(pack.investorSummary).toBe(summaryComposerSpy.mock.results[0]?.value)
    expect(pack.investorSummary.recommendedNextAction).toEqual({
      source: "PERSISTED_NEXT_ACTION",
      actionText: "Review title evidence",
    })
    expect(pack.investorShield).toBe(sampleShield)
    expect(pack.evidenceIndex).toEqual(projectionSpy.mock.results.map((entry) => entry.value))
    expect(pack.disclaimers.map((entry) => entry.code)).toEqual(expectedDisclaimerCodes)
    expect(pack.disclaimers.every((entry) => entry.required)).toBe(true)
  })

  it("keeps empty Evidence Lite as an empty pack index", async () => {
    const projectionSpy = vi.spyOn(
      evidenceProjectionModule,
      "projectEvidenceLiteRecordToPdfEvidenceItem"
    )

    getSavedDealByIdMock.mockResolvedValueOnce(
      makeSavedDealRecord({
        next_action: null,
      })
    )
    loadAndEvaluateInvestorShieldMock.mockResolvedValueOnce(emptyShield)
    listTasksForDealMock.mockResolvedValueOnce([])
    listOffersForDealMock.mockResolvedValueOnce([])
    listEvidenceLiteForDealMock.mockResolvedValueOnce([])

    const pack = await loadPdfEvidencePackForDeal({
      dealId: "deal-123",
      generatedAt: "2026-06-27T12:30:00.000Z",
      confidentialityLabel: "INTERNAL USE ONLY",
    })

    expect(projectionSpy).not.toHaveBeenCalled()
    expect(pack).not.toBeNull()
    expect(pack?.evidenceIndex).toEqual([])
    expect(pack?.investorSummary.activeTasks).toEqual([])
    expect(pack?.investorSummary.latestOffer).toBeNull()
    expect(pack?.investorSummary.recommendedNextAction).toEqual({
      source: "UNAVAILABLE",
      actionText: null,
    })
  })

  it("propagates dependency failures without composing a partial pack", async () => {
    const summaryComposerSpy = vi.spyOn(summaryComposerModule, "composeInvestorSummaryViewModel")
    const packComposerSpy = vi.spyOn(packComposerModule, "composePdfEvidencePack")

    getSavedDealByIdMock.mockResolvedValueOnce(makeSavedDealRecord())
    loadAndEvaluateInvestorShieldMock.mockRejectedValueOnce(new Error("shield failed"))
    listTasksForDealMock.mockResolvedValueOnce(sampleTasks)
    listOffersForDealMock.mockResolvedValueOnce(sampleOffers)
    listEvidenceLiteForDealMock.mockResolvedValueOnce(sampleEvidenceRecords)

    await expect(
      loadPdfEvidencePackForDeal({
        dealId: "deal-123",
        generatedAt: "2026-06-27T13:00:00.000Z",
        confidentialityLabel: "INTERNAL USE ONLY",
      })
    ).rejects.toThrow("shield failed")

    expect(summaryComposerSpy).not.toHaveBeenCalled()
    expect(packComposerSpy).not.toHaveBeenCalled()
  })

  it("keeps the loader source on repositories and pure helpers only", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "lib/pdf-evidence-pack/load-pdf-evidence-pack.ts"),
      "utf8"
    )

    expect(source).toContain('from "@/lib/operator-command/saved-deals-repository"')
    expect(source).toContain('from "@/lib/investor-shield/investor-shield-read-model"')
    expect(source).toContain('from "@/lib/operator-command/deal-tasks-repository"')
    expect(source).toContain('from "@/lib/operator-command/deal-offers-repository"')
    expect(source).toContain('from "@/lib/evidence-lite/evidence-lite-repository"')
    expect(source).toContain("Promise.all")
    expect(source).toContain("getSavedDealById")
    expect(source).toContain("loadAndEvaluateInvestorShield")
    expect(source).toContain("listTasksForDeal")
    expect(source).toContain("listOffersForDeal")
    expect(source).toContain("listEvidenceLiteForDeal")
    expect(source).toContain("composeInvestorSummaryViewModel")
    expect(source).toContain("projectEvidenceLiteRecordToPdfEvidenceItem")
    expect(source).toContain("composePdfEvidencePack")
    expect(source).not.toContain("pdf-evidence-pack-assembly")
    expect(source).not.toContain("getInvestorSummaryForDeal")
    expect(source).not.toContain("route.ts")
    expect(source).not.toContain("fetch(")
    expect(source).not.toContain("render(")
    expect(source).not.toContain("query(")
    expect(source).not.toContain("new Pool")
    expect(source).not.toContain("DATABASE_URL")
  })
})
