import { describe, expect, it } from "vitest"
import type { DealTaskRecord } from "@/lib/operator-command/deal-tasks-repository"
import { selectActiveInvestorSummaryTasks } from "@/lib/investor-summary/select-active-investor-summary-tasks"

function makeTask(overrides: Partial<DealTaskRecord> = {}): DealTaskRecord {
  return {
    id: "task-base",
    deal_id: "deal-1",
    task_title: "Confirm finance blocker evidence",
    task_type: "MANUAL_REVIEW",
    task_status: "IN_PROGRESS",
    priority: "HIGH",
    due_date: "2026-01-19T17:00:00.000Z",
    blocker_reason: "Awaiting finance confirmation",
    created_at: "2026-01-16T11:05:00.000Z",
    completed_at: null,
    ...overrides,
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue)
    }
  }

  return value
}

describe("selectActiveInvestorSummaryTasks", () => {
  it("includes every proven active status", () => {
    const tasks = [
      makeTask({ id: "task-open", task_status: "OPEN" }),
      makeTask({ id: "task-progress", task_status: "IN_PROGRESS" }),
      makeTask({ id: "task-blocked", task_status: "BLOCKED" }),
    ]

    const result = selectActiveInvestorSummaryTasks(tasks)

    expect(result.map((task) => task.taskId)).toEqual(["task-open", "task-progress", "task-blocked"])
  })

  it("excludes every proven terminal status", () => {
    const tasks = [
      makeTask({ id: "task-complete", task_status: "COMPLETE" }),
      makeTask({ id: "task-cancelled", task_status: "CANCELLED" }),
    ]

    expect(selectActiveInvestorSummaryTasks(tasks)).toEqual([])
  })

  it("maps included tasks to the current Investor Summary task contract", () => {
    const task = makeTask({
      id: "task-mapped",
      task_title: "Confirm finance blocker evidence",
      task_type: "MANUAL_REVIEW",
      task_status: "IN_PROGRESS",
      priority: "HIGH",
      due_date: "2026-01-19T17:00:00.000Z",
      blocker_reason: null,
      completed_at: null,
    })

    expect(selectActiveInvestorSummaryTasks([task])).toEqual([
      {
        taskId: "task-mapped",
        title: "Confirm finance blocker evidence",
        taskType: "MANUAL_REVIEW",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: "2026-01-19T17:00:00.000Z",
        blockerReason: null,
        createdAt: "2026-01-16T11:05:00.000Z",
        completedAt: null,
      },
    ])
  })

  it("preserves input order after filtering", () => {
    const tasks = [
      makeTask({ id: "task-complete", task_status: "COMPLETE" }),
      makeTask({ id: "task-first", task_status: "OPEN" }),
      makeTask({ id: "task-second", task_status: "BLOCKED" }),
      makeTask({ id: "task-third", task_status: "IN_PROGRESS" }),
      makeTask({ id: "task-cancelled", task_status: "CANCELLED" }),
    ]

    const result = selectActiveInvestorSummaryTasks(tasks)

    expect(result.map((task) => task.taskId)).toEqual(["task-first", "task-second", "task-third"])
  })

  it("returns an empty array for empty input", () => {
    expect(selectActiveInvestorSummaryTasks([])).toEqual([])
  })

  it("returns an empty array when all tasks are terminal", () => {
    const tasks = [
      makeTask({ id: "task-complete", task_status: "COMPLETE" }),
      makeTask({ id: "task-cancelled", task_status: "CANCELLED" }),
    ]

    expect(selectActiveInvestorSummaryTasks(tasks)).toEqual([])
  })

  it("preserves nullable due date and blocker reason", () => {
    const task = makeTask({
      id: "task-nullables",
      task_status: "OPEN",
      due_date: null,
      blocker_reason: null,
    })

    expect(selectActiveInvestorSummaryTasks([task])).toEqual([
      expect.objectContaining({
        dueDate: null,
        blockerReason: null,
      }),
    ])
  })

  it("does not mutate the input array", () => {
    const tasks = deepFreeze([
      makeTask({ id: "task-1", task_status: "OPEN" }),
      makeTask({ id: "task-2", task_status: "COMPLETE" }),
    ])
    const snapshot = structuredClone(tasks)

    selectActiveInvestorSummaryTasks(tasks)

    expect(tasks).toEqual(snapshot)
  })

  it("does not mutate input task records", () => {
    const task = deepFreeze(
      makeTask({
        id: "task-immutable",
        task_status: "IN_PROGRESS",
        blocker_reason: "Awaiting finance confirmation",
      })
    )
    const snapshot = structuredClone(task)

    selectActiveInvestorSummaryTasks([task])

    expect(task).toEqual(snapshot)
  })

  it("preserves duplicate active records", () => {
    const task = makeTask({
      id: "task-duplicate",
      task_status: "BLOCKED",
    })

    const result = selectActiveInvestorSummaryTasks([task, task])

    expect(result).toHaveLength(2)
    expect(result.map((item) => item.taskId)).toEqual(["task-duplicate", "task-duplicate"])
  })
})
