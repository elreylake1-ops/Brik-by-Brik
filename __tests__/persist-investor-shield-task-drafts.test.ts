import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { InvestorShieldTaskDraft } from "@/lib/investor-shield/build-investor-shield-task-drafts"

const { createTaskMock, listTasksForDealMock } = vi.hoisted(() => ({
  createTaskMock: vi.fn(),
  listTasksForDealMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/deal-tasks-repository", () => ({
  createTask: createTaskMock,
  listTasksForDeal: listTasksForDealMock,
}))

import { persistInvestorShieldTaskDrafts } from "@/lib/investor-shield/persist-investor-shield-task-drafts"

function makeDrafts(): InvestorShieldTaskDraft[] {
  return [
    {
      dealId: "deal-persist-1",
      title: "Obtain builder quote",
      description: "Refurb certainty needs stronger builder evidence.",
      status: "OPEN",
      priority: "HIGH",
      taskType: "EVIDENCE",
      source: "investor_shield",
      gateKey: "REFURB_CERTAINTY",
      subGateKey: "BUILDER_QUOTE_EVIDENCE",
      idempotencyKey:
        "investor-shield:deal-persist-1:REFURB_CERTAINTY:OBTAIN_BUILDER_QUOTE",
    },
    {
      dealId: "deal-persist-1",
      title: "Review lender criteria",
      description: "Lender criteria evidence must be confirmed.",
      status: "OPEN",
      priority: "MEDIUM",
      taskType: "FINANCE_REVIEW",
      source: "investor_shield",
      gateKey: "LENDER_CRITERIA",
      idempotencyKey:
        "investor-shield:deal-persist-1:LENDER_CRITERIA:REVIEW_LENDER_CRITERIA",
    },
  ]
}

describe("persistInvestorShieldTaskDrafts", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    listTasksForDealMock.mockResolvedValue([])
    createTaskMock.mockImplementation(async (dealId: string, input: Record<string, unknown>) => ({
      id: "task-created",
      deal_id: dealId,
      task_title: input.task_title,
      task_type: input.task_type,
      task_status: input.task_status,
      priority: input.priority,
      due_date: null,
      blocker_reason: input.blocker_reason,
      created_at: "2026-06-05T00:00:00.000Z",
      completed_at: null,
    }))
  })

  it("inserts one task per unique draft", async () => {
    const drafts = makeDrafts()

    const result = await persistInvestorShieldTaskDrafts("deal-persist-1", drafts)

    expect(createTaskMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      insertedCount: 2,
      skippedDuplicateCount: 0,
      failedCount: 0,
      errors: [],
    })
  })

  it("skips duplicate drafts in the same call", async () => {
    const drafts = [...makeDrafts(), makeDrafts()[0]]

    const result = await persistInvestorShieldTaskDrafts("deal-persist-1", drafts)

    expect(createTaskMock).toHaveBeenCalledTimes(2)
    expect(result.skippedDuplicateCount).toBe(1)
  })

  it("skips already-existing equivalent investor shield tasks on repeated call", async () => {
    listTasksForDealMock.mockResolvedValue([
      {
        id: "task-1",
        deal_id: "deal-persist-1",
        task_title: "Obtain builder quote",
        task_type: "EVIDENCE",
        task_status: "OPEN",
        priority: "HIGH",
        due_date: null,
        blocker_reason:
          "Investor Shield ID: investor-shield:deal-persist-1:REFURB_CERTAINTY:OBTAIN_BUILDER_QUOTE | Refurb certainty needs stronger builder evidence.",
        created_at: "2026-06-05T00:00:00.000Z",
        completed_at: null,
      },
    ])

    const result = await persistInvestorShieldTaskDrafts("deal-persist-1", makeDrafts())

    expect(createTaskMock).toHaveBeenCalledTimes(1)
    expect(result.insertedCount).toBe(1)
    expect(result.skippedDuplicateCount).toBe(1)
  })

  it("returns empty counts when drafts array is empty", async () => {
    const result = await persistInvestorShieldTaskDrafts("deal-persist-1", [])

    expect(listTasksForDealMock).not.toHaveBeenCalled()
    expect(createTaskMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      insertedCount: 0,
      skippedDuplicateCount: 0,
      failedCount: 0,
      errors: [],
    })
  })

  it("preserves dealId as string and does not mutate input drafts", async () => {
    const drafts = makeDrafts()
    const before = JSON.parse(JSON.stringify(drafts))

    await persistInvestorShieldTaskDrafts("deal-persist-1", drafts)

    expect(typeof createTaskMock.mock.calls[0][0]).toBe("string")
    expect(drafts).toEqual(before)
  })

  it("handles insert failure safely and reports failedCount/errors", async () => {
    createTaskMock
      .mockResolvedValueOnce({
        id: "task-ok",
        deal_id: "deal-persist-1",
        task_title: "Obtain builder quote",
        task_type: "EVIDENCE",
        task_status: "OPEN",
        priority: "HIGH",
        due_date: null,
        blocker_reason: "marker",
        created_at: "2026-06-05T00:00:00.000Z",
        completed_at: null,
      })
      .mockRejectedValueOnce(new Error("insert failed"))

    const result = await persistInvestorShieldTaskDrafts("deal-persist-1", makeDrafts())

    expect(result.insertedCount).toBe(1)
    expect(result.failedCount).toBe(1)
    expect(result.errors).toEqual([
      "investor-shield:deal-persist-1:LENDER_CRITERIA:REVIEW_LENDER_CRITERIA: insert failed",
    ])
  })

  it("module does not touch saved deals, evaluator, or pipeline wiring", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/investor-shield/persist-investor-shield-task-drafts.ts"
      ),
      "utf8"
    )

    expect(source).not.toContain("@/lib/operator-command/saved-deals-repository")
    expect(source).not.toContain("evaluateInvestorShield")
    expect(source).not.toContain("loadAndEvaluateInvestorShield")
    expect(source).not.toContain("pipeline")
    expect(source).not.toContain("saved_deals")
  })
})
