import { describe, it, expect } from "vitest"
import { calculateTimeline } from "@/lib/engine/timeline-engine"
import type { GeneratedRefurbTask } from "@/types/refurb"

function makeTask(overrides: Partial<GeneratedRefurbTask>): GeneratedRefurbTask {
  return {
    id: "test-task",
    room: "kitchen",
    scope: "full_replace",
    taskName: "Test task",
    trade: "builder",
    labourDays: 1,
    dayRate: 400,
    materialCost: 0,
    scalingRule: "fixed",
    quantity: 1,
    labourCost: 400,
    totalCost: 400,
    assumptionsUsed: [],
    warnings: [],
    ...overrides,
  }
}

describe("calculateTimeline", () => {

  it("empty task list returns 0 weeks and 0 working days", () => {
    const result = calculateTimeline([])
    expect(result.totalCalendarWeeks).toBe(0)
    expect(result.totalWorkingDays).toBe(0)
    expect(result.totalWorkingDaysWithContingency).toBe(0)
  })

  it("contingencyFactor is 1.2 (20% buffer)", () => {
    const result = calculateTimeline([])
    expect(result.contingencyFactor).toBe(1.2)
  })

  it("single phase-1 trade: correct calendar weeks", () => {
    // labourer phase 1, 5 working days → 5 × 1.2 = 6 days → 2 weeks
    const tasks = [makeTask({ trade: "labourer", labourDays: 5, quantity: 1 })]
    const result = calculateTimeline(tasks)
    expect(result.totalWorkingDays).toBe(5)
    expect(result.totalWorkingDaysWithContingency).toBe(6) // ceil(5 × 1.2) = 6
    expect(result.totalCalendarWeeks).toBe(2)             // ceil(6 / 5) = 2
  })

  it("single phase-3 trade: phases 1 and 2 contribute 0 days", () => {
    const tasks = [makeTask({ trade: "decorator", labourDays: 3, quantity: 1 })]
    const result = calculateTimeline(tasks)
    const phase1 = result.phases.find((p) => p.phase === 1)!
    const phase2 = result.phases.find((p) => p.phase === 2)!
    const phase3 = result.phases.find((p) => p.phase === 3)!
    expect(phase1.workingDays).toBe(0)
    expect(phase2.workingDays).toBe(0)
    expect(phase3.workingDays).toBe(3)
  })

  it("two trades in the same phase: phase duration = max, not sum", () => {
    // electrician (phase 2) 7 days + plumber (phase 2) 3 days → phase 2 = 7
    const tasks = [
      makeTask({ trade: "electrician", labourDays: 7, quantity: 1 }),
      makeTask({ trade: "plumber", labourDays: 3, quantity: 1 }),
    ]
    const result = calculateTimeline(tasks)
    const phase2 = result.phases.find((p) => p.phase === 2)!
    expect(phase2.workingDays).toBe(7)
    expect(result.totalWorkingDays).toBe(7)
  })

  it("trades across different phases: total = sum of phase maximums", () => {
    // Phase 1: labourer 2d → 2
    // Phase 2: electrician 4d, plumber 3d → 4
    // Phase 3: decorator 2d → 2
    // Total = 2 + 4 + 2 = 8
    const tasks = [
      makeTask({ trade: "labourer", labourDays: 2, quantity: 1 }),
      makeTask({ trade: "electrician", labourDays: 4, quantity: 1 }),
      makeTask({ trade: "plumber", labourDays: 3, quantity: 1 }),
      makeTask({ trade: "decorator", labourDays: 2, quantity: 1 }),
    ]
    const result = calculateTimeline(tasks)
    expect(result.totalWorkingDays).toBe(8)
  })

  it("quantity multiplies effective labour days", () => {
    // decorator 1 labourDay × 3 quantity = 3 effective days in phase 3
    const tasks = [makeTask({ trade: "decorator", labourDays: 1, quantity: 3 })]
    const result = calculateTimeline(tasks)
    const phase3 = result.phases.find((p) => p.phase === 3)!
    expect(phase3.workingDays).toBe(3)
  })

  it("trade schedule contains correct phase assignment", () => {
    const tasks = [
      makeTask({ trade: "roofer", labourDays: 3, quantity: 1 }),
      makeTask({ trade: "electrician", labourDays: 5, quantity: 1 }),
      makeTask({ trade: "tiler", labourDays: 2, quantity: 1 }),
    ]
    const result = calculateTimeline(tasks)
    const rooferEntry = result.tradeSchedule.find((ts) => ts.trade === "roofer")!
    const electricianEntry = result.tradeSchedule.find((ts) => ts.trade === "electrician")!
    const tilerEntry = result.tradeSchedule.find((ts) => ts.trade === "tiler")!
    expect(rooferEntry.phase).toBe(1)
    expect(electricianEntry.phase).toBe(2)
    expect(tilerEntry.phase).toBe(3)
  })

  it("same trade across multiple tasks: labour days are summed", () => {
    const tasks = [
      makeTask({ trade: "plasterer", labourDays: 2, quantity: 1 }),
      makeTask({ trade: "plasterer", labourDays: 1, quantity: 1 }),
    ]
    const result = calculateTimeline(tasks)
    const plastererEntry = result.tradeSchedule.find((ts) => ts.trade === "plasterer")!
    expect(plastererEntry.totalLabourDays).toBe(3)
  })

  it("phase labels are correct", () => {
    const result = calculateTimeline([])
    const labels = result.phases.map((p) => p.label)
    expect(labels).toContain("Strip & Structural")
    expect(labels).toContain("First & Second Fix")
    expect(labels).toContain("Finishing")
  })

  it("warnings are passed through from tasks and deduplicated", () => {
    const tasks = [
      makeTask({ warnings: ["Roof is placeholder"] }),
      makeTask({ warnings: ["Roof is placeholder"] }),
      makeTask({ warnings: ["Floor area was not provided"] }),
    ]
    const result = calculateTimeline(tasks)
    expect(result.warnings).toHaveLength(2)
    expect(result.warnings).toContain("Roof is placeholder")
    expect(result.warnings).toContain("Floor area was not provided")
  })

  it("assumptions list is non-empty", () => {
    const result = calculateTimeline([])
    expect(result.assumptions.length).toBeGreaterThan(0)
  })

  it("totalWorkingDaysWithContingency = ceil(totalWorkingDays × 1.2)", () => {
    const tasks = [makeTask({ trade: "labourer", labourDays: 3, quantity: 1 })]
    const result = calculateTimeline(tasks)
    expect(result.totalWorkingDaysWithContingency).toBe(
      Math.ceil(result.totalWorkingDays * result.contingencyFactor)
    )
  })

  it("totalCalendarWeeks = ceil(totalWorkingDaysWithContingency / 5)", () => {
    const tasks = [makeTask({ trade: "labourer", labourDays: 10, quantity: 1 })]
    const result = calculateTimeline(tasks)
    expect(result.totalCalendarWeeks).toBe(
      Math.ceil(result.totalWorkingDaysWithContingency / 5)
    )
  })

})
