import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}))

vi.mock("@/lib/db/postgres", () => ({
  query: queryMock,
}))

import {
  completeTask,
  createTask,
  listTasksForDeal,
  markTaskBlocked,
  updateTaskStatus,
} from "@/lib/operator-command/deal-tasks-repository"

describe("phase 4a deal tasks repository", () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it("createTask inserts into deal_tasks with expected fields", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: "task-1",
        deal_id: "deal-1",
        task_title: "Collect title pack",
        task_type: "DUE_DILIGENCE",
        task_status: "OPEN",
        priority: "MEDIUM",
        due_date: null,
        blocker_reason: null,
        created_at: "2026-05-22",
        completed_at: null,
      }],
    })

    await createTask("deal-1", {
      task_title: "Collect title pack",
    })

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("INSERT INTO lake_views_property.deal_tasks")
    expect(sql).toContain("deal_id")
    expect(sql).toContain("task_title")
    expect(sql).toContain("task_type")
    expect(sql).toContain("task_status")
    expect(sql).toContain("priority")
    expect(sql).toContain("due_date")
    expect(sql).toContain("blocker_reason")
    expect(params[0]).toBe("deal-1")
    expect(params[1]).toBe("Collect title pack")
  })

  it("createTask returns mapped task row", async () => {
    const row = {
      id: "task-2",
      deal_id: "deal-1",
      task_title: "Request EPC",
      task_type: "DUE_DILIGENCE",
      task_status: "OPEN",
      priority: "HIGH",
      due_date: "2026-05-30",
      blocker_reason: null,
      created_at: "2026-05-22",
      completed_at: null,
    }
    queryMock.mockResolvedValueOnce({ rows: [row] })

    const result = await createTask("deal-1", {
      task_title: "Request EPC",
      priority: "HIGH",
      due_date: "2026-05-30",
    })

    expect(result).toEqual(row)
  })

  it("listTasksForDeal queries by deal_id", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await listTasksForDeal("deal-abc")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("FROM lake_views_property.deal_tasks")
    expect(sql).toContain("WHERE deal_id = $1")
    expect(params).toEqual(["deal-abc"])
  })

  it("updateTaskStatus updates only task_status", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await updateTaskStatus("task-1", "OPEN")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("UPDATE lake_views_property.deal_tasks")
    expect(sql).toContain("SET task_status = $2")
    expect(sql).not.toContain("blocker_reason =")
    expect(sql).not.toContain("completed_at =")
    expect(params).toEqual(["task-1", "OPEN"])
  })

  it("markTaskBlocked updates task_status BLOCKED and blocker_reason", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await markTaskBlocked("task-1", "Awaiting survey access")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("UPDATE lake_views_property.deal_tasks")
    expect(sql).toContain("SET task_status = 'BLOCKED'")
    expect(sql).toContain("blocker_reason = $2")
    expect(sql).not.toContain("completed_at =")
    expect(params).toEqual(["task-1", "Awaiting survey access"])
  })

  it("completeTask updates task_status COMPLETE and completed_at", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await completeTask("task-1")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("UPDATE lake_views_property.deal_tasks")
    expect(sql).toContain("SET task_status = 'COMPLETE'")
    expect(sql).toContain("completed_at = NOW()")
    expect(sql).not.toContain("blocker_reason =")
    expect(params).toEqual(["task-1"])
  })

  it("helpers do not touch saved_deals, engine_result_json, or pipeline state", async () => {
    queryMock.mockResolvedValue({ rows: [] })
    await listTasksForDeal("deal-1")

    const sqlTexts = queryMock.mock.calls.map(([sql]) => String(sql)).join("\n")
    expect(sqlTexts).not.toContain("saved_deals")
    expect(sqlTexts).not.toContain("engine_result_json")
    expect(sqlTexts).not.toContain("pipeline_state")
  })

  it("repository module has no calculator/engine imports", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "lib/operator-command/deal-tasks-repository.ts"),
      "utf8"
    )
    expect(source).not.toContain("@/lib/engine")
    expect(source).not.toContain("@/lib/calculations")
    expect(source).not.toContain("@/app/page")
  })

  it("does not introduce forbidden runtime keys", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: "task-3",
        deal_id: "deal-1",
        task_title: "Review lease terms",
        task_type: "DUE_DILIGENCE",
        task_status: "OPEN",
        priority: "MEDIUM",
        due_date: null,
        blocker_reason: null,
        created_at: "2026-05-22",
        completed_at: null,
      }],
    })

    const payload = await createTask("deal-1", { task_title: "Review lease terms" })
    const serialized = JSON.stringify(payload)

    for (const forbidden of ["aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`)
    }
  })
})

