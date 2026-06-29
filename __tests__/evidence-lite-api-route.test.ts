import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  createEvidenceLiteMock,
  getSavedDealByIdMock,
  listEvidenceLiteForDealMock,
  validateCreateEvidenceLiteInputMock,
} = vi.hoisted(() => ({
  createEvidenceLiteMock: vi.fn(),
  getSavedDealByIdMock: vi.fn(),
  listEvidenceLiteForDealMock: vi.fn(),
  validateCreateEvidenceLiteInputMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: getSavedDealByIdMock,
}))

vi.mock("@/lib/evidence-lite/evidence-lite-repository", () => ({
  createEvidenceLite: createEvidenceLiteMock,
  listEvidenceLiteForDeal: listEvidenceLiteForDealMock,
}))

vi.mock("@/lib/evidence-lite/evidence-lite-validation", () => ({
  validateCreateEvidenceLiteInput: validateCreateEvidenceLiteInputMock,
}))

import { GET, POST } from "@/app/api/saved-deals/[id]/evidence/route"

function makeGetRequest() {
  return new Request("http://localhost/api/saved-deals/deal-1/evidence", {
    method: "GET",
  })
}

function makePostRequest(body: string) {
  return new Request("http://localhost/api/saved-deals/deal-1/evidence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
}

describe("evidence lite api route", () => {
  beforeEach(() => {
    createEvidenceLiteMock.mockReset()
    getSavedDealByIdMock.mockReset()
    listEvidenceLiteForDealMock.mockReset()
    validateCreateEvidenceLiteInputMock.mockReset()
  })

  it("GET returns evidence for an existing saved deal", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    listEvidenceLiteForDealMock.mockResolvedValueOnce([
      {
        id: "evidence-1",
        dealId: "deal-1",
        evidenceType: "TITLE_REVIEW",
        linkedGate: "SOLICITOR_REVIEW",
        title: "Title pack",
        note: "Checked",
        status: "RECORDED",
        reviewed: false,
        reviewerNote: null,
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
      },
    ])

    const response = await GET(makeGetRequest(), { params: { id: " deal-1 " } })

    expect(response.status).toBe(200)
    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-1")
    expect(listEvidenceLiteForDealMock).toHaveBeenCalledWith("deal-1")

    const payload = await response.json()
    expect(payload).toEqual({
      success: true,
      evidence: [
        {
          id: "evidence-1",
          dealId: "deal-1",
          evidenceType: "TITLE_REVIEW",
          linkedGate: "SOLICITOR_REVIEW",
            title: "Title pack",
            note: "Checked",
            status: "RECORDED",
            reviewed: false,
            reviewerNote: null,
            createdAt: "2026-06-22T10:00:00.000Z",
            updatedAt: "2026-06-22T10:00:00.000Z",
          },
      ],
    })
  })

  it("GET returns an empty evidence array when no rows exist", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    listEvidenceLiteForDealMock.mockResolvedValueOnce([])

    const response = await GET(makeGetRequest(), { params: { id: "deal-1" } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, evidence: [] })
  })

  it("GET returns 400 for missing or blank ids", async () => {
    const missingResponse = await GET(makeGetRequest(), { params: {} })
    const blankResponse = await GET(makeGetRequest(), { params: { id: "   " } })

    expect(missingResponse.status).toBe(400)
    expect(blankResponse.status).toBe(400)
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(listEvidenceLiteForDealMock).not.toHaveBeenCalled()

    await expect(missingResponse.json()).resolves.toEqual({
      success: false,
      error: "Invalid saved deal id.",
    })
  })

  it("GET returns 404 when the saved deal is missing and does not list evidence", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    const response = await GET(makeGetRequest(), { params: { id: "missing" } })

    expect(response.status).toBe(404)
    expect(listEvidenceLiteForDealMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      success: false,
      error: "Saved deal not found.",
    })
  })

  it("GET returns a safe 500 error when the repository fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    getSavedDealByIdMock.mockRejectedValueOnce(new Error("postgresql://user:password@host/db token=secret"))

    const response = await GET(makeGetRequest(), { params: { id: "deal-1" } })

    expect(response.status).toBe(500)

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("EVIDENCE_LITE_READ_FAILED")
    expect(typeof payload.traceId).toBe("string")
    expect(payload.diagnostic.routeName).toBe("saved-deals.evidence")
    expect(payload.diagnostic.errorMessage).not.toContain("postgresql://")
    expect(payload.diagnostic.errorMessage).not.toContain("password")
    expect(payload.diagnostic.errorMessage).not.toContain("token")
    expect(payload.diagnostic.errorMessage).not.toContain("secret")
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it("POST returns 201 and creates canonical evidence for a valid body", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    validateCreateEvidenceLiteInputMock.mockReturnValueOnce({
      valid: true,
      errors: [],
      warnings: ["linkedGate normalized from SOLICITOR_FEEDBACK to SOLICITOR_REVIEW"],
      value: {
        dealId: "deal-1",
        evidenceType: "TITLE_REVIEW",
        linkedGate: "SOLICITOR_REVIEW",
        title: "Title pack",
        note: "Checked",
        status: "RECORDED",
        reviewed: false,
      },
    })
    createEvidenceLiteMock.mockResolvedValueOnce({
      id: "evidence-1",
      dealId: "deal-1",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      title: "Title pack",
      note: "Checked",
      status: "RECORDED",
      reviewed: false,
      reviewerNote: null,
      createdAt: "2026-06-22T10:00:00.000Z",
      updatedAt: "2026-06-22T10:00:00.000Z",
    })

    const response = await POST(
      makePostRequest(
        JSON.stringify({
          linkedGate: "SOLICITOR_FEEDBACK",
          evidenceType: "TITLE_REVIEW",
          title: "Title pack",
          note: "Checked",
          status: "RECORDED",
          reviewed: false,
        })
      ),
      { params: { id: " deal-1 " } }
    )

    expect(response.status).toBe(201)
    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-1")
    expect(validateCreateEvidenceLiteInputMock).toHaveBeenCalledWith({
      linkedGate: "SOLICITOR_FEEDBACK",
      evidenceType: "TITLE_REVIEW",
      title: "Title pack",
      note: "Checked",
      status: "RECORDED",
      reviewed: false,
      dealId: "deal-1",
    })
    expect(createEvidenceLiteMock).toHaveBeenCalledWith({
      dealId: "deal-1",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      title: "Title pack",
      note: "Checked",
      status: "RECORDED",
      reviewed: false,
    })

    const payload = await response.json()
    expect(payload).toEqual({
      success: true,
      evidence: {
        id: "evidence-1",
        dealId: "deal-1",
        evidenceType: "TITLE_REVIEW",
        linkedGate: "SOLICITOR_REVIEW",
        title: "Title pack",
        note: "Checked",
        status: "RECORDED",
        reviewed: false,
        reviewerNote: null,
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
      },
    })
  })

  it("POST rejects a body-supplied dealId before validation", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })

    const response = await POST(
      makePostRequest(
        JSON.stringify({
          dealId: "other-deal",
          linkedGate: "TITLE",
          evidenceType: "TITLE_REVIEW",
          title: "Title pack",
          note: "Checked",
          status: "RECORDED",
          reviewed: false,
        })
      ),
      { params: { id: "deal-1" } }
    )

    expect(response.status).toBe(400)
    expect(validateCreateEvidenceLiteInputMock).not.toHaveBeenCalled()
    expect(createEvidenceLiteMock).not.toHaveBeenCalled()

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("Invalid evidence input.")
    expect(payload.validation.errors).toEqual([
      {
        field: "dealId",
        message: "dealId is supplied by the route and must not be included in the body",
      },
    ])
  })

  it("POST returns a structured validation response for invalid values", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    validateCreateEvidenceLiteInputMock.mockReturnValueOnce({
      valid: false,
      errors: [
        { field: "linkedGate", message: "linkedGate must be one of: ... " },
        { field: "status", message: "status must be one of: ..." },
      ],
      warnings: [],
    })

    const response = await POST(
      makePostRequest(
        JSON.stringify({
          linkedGate: "GENERAL",
          evidenceType: "TITLE_REVIEW",
          title: "Title pack",
          note: "Checked",
          status: "RECEIVED",
          reviewed: false,
        })
      ),
      { params: { id: "deal-1" } }
    )

    expect(response.status).toBe(400)
    expect(createEvidenceLiteMock).not.toHaveBeenCalled()

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("Invalid evidence input.")
    expect(payload.validation.errors).toEqual([
      { field: "linkedGate", message: "linkedGate must be one of: ... " },
      { field: "status", message: "status must be one of: ..." },
    ])
  })

  it("POST returns 400 for malformed JSON and does not query repositories", async () => {
    const response = await POST(
      new Request("http://localhost/api/saved-deals/deal-1/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      { params: { id: "deal-1" } }
    )

    expect(response.status).toBe(400)
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(validateCreateEvidenceLiteInputMock).not.toHaveBeenCalled()
    expect(createEvidenceLiteMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      success: false,
      error: "Malformed JSON.",
    })
  })

  it("POST returns 404 when the saved deal is missing and does not create evidence", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    const response = await POST(
      makePostRequest(
        JSON.stringify({
          linkedGate: "TITLE",
          evidenceType: "TITLE_REVIEW",
          title: "Title pack",
          note: "Checked",
          status: "RECORDED",
          reviewed: false,
        })
      ),
      { params: { id: "missing" } }
    )

    expect(response.status).toBe(404)
    expect(validateCreateEvidenceLiteInputMock).not.toHaveBeenCalled()
    expect(createEvidenceLiteMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      success: false,
      error: "Saved deal not found.",
    })
  })

  it("POST returns a safe 500 error when create fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    validateCreateEvidenceLiteInputMock.mockReturnValueOnce({
      valid: true,
      errors: [],
      warnings: [],
      value: {
        dealId: "deal-1",
        evidenceType: "TITLE_REVIEW",
        linkedGate: "SOLICITOR_REVIEW",
        title: "Title pack",
        note: "Checked",
        status: "RECORDED",
        reviewed: false,
      },
    })
    createEvidenceLiteMock.mockRejectedValueOnce(
      new Error("postgresql://user:password@host/db secret token")
    )

    const response = await POST(
      makePostRequest(
        JSON.stringify({
          linkedGate: "TITLE",
          evidenceType: "TITLE_REVIEW",
          title: "Title pack",
          note: "Checked",
          status: "RECORDED",
          reviewed: false,
        })
      ),
      { params: { id: "deal-1" } }
    )

    expect(response.status).toBe(500)

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("EVIDENCE_LITE_CREATE_FAILED")
    expect(typeof payload.traceId).toBe("string")
    expect(payload.diagnostic.routeName).toBe("saved-deals.evidence")
    expect(payload.diagnostic.errorMessage).not.toContain("postgresql://")
    expect(payload.diagnostic.errorMessage).not.toContain("password")
    expect(payload.diagnostic.errorMessage).not.toContain("secret")
    expect(payload.diagnostic.errorMessage).not.toContain("token")
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it("route source only implements GET and POST and stays clear of write side effects", () => {
    const routeSource = readFileSync(
      path.resolve(process.cwd(), "app/api/saved-deals/[id]/evidence/route.ts"),
      "utf8"
    )

    expect(routeSource).toContain("export async function GET")
    expect(routeSource).toContain("export async function POST")
    expect(routeSource).not.toContain("export async function PATCH")
    expect(routeSource).not.toContain("export async function DELETE")
    expect(routeSource).not.toContain("deal_tasks")
    expect(routeSource).not.toContain("deal_offers")
    expect(routeSource).not.toContain("pipeline_state")
    expect(routeSource).not.toContain("investor_shield_checks")
    expect(routeSource).not.toContain("manual_overrides")
    expect(routeSource).not.toContain("@/app/page")
  })
})
