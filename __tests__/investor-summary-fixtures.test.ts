import { describe, expect, it } from "vitest"
import {
  INVESTOR_SUMMARY_BLOCKED_FIXTURE,
  INVESTOR_SUMMARY_FIXTURES,
  INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE,
  INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE,
} from "./fixtures/investor-summary-fixtures"

describe("Phase 4F-1B investor summary contract fixtures", () => {
  it("fixture ids are present and unique", () => {
    const ids = INVESTOR_SUMMARY_FIXTURES.map((fixture) => fixture.deal.dealId)

    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
  })

  it("blocked fixture carries canonical blocked-gate and task data", () => {
    expect(INVESTOR_SUMMARY_BLOCKED_FIXTURE.investorShield.overallStatus).toBe("BLOCKED")
    expect(INVESTOR_SUMMARY_BLOCKED_FIXTURE.investorShield.blockedGates).toHaveLength(2)
    expect(INVESTOR_SUMMARY_BLOCKED_FIXTURE.activeTasks).toHaveLength(2)
    expect(INVESTOR_SUMMARY_BLOCKED_FIXTURE.latestOffer).not.toBeNull()
    expect(INVESTOR_SUMMARY_BLOCKED_FIXTURE.recommendedNextAction.source).toBe(
      "PERSISTED_NEXT_ACTION"
    )
  })

  it("shield fallback fixture uses fallback recommendation and nullable offer", () => {
    expect(INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE.latestOffer).toBeNull()
    expect(INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE.recommendedNextAction.source).toBe(
      "INVESTOR_SHIELD_FALLBACK"
    )
    expect(INVESTOR_SUMMARY_SHIELD_FALLBACK_FIXTURE.activeTasks).toHaveLength(0)
  })

  it("unavailable fixture preserves explicit missing states", () => {
    expect(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE.purchasePrice).toBeNull()
    expect(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE.gdvRange.downside).toBeNull()
    expect(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE.trueMao.twentyPercent).toBeNull()
    expect(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE.capitalProtectionState).toBeNull()
    expect(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE.classification).toBeNull()
    expect(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE.investorShield.overallStatus).toBeNull()
    expect(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE.latestOffer).toBeNull()
    expect(INVESTOR_SUMMARY_UNAVAILABLE_FIXTURE.recommendedNextAction.source).toBe("UNAVAILABLE")
  })

  it("no fixture contains forbidden runtime behavior keys", () => {
    const forbiddenKeys = [
      "apiUrl",
      "database",
      "aiProvider",
      "scraping",
      "crm",
      "webhook",
      "runtimeWrite",
    ]

    for (const fixture of INVESTOR_SUMMARY_FIXTURES) {
      const serialized = JSON.stringify(fixture)
      for (const forbiddenKey of forbiddenKeys) {
        expect(serialized).not.toContain(`"${forbiddenKey}"`)
      }
    }
  })
})
