import { describe, expect, it } from "vitest"
import {
  INVESTOR_SUMMARY_BLOCKED_FIXTURE,
  INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE,
  INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE,
} from "./fixtures/investor-summary-fixtures"
import {
  mapInvestorSummaryViewModel,
  type InvestorSummaryMapperInput,
} from "@/lib/investor-summary/map-investor-summary-view-model"

function buildInput(
  fixture:
    | typeof INVESTOR_SUMMARY_BLOCKED_FIXTURE
    | typeof INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE
    | typeof INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE,
  overrides: Partial<InvestorSummaryMapperInput> = {}
): InvestorSummaryMapperInput {
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
      ...(overrides.investorShield ?? {}),
    },
    activeTasks: overrides.activeTasks ?? fixture.activeTasks,
    latestOffer: Object.prototype.hasOwnProperty.call(overrides, "latestOffer")
      ? overrides.latestOffer ?? null
      : fixture.latestOffer,
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

describe("mapInvestorSummaryViewModel", () => {
  it("maps complete canonical input to the complete fixture", () => {
    const input = buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
      savedDeal: {
        persistedNextAction: INVESTOR_SUMMARY_BLOCKED_FIXTURE.recommendedNextAction.actionText,
      },
      investorShield: {
        fallbackRecommendedActionTitle: "Unused fallback",
      },
    })

    expect(mapInvestorSummaryViewModel(input)).toEqual(INVESTOR_SUMMARY_BLOCKED_FIXTURE)
  })

  it("preserves null monetary values", () => {
    const input = buildInput(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE, {
      savedDeal: {
        persistedNextAction: null,
      },
      investorShield: {
        fallbackRecommendedActionTitle: null,
      },
      latestOffer: null,
    })

    const result = mapInvestorSummaryViewModel(input)

    expect(result.purchasePrice).toBeNull()
    expect(result.gdvRange).toEqual({
      downside: null,
      realistic: null,
      strong: null,
    })
    expect(result.trueMao).toEqual({
      fifteenPercent: null,
      twentyPercent: null,
      twentyFivePercent: null,
    })
  })

  it("preserves partial monetary values independently", () => {
    const input = buildInput(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE, {
      savedDeal: {
        purchasePrice: 0,
        persistedNextAction: null,
      },
      canonicalValues: {
        gdvRange: {
          downside: null,
          realistic: 200000,
          strong: null,
        },
        trueMao: {
          fifteenPercent: null,
          twentyPercent: 0,
          twentyFivePercent: 103800,
        },
      },
      investorShield: {
        fallbackRecommendedActionTitle: null,
      },
      latestOffer: {
        offerId: "offer-zero",
        amount: 0,
        offerType: "INITIAL",
        offerStatus: "DRAFT",
        rationale: null,
        sellerResponse: null,
        createdAt: "2026-01-17T08:45:00.000Z",
      },
    })

    const result = mapInvestorSummaryViewModel(input)

    expect(result.purchasePrice).toBe(0)
    expect(result.gdvRange).toEqual({
      downside: null,
      realistic: 200000,
      strong: null,
    })
    expect(result.trueMao).toEqual({
      fifteenPercent: null,
      twentyPercent: 0,
      twentyFivePercent: 103800,
    })
    expect(result.latestOffer?.amount).toBe(0)
  })

  it("does not infer missing monetary values from purchase price or latest offer", () => {
    const input = buildInput(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE, {
      savedDeal: {
        purchasePrice: 175000,
        persistedNextAction: null,
      },
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
      investorShield: {
        fallbackRecommendedActionTitle: null,
      },
      latestOffer: {
        offerId: "offer-1",
        amount: 250000,
        offerType: "INITIAL",
        offerStatus: "DRAFT",
        rationale: null,
        sellerResponse: null,
        createdAt: "2026-01-17T08:45:00.000Z",
      },
    })

    const result = mapInvestorSummaryViewModel(input)

    expect(result.trueMao).toEqual({
      fifteenPercent: null,
      twentyPercent: null,
      twentyFivePercent: null,
    })
    expect(result.gdvRange).toEqual({
      downside: null,
      realistic: null,
      strong: null,
    })
  })

  it("uses persisted next action ahead of Shield fallback", () => {
    const input = buildInput(INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE, {
      savedDeal: {
        persistedNextAction: "  Persisted action wins  ",
      },
      investorShield: {
        fallbackRecommendedActionTitle: "Fallback should lose",
      },
    })

    expect(mapInvestorSummaryViewModel(input).recommendedNextAction).toEqual({
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
    })

    expect(mapInvestorSummaryViewModel(input).recommendedNextAction).toEqual({
      source: "INVESTOR_SHIELD_FALLBACK",
      actionText: "Request lender criteria evidence",
    })
  })

  it("uses explicit unavailable action when persisted and fallback actions are absent", () => {
    const input = buildInput(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE, {
      savedDeal: {
        persistedNextAction: "   ",
      },
      investorShield: {
        fallbackRecommendedActionTitle: " ",
      },
    })

    expect(mapInvestorSummaryViewModel(input).recommendedNextAction).toEqual({
      source: "UNAVAILABLE",
      actionText: null,
    })
  })

  it("preserves recommended-action source values and whitespace-only shield fallback as unavailable", () => {
    const persisted = buildInput(INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE, {
      savedDeal: {
        persistedNextAction: "  Persisted action wins  ",
      },
      investorShield: {
        fallbackRecommendedActionTitle: "  Shield fallback  ",
      },
    })

    expect(mapInvestorSummaryViewModel(persisted).recommendedNextAction.source).toBe(
      "PERSISTED_NEXT_ACTION"
    )

    const shieldFallback = buildInput(INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE, {
      savedDeal: {
        persistedNextAction: null,
      },
      investorShield: {
        fallbackRecommendedActionTitle: "  Shield fallback  ",
      },
    })

    expect(mapInvestorSummaryViewModel(shieldFallback).recommendedNextAction.source).toBe(
      "INVESTOR_SHIELD_FALLBACK"
    )

    const unavailable = buildInput(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE, {
      savedDeal: {
        persistedNextAction: "   ",
      },
      investorShield: {
        fallbackRecommendedActionTitle: " ",
      },
    })

    expect(mapInvestorSummaryViewModel(unavailable).recommendedNextAction.source).toBe(
      "UNAVAILABLE"
    )
  })

  it("does not concatenate persisted and Shield actions or let tasks and offers influence the action", () => {
    const input = buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
      savedDeal: {
        persistedNextAction: "Persisted action",
      },
      investorShield: {
        fallbackRecommendedActionTitle: "Shield fallback",
      },
      activeTasks: [
        {
          taskId: "task-1",
          title: "Task should not influence action",
          taskType: "DUE_DILIGENCE",
          status: "OPEN",
          priority: "HIGH",
          dueDate: null,
          blockerReason: null,
          createdAt: "2026-06-10T09:00:00.000Z",
          completedAt: null,
        },
      ],
      latestOffer: {
        offerId: "offer-1",
        amount: 250000,
        offerType: "INITIAL",
        offerStatus: "ACCEPTED",
        rationale: null,
        sellerResponse: null,
        createdAt: "2026-06-11T08:30:00.000Z",
      },
    })

    expect(mapInvestorSummaryViewModel(input).recommendedNextAction).toEqual({
      source: "PERSISTED_NEXT_ACTION",
      actionText: "Persisted action",
    })
  })

  it("preserves empty blocked gates, tasks, and latest offer", () => {
    const input = buildInput(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE, {
      savedDeal: {
        persistedNextAction: null,
      },
      investorShield: {
        blockedGates: [],
        fallbackRecommendedActionTitle: null,
      },
      activeTasks: [],
      latestOffer: null,
    })

    const result = mapInvestorSummaryViewModel(input)

    expect(result.investorShield.blockedGates).toEqual([])
    expect(result.activeTasks).toEqual([])
    expect(result.latestOffer).toBeNull()
  })

  it("preserves shield, classification, capital protection, tasks, and latest-offer values unchanged", () => {
    const input = buildInput(INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE, {
      savedDeal: {
        classification: "NO_DEAL",
        capitalProtectionState: "NO_DEAL",
        persistedNextAction: null,
      },
      investorShield: {
        overallStatus: "CLEAR",
        missingEvidenceCount: 0,
        blockedGates: [
          {
            gateKey: "LENDER_CRITERIA",
            label: "Lender Criteria",
            gateType: "required",
            blockerReason: "Lender criteria evidence remains outstanding.",
          },
          {
            gateKey: "TITLE",
            label: "Title Review",
            gateType: "required",
            blockerReason: null,
          },
        ],
        fallbackRecommendedActionTitle: null,
      },
      activeTasks: [
        {
          taskId: "task-1",
          title: "Collect title pack",
          taskType: "DUE_DILIGENCE",
          status: "OPEN",
          priority: "HIGH",
          dueDate: null,
          blockerReason: "Waiting on legal documents.",
          createdAt: "2026-06-10T09:00:00.000Z",
          completedAt: null,
        },
        {
          taskId: "task-2",
          title: "Request builder quote",
          taskType: "EVIDENCE",
          status: "IN_PROGRESS",
          priority: "MEDIUM",
          dueDate: "2026-06-12",
          blockerReason: null,
          createdAt: "2026-06-10T10:15:00.000Z",
          completedAt: "2026-06-13T11:30:00.000Z",
        },
      ],
      latestOffer: {
        offerId: "offer-unchanged",
        amount: 0,
        offerType: "INITIAL",
        offerStatus: "REJECTED",
        rationale: null,
        sellerResponse: "No",
        createdAt: "2026-06-11T08:30:00.000Z",
      },
    })

    const result = mapInvestorSummaryViewModel(input)

    expect(result.investorShield.overallStatus).toBe("CLEAR")
    expect(result.investorShield.missingEvidenceCount).toBe(0)
    expect(result.investorShield.blockedGates).toEqual([
      {
        gateKey: "LENDER_CRITERIA",
        label: "Lender Criteria",
        gateType: "required",
        blockerReason: "Lender criteria evidence remains outstanding.",
      },
      {
        gateKey: "TITLE",
        label: "Title Review",
        gateType: "required",
        blockerReason: null,
      },
    ])
    expect(result.capitalProtectionState).toBe("NO_DEAL")
    expect(result.classification).toBe("NO_DEAL")
    expect(result.activeTasks).toEqual([
      {
        taskId: "task-1",
        title: "Collect title pack",
        taskType: "DUE_DILIGENCE",
        status: "OPEN",
        priority: "HIGH",
        dueDate: null,
        blockerReason: "Waiting on legal documents.",
        createdAt: "2026-06-10T09:00:00.000Z",
        completedAt: null,
      },
      {
        taskId: "task-2",
        title: "Request builder quote",
        taskType: "EVIDENCE",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        dueDate: "2026-06-12",
        blockerReason: null,
        createdAt: "2026-06-10T10:15:00.000Z",
        completedAt: "2026-06-13T11:30:00.000Z",
      },
    ])
    expect(result.latestOffer).toEqual({
      offerId: "offer-unchanged",
      amount: 0,
      offerType: "INITIAL",
      offerStatus: "REJECTED",
      rationale: null,
      sellerResponse: "No",
      createdAt: "2026-06-11T08:30:00.000Z",
    })
  })

  it("does not mutate inputs", () => {
    const input = deepFreeze(
      buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
        investorShield: {
          fallbackRecommendedActionTitle: "Fallback should not matter",
        },
      })
    )
    const snapshot = structuredClone(input)

    mapInvestorSummaryViewModel(input)

    expect(input).toEqual(snapshot)
  })

  it("preserves task order and duplicate task summaries without mutation", () => {
    const taskA = {
      taskId: "task-a",
      title: "Task A",
      taskType: "DUE_DILIGENCE",
      status: "OPEN",
      priority: "HIGH",
      dueDate: null,
      blockerReason: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    } as const
    const taskB = {
      taskId: "task-b",
      title: "Task B",
      taskType: "EVIDENCE",
      status: "BLOCKED",
      priority: "MEDIUM",
      dueDate: "2026-01-02",
      blockerReason: "Need evidence",
      createdAt: "2026-01-02T00:00:00.000Z",
      completedAt: null,
    } as const
    const input = buildInput(INVESTOR_SUMMARY_BLOCKED_FIXTURE, {
      activeTasks: [taskB, taskA, taskA],
      latestOffer: {
        offerId: "offer-1",
        amount: 0,
        offerType: "INITIAL",
        offerStatus: "DRAFT",
        rationale: null,
        sellerResponse: null,
        createdAt: "2026-06-11T08:30:00.000Z",
      },
    })

    const result = mapInvestorSummaryViewModel(input)

    expect(result.activeTasks).toEqual([taskB, taskA, taskA])
    expect(result.activeTasks[0]).not.toBe(taskB)
    expect(result.activeTasks[1]).not.toBe(taskA)
    expect(result.activeTasks[2]).not.toBe(taskA)
  })
})
