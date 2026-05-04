import { describe, expect, it } from "vitest"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import type { DealInputs } from "@/types/deal"
import type { CostOverride } from "@/types/overrides"
import type { RefurbScopeInput } from "@/types/scope"

const baseDealInputs: DealInputs = {
  purchasePrice: 120000,
  gdv: 200000,
  refurbCost: 0,
  stampDuty: 3600,
  legalCosts: 2000,
  saleCosts: 3000,
  bridgeTermMonths: 6,
}

const sampleScope: RefurbScopeInput = {
  bedrooms: 3,
  bathrooms: 1,
  floorAreaSqm: 80,
  kitchen: { scope: "full_replace", size: "medium" },
  bathroom: { scope: "full_replace" },
  bedroom: { scope: "cosmetic_refresh" },
  flooring: { replaceWholeProperty: true },
  majorWorks: { rewire: true, boiler: false, roof: false },
}

describe("Phase 1B Step 2 overrides and assumptions reporting", () => {
  it("applies labour day rate override by trade and tracks audit entries", () => {
    const overrides: CostOverride[] = [
      {
        id: "ovr-elec-rate",
        type: "labour_day_rate",
        targetTrade: "electrician",
        value: 500,
        reason: "Conservative electrician day-rate uplift",
      },
    ]

    const result = analyzeDealWithRefurb(baseDealInputs, sampleScope, overrides)

    expect(result.refurbSource).toBe("generated")
    expect(result.overridesApplied.length).toBeGreaterThan(0)
    expect(result.overridesApplied.some((entry) => entry.overrideId === "ovr-elec-rate")).toBe(true)
    expect(result.refurb?.totalRefurbCost).toBeCloseTo(18925, 0)
    expect(result.assumptionsReport.some((assumption) => assumption.includes("Override ovr-elec-rate"))).toBe(true)
  })

  it("applies labour days override on a specific task", () => {
    const boilerScope: RefurbScopeInput = {
      ...sampleScope,
      majorWorks: { rewire: false, boiler: true, roof: false },
    }

    const baseline = analyzeDealWithRefurb(baseDealInputs, boilerScope)
    const overridden = analyzeDealWithRefurb(baseDealInputs, boilerScope, [
      {
        id: "ovr-boiler-days",
        type: "labour_days",
        targetTaskId: "major-boiler-replacement",
        value: 2.5,
        reason: "Access constraints expected",
      },
    ])

    expect(overridden.refurb?.totalRefurbCost).toBeGreaterThan(baseline.refurb?.totalRefurbCost ?? 0)
    expect(overridden.overridesApplied.some((entry) => entry.overrideId === "ovr-boiler-days")).toBe(true)
  })

  it("applies material price override by material item", () => {
    const overrides: CostOverride[] = [
      {
        id: "ovr-cable-material",
        type: "material_price",
        targetMaterialItem: "electrical-cable-rewire",
        value: 1500,
        reason: "Updated wholesaler quote",
      },
    ]

    const result = analyzeDealWithRefurb(baseDealInputs, sampleScope, overrides)

    expect(result.refurb?.totalRefurbCost).toBeCloseTo(19075, 0)
    expect(result.overridesApplied.filter((entry) => entry.overrideId === "ovr-cable-material").length).toBe(3)
  })

  it("supports task exclusion and inclusion overrides", () => {
    const excluded = analyzeDealWithRefurb(baseDealInputs, sampleScope, [
      {
        id: "ovr-exclude-kitchen-decoration",
        type: "task_exclude",
        targetTaskId: "kitchen-full-replace-decoration",
        value: true,
        reason: "Client requested no repaint",
      },
    ])

    expect(excluded.refurb?.taskList.length).toBe(19)
    expect(excluded.refurb?.totalRefurbCost).toBeCloseTo(17875, 0)

    const reIncluded = analyzeDealWithRefurb(baseDealInputs, sampleScope, [
      {
        id: "ovr-exclude-kitchen-decoration",
        type: "task_exclude",
        targetTaskId: "kitchen-full-replace-decoration",
        value: true,
      },
      {
        id: "ovr-include-kitchen-decoration",
        type: "task_include",
        targetTaskId: "kitchen-full-replace-decoration",
        value: true,
      },
    ])

    expect(reIncluded.refurb?.taskList.length).toBe(20)
  })

  it("manual mode remains unchanged and returns no applied overrides", () => {
    const result = analyzeDealWithRefurb(baseDealInputs, undefined, [
      {
        id: "ovr-manual-ignored",
        type: "labour_day_rate",
        targetTrade: "electrician",
        value: 500,
      },
    ])

    expect(result.refurbSource).toBe("manual")
    expect(result.overridesApplied).toEqual([])
    expect(result.assumptionsReport).toEqual([])
  })
})
