import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getEvidenceLiteByIdMock, getSavedDealByIdMock, updateEvidenceLiteMock } = vi.hoisted(
  () => ({
    getEvidenceLiteByIdMock: vi.fn(),
    getSavedDealByIdMock: vi.fn(),
    updateEvidenceLiteMock: vi.fn(),
  })
)

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

function makeEvidenceRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "evidence-1",
    dealId: "deal-1",
    evidenceType: "TITLE_REVIEW",
    linkedGate: "SOLICITOR_REVIEW",
    linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
    evidenceCommandType: "TITLE_LEGAL",
    title: "Canonical title",
    note: "Canonical note",
    evidenceSummary: "Canonical note",
    status: "RECORDED",
    evidenceStatus: "RECEIVED",
    evidenceStrength: "WEAK",
    reviewState: "NOT_REVIEWED",
    blockerImpact: "DOES_NOT_BLOCK",
    linkedProfessionalGate: "NONE",
    recommendedNextAction: null,
    expiryOrUpdateDate: null,
    source: null,
    mobileCaptureNote: null,
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

function makeContext(id?: string, evidenceId?: string) {
  return {
    params: {
      id,
      evidenceId,
    },
  }
}

describe("evidence lite item api route", () => {
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
    },
    {
      label: "partial note update",
      body: { note: " Updated note " },
      expectedInput: { note: "Updated note" },
    },
    {
      label: "partial reviewed update",
      body: { reviewed: true },
      expectedInput: { reviewed: true },
    },
    {
      label: "evidence type update",
      body: { evidenceType: "TITLE_REVIEW" },
      expectedInput: { evidenceType: "TITLE_REVIEW" },
    },
    {
      label: "canonical linked-gate update",
      body: { linkedGate: "SOLICITOR_REVIEW" },
      expectedInput: { linkedGate: "SOLICITOR_REVIEW" },
    },
    {
      label: "SOLICITOR_FEEDBACK normalization",
      body: { linkedGate: " SOLICITOR_FEEDBACK " },
      expectedInput: { linkedGate: "SOLICITOR_REVIEW" },
    },
  ])("$label returns 200 and passes normalized legacy input to the repository", async ({ body, expectedInput }) => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    getEvidenceLiteByIdMock.mockResolvedValueOnce(makeEvidenceRecord())
    const updatedEvidence = makeEvidenceRecord({
      title: "Updated canonical title",
      note: "Updated canonical note",
      evidenceSummary: "Updated canonical note",
      reviewed: true,
      updatedAt: "2026-06-26T11:00:00.000Z",
    })
    updateEvidenceLiteMock.mockResolvedValueOnce(updatedEvidence)

    const response = await PATCH(makeRequest(body), makeContext(" deal-1 ", " evidence-1 "))

    expect(response.status).toBe(200)
    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-1")
    expect(getEvidenceLiteByIdMock).toHaveBeenCalledWith("deal-1", "evidence-1")
    expect(updateEvidenceLiteMock).toHaveBeenCalledWith("deal-1", "evidence-1", expectedInput)
    expect(await response.json()).toEqual({
      success: true,
      evidence: updatedEvidence,
    })
  })

  it("PATCH updates structured Evidence Command fields", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    getEvidenceLiteByIdMock.mockResolvedValueOnce(makeEvidenceRecord())
    const updatedEvidence = makeEvidenceRecord({
      evidenceType: "OTHER",
      linkedGate: "TITLE",
      linkedInvestorShieldGate: "TITLE",
      evidenceCommandType: "PHOTO_EVIDENCE",
      title: "Updated title",
      note: "Updated command summary",
      evidenceSummary: "Updated command summary",
      status: "VERIFIED",
      evidenceStatus: "SUFFICIENT",
      evidenceStrength: "STRONG",
      reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
      blockerImpact: "REQUIRES_MANUAL_REVIEW",
      linkedProfessionalGate: "SURVEYOR_REPORT",
      recommendedNextAction: "Follow up",
      expiryOrUpdateDate: "2026-08-01",
      source: "mobile",
      mobileCaptureNote: "captured on phone",
      reviewed: true,
      updatedAt: "2026-06-26T12:00:00.000Z",
    })
    updateEvidenceLiteMock.mockResolvedValueOnce(updatedEvidence)

    const response = await PATCH(
      makeRequest({
        evidenceType: "PHOTO_EVIDENCE",
        linkedInvestorShieldGate: "TITLE",
        linkedProfessionalGate: "SURVEYOR_REPORT",
        title: " Updated title ",
        evidenceSummary: " Updated command summary ",
        evidenceStatus: "SUFFICIENT",
        evidenceStrength: "STRONG",
        reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
        blockerImpact: "REQUIRES_MANUAL_REVIEW",
        recommendedNextAction: " Follow up ",
        expiryOrUpdateDate: "2026-08-01",
        source: " mobile ",
        mobileCaptureNote: " captured on phone ",
      }),
      makeContext("deal-1", "evidence-1")
    )

    expect(response.status).toBe(200)
    expect(updateEvidenceLiteMock).toHaveBeenCalledWith("deal-1", "evidence-1", {
      evidenceType: "PHOTO_EVIDENCE",
      linkedInvestorShieldGate: "TITLE",
      linkedProfessionalGate: "SURVEYOR_REPORT",
      title: "Updated title",
      evidenceSummary: "Updated command summary",
      evidenceStatus: "SUFFICIENT",
      evidenceStrength: "STRONG",
      reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
      blockerImpact: "REQUIRES_MANUAL_REVIEW",
      recommendedNextAction: "Follow up",
      expiryOrUpdateDate: "2026-08-01",
      source: "mobile",
      mobileCaptureNote: "captured on phone",
    })
    expect(await response.json()).toEqual({
      success: true,
      evidence: updatedEvidence,
    })
  })

  it("PATCH accepts a partial command update", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    getEvidenceLiteByIdMock.mockResolvedValueOnce(makeEvidenceRecord())
    const updatedEvidence = makeEvidenceRecord({
      evidenceSummary: "Photo of roof defect",
      evidenceStatus: "REQUESTED",
      updatedAt: "2026-06-26T12:30:00.000Z",
    })
    updateEvidenceLiteMock.mockResolvedValueOnce(updatedEvidence)

    const response = await PATCH(
      makeRequest({
        evidenceSummary: " Photo of roof defect ",
      }),
      makeContext("deal-1", "evidence-1")
    )

    expect(response.status).toBe(200)
    expect(updateEvidenceLiteMock).toHaveBeenCalledWith("deal-1", "evidence-1", {
      evidenceSummary: "Photo of roof defect",
    })
    expect(await response.json()).toEqual({
      success: true,
      evidence: updatedEvidence,
    })
  })

  it.each([
    {
      label: "invalid evidence status",
      body: { evidenceStatus: "SATISFIED" },
      field: "evidenceStatus",
    },
    {
      label: "invalid review state",
      body: { reviewState: "APPROVED" },
      field: "reviewState",
    },
    {
      label: "invalid blocker impact",
      body: { blockerImpact: "BLOCKS_ALL" },
      field: "blockerImpact",
    },
    {
      label: "invalid professional gate",
      body: { linkedProfessionalGate: "GENERAL" },
      field: "linkedProfessionalGate",
    },
    {
      label: "invalid Investor Shield gate",
      body: { linkedInvestorShieldGate: "GENERAL" },
      field: "linkedInvestorShieldGate",
    },
    {
      label: "invalid expiry date",
      body: { expiryOrUpdateDate: "not-a-date" },
      field: "expiryOrUpdateDate",
    },
  ])("$label returns 400 before updating the repository", async ({ body, field }) => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    getEvidenceLiteByIdMock.mockResolvedValueOnce(makeEvidenceRecord())

    const response = await PATCH(makeRequest(body), makeContext("deal-1", "evidence-1"))

    expect(response.status).toBe(400)
    expect(updateEvidenceLiteMock).not.toHaveBeenCalled()

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("Invalid evidence input.")
    expect(payload.validation.errors.map((error: { field: string }) => error.field)).toEqual(
      expect.arrayContaining([field])
    )
  })

  it("returns 400 when the body tries to override the route dealId", async () => {
    const response = await PATCH(
      makeRequest({
        dealId: "deal-2",
        reviewed: true,
      }),
      makeContext("deal-1", "evidence-1")
    )

    expect(response.status).toBe(400)
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(getEvidenceLiteByIdMock).not.toHaveBeenCalled()
    expect(updateEvidenceLiteMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      success: false,
      error: "Invalid evidence input.",
      validation: {
        errors: [
          {
            field: "dealId",
            message: "dealId is supplied by the route and must not be included in the body",
          },
        ],
        warnings: [],
      },
    })
  })

  it("returns 404 when the saved deal is missing and does not look up evidence", async () => {
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

  it("returns 404 when the evidence record is missing and does not update", async () => {
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

    const response = await PATCH(
      makeRequest({ reviewed: true }),
      makeContext("deal-1", "shared-evidence")
    )

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
    getEvidenceLiteByIdMock.mockRejectedValueOnce(new Error("postgresql://user:password@host/db token=secret"))

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
