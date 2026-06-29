import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { EvidenceLiteRecord } from "@/types/evidence-lite"

const {
  getEvidenceLiteByIdMock,
  getSavedDealByIdMock,
  updateEvidenceLiteMock,
} = vi.hoisted(() => ({
  getEvidenceLiteByIdMock: vi.fn(),
  getSavedDealByIdMock: vi.fn(),
  updateEvidenceLiteMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: getSavedDealByIdMock,
}))

vi.mock("@/lib/evidence-lite/evidence-lite-repository", () => ({
  getEvidenceLiteById: getEvidenceLiteByIdMock,
  updateEvidenceLite: updateEvidenceLiteMock,
}))

import { PATCH } from "@/app/api/saved-deals/[id]/evidence/[evidenceId]/route"

const ROUTE_PATH = path.resolve(
  process.cwd(),
  "app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts"
)

function makeEvidenceRecord(overrides: Partial<EvidenceLiteRecord> = {}): EvidenceLiteRecord {
  return {
    id: "evidence-1",
    dealId: "deal-1",
    evidenceType: "TITLE_REVIEW",
    linkedGate: "SOLICITOR_REVIEW",
    title: "Canonical title",
    note: "Canonical note",
    status: "RECORDED",
    reviewed: false,
    reviewerNote: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  }
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/saved-deals/deal-1/evidence/evidence-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeMalformedRequest(body: string): Request {
  return new Request("http://localhost/api/saved-deals/deal-1/evidence/evidence-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body,
  })
}

function makeContext(id?: string, evidenceId?: string) {
  return {
    params: {
      id,
      evidenceId,
    },
  }
}

describe("evidence lite item api route", () => {
  const canonicalUpdatedEvidence = makeEvidenceRecord({
    title: "Updated canonical title",
    note: "Updated canonical note",
    reviewed: true,
    updatedAt: "2026-06-26T11:00:00.000Z",
  })

  beforeEach(() => {
    getEvidenceLiteByIdMock.mockReset()
    getSavedDealByIdMock.mockReset()
    updateEvidenceLiteMock.mockReset()
  })

  it.each([
    {
      label: "partial title update",
      body: { title: " Updated title " },
      expectedInput: { title: "Updated title" },
      params: makeContext(" deal-1 ", " evidence-1 "),
    },
    {
      label: "partial note update",
      body: { note: " Updated note " },
      expectedInput: { note: "Updated note" },
      params: makeContext("deal-1", "evidence-1"),
    },
    {
      label: "partial reviewed update",
      body: { reviewed: true },
      expectedInput: { reviewed: true },
      params: makeContext("deal-1", "evidence-1"),
    },
    {
      label: "evidence type update",
      body: { evidenceType: "TITLE_REVIEW" },
      expectedInput: { evidenceType: "TITLE_REVIEW" },
      params: makeContext("deal-1", "evidence-1"),
    },
    {
      label: "canonical linked-gate update",
      body: { linkedGate: "SOLICITOR_REVIEW" },
      expectedInput: { linkedGate: "SOLICITOR_REVIEW" },
      params: makeContext("deal-1", "evidence-1"),
    },
    {
      label: "SOLICITOR_FEEDBACK normalization",
      body: { linkedGate: " SOLICITOR_FEEDBACK " },
      expectedInput: { linkedGate: "SOLICITOR_REVIEW" },
      params: makeContext("deal-1", "evidence-1"),
    },
  ])(
    "$label returns 200 and passes normalized input to the repository",
    async ({ body, expectedInput, params }) => {
      getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
      getEvidenceLiteByIdMock.mockResolvedValueOnce(makeEvidenceRecord())
      updateEvidenceLiteMock.mockResolvedValueOnce(canonicalUpdatedEvidence)

      const response = await PATCH(makeRequest(body), params)

      expect(response.status).toBe(200)
      expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-1")
      expect(getEvidenceLiteByIdMock).toHaveBeenCalledWith("deal-1", "evidence-1")
      expect(updateEvidenceLiteMock).toHaveBeenCalledWith("deal-1", "evidence-1", expectedInput)

      const payload = await response.json()
      expect(payload).toEqual({
        success: true,
        evidence: canonicalUpdatedEvidence,
      })
    }
  )

  it("returns 400 for malformed JSON and skips repository access", async () => {
    const response = await PATCH(makeMalformedRequest("{"), makeContext("deal-1", "evidence-1"))

    expect(response.status).toBe(400)
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(getEvidenceLiteByIdMock).not.toHaveBeenCalled()
    expect(updateEvidenceLiteMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      success: false,
      error: "Malformed JSON.",
    })
  })

  it("returns 400 for missing or blank saved-deal ids", async () => {
    const missing = await PATCH(makeRequest({ reviewed: true }), makeContext())
    const blank = await PATCH(makeRequest({ reviewed: true }), makeContext("   ", "evidence-1"))

    expect(missing.status).toBe(400)
    expect(blank.status).toBe(400)
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(getEvidenceLiteByIdMock).not.toHaveBeenCalled()
    expect(updateEvidenceLiteMock).not.toHaveBeenCalled()

    await expect(missing.json()).resolves.toEqual({
      success: false,
      error: "Invalid saved deal id.",
    })
  })

  it("returns 400 for missing or blank evidence ids", async () => {
    const missing = await PATCH(makeRequest({ reviewed: true }), makeContext("deal-1"))
    const blank = await PATCH(makeRequest({ reviewed: true }), makeContext("deal-1", "   "))

    expect(missing.status).toBe(400)
    expect(blank.status).toBe(400)
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(getEvidenceLiteByIdMock).not.toHaveBeenCalled()
    expect(updateEvidenceLiteMock).not.toHaveBeenCalled()

    await expect(missing.json()).resolves.toEqual({
      success: false,
      error: "Invalid evidence id.",
    })
  })

  it.each([
    {
      label: "empty object",
      body: {},
      expectedFields: ["root"],
    },
    {
      label: "body dealId",
      body: { dealId: "deal-2", reviewed: true },
      expectedFields: ["dealId"],
    },
    {
      label: "body id",
      body: { id: "evidence-2", reviewed: true },
      expectedFields: ["id"],
    },
    {
      label: "body evidenceId",
      body: { evidenceId: "evidence-2", reviewed: true },
      expectedFields: ["evidenceId"],
    },
    {
      label: "created timestamp field",
      body: { createdAt: "2026-06-26T00:00:00.000Z", reviewed: true },
      expectedFields: ["createdAt"],
    },
    {
      label: "updated timestamp field",
      body: { updatedAt: "2026-06-26T00:00:00.000Z", reviewed: true },
      expectedFields: ["updatedAt"],
    },
    {
      label: "unknown field",
      body: { unexpected: true, reviewed: true },
      expectedFields: ["unexpected"],
    },
    {
      label: "status field",
      body: { status: "VERIFIED", reviewed: true },
      expectedFields: ["status"],
    },
    {
      label: "blank title",
      body: { title: "   ", reviewed: true },
      expectedFields: ["title"],
    },
    {
      label: "invalid note",
      body: { note: null, reviewed: true },
      expectedFields: ["note"],
    },
    {
      label: "invalid evidence type",
      body: { evidenceType: "INVALID", reviewed: true },
      expectedFields: ["evidenceType"],
    },
    {
      label: "GENERAL linked gate",
      body: { linkedGate: "GENERAL", reviewed: true },
      expectedFields: ["linkedGate"],
    },
    {
      label: "RECEIVED linked gate",
      body: { linkedGate: "RECEIVED", reviewed: true },
      expectedFields: ["linkedGate"],
    },
    {
      label: "arbitrary linked gate",
      body: { linkedGate: "SOME_GATE", reviewed: true },
      expectedFields: ["linkedGate"],
    },
  ])("$label returns 400 before repository access", async ({ body, expectedFields }) => {
    const response = await PATCH(makeRequest(body), makeContext("deal-1", "evidence-1"))

    expect(response.status).toBe(400)
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(getEvidenceLiteByIdMock).not.toHaveBeenCalled()
    expect(updateEvidenceLiteMock).not.toHaveBeenCalled()

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("Invalid evidence input.")
    expect(payload.validation.errors.map((error: { field: string }) => error.field)).toEqual(
      expect.arrayContaining(expectedFields)
    )
  })

  it("returns a safe 404 when the saved deal is missing and does not look up evidence", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    const response = await PATCH(makeRequest({ reviewed: true }), makeContext("missing", "evidence-1"))

    expect(response.status).toBe(404)
    expect(getSavedDealByIdMock).toHaveBeenCalledWith("missing")
    expect(getEvidenceLiteByIdMock).not.toHaveBeenCalled()
    expect(updateEvidenceLiteMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      success: false,
      error: "Saved deal not found.",
    })
  })

  it("returns a safe 404 when the evidence record is missing and does not update", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    getEvidenceLiteByIdMock.mockResolvedValueOnce(null)

    const response = await PATCH(makeRequest({ reviewed: true }), makeContext("deal-1", "missing"))

    expect(response.status).toBe(404)
    expect(getEvidenceLiteByIdMock).toHaveBeenCalledWith("deal-1", "missing")
    expect(updateEvidenceLiteMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      success: false,
      error: "Evidence record not found.",
    })
  })

  it("treats cross-deal evidence as missing and does not update", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    getEvidenceLiteByIdMock.mockResolvedValueOnce(null)

    const response = await PATCH(makeRequest({ reviewed: true }), makeContext("deal-1", "shared-evidence"))

    expect(response.status).toBe(404)
    expect(getEvidenceLiteByIdMock).toHaveBeenCalledWith("deal-1", "shared-evidence")
    expect(updateEvidenceLiteMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      success: false,
      error: "Evidence record not found.",
    })
  })

  it("returns a safe 500 when the saved-deal repository fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    getSavedDealByIdMock.mockRejectedValueOnce(
      new Error("postgresql://user:password@host/db token=secret")
    )

    const response = await PATCH(makeRequest({ reviewed: true }), makeContext("deal-1", "evidence-1"))

    expect(response.status).toBe(500)

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("EVIDENCE_LITE_UPDATE_FAILED")
    expect(typeof payload.traceId).toBe("string")
    expect(payload.diagnostic.routeName).toBe("saved-deals.evidence.item")
    expect(payload.diagnostic.errorMessage).not.toContain("postgresql://")
    expect(payload.diagnostic.errorMessage).not.toContain("password")
    expect(payload.diagnostic.errorMessage).not.toContain("token")
    expect(payload.diagnostic.errorMessage).not.toContain("secret")
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it("returns a safe 500 when the evidence lookup fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    getEvidenceLiteByIdMock.mockRejectedValueOnce(
      new Error("postgresql://user:password@host/db token=secret")
    )

    const response = await PATCH(makeRequest({ reviewed: true }), makeContext("deal-1", "evidence-1"))

    expect(response.status).toBe(500)

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("EVIDENCE_LITE_UPDATE_FAILED")
    expect(typeof payload.traceId).toBe("string")
    expect(payload.diagnostic.routeName).toBe("saved-deals.evidence.item")
    expect(payload.diagnostic.errorMessage).not.toContain("postgresql://")
    expect(payload.diagnostic.errorMessage).not.toContain("password")
    expect(payload.diagnostic.errorMessage).not.toContain("token")
    expect(payload.diagnostic.errorMessage).not.toContain("secret")
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it("returns a safe 500 when the update repository fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    getEvidenceLiteByIdMock.mockResolvedValueOnce(makeEvidenceRecord())
    updateEvidenceLiteMock.mockRejectedValueOnce(
      new Error("postgresql://user:password@host/db token=secret")
    )

    const response = await PATCH(makeRequest({ reviewed: true }), makeContext("deal-1", "evidence-1"))

    expect(response.status).toBe(500)

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("EVIDENCE_LITE_UPDATE_FAILED")
    expect(typeof payload.traceId).toBe("string")
    expect(payload.diagnostic.routeName).toBe("saved-deals.evidence.item")
    expect(payload.diagnostic.errorMessage).not.toContain("postgresql://")
    expect(payload.diagnostic.errorMessage).not.toContain("password")
    expect(payload.diagnostic.errorMessage).not.toContain("token")
    expect(payload.diagnostic.errorMessage).not.toContain("secret")
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it("keeps the route source limited to PATCH and shared repository lookups", () => {
    const routeSource = readFileSync(ROUTE_PATH, "utf8")

    expect(routeSource).toContain("export async function PATCH")
    expect(routeSource).not.toContain("export async function GET")
    expect(routeSource).not.toContain("export async function PUT")
    expect(routeSource).not.toContain("export async function DELETE")
    expect(routeSource).not.toContain("new Pool")
    expect(routeSource).not.toContain("INSERT INTO")
    expect(routeSource).not.toContain("UPDATE brik_by_brik_engine")
    expect(routeSource).not.toContain("@/lib/investor-shield")
    expect(routeSource).not.toContain("@/lib/operator-command/deal-tasks-repository")
    expect(routeSource).not.toContain("@/lib/operator-command/deal-offers-repository")
    expect(routeSource).not.toContain("loadAndEvaluateInvestorShield")
    expect(routeSource).not.toContain("createTask")
    expect(routeSource).not.toContain("createOffer")
    expect(routeSource).not.toContain("upload")
    expect(routeSource).not.toContain("ocr")
    expect(routeSource).not.toContain("pdf")
  })
})
