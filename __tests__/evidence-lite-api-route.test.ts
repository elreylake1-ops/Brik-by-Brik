import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { createEvidenceLiteMock, getSavedDealByIdMock, listEvidenceLiteForDealMock } = vi.hoisted(
  () => ({
    createEvidenceLiteMock: vi.fn(),
    getSavedDealByIdMock: vi.fn(),
    listEvidenceLiteForDealMock: vi.fn(),
  })
)

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: getSavedDealByIdMock,
}))

vi.mock("@/lib/evidence-lite/evidence-lite-repository", () => ({
  createEvidenceLite: createEvidenceLiteMock,
  listEvidenceLiteForDeal: listEvidenceLiteForDealMock,
}))

import { GET, POST } from "@/app/api/saved-deals/[id]/evidence/route"

function makeGetRequest() {
  return new Request("http://localhost/api/saved-deals/deal-1/evidence", {
    method: "GET",
  })
}

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/saved-deals/deal-1/evidence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeMalformedPostRequest(body: string) {
  return new Request("http://localhost/api/saved-deals/deal-1/evidence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
}

function makeEvidenceRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "evidence-1",
    dealId: "deal-1",
    evidenceType: "TITLE_REVIEW",
    linkedGate: "SOLICITOR_REVIEW",
    linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
    evidenceCommandType: "TITLE_LEGAL",
    title: "Title pack",
    note: "Checked",
    evidenceSummary: "Checked",
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
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:00:00.000Z",
    ...overrides,
  }
}

function makeLegacyCreateBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    evidenceType: "TITLE_REVIEW",
    linkedGate: " SOLICITOR_FEEDBACK ",
    title: " Title pack ",
    note: " Checked ",
    status: "RECORDED",
    reviewed: false,
    ...overrides,
  }
}

function makeCommandCreateBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    evidenceType: "TITLE_LEGAL",
    linkedInvestorShieldGate: "TITLE",
    title: " Title pack ",
    evidenceSummary: " Summary ",
    ...overrides,
  }
}

describe("evidence lite api route", () => {
  beforeEach(() => {
    createEvidenceLiteMock.mockReset()
    getSavedDealByIdMock.mockReset()
    listEvidenceLiteForDealMock.mockReset()
  })

  it("GET returns structured evidence command fields for an existing saved deal", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    const evidence = makeEvidenceRecord()
    listEvidenceLiteForDealMock.mockResolvedValueOnce([evidence])

    const response = await GET(makeGetRequest(), { params: { id: " deal-1 " } })

    expect(response.status).toBe(200)
    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-1")
    expect(listEvidenceLiteForDealMock).toHaveBeenCalledWith("deal-1")

    await expect(response.json()).resolves.toEqual({
      success: true,
      evidence: [evidence],
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
    expect(await missingResponse.json()).toEqual({
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

  it("POST returns 201 and creates canonical legacy evidence", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    const createdEvidence = makeEvidenceRecord({
      id: "evidence-legacy",
      linkedGate: "SOLICITOR_REVIEW",
      evidenceCommandType: "TITLE_LEGAL",
      evidenceSummary: "Checked",
      evidenceStatus: "RECEIVED",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "NONE",
    })
    createEvidenceLiteMock.mockResolvedValueOnce(createdEvidence)

    const response = await POST(makePostRequest(makeLegacyCreateBody()), {
      params: { id: " deal-1 " },
    })

    expect(response.status).toBe(201)
    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-1")
    expect(createEvidenceLiteMock).toHaveBeenCalledWith({
      dealId: "deal-1",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      title: "Title pack",
      note: "Checked",
      status: "RECORDED",
      reviewed: false,
    })
    expect(await response.json()).toEqual({
      success: true,
      evidence: createdEvidence,
    })
  })

  it("POST returns 201 and creates structured command evidence with safe defaults", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    const createdEvidence = makeEvidenceRecord({
      id: "evidence-command-defaults",
      evidenceType: "OTHER",
      linkedGate: "SOLICITOR_REVIEW",
      linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
      evidenceCommandType: "PHOTO_EVIDENCE",
      title: "Roof photo",
      note: "Roof defect photo",
      evidenceSummary: "Roof defect photo",
      status: "MISSING",
      evidenceStatus: "MISSING",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "NONE",
      reviewed: false,
    })
    createEvidenceLiteMock.mockResolvedValueOnce(createdEvidence)

    const response = await POST(
      makePostRequest({
        evidenceType: "PHOTO_EVIDENCE",
        linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
        title: " Roof photo ",
        evidenceSummary: " Roof defect photo ",
      }),
      { params: { id: "deal-1" } }
    )

    expect(response.status).toBe(201)
    expect(createEvidenceLiteMock).toHaveBeenCalledWith({
      dealId: "deal-1",
      evidenceType: "PHOTO_EVIDENCE",
      linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
      linkedProfessionalGate: "NONE",
      title: "Roof photo",
      evidenceSummary: "Roof defect photo",
      evidenceStatus: "MISSING",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "DOES_NOT_BLOCK",
      recommendedNextAction: null,
      expiryOrUpdateDate: null,
      source: null,
      mobileCaptureNote: null,
    })
    expect(await response.json()).toEqual({
      success: true,
      evidence: createdEvidence,
    })
  })

  it("POST accepts a fully structured command payload", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    const createdEvidence = makeEvidenceRecord({
      id: "evidence-command-full",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "TITLE",
      linkedInvestorShieldGate: "TITLE",
      evidenceCommandType: "TITLE_LEGAL",
      title: "Title pack",
      note: "Summary",
      evidenceSummary: "Summary",
      status: "RECORDED",
      evidenceStatus: "RECEIVED",
      evidenceStrength: "STRONG",
      reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
      blockerImpact: "REQUIRES_MANUAL_REVIEW",
      linkedProfessionalGate: "SURVEYOR_REPORT",
      recommendedNextAction: "Follow up",
      expiryOrUpdateDate: "2026-08-01",
      source: "operator_entered",
      mobileCaptureNote: "captured on phone",
      reviewed: true,
    })
    createEvidenceLiteMock.mockResolvedValueOnce(createdEvidence)

    const response = await POST(
      makePostRequest({
        evidenceType: "TITLE_LEGAL",
        linkedInvestorShieldGate: "TITLE",
        linkedProfessionalGate: "SURVEYOR_REPORT",
        title: " Title pack ",
        evidenceSummary: " Summary ",
        evidenceStatus: "RECEIVED",
        evidenceStrength: "STRONG",
        reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
        blockerImpact: "REQUIRES_MANUAL_REVIEW",
        recommendedNextAction: " Follow up ",
        expiryOrUpdateDate: "2026-08-01",
        source: " operator_entered ",
        mobileCaptureNote: " captured on phone ",
      }),
      { params: { id: "deal-1" } }
    )

    expect(response.status).toBe(201)
    expect(createEvidenceLiteMock).toHaveBeenCalledWith({
      dealId: "deal-1",
      evidenceType: "TITLE_LEGAL",
      linkedInvestorShieldGate: "TITLE",
      linkedProfessionalGate: "SURVEYOR_REPORT",
      title: "Title pack",
      evidenceSummary: "Summary",
      evidenceStatus: "RECEIVED",
      evidenceStrength: "STRONG",
      reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
      blockerImpact: "REQUIRES_MANUAL_REVIEW",
      recommendedNextAction: "Follow up",
      expiryOrUpdateDate: "2026-08-01",
      source: "operator_entered",
      mobileCaptureNote: "captured on phone",
    })
    expect(await response.json()).toEqual({
      success: true,
      evidence: createdEvidence,
    })
  })

  it.each([
    {
      label: "unknown evidence type",
      body: makeCommandCreateBody({ evidenceType: "NOT_A_TYPE" }),
      field: "evidenceType",
    },
    {
      label: "GENERAL evidence type",
      body: makeCommandCreateBody({ evidenceType: "GENERAL" }),
      field: "evidenceType",
    },
    {
      label: "unknown status",
      body: makeCommandCreateBody({ evidenceStatus: "SATISFIED" }),
      field: "evidenceStatus",
    },
    {
      label: "unknown strength",
      body: makeCommandCreateBody({ evidenceStrength: "HARD" }),
      field: "evidenceStrength",
    },
    {
      label: "unknown review state",
      body: makeCommandCreateBody({ reviewState: "APPROVED" }),
      field: "reviewState",
    },
    {
      label: "unknown blocker impact",
      body: makeCommandCreateBody({ blockerImpact: "BLOCKS_ALL" }),
      field: "blockerImpact",
    },
    {
      label: "unknown professional gate",
      body: makeCommandCreateBody({ linkedProfessionalGate: "GENERAL" }),
      field: "linkedProfessionalGate",
    },
    {
      label: "invalid Investor Shield gate",
      body: makeCommandCreateBody({ linkedInvestorShieldGate: "GENERAL" }),
      field: "linkedInvestorShieldGate",
    },
    {
      label: "empty title",
      body: makeCommandCreateBody({ title: "   " }),
      field: "title",
    },
    {
      label: "empty evidence summary",
      body: makeCommandCreateBody({ evidenceSummary: "   " }),
      field: "evidenceSummary",
    },
    {
      label: "invalid expiry date",
      body: makeCommandCreateBody({ expiryOrUpdateDate: "not-a-date" }),
      field: "expiryOrUpdateDate",
    },
  ])("$label returns 400 and rejects the payload", async ({ body, field }) => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })

    const response = await POST(makePostRequest(body), { params: { id: "deal-1" } })

    expect(response.status).toBe(400)
    expect(createEvidenceLiteMock).not.toHaveBeenCalled()

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("Invalid evidence input.")
    expect(payload.validation.errors.map((error: { field: string }) => error.field)).toEqual(
      expect.arrayContaining([field])
    )
  })

  it("POST rejects a body-supplied dealId before validation", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })

    const response = await POST(
      makePostRequest(
        makeCommandCreateBody({
          dealId: "other-deal",
        })
      ),
      { params: { id: "deal-1" } }
    )

    expect(response.status).toBe(400)
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
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

  it("POST returns 400 for malformed JSON and does not query repositories", async () => {
    const response = await POST(makeMalformedPostRequest("{"), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(400)
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(createEvidenceLiteMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      success: false,
      error: "Malformed JSON.",
    })
  })

  it("POST returns 404 when the saved deal is missing and does not create evidence", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    const response = await POST(
      makePostRequest({
        evidenceType: "TITLE_LEGAL",
        linkedInvestorShieldGate: "TITLE",
        title: "Title pack",
        evidenceSummary: "Summary",
      }),
      { params: { id: "missing" } }
    )

    expect(response.status).toBe(404)
    expect(createEvidenceLiteMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      success: false,
      error: "Saved deal not found.",
    })
  })

  it("POST returns a safe 500 error when create fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    createEvidenceLiteMock.mockRejectedValueOnce(
      new Error("postgresql://user:password@host/db secret token")
    )

    const response = await POST(
      makePostRequest({
        evidenceType: "TITLE_LEGAL",
        linkedInvestorShieldGate: "TITLE",
        title: "Title pack",
        evidenceSummary: "Summary",
      }),
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
