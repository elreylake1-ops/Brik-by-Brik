import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { createTaskMock, listTasksForDealMock } = vi.hoisted(() => ({
  createTaskMock: vi.fn(),
  listTasksForDealMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/deal-tasks-repository", () => ({
  createTask: createTaskMock,
  listTasksForDeal: listTasksForDealMock,
}))

import { GET, POST } from "@/app/api/saved-deals/[id]/tasks/route"

function makeGetRequest() {
  return new Request("http://localhost/api/saved-deals/deal-1/tasks", { method: "GET" })
}

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/saved-deals/deal-1/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("phase 4a deal tasks api route", () => {
  beforeEach(() => {
    createTaskMock.mockReset()
    listTasksForDealMock.mockReset()
  })

  it("GET returns 200 and tasks array", async () => {
    listTasksForDealMock.mockResolvedValueOnce([{ id: "task-1" }])

    const response = await GET(makeGetRequest(), { params: { id: "deal-1" } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, tasks: [{ id: "task-1" }] })
  })

  it("GET invalid/missing id returns 400", async () => {
    const missing = await GET(makeGetRequest(), { params: {} })
    expect(missing.status).toBe(400)

    const blank = await GET(makeGetRequest(), { params: { id: "  " } })
    expect(blank.status).toBe(400)
  })

  it("GET repository failure returns safe 500", async () => {
    listTasksForDealMock.mockRejectedValueOnce(new Error("db details"))
    const response = await GET(makeGetRequest(), { params: { id: "deal-1" } })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: "Unable to load deal tasks at this time.",
    })
  })

  it("POST valid body returns 201 and created task", async () => {
    createTaskMock.mockResolvedValueOnce({ id: "task-2" })
    const response = await POST(
      makePostRequest({
        task_title: "Collect title pack",
        task_type: "DUE_DILIGENCE",
        task_status: "OPEN",
        priority: "HIGH",
        due_date: "2026-06-01",
        blocker_reason: null,
      }),
      { params: { id: "deal-1" } }
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ success: true, task: { id: "task-2" } })
  })

  it("POST defaults task_type to DUE_DILIGENCE if missing", async () => {
    createTaskMock.mockResolvedValueOnce({ id: "task-3" })
    await POST(makePostRequest({ task_title: "Request EPC" }), { params: { id: "deal-1" } })

    expect(createTaskMock).toHaveBeenCalledWith(
      "deal-1",
      expect.objectContaining({ task_type: "DUE_DILIGENCE" })
    )
  })

  it("POST defaults task_status to OPEN if missing", async () => {
    createTaskMock.mockResolvedValueOnce({ id: "task-4" })
    await POST(makePostRequest({ task_title: "Request EPC" }), { params: { id: "deal-1" } })

    expect(createTaskMock).toHaveBeenCalledWith(
      "deal-1",
      expect.objectContaining({ task_status: "OPEN" })
    )
  })

  it("POST defaults priority to MEDIUM if missing", async () => {
    createTaskMock.mockResolvedValueOnce({ id: "task-5" })
    await POST(makePostRequest({ task_title: "Request EPC" }), { params: { id: "deal-1" } })

    expect(createTaskMock).toHaveBeenCalledWith(
      "deal-1",
      expect.objectContaining({ priority: "MEDIUM" })
    )
  })

  it("POST missing/invalid task_title returns 400", async () => {
    const missing = await POST(makePostRequest({}), { params: { id: "deal-1" } })
    expect(missing.status).toBe(400)

    const invalid = await POST(makePostRequest({ task_title: 123 }), { params: { id: "deal-1" } })
    expect(invalid.status).toBe(400)

    const blank = await POST(makePostRequest({ task_title: "   " }), { params: { id: "deal-1" } })
    expect(blank.status).toBe(400)
  })

  it("POST repository failure returns safe 500", async () => {
    createTaskMock.mockRejectedValueOnce(new Error("db details"))
    const response = await POST(makePostRequest({ task_title: "Review lease" }), { params: { id: "deal-1" } })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: "Unable to create deal task at this time.",
    })
  })

  it("route does not import calculator/engine modules", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "app/api/saved-deals/[id]/tasks/route.ts"),
      "utf8"
    )
    expect(source).not.toContain("@/lib/engine")
    expect(source).not.toContain("@/lib/calculations")
    expect(source).not.toContain("@/app/page")
  })

  it("route does not touch saved_deals, pipeline_state, or engine_result_json", async () => {
    listTasksForDealMock.mockResolvedValueOnce([])
    await GET(makeGetRequest(), { params: { id: "deal-1" } })

    const source = readFileSync(
      path.resolve(process.cwd(), "app/api/saved-deals/[id]/tasks/route.ts"),
      "utf8"
    )
    expect(source).not.toContain("saved_deals")
    expect(source).not.toContain("pipeline_state")
    expect(source).not.toContain("engine_result_json")
  })

  it("does not introduce forbidden runtime keys", async () => {
    listTasksForDealMock.mockResolvedValueOnce([{ id: "task-6" }])
    const response = await GET(makeGetRequest(), { params: { id: "deal-1" } })
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    for (const forbidden of ["aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`)
    }
  })
})
