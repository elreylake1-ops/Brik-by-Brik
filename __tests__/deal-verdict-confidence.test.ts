import { describe, expect, it } from "vitest"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import type { DealInputs } from "@/types/deal"
import type { CostOverride } from "@/types/overrides"
import type { RefurbScopeInput } from "@/types/scope"

const baseScope: RefurbScopeInput = {
  bedrooms: 3,
  bathrooms: 1,
  floorAreaSqm: 80,
  kitchen: { scope: "full_replace", size: "medium" },
  bathroom: { scope: "full_replace" },
  bedroom: { scope: "cosmetic_refresh" },
  flooring: { replaceWholeProperty: true },
  majorWorks: { rewire: true, boiler: false, roof: false },
}

const baseDealInputs: DealInputs = {
  purchasePrice: 120000,
  gdv: 200000,
  refurbCost: 25000,
  stampDuty: 3600,
  legalCosts: 2000,
  saleCosts: 3000,
  bridgeTermMonths: 6,
}

describe("Phase 1D engine verdict and confidence", () => {
  it("returns ANALYSIS ONLY when core deal inputs are incomplete", () => {
    const result = analyzeDealWithRefurb({
      ...baseDealInputs,
      purchasePrice: 0,
      gdv: 0,
    })

    expect(result.verdict.status).toBe("ANALYSIS ONLY")
    expect(result.confidence.score).toBeLessThan(100)
  })

  it("returns GO when within stronger MAO band and profit is positive", () => {
    const result = analyzeDealWithRefurb(baseDealInputs, baseScope)

    expect(result.verdict.status).toBe("GO")
    expect(result.verdict.checks.length).toBeGreaterThan(0)
    expect(result.confidence.band).toBe("HIGH")
  })

  it("returns NO-GO when purchase price is well above MAO bands", () => {
    const result = analyzeDealWithRefurb(
      {
        ...baseDealInputs,
        purchasePrice: 180000,
      },
      baseScope
    )

    expect(result.verdict.status).toBe("NO-GO")
  })

  it("confidence score decreases when warnings and overrides are present", () => {
    const warningScope: RefurbScopeInput = {
      ...baseScope,
      floorAreaSqm: undefined,
      majorWorks: { rewire: false, boiler: false, roof: true },
    }

    const override: CostOverride[] = [
      {
        id: "ovr-confidence-check",
        type: "labour_day_rate",
        targetTrade: "electrician",
        value: 500,
      },
    ]

    const baseline = analyzeDealWithRefurb(baseDealInputs, baseScope)
    const stressed = analyzeDealWithRefurb(baseDealInputs, warningScope, override)

    expect(stressed.warnings.length).toBeGreaterThan(0)
    expect(stressed.overridesApplied.length).toBeGreaterThan(0)
    expect(stressed.confidence.score).toBeLessThan(baseline.confidence.score)
  })
})
