import { describe, it, expect } from "vitest"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import type { GeneratedRefurbTask } from "@/types/refurb"

function makeTask(overrides: Partial<GeneratedRefurbTask>): GeneratedRefurbTask {
  return {
    id: "test-task",
    room: "kitchen",
    scope: "full_replace",
    taskName: "Test task",
    trade: "builder",
    labourDays: 2,
    dayRate: 400,
    materialCost: 500,
    scalingRule: "fixed",
    quantity: 1,
    labourCost: 800,
    totalCost: 1300,
    assumptionsUsed: [],
    warnings: [],
    ...overrides,
  }
}

describe("calculateRefurbCost", () => {

  it("empty task list returns all zeros", () => {
    const result = calculateRefurbCost([])
    expect(result.totalRefurbCost).toBe(0)
    expect(result.labourCost).toBe(0)
    expect(result.materialCost).toBe(0)
    expect(result.roomBreakdown).toEqual({})
    expect(result.tradeBreakdown).toEqual({})
    expect(result.taskList).toHaveLength(0)
    expect(result.confidenceFlags).toHaveLength(0)
  })

  it("single task: totalRefurbCost = labourCost + materialCost × quantity", () => {
    const task = makeTask({ labourCost: 800, materialCost: 500, quantity: 1, totalCost: 1300 })
    const result = calculateRefurbCost([task])
    expect(result.totalRefurbCost).toBe(1300)
    expect(result.labourCost).toBe(800)
    expect(result.materialCost).toBe(500)
  })

  it("quantity > 1: materialCost scales with quantity", () => {
    const task = makeTask({
      labourCost: 1600, // 2 days × £400 × 2 quantity
      materialCost: 500, // per-unit
      quantity: 2,
      totalCost: 2600,  // 1600 + (500 × 2)
    })
    const result = calculateRefurbCost([task])
    expect(result.totalRefurbCost).toBe(2600)
    expect(result.labourCost).toBe(1600)
    expect(result.materialCost).toBe(1000) // 500 × 2
  })

  it("multiple tasks: totals sum correctly", () => {
    const tasks = [
      makeTask({ totalCost: 1300, labourCost: 800, materialCost: 500, quantity: 1 }),
      makeTask({ totalCost: 2000, labourCost: 1500, materialCost: 500, quantity: 1 }),
    ]
    const result = calculateRefurbCost(tasks)
    expect(result.totalRefurbCost).toBe(3300)
    expect(result.labourCost).toBe(2300)
    expect(result.materialCost).toBe(1000)
  })

  it("room breakdown groups tasks by room and sums totalCost", () => {
    const tasks = [
      makeTask({ room: "kitchen", totalCost: 1500 }),
      makeTask({ room: "bathroom", totalCost: 2000 }),
      makeTask({ room: "kitchen", totalCost: 500 }),
    ]
    const result = calculateRefurbCost(tasks)
    expect(result.roomBreakdown["kitchen"]).toBeCloseTo(2000)
    expect(result.roomBreakdown["bathroom"]).toBeCloseTo(2000)
  })

  it("trade breakdown groups tasks by trade and sums totalCost", () => {
    const tasks = [
      makeTask({ trade: "plumber", totalCost: 800 }),
      makeTask({ trade: "electrician", totalCost: 600 }),
      makeTask({ trade: "plumber", totalCost: 200 }),
    ]
    const result = calculateRefurbCost(tasks)
    expect(result.tradeBreakdown["plumber"]).toBeCloseTo(1000)
    expect(result.tradeBreakdown["electrician"]).toBeCloseTo(600)
  })

  it("taskList is passed through unchanged", () => {
    const tasks = [makeTask({}), makeTask({ id: "second-task" })]
    const result = calculateRefurbCost(tasks)
    expect(result.taskList).toHaveLength(2)
    expect(result.taskList[0].id).toBe("test-task")
    expect(result.taskList[1].id).toBe("second-task")
  })

  it("confidenceFlags collects warnings from all tasks", () => {
    const tasks = [
      makeTask({ warnings: ["Warning A"] }),
      makeTask({ warnings: ["Warning B"] }),
    ]
    const result = calculateRefurbCost(tasks)
    expect(result.confidenceFlags).toContain("Warning A")
    expect(result.confidenceFlags).toContain("Warning B")
  })

  it("confidenceFlags deduplicates identical warnings", () => {
    const tasks = [
      makeTask({ warnings: ["Roof is a placeholder"] }),
      makeTask({ warnings: ["Roof is a placeholder"] }),
    ]
    const result = calculateRefurbCost(tasks)
    expect(result.confidenceFlags).toHaveLength(1)
  })

  it("tasks with no warnings produce empty confidenceFlags", () => {
    const tasks = [makeTask({ warnings: [] }), makeTask({ warnings: [] })]
    const result = calculateRefurbCost(tasks)
    expect(result.confidenceFlags).toHaveLength(0)
  })

  it("totalRefurbCost equals labourCost plus materialCost for all tasks", () => {
    const tasks = [
      makeTask({ labourCost: 800, materialCost: 500, quantity: 1, totalCost: 1300 }),
      makeTask({ labourCost: 400, materialCost: 300, quantity: 2, totalCost: 1000 }),
    ]
    const result = calculateRefurbCost(tasks)
    expect(result.totalRefurbCost).toBeCloseTo(result.labourCost + result.materialCost)
  })

})
