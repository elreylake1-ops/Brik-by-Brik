import { describe, it, expect } from "vitest"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import type { RefurbScopeInput } from "@/types/scope"

// Base scope with everything off — extend per test
const baseScope: RefurbScopeInput = {
  bedrooms: 3,
  bathrooms: 1,
  kitchen: { scope: "keep", size: "medium" },
  bathroom: { scope: "cosmetic" },
  bedroom: { scope: "none" },
  flooring: { replaceWholeProperty: false },
  majorWorks: { rewire: false, boiler: false, roof: false },
}

describe("generateTasksFromScope", () => {

  it("kitchen full_replace generates kitchen tasks", () => {
    const tasks = generateTasksFromScope({
      ...baseScope,
      kitchen: { scope: "full_replace", size: "medium" },
    })
    const kitchenTasks = tasks.filter((t) => t.room === "kitchen")
    expect(kitchenTasks.length).toBeGreaterThan(0)
    expect(kitchenTasks.every((t) => t.scope === "full_replace")).toBe(true)
    // All generated tasks must have a positive totalCost
    kitchenTasks.forEach((t) => {
      expect(t.totalCost).toBeGreaterThanOrEqual(0)
      expect(t.quantity).toBe(1)
    })
  })

  it("kitchen size small applies 0.8 multiplier to labour and materials", () => {
    const medium = generateTasksFromScope({
      ...baseScope,
      kitchen: { scope: "full_replace", size: "medium" },
    }).filter((t) => t.room === "kitchen")

    const small = generateTasksFromScope({
      ...baseScope,
      kitchen: { scope: "full_replace", size: "small" },
    }).filter((t) => t.room === "kitchen")

    expect(small.length).toBe(medium.length)
    small.forEach((st, i) => {
      const mt = medium[i]
      expect(st.labourDays).toBeCloseTo(mt.labourDays * 0.8)
      expect(st.materialCost).toBeCloseTo(mt.materialCost * 0.8)
    })
  })

  it("bathroom full_replace with bathrooms=2 scales tasks by 2", () => {
    const tasks = generateTasksFromScope({
      ...baseScope,
      bathrooms: 2,
      bathroom: { scope: "full_replace" },
    })
    const bathroomTasks = tasks.filter((t) => t.room === "bathroom")
    expect(bathroomTasks.length).toBeGreaterThan(0)
    bathroomTasks.forEach((t) => {
      expect(t.quantity).toBe(2)
      expect(t.labourCost).toBeCloseTo(t.labourDays * t.dayRate * 2)
    })
  })

  it("bedroom cosmetic_refresh with bedrooms=3 scales tasks by 3", () => {
    const tasks = generateTasksFromScope({
      ...baseScope,
      bedrooms: 3,
      bedroom: { scope: "cosmetic_refresh" },
    })
    const bedroomTasks = tasks.filter((t) => t.room === "bedroom")
    expect(bedroomTasks.length).toBeGreaterThan(0)
    bedroomTasks.forEach((t) => {
      expect(t.quantity).toBe(3)
      expect(t.labourCost).toBeCloseTo(t.labourDays * t.dayRate * 3)
    })
  })

  it("flooring with floorAreaSqm uses sqm quantity and per_sqm scaling", () => {
    const tasks = generateTasksFromScope({
      ...baseScope,
      floorAreaSqm: 80,
      flooring: { replaceWholeProperty: true },
    })
    const flooringTasks = tasks.filter((t) => t.scope === "flooring_replacement")
    expect(flooringTasks.length).toBeGreaterThan(0)
    flooringTasks.forEach((t) => {
      expect(t.quantity).toBe(80)
      expect(t.scalingRule).toBe("per_sqm")
      expect(t.warnings).toHaveLength(0)
    })
  })

  it("flooring without floorAreaSqm uses room-count fallback and returns warning", () => {
    const tasks = generateTasksFromScope({
      ...baseScope,
      bedrooms: 3,
      bathrooms: 1,
      flooring: { replaceWholeProperty: true },
      // floorAreaSqm deliberately omitted
    })
    const flooringTasks = tasks.filter((t) => t.scope === "flooring_replacement")
    expect(flooringTasks.length).toBeGreaterThan(0)
    flooringTasks.forEach((t) => {
      expect(t.warnings.length).toBeGreaterThan(0)
      expect(t.warnings[0]).toContain("Floor area was not provided")
      // Room count = 3 bed + 1 bath + 2 extra = 6
      expect(t.quantity).toBe(6)
    })
  })

  it("rewire generates electrician tasks", () => {
    const tasks = generateTasksFromScope({
      ...baseScope,
      majorWorks: { rewire: true, boiler: false, roof: false },
    })
    const rewireTasks = tasks.filter((t) => t.scope === "rewire")
    expect(rewireTasks.length).toBeGreaterThan(0)
    const trades = rewireTasks.map((t) => t.trade)
    expect(trades).toContain("electrician")
  })

  it("boiler generates gas_engineer task with positive totalCost", () => {
    const tasks = generateTasksFromScope({
      ...baseScope,
      majorWorks: { rewire: false, boiler: true, roof: false },
    })
    const boilerTasks = tasks.filter((t) => t.trade === "gas_engineer")
    expect(boilerTasks.length).toBeGreaterThan(0)
    boilerTasks.forEach((t) => {
      expect(t.totalCost).toBeGreaterThan(0)
    })
  })

  it("roof generates placeholder task with warning", () => {
    const tasks = generateTasksFromScope({
      ...baseScope,
      majorWorks: { rewire: false, boiler: false, roof: true },
    })
    const roofTasks = tasks.filter((t) => t.scope === "roof")
    expect(roofTasks.length).toBeGreaterThan(0)
    roofTasks.forEach((t) => {
      expect(t.warnings.length).toBeGreaterThan(0)
      expect(t.warnings[0].toLowerCase()).toContain("placeholder")
    })
  })

  it("kitchen keep generates no tasks", () => {
    const tasks = generateTasksFromScope({ ...baseScope, kitchen: { scope: "keep", size: "medium" } })
    expect(tasks.filter((t) => t.room === "kitchen")).toHaveLength(0)
  })

  it("unsupported kitchen scope returns warning stub with zero cost", () => {
    const tasks = generateTasksFromScope({
      ...baseScope,
      kitchen: { scope: "refresh", size: "medium" },
    })
    const stub = tasks.find((t) => t.id === "kitchen-refresh-unsupported")
    expect(stub).toBeDefined()
    expect(stub!.totalCost).toBe(0)
    expect(stub!.warnings.length).toBeGreaterThan(0)
  })

  it("totalCost equals labourCost plus materialCost times quantity", () => {
    const tasks = generateTasksFromScope({
      ...baseScope,
      kitchen: { scope: "full_replace", size: "large" },
      bathroom: { scope: "full_replace" },
      bedroom: { scope: "cosmetic_refresh" },
    })
    tasks.forEach((t) => {
      const expected = t.labourCost + t.materialCost * t.quantity
      expect(t.totalCost).toBeCloseTo(expected)
    })
  })

})
