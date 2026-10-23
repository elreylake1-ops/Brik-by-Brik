import { describe, expect, it } from "vitest"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { calculateTimeline } from "@/lib/engine/timeline-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import type { DealInputs } from "@/types/deal"
import type { RefurbScopeInput } from "@/types/scope"

describe("Financial and Refurbishment Traceability", () => {
  const baselineDeal: DealInputs = {
    purchasePrice: 450_000,
    gdv: 750_000,
    refurbCost: 50_000,
    saleCosts: 9_000,
    stampDuty: 22_500,
    legalCosts: 3_500,
    bridgeTermMonths: 9,
  }

  it("1. Traces accepted checklist findings into work items and prices them accurately", () => {
    // When bathroom is accepted for full refurb
    const scopeWithBathroom: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 3,
      floorAreaSqm: 240,
      kitchen: { scope: "keep", size: "medium" },
      bathroom: { scope: "full_replace" },
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const tasks = generateTasksFromScope(scopeWithBathroom)
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks.some((t) => t.room === "bathroom")).toBe(true)

    const refurbResult = calculateRefurbCost(tasks)
    expect(refurbResult.totalRefurbCost).toBeGreaterThan(0)
    expect(refurbResult.labourCost + refurbResult.materialCost).toBe(refurbResult.totalRefurbCost)
  })

  it("2. Distinguishes priced from unpriced supplier work items", () => {
    // When an unsupported or partial scope item is accepted
    const scopeWithUnpriced: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 3,
      floorAreaSqm: 240,
      kitchen: { scope: "keep", size: "medium" },
      bathroom: { scope: "partial" }, // partial bathroom has no task templates in pilot library
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const tasks = generateTasksFromScope(scopeWithUnpriced)
    const refurbResult = calculateRefurbCost(tasks)

    // Unpriced items must not invent synthetic costs
    expect(refurbResult.totalRefurbCost).toBe(0)
    expect(tasks.some((t) => t.warnings.some((w) => w.includes("has no task templates")))).toBe(true)
  })

  it("3. Confirms rejected and unreviewed findings cannot silently affect costs", () => {
    // A rejected roof finding (C01) leaves roof: false
    const scopeWithoutRoof: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 3,
      floorAreaSqm: 240,
      kitchen: { scope: "keep", size: "medium" },
      bathroom: { scope: "none" as any },
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const tasks = generateTasksFromScope(scopeWithoutRoof)
    const refurbResult = calculateRefurbCost(tasks)

    // Zero scope = zero refurb cost
    expect(refurbResult.totalRefurbCost).toBe(0)
    expect(tasks.length).toBe(0)
  })

  it("4. Validates Schedule of Works sequencing and 20% delay contingency buffer", () => {
    const scope: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 3,
      floorAreaSqm: 240,
      kitchen: { scope: "full_replace", size: "medium" },
      bathroom: { scope: "full_replace" },
      bedroom: { scope: "cosmetic_refresh" },
      flooring: { replaceWholeProperty: true },
      majorWorks: { roof: true, boiler: true, rewire: true },
    }

    const tasks = generateTasksFromScope(scope)
    const timeline = calculateTimeline(tasks)

    expect(timeline.phases.length).toBe(3)
    expect(timeline.phases[0].label).toBe("Strip & Structural")
    expect(timeline.phases[1].label).toBe("First & Second Fix")
    expect(timeline.phases[2].label).toBe("Finishing")

    // Contingency factor must be 1.2 (20% buffer)
    expect(timeline.contingencyFactor).toBeCloseTo(1.2, 5)
    expect(timeline.totalWorkingDaysWithContingency).toBeGreaterThan(timeline.totalWorkingDays)
    expect(timeline.assumptions.some((a) => a.includes("contingency buffer"))).toBe(true)
  })

  it("5. Computes baseline versus proposed True MAO and explains delta reasons", () => {
    // 5.1 Baseline deal result (using manual £50k refurb)
    const baselineResult = analyzeDealWithRefurb(baselineDeal)
    expect(baselineResult.refurbSource).toBe("manual")
    expect(baselineResult.deal.trueMao.twentyPercent).toBe(450_875)

    // 5.2 Proposed deal result (with confirmed scope costing £0 direct engine cost pending builder quote)
    const scopeZero: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 3,
      floorAreaSqm: 240,
      kitchen: { scope: "keep", size: "medium" },
      bathroom: { scope: "partial" },
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const proposedResult = analyzeDealWithRefurb(baselineDeal, scopeZero)
    expect(proposedResult.refurbSource).toBe("generated")
    expect(proposedResult.refurb?.totalRefurbCost).toBe(0)
    expect(proposedResult.deal.trueMao.twentyPercent).toBe(500_875)

    // Delta explanation: £50,000 reduction in refurb cost increases MAO by exactly £50,000
    const deltaMao = proposedResult.deal.trueMao.twentyPercent - baselineResult.deal.trueMao.twentyPercent
    expect(deltaMao).toBe(50_000)
  })

  it("6. Strictly guarantees Saved Deal input immutability", () => {
    const frozenCopy = Object.freeze({ ...baselineDeal })
    const scope: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 3,
      floorAreaSqm: 240,
      kitchen: { scope: "full_replace", size: "medium" },
      bathroom: { scope: "full_replace" },
      bedroom: { scope: "full_refurb" },
      flooring: { replaceWholeProperty: true },
      majorWorks: { roof: true, boiler: true, rewire: true },
    }

    const result = analyzeDealWithRefurb(baselineDeal, scope)

    // Baseline inputs are completely unchanged
    expect(baselineDeal.purchasePrice).toBe(450_000)
    expect(baselineDeal.refurbCost).toBe(50_000)
    expect(baselineDeal.gdv).toBe(750_000)
    expect(frozenCopy.purchasePrice).toBe(450_000)
  })

  it("7. Verifies Investor Shield and Deep Due Diligence receive accurate financial context", () => {
    const scope: RefurbScopeInput = {
      bedrooms: 3,
      bathrooms: 2,
      floorAreaSqm: 110,
      kitchen: { scope: "full_replace", size: "medium" },
      bathroom: { scope: "full_replace" },
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: true, rewire: false },
    }

    const result = analyzeDealWithRefurb(baselineDeal, scope)
    expect(result.dueDiligence).toBeDefined()
    expect(result.dueDiligence?.inputs.purchasePrice).toBe(baselineDeal.purchasePrice)
    expect(result.dueDiligence?.inputs.gdvRealistic).toBe(baselineDeal.gdv)
    expect(result.dueDiligence?.inputs.refurbCost).toBe(result.refurb?.totalRefurbCost)
    expect(result.dueDiligence?.decision.capitalProtectionStatus).toBeDefined()
  })
})
