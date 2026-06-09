import { describe, expect, it } from "vitest"
import type { InvestorShieldUiViewModel } from "@/types/investor-shield-ui"
import {
  advisoryOnlyFixture,
  blockedRequiredGateFixture,
  clearedRequiredGatesFixture,
  manualReviewFixture,
  taskRecommendationFixture,
  waiverVisibilityFixture,
} from "./fixtures/investor-shield-ui-fixtures"

const FIXTURES = [
  blockedRequiredGateFixture,
  clearedRequiredGatesFixture,
  advisoryOnlyFixture,
  manualReviewFixture,
  taskRecommendationFixture,
  waiverVisibilityFixture,
] as const satisfies readonly InvestorShieldUiViewModel[]

describe("Investor Shield UI fixtures", () => {
  it("all fixtures satisfy the contract", () => {
    expect(FIXTURES).toHaveLength(6)
    expect(FIXTURES.every((fixture) => fixture.deterministicGovernance.isDominant)).toBe(true)
  })

  it("advisory signals stay advisory-only", () => {
    const advisoryFixtures = [advisoryOnlyFixture, blockedRequiredGateFixture]

    for (const fixture of advisoryFixtures) {
      for (const signal of fixture.advisorySignals) {
        expect(signal.advisoryOnly).toBe(true)
        expect(signal.cannotSatisfyHardGate).toBe(true)
      }
    }
  })

  it("blocked movement fixtures prevent mutation", () => {
    expect(blockedRequiredGateFixture.protectedMovement.pipelineMutationPrevented).toBe(true)
    expect(advisoryOnlyFixture.protectedMovement.pipelineMutationPrevented).toBe(true)
    expect(manualReviewFixture.protectedMovement.pipelineMutationPrevented).toBe(true)
    expect(taskRecommendationFixture.protectedMovement.pipelineMutationPrevented).toBe(true)
  })

  it("manual review does not clear gates", () => {
    expect(manualReviewFixture.manualReview.doesNotClearGate).toBe(true)
    expect(blockedRequiredGateFixture.manualReview.doesNotClearGate).toBe(true)
  })

  it("waiver fixtures carry a reason", () => {
    expect(waiverVisibilityFixture.waiverSummary.isWaived).toBe(true)
    expect(waiverVisibilityFixture.waiverSummary.reason).toBeTruthy()
    expect(clearedRequiredGatesFixture.waiverSummary.isWaived).toBe(true)
    expect(clearedRequiredGatesFixture.waiverSummary.reason).toBeTruthy()
  })

  it("task recommendations do not imply gate satisfaction", () => {
    for (const recommendation of taskRecommendationFixture.taskRecommendations) {
      expect(recommendation.duplicateSafe).toBe(true)
      expect(recommendation.status).toBe("open")
    }

    expect(taskRecommendationFixture.gates[0]?.status).not.toBe("satisfied")
    expect(blockedRequiredGateFixture.gates[0]?.status).not.toBe("satisfied")
  })
})
