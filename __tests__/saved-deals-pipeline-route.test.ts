import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getSavedDealByIdMock,
  updateSavedDealPipelineStateMock,
  evaluateOperatorGuardMock,
} = vi.hoisted(() => ({
  getSavedDealByIdMock: vi.fn(),
  updateSavedDealPipelineStateMock: vi.fn(),
  evaluateOperatorGuardMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: getSavedDealByIdMock,
  updateSavedDealPipelineState: updateSavedDealPipelineStateMock,
}))

vi.mock("@/lib/operator-command/evaluate-operator-guard", () => ({
  evaluateOperatorGuard: evaluateOperatorGuardMock,
}))

import { POST } from "@/app/api/saved-deals/[id]/pipeline/route"

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/saved-deals/deal-1/pipeline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const savedDealFixture = {
  id: "deal-1",
  pipeline_state: "UNDER_ANALYSIS",
  governance_state: "STRONG_OPPORTUNITY",
  classification: "STRONG_OPPORTUNITY",
  engine_result_json: { untouched: true },
}

describe("phase 4a saved deal pipeline route", () => {
  beforeEach(() => {
    getSavedDealByIdMock.mockReset()
    updateSavedDealPipelineStateMock.mockReset()
    evaluateOperatorGuardMock.mockReset()
  })

  it("returns 200 and updates pipeline when guard allows", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(savedDealFixture)
    evaluateOperatorGuardMock.mockReturnValueOnce({
      decision: "ALLOW",
      allowed: true,
      reasons: ["ALLOWED_BY_GOVERNANCE"],
      required_task_type: null,
      block_message: null,
      warning_message: null,
    })
    updateSavedDealPipelineStateMock.mockResolvedValueOnce({
      ...savedDealFixture,
      pipeline_state: "READY_FOR_OFFER",
    })

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(200)
    expect(updateSavedDealPipelineStateMock).toHaveBeenCalledWith("deal-1", "READY_FOR_OFFER")
  })

  it("returns 404 when saved deal not found", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "missing" },
    })

    expect(response.status).toBe(404)
  })

  it("returns 400 for missing requested_pipeline_state", async () => {
    const response = await POST(makeRequest({}), { params: { id: "deal-1" } })
    expect(response.status).toBe(400)
  })

  it("returns 409 and does not update when guard blocks", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(savedDealFixture)
    evaluateOperatorGuardMock.mockReturnValueOnce({
      decision: "BLOCK",
      allowed: false,
      reasons: ["GOVERNANCE_REJECT_OR_FATAL"],
      required_task_type: null,
      block_message: "blocked",
      warning_message: null,
    })

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(409)
    expect(updateSavedDealPipelineStateMock).not.toHaveBeenCalled()
  })

  it("returns 409 and does not update when guard requires review/task", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(savedDealFixture)
    evaluateOperatorGuardMock.mockReturnValueOnce({
      decision: "REQUIRE_TASK",
      allowed: false,
      reasons: ["MANUAL_REVIEW_REQUIRED"],
      required_task_type: "MANUAL_REVIEW",
      block_message: null,
      warning_message: null,
    })

    const response = await POST(makeRequest({ requested_pipeline_state: "DUE_DILIGENCE" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(409)
    expect(updateSavedDealPipelineStateMock).not.toHaveBeenCalled()
  })

  it("returns safe 500 on repository failure", async () => {
    getSavedDealByIdMock.mockRejectedValueOnce(new Error("db details"))

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: "Unable to update saved deal pipeline at this time.",
    })
  })

  it("guard input uses saved deal governance/classification/current pipeline", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(savedDealFixture)
    evaluateOperatorGuardMock.mockReturnValueOnce({
      decision: "ALLOW",
      allowed: true,
      reasons: ["ALLOWED_BY_GOVERNANCE"],
      required_task_type: null,
      block_message: null,
      warning_message: null,
    })
    updateSavedDealPipelineStateMock.mockResolvedValueOnce(savedDealFixture)

    await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(evaluateOperatorGuardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        governance_state: savedDealFixture.governance_state,
        classification: savedDealFixture.classification,
        current_pipeline_state: savedDealFixture.pipeline_state,
        requested_pipeline_state: "READY_FOR_OFFER",
      })
    )
  })

  it("route does not import calculator/engine modules and does not mutate engine_result_json", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(savedDealFixture)
    evaluateOperatorGuardMock.mockReturnValueOnce({
      decision: "ALLOW",
      allowed: true,
      reasons: ["ALLOWED_BY_GOVERNANCE"],
      required_task_type: null,
      block_message: null,
      warning_message: null,
    })
    updateSavedDealPipelineStateMock.mockResolvedValueOnce(savedDealFixture)

    await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    const routeSource = readFileSync(
      path.resolve(process.cwd(), "app/api/saved-deals/[id]/pipeline/route.ts"),
      "utf8"
    )
    expect(routeSource).not.toContain("@/lib/engine")
    expect(routeSource).not.toContain("@/lib/calculations")
    expect(routeSource).not.toContain("@/app/page")
    expect(updateSavedDealPipelineStateMock.mock.calls[0]).toStrictEqual(["deal-1", "READY_FOR_OFFER"])
  })

  it("does not introduce forbidden runtime keys", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(savedDealFixture)
    evaluateOperatorGuardMock.mockReturnValueOnce({
      decision: "ALLOW",
      allowed: true,
      reasons: ["ALLOWED_BY_GOVERNANCE"],
      required_task_type: null,
      block_message: null,
      warning_message: null,
    })
    updateSavedDealPipelineStateMock.mockResolvedValueOnce(savedDealFixture)

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    const payload = await response.json()
    const serialized = JSON.stringify(payload)
    for (const forbidden of ["aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`)
    }
  })
})
