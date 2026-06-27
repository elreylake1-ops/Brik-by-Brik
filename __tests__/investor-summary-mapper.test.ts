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
})
