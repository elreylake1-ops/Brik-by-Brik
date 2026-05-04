import { describe, it, expect } from "vitest"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { analyzeDeal } from "@/lib/calculations"
import type { DealInputs } from "@/types/deal"
import type { RefurbScopeInput } from "@/types/scope"

const baseDealInputs: DealInputs = {
  purchasePrice: 120000,
  gdv: 200000,
  refurbCost: 25000,
  stampDuty: 3600,
  legalCosts: 2000,
  saleCosts: 3000,
  bridgeTermMonths: 6,
}

const minimalScope: RefurbScopeInput = {
  bedrooms: 3,
  bathrooms: 1,
  kitchen: { scope: "keep", size: "medium" },
  bathroom: { scope: "cosmetic" },
  bedroom: { scope: "none" },
  flooring: { replaceWholeProperty: false },
  majorWorks: { rewire: false, boiler: false, roof: false },
}

const kitchenScope: RefurbScopeInput = {
  ...minimalScope,
  kitchen: { scope: "full_replace", size: "medium" },
}

describe("analyzeDealWithRefurb — no scope (manual fallback)", () => {

  it("refurbSource is 'manual'", () => {
    const result = analyzeDealWithRefurb(baseDealInputs)
    expect(result.refurbSource).toBe("manual")
  })

  it("deal matches analyzeDeal with same inputs", () => {
    const result = analyzeDealWithRefurb(baseDealInputs)
    const expected = analyzeDeal(baseDealInputs)
    expect(result.deal).toEqual(expected)
  })

  it("refurb and timeline are undefined", () => {
    const result = analyzeDealWithRefurb(baseDealInputs)
    expect(result.refurb).toBeUndefined()
    expect(result.timeline).toBeUndefined()
  })

  it("warnings is empty", () => {
    const result = analyzeDealWithRefurb(baseDealInputs)
    expect(result.warnings).toHaveLength(0)
  })

  it("manual refurbCost flows into deal.totalCost unchanged", () => {
    const result = analyzeDealWithRefurb(baseDealInputs)
    const expected = analyzeDeal(baseDealInputs)
    expect(result.deal.totalCost).toBeCloseTo(expected.totalCost)
  })

})

describe("analyzeDealWithRefurb — with scope (generated refurb)", () => {

  it("refurbSource is 'generated'", () => {
    const result = analyzeDealWithRefurb(baseDealInputs, kitchenScope)
    expect(result.refurbSource).toBe("generated")
  })

  it("refurb and timeline are present", () => {
    const result = analyzeDealWithRefurb(baseDealInputs, kitchenScope)
    expect(result.refurb).toBeDefined()
    expect(result.timeline).toBeDefined()
  })

  it("generated totalRefurbCost replaces manual refurbCost in deal", () => {
    const result = analyzeDealWithRefurb(baseDealInputs, kitchenScope)
    const generatedCost = result.refurb!.totalRefurbCost

    const expectedDeal = analyzeDeal({ ...baseDealInputs, refurbCost: generatedCost })
    expect(result.deal.totalCost).toBeCloseTo(expectedDeal.totalCost)
    expect(result.deal.profit).toBeCloseTo(expectedDeal.profit)
  })

  it("manual refurbCost field is ignored when scope provided", () => {
    const withHighManual = { ...baseDealInputs, refurbCost: 999999 }
    const result = analyzeDealWithRefurb(withHighManual, kitchenScope)
    const generatedCost = result.refurb!.totalRefurbCost

    const expectedDeal = analyzeDeal({ ...withHighManual, refurbCost: generatedCost })
    expect(result.deal.totalCost).toBeCloseTo(expectedDeal.totalCost)
  })

  it("deal.totalCost accounts for generated refurb cost", () => {
    const result = analyzeDealWithRefurb(baseDealInputs, kitchenScope)
    expect(result.refurb!.totalRefurbCost).toBeGreaterThan(0)
    expect(result.deal.totalCost).toBeGreaterThan(baseDealInputs.purchasePrice)
  })

  it("warnings matches refurb.confidenceFlags", () => {
    const roofScope: RefurbScopeInput = {
      ...minimalScope,
      majorWorks: { rewire: false, boiler: false, roof: true },
    }
    const result = analyzeDealWithRefurb(baseDealInputs, roofScope)
    expect(result.warnings).toEqual(result.refurb!.confidenceFlags)
  })

  it("minimal scope with no tasks: generated refurbCost is 0", () => {
    const result = analyzeDealWithRefurb(baseDealInputs, minimalScope)
    expect(result.refurb!.totalRefurbCost).toBe(0)
  })

  it("refurb result matches standalone calculateRefurbCost output", () => {
    const tasks = generateTasksFromScope(kitchenScope)
    const expected = calculateRefurbCost(tasks)
    const result = analyzeDealWithRefurb(baseDealInputs, kitchenScope)
    expect(result.refurb!.totalRefurbCost).toBeCloseTo(expected.totalRefurbCost)
    expect(result.refurb!.labourCost).toBeCloseTo(expected.labourCost)
  })

  it("profit margin is recalculated with generated refurb cost", () => {
    const result = analyzeDealWithRefurb(baseDealInputs, kitchenScope)
    const generatedCost = result.refurb!.totalRefurbCost
    const expectedDeal = analyzeDeal({ ...baseDealInputs, refurbCost: generatedCost })
    expect(result.deal.profitMargin).toBeCloseTo(expectedDeal.profitMargin)
  })

  it("True MAO is recalculated with generated refurb cost", () => {
    const result = analyzeDealWithRefurb(baseDealInputs, kitchenScope)
    const generatedCost = result.refurb!.totalRefurbCost
    const expectedDeal = analyzeDeal({ ...baseDealInputs, refurbCost: generatedCost })
    expect(result.deal.trueMao.fifteenPercent).toBeCloseTo(expectedDeal.trueMao.fifteenPercent)
    expect(result.deal.trueMao.twentyPercent).toBeCloseTo(expectedDeal.trueMao.twentyPercent)
    expect(result.deal.trueMao.twentyFivePercent).toBeCloseTo(expectedDeal.trueMao.twentyFivePercent)
  })

})
