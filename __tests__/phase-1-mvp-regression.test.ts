import { describe, expect, it } from "vitest"
import { analyzeDeal, calculateFinanceCost, calculateTotalCost } from "@/lib/calculations"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { calculateTimeline } from "@/lib/engine/timeline-engine"
import type { DealInputs } from "@/types/deal"
import type { RefurbScopeInput } from "@/types/scope"

const phase1SampleInputs: DealInputs = {
  purchasePrice: 120000,
  gdv: 200000,
  refurbCost: 25000,
  stampDuty: 3600,
  legalCosts: 2000,
  saleCosts: 3000,
  bridgeTermMonths: 6,
}

const mandatoryScope: RefurbScopeInput = {
  bedrooms: 3,
  bathrooms: 1,
  floorAreaSqm: 80,
  kitchen: { scope: "full_replace", size: "medium" },
  bathroom: { scope: "full_replace" },
  bedroom: { scope: "cosmetic_refresh" },
  flooring: { replaceWholeProperty: true },
  majorWorks: { rewire: true, boiler: false, roof: false },
}

describe("Phase 1 core formula regression (README-backed)", () => {
  it("finance cost uses purchase price baseline and total investment includes all major costs", () => {
    const finance = calculateFinanceCost(phase1SampleInputs.purchasePrice, phase1SampleInputs.bridgeTermMonths)

    expect(finance.interest).toBeCloseTo(9000, 2)
    expect(finance.arrangementFee).toBeCloseTo(2400, 2)
    expect(finance.exitFee).toBeCloseTo(1200, 2)
    expect(finance.totalFinanceCost).toBeCloseTo(12600, 2)

    const totalInvestment = calculateTotalCost(
      phase1SampleInputs.purchasePrice,
      phase1SampleInputs.refurbCost,
      phase1SampleInputs.stampDuty,
      phase1SampleInputs.legalCosts,
      finance.totalFinanceCost,
      phase1SampleInputs.saleCosts
    )

    expect(totalInvestment).toBeCloseTo(166200, 2)

    const deal = analyzeDeal(phase1SampleInputs)
    expect(deal.totalCost).toBeCloseTo(totalInvestment, 2)
    expect(deal.profit).toBeCloseTo(33800, 2)
  })

  it("profit targets and MAO bands remain consistent", () => {
    const deal = analyzeDeal(phase1SampleInputs)

    expect(deal.trueMao.fifteenPercent).toBeCloseTo(123800, 2)
    expect(deal.trueMao.twentyPercent).toBeCloseTo(113800, 2)
    expect(deal.trueMao.twentyFivePercent).toBeCloseTo(103800, 2)

    expect(deal.trueMao.fifteenPercent).toBeGreaterThan(deal.trueMao.twentyPercent)
    expect(deal.trueMao.twentyPercent).toBeGreaterThan(deal.trueMao.twentyFivePercent)
  })
})

describe("Phase 1D verdict boundary regression", () => {
  const baseInputs = { ...phase1SampleInputs }

  it("missing purchase price returns ANALYSIS ONLY", () => {
    const result = analyzeDealWithRefurb({ ...baseInputs, purchasePrice: 0 })
    expect(result.verdict.status).toBe("ANALYSIS ONLY")
  })

  it("total investment >= GDV returns NO-GO", () => {
    const result = analyzeDealWithRefurb({ ...baseInputs, gdv: 166200 })
    expect(result.verdict.status).toBe("NO-GO")
  })

  it("purchase <= MAO 20% returns GO", () => {
    const result = analyzeDealWithRefurb({ ...baseInputs, purchasePrice: 110000 })
    expect(result.verdict.status).toBe("GO")
  })

  it("purchase between MAO 20% and MAO 15% returns CONDITIONAL", () => {
    const result = analyzeDealWithRefurb({ ...baseInputs, purchasePrice: 120000 })
    expect(result.verdict.status).toBe("CONDITIONAL")
  })

  it("purchase > MAO 15% returns NO-GO", () => {
    const result = analyzeDealWithRefurb({ ...baseInputs, purchasePrice: 130000 })
    expect(result.verdict.status).toBe("NO-GO")
  })
})

describe("Phase 1A/1B scope and output regression", () => {
  it("mandatory Phase 1B sample generates required tasks and exclusions", () => {
    const tasks = generateTasksFromScope(mandatoryScope)

    expect(tasks.some((task) => task.room === "kitchen" && task.scope === "full_replace")).toBe(true)
    expect(tasks.some((task) => task.room === "bathroom" && task.scope === "full_replace")).toBe(true)
    expect(tasks.some((task) => task.room === "bedroom" && task.scope === "cosmetic_refresh" && task.quantity === 3)).toBe(true)
    expect(tasks.some((task) => task.scope === "flooring_replacement")).toBe(true)
    expect(tasks.some((task) => task.scope === "rewire")).toBe(true)
    expect(tasks.some((task) => task.scope === "boiler")).toBe(false)
    expect(tasks.some((task) => task.scope === "roof")).toBe(false)
  })

  it("bathroom count scaling changes bathroom task totals", () => {
    const oneBathroomTasks = generateTasksFromScope({
      ...mandatoryScope,
      bathrooms: 1,
      bathroom: { scope: "full_replace" },
    })
    const twoBathroomTasks = generateTasksFromScope({
      ...mandatoryScope,
      bathrooms: 2,
      bathroom: { scope: "full_replace" },
    })

    const oneTotal = oneBathroomTasks
      .filter((task) => task.room === "bathroom")
      .reduce((sum, task) => sum + task.totalCost, 0)
    const twoTotal = twoBathroomTasks
      .filter((task) => task.room === "bathroom")
      .reduce((sum, task) => sum + task.totalCost, 0)

    expect(twoTotal).toBeCloseTo(oneTotal * 2, 2)
  })

  it("missing floorAreaSqm for flooring surfaces warnings/assumptions", () => {
    const result = analyzeDealWithRefurb(phase1SampleInputs, {
      ...mandatoryScope,
      floorAreaSqm: undefined,
      flooring: { replaceWholeProperty: true },
    })

    expect(result.warnings.some((warning) => warning.includes("floorAreaSqm not provided"))).toBe(true)
    expect(result.assumptionsReport.some((item) => item.includes("floorAreaSqm not provided"))).toBe(true)
  })

  it("refurb room/trade/task outputs reconcile with totals", () => {
    const tasks = generateTasksFromScope(mandatoryScope)
    const refurb = calculateRefurbCost(tasks)

    const roomTotal = Object.values(refurb.roomBreakdown).reduce((sum, value) => sum + value, 0)
    const tradeTotal = Object.values(refurb.tradeBreakdown).reduce((sum, value) => sum + (value ?? 0), 0)

    expect(refurb.totalRefurbCost).toBeCloseTo(refurb.labourCost + refurb.materialCost, 2)
    expect(roomTotal).toBeCloseTo(refurb.totalRefurbCost, 2)
    expect(tradeTotal).toBeCloseTo(refurb.totalRefurbCost, 2)

    refurb.taskList.forEach((task) => {
      expect(task.id.length).toBeGreaterThan(0)
      expect(task.taskName.length).toBeGreaterThan(0)
      expect(task.trade.length).toBeGreaterThan(0)
      expect(task.scalingRule.length).toBeGreaterThan(0)
      expect(task.quantity).toBeGreaterThan(0)
    })
  })

  it("timeline derives from generated tasks and remains internally consistent", () => {
    const tasks = generateTasksFromScope(mandatoryScope)
    const timeline = calculateTimeline(tasks)

    const perTradeFromTasks = new Map<string, number>()
    for (const task of tasks) {
      const current = perTradeFromTasks.get(task.trade) ?? 0
      perTradeFromTasks.set(task.trade, current + task.labourDays * task.quantity)
    }

    timeline.tradeSchedule.forEach((tradeEntry) => {
      expect(tradeEntry.totalLabourDays).toBeCloseTo(perTradeFromTasks.get(tradeEntry.trade) ?? 0, 5)
    })

    expect(timeline.totalWorkingDaysWithContingency).toBe(
      Math.ceil(timeline.totalWorkingDays * timeline.contingencyFactor)
    )
    expect(timeline.totalCalendarWeeks).toBe(
      Math.ceil(timeline.totalWorkingDaysWithContingency / 5)
    )
  })

  it("manual fallback keeps lower confidence and generated scope shows assumptions/overrides visibility", () => {
    const manual = analyzeDealWithRefurb(phase1SampleInputs)
    const generated = analyzeDealWithRefurb(phase1SampleInputs, mandatoryScope)

    expect(manual.refurbSource).toBe("manual")
    expect(generated.refurbSource).toBe("generated")

    expect(manual.confidence.score).toBeLessThan(generated.confidence.score)
    expect(manual.confidence.factors.some((factor) => factor.includes("Manual refurb input path"))).toBe(true)

    expect(generated.assumptionsReport.length).toBeGreaterThan(0)
    expect(generated.overridesApplied).toEqual([])
  })

  it("mandatory sample output flows into final deal analysis", () => {
    const result = analyzeDealWithRefurb({ ...phase1SampleInputs, refurbCost: 0 }, mandatoryScope)

    expect(result.refurbSource).toBe("generated")
    expect(result.refurb?.totalRefurbCost).toBeCloseTo(18175, 0)
    expect(result.refurb?.roomBreakdown).toBeDefined()
    expect(result.refurb?.tradeBreakdown).toBeDefined()
    expect(result.refurb?.taskList.length).toBe(20)

    const expectedDeal = analyzeDeal({ ...phase1SampleInputs, refurbCost: result.refurb!.totalRefurbCost })
    expect(result.deal.totalCost).toBeCloseTo(expectedDeal.totalCost, 2)
    expect(result.deal.profit).toBeCloseTo(expectedDeal.profit, 2)
    expect(result.timeline?.totalWorkingDaysWithContingency).toBe(18)
    expect(result.timeline?.totalCalendarWeeks).toBe(4)
  })
})
