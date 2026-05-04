import { describe, expect, it } from "vitest"
import { analyzeDeal } from "@/lib/calculations"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { calculateTimeline } from "@/lib/engine/timeline-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import type { DealInputs } from "@/types/deal"
import type { RefurbScopeInput } from "@/types/scope"

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

const sampleDealInputs: DealInputs = {
  purchasePrice: 120000,
  gdv: 200000,
  refurbCost: 0,
  stampDuty: 3600,
  legalCosts: 2000,
  saleCosts: 3000,
  bridgeTermMonths: 6,
}

const baseScope: RefurbScopeInput = {
  bedrooms: 3,
  bathrooms: 1,
  kitchen: { scope: "keep", size: "medium" },
  bathroom: { scope: "cosmetic" },
  bedroom: { scope: "none" },
  flooring: { replaceWholeProperty: false },
  majorWorks: { rewire: false, boiler: false, roof: false },
}

function kitchenTotal(size: "small" | "medium" | "large"): number {
  const tasks = generateTasksFromScope({
    ...baseScope,
    kitchen: { scope: "full_replace", size },
  }).filter((task) => task.room === "kitchen")

  return calculateRefurbCost(tasks).totalRefurbCost
}

describe("Phase 1A acceptance - mandatory sample scope", () => {
  it("matches mandatory cost and timeline outputs end-to-end", () => {
    const tasks = generateTasksFromScope(sampleScope)
    const refurb = calculateRefurbCost(tasks)
    const timeline = calculateTimeline(tasks)
    const result = analyzeDealWithRefurb(sampleDealInputs, sampleScope)

    expect(tasks).toHaveLength(20)

    expect(refurb.labourCost).toBeCloseTo(8815, 0)
    expect(refurb.materialCost).toBeCloseTo(9360, 0)
    expect(refurb.totalRefurbCost).toBeCloseTo(18175, 0)
    expect(refurb.totalRefurbCost).toBeCloseTo(refurb.labourCost + refurb.materialCost)

    expect(refurb.roomBreakdown.kitchen).toBeCloseTo(6100, 0)
    expect(refurb.roomBreakdown.bathroom).toBeCloseTo(3075, 0)
    expect(refurb.roomBreakdown.bedroom).toBeCloseTo(1680, 0)
    expect(refurb.roomBreakdown.whole_property).toBeGreaterThan(0)

    expect(refurb.tradeBreakdown.electrician).toBeGreaterThan(0)
    expect(refurb.tradeBreakdown.plumber).toBeGreaterThan(0)
    expect(refurb.tradeBreakdown.carpenter).toBeGreaterThan(0)
    expect(refurb.tradeBreakdown.decorator).toBeGreaterThan(0)

    const flooringCost = tasks
      .filter((task) => task.scope === "flooring_replacement")
      .reduce((sum, task) => sum + task.totalCost, 0)
    const rewireCost = tasks
      .filter((task) => task.scope === "rewire")
      .reduce((sum, task) => sum + task.totalCost, 0)

    expect(flooringCost).toBeCloseTo(1920, 0)
    expect(rewireCost).toBeCloseTo(5400, 0)

    const phase1 = timeline.phases.find((phase) => phase.phase === 1)
    const phase2 = timeline.phases.find((phase) => phase.phase === 2)
    const phase3 = timeline.phases.find((phase) => phase.phase === 3)

    expect(phase1?.workingDays).toBeCloseTo(2.5)
    expect(phase2?.workingDays).toBeCloseTo(7.5)
    expect(phase3?.workingDays).toBeCloseTo(4.5)

    expect(timeline.totalWorkingDays).toBeCloseTo(14.5)
    expect(timeline.contingencyFactor).toBe(1.2)
    expect(timeline.totalWorkingDaysWithContingency).toBe(18)
    expect(timeline.totalCalendarWeeks).toBe(4)

    expect(result.refurbSource).toBe("generated")
    expect(result.refurb?.taskList).toHaveLength(20)
    expect(result.refurb?.totalRefurbCost).toBeCloseTo(18175, 0)
    expect(result.timeline?.totalWorkingDaysWithContingency).toBe(18)
    expect(result.timeline?.totalCalendarWeeks).toBe(4)

    const expectedDeal = analyzeDeal({ ...sampleDealInputs, refurbCost: 18175 })
    expect(result.deal.totalCost).toBeCloseTo(expectedDeal.totalCost, 0)
  })

  it("surfaces warning/confidence flags when applicable", () => {
    const warningScope: RefurbScopeInput = {
      ...baseScope,
      flooring: { replaceWholeProperty: true },
      majorWorks: { rewire: false, boiler: false, roof: true },
      // floorAreaSqm intentionally omitted to force fallback warning
    }

    const result = analyzeDealWithRefurb(sampleDealInputs, warningScope)

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.refurb?.confidenceFlags.length).toBeGreaterThan(0)
    expect(result.warnings.some((warning) => warning.includes("floorAreaSqm not provided"))).toBe(true)
    expect(result.warnings.some((warning) => warning.toLowerCase().includes("roof"))).toBe(true)
  })
})

describe("Phase 1A acceptance - kitchen size modifier (AC5)", () => {
  it("applies expected totals for small, medium, and large kitchen full_replace", () => {
    expect(kitchenTotal("small")).toBeCloseTo(4880, 0)
    expect(kitchenTotal("medium")).toBeCloseTo(6100, 0)
    expect(kitchenTotal("large")).toBeCloseTo(7625, 0)
  })

  it("keeps ordering small < medium < large", () => {
    const small = kitchenTotal("small")
    const medium = kitchenTotal("medium")
    const large = kitchenTotal("large")

    expect(small).toBeLessThan(medium)
    expect(medium).toBeLessThan(large)
  })
})

describe("Phase 1A acceptance - manual fallback unchanged (AC13)", () => {
  it("uses manual path when scope is omitted", () => {
    const withRefurb10000 = analyzeDealWithRefurb({ ...sampleDealInputs, refurbCost: 10000 })
    const withRefurb30000 = analyzeDealWithRefurb({ ...sampleDealInputs, refurbCost: 30000 })

    expect(withRefurb10000.refurbSource).toBe("manual")
    expect(withRefurb10000.refurb).toBeUndefined()
    expect(withRefurb30000.deal.totalCost).toBeGreaterThan(withRefurb10000.deal.totalCost)
    expect(withRefurb30000.deal.profit).toBeLessThan(withRefurb10000.deal.profit)
  })
})
