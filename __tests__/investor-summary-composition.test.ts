import { describe, expect, it } from "vitest"
import type { DealOfferRecord } from "@/lib/operator-command/deal-offers-repository"
import type { DealTaskRecord } from "@/lib/operator-command/deal-tasks-repository"
import {
  INVESTOR_SUMMARY_BLOCKED_FIXTURE,
  INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE,
  INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE,
} from "./fixtures/investor-summary-fixtures"
import {
  composeInvestorSummaryViewModel,
  type InvestorSummaryCompositionInput,
} from "@/lib/investor-summary/compose-investor-summary-view-model"

function makeTaskRecord(overrides: Partial<DealTaskRecord> = {}): DealTaskRecord {
  return {
    id: "task-base",
    deal_id: "deal-summary-blocked-001",
    task_title: "Confirm finance blocker evidence",
    task_type: "MANUAL_REVIEW",
    task_status: "IN_PROGRESS",
    priority: "HIGH",
    due_date: "2026-01-19T17:00:00.000Z",
    blocker_reason: "Awaiting finance confirmation",
    created_at: "2026-01-16T11:05:00.000Z",
    completed_at: null,
    ...overrides,
  }
}

function makeOfferRecord(overrides: Partial<DealOfferRecord> = {}): DealOfferRecord {
  return {
    id: "offer-base",
    deal_id: "deal-summary-blocked-001",
    offer_amount: 100000,
    offer_type: "INITIAL",
    offer_status: "DRAFT",
    offer_rationale: "Initial offer",
    seller_response: null,
    created_at: "2026-01-17T08:45:00.000Z",
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

function buildInput(
  fixture:
    | typeof INVESTOR_SUMMARY_BLOCKED_FIXTURE
    | typeof INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE
    | typeof INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE,
  overrides: Partial<InvestorSummaryCompositionInput> = {}
): InvestorSummaryCompositionInput {
  return {
    savedDeal: {
      dealId: fixture.deal.dealId,
      address: fixture.deal.address,
      purchasePrice: fixture.purchasePrice,
      classification: fixture.classification,
      capitalProtectionState: fixture.capitalProtectionState,
      persistedNextAction: fixture.recommendedNextAction.actionText,
      ...(overrides.savedDeal ?? {}),
    },
    canonicalValues: {
      gdvRange: fixture.gdvRange,
      trueMao: fixture.trueMao,
      ...(overrides.canonicalValues ?? {}),
    },
    investorShield: {
      overallStatus: fixture.investorShield.overallStatus,
      missingEvidenceCount: fixture.investorShield.missingEvidenceCount,
      blockedGates: fixture.investorShield.blockedGates,
      fallbackRecommendedActionTitle: fixture.recommendedNextAction.actionText,
      ...(overrides.investorShield ?? {}),
    },
    taskRecords: overrides.taskRecords ?? [],
    offerRecords: overrides.offerRecords ?? [],
  }
}

describe("composeInvestorSummaryViewModel", () => {
  it("produces the expected complete investor summary view model from prepared input", () => {
    const input = buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
      taskRecords: [
        makeTaskRecord({ id: "task-complete", task_status: "COMPLETE" }),
        makeTaskRecord({
          id: "task-summary-blocked-001",
          task_title: "Collect title pack",
          task_type: "DUE_DILIGENCE",
          task_status: "OPEN",
          priority: "HIGH",
          due_date: "2026-06-12",
          blocker_reason: "Waiting on legal documents.",
          created_at: "2026-06-10T09:00:00.000Z",
        }),
        makeTaskRecord({
          id: "task-summary-blocked-002",
          task_title: "Request builder quote",
          task_type: "EVIDENCE",
          task_status: "IN_PROGRESS",
          priority: "MEDIUM",
          due_date: null,
          blocker_reason: null,
          created_at: "2026-06-10T10:15:00.000Z",
        }),
        makeTaskRecord({ id: "task-cancelled", task_status: "CANCELLED" }),
      ],
      offerRecords: [
        makeOfferRecord({
          id: "offer-summary-blocked-001",
          offer_amount: 118000,
          offer_type: "INITIAL",
          offer_status: "PENDING",
          offer_rationale: "Initial offer with evidence caveat.",
          seller_response: null,
          created_at: "2026-06-11T08:30:00.000Z",
        }),
        makeOfferRecord({
          id: "offer-older",
          offer_amount: 140000,
          offer_status: "ACCEPTED",
          created_at: "2026-01-18T08:45:00.000Z",
        }),
      ],
    })

    expect(composeInvestorSummaryViewModel(input)).toEqual(INVESTOR_SUMMARY_BLOCKED_FIXTURE)
  })

  it("reflects active-task selector output in the final view model", () => {
    const input = buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
      taskRecords: [
        makeTaskRecord({ id: "task-complete", task_status: "COMPLETE" }),
        makeTaskRecord({ id: "task-1", task_status: "OPEN" }),
        makeTaskRecord({ id: "task-2", task_status: "BLOCKED" }),
        makeTaskRecord({ id: "task-3", task_status: "IN_PROGRESS" }),
        makeTaskRecord({ id: "task-cancelled", task_status: "CANCELLED" }),
      ],
      offerRecords: [makeOfferRecord({ id: "offer-latest" })],
    })

    expect(composeInvestorSummaryViewModel(input).activeTasks.map((task) => task.taskId)).toEqual([
      "task-1",
      "task-2",
      "task-3",
    ])
  })

  it("omits COMPLETE and CANCELLED tasks from the final active-task collection", () => {
    const input = buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
      taskRecords: [
        makeTaskRecord({ id: "task-complete", task_status: "COMPLETE" }),
        makeTaskRecord({ id: "task-open", task_status: "OPEN" }),
        makeTaskRecord({ id: "task-cancelled", task_status: "CANCELLED" }),
      ],
      offerRecords: [makeOfferRecord({ id: "offer-latest" })],
    })

    const result = composeInvestorSummaryViewModel(input)

    expect(result.activeTasks.map((task) => task.status)).not.toContain("COMPLETE")
    expect(result.activeTasks.map((task) => task.status)).not.toContain("CANCELLED")
  })

  it("preserves task input order after terminal tasks are removed", () => {
    const input = buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
      taskRecords: [
        makeTaskRecord({ id: "task-complete", task_status: "COMPLETE" }),
        makeTaskRecord({ id: "task-first", task_status: "OPEN" }),
        makeTaskRecord({ id: "task-cancelled", task_status: "CANCELLED" }),
        makeTaskRecord({ id: "task-second", task_status: "BLOCKED" }),
        makeTaskRecord({ id: "task-third", task_status: "IN_PROGRESS" }),
      ],
      offerRecords: [makeOfferRecord({ id: "offer-latest" })],
    })

    expect(composeInvestorSummaryViewModel(input).activeTasks.map((task) => task.taskId)).toEqual([
      "task-first",
      "task-second",
      "task-third",
    ])
  })

  it("selects the first supplied offer as the final latest offer", () => {
    const input = buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
      taskRecords: [],
      offerRecords: [
        makeOfferRecord({
          id: "offer-first",
          offer_amount: 90000,
          offer_status: "DRAFT",
        }),
        makeOfferRecord({
          id: "offer-second",
          offer_amount: 250000,
          offer_status: "ACCEPTED",
          created_at: "2026-01-18T08:45:00.000Z",
        }),
      ],
    })

    expect(composeInvestorSummaryViewModel(input).latestOffer?.offerId).toBe("offer-first")
  })

  it("does not select the highest offer when it is not first", () => {
    const input = buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
      taskRecords: [],
      offerRecords: [
        makeOfferRecord({
          id: "offer-low",
          offer_amount: 50000,
          offer_status: "DRAFT",
        }),
        makeOfferRecord({
          id: "offer-high",
          offer_amount: 250000,
          offer_status: "PENDING",
        }),
      ],
    })

    expect(composeInvestorSummaryViewModel(input).latestOffer?.amount).toBe(50000)
  })

  it("returns an empty active-task collection for empty task input", () => {
    const input = buildInput(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE, {
      taskRecords: [],
      offerRecords: [makeOfferRecord({ id: "offer-latest" })],
    })

    expect(composeInvestorSummaryViewModel(input).activeTasks).toEqual([])
  })

  it("returns null latestOffer for empty offer input", () => {
    const input = buildInput(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE, {
      taskRecords: [makeTaskRecord({ id: "task-open", task_status: "OPEN" })],
      offerRecords: [],
    })

    expect(composeInvestorSummaryViewModel(input).latestOffer).toBeNull()
  })

  it("keeps persisted next action ahead of Shield fallback", () => {
    const input = buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
      savedDeal: {
        persistedNextAction: "  Persisted action wins  ",
      },
      investorShield: {
        fallbackRecommendedActionTitle: "Fallback should lose",
      },
      taskRecords: [makeTaskRecord({ id: "task-open", task_status: "OPEN" })],
      offerRecords: [makeOfferRecord({ id: "offer-latest" })],
    })

    expect(composeInvestorSummaryViewModel(input).recommendedNextAction).toEqual({
      source: "PERSISTED_NEXT_ACTION",
      actionText: "Persisted action wins",
    })
  })

  it("uses Shield fallback when persisted next action is absent", () => {
    const input = buildInput(INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE, {
      savedDeal: {
        persistedNextAction: null,
      },
      investorShield: {
        fallbackRecommendedActionTitle: "  Request lender criteria evidence  ",
      },
      taskRecords: [],
      offerRecords: [makeOfferRecord({ id: "offer-latest", offer_status: "PENDING" })],
    })

    expect(composeInvestorSummaryViewModel(input).recommendedNextAction).toEqual({
      source: "INVESTOR_SHIELD_FALLBACK",
      actionText: "Request lender criteria evidence",
    })
  })

  it("uses the explicit unavailable action when both actions are absent", () => {
    const input = buildInput(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE, {
      savedDeal: {
        persistedNextAction: "   ",
      },
      investorShield: {
        fallbackRecommendedActionTitle: " ",
      },
      taskRecords: [],
      offerRecords: [],
    })

    expect(composeInvestorSummaryViewModel(input).recommendedNextAction).toEqual({
      source: "UNAVAILABLE",
      actionText: null,
    })
  })

  it("does not mutate task arrays, task records, offer arrays, or offer records", () => {
    const input = deepFreeze(
      buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
        taskRecords: [
          makeTaskRecord({ id: "task-1", task_status: "OPEN" }),
          makeTaskRecord({ id: "task-2", task_status: "COMPLETE" }),
        ],
        offerRecords: [
          makeOfferRecord({ id: "offer-1", offer_amount: 100000 }),
          makeOfferRecord({ id: "offer-2", offer_amount: 150000 }),
        ],
      })
    )
    const snapshot = structuredClone(input)

    composeInvestorSummaryViewModel(input)

    expect(input).toEqual(snapshot)
  })

  it("does not mutate other prepared input objects", () => {
    const input = deepFreeze(
      buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
        taskRecords: [makeTaskRecord({ id: "task-open", task_status: "OPEN" })],
        offerRecords: [makeOfferRecord({ id: "offer-latest" })],
      })
    )
    const snapshot = structuredClone(input)

    composeInvestorSummaryViewModel(input)

    expect(input.savedDeal).toEqual(snapshot.savedDeal)
    expect(input.canonicalValues).toEqual(snapshot.canonicalValues)
    expect(input.investorShield).toEqual(snapshot.investorShield)
  })
})
