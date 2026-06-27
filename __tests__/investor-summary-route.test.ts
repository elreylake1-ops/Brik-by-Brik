import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getInvestorSummaryForDealMock } = vi.hoisted(() => ({
  getInvestorSummaryForDealMock: vi.fn(),
}))

vi.mock("@/lib/investor-summary/investor-summary-repository", () => ({
  getInvestorSummaryForDeal: getInvestorSummaryForDealMock,
}))

import { GET } from "@/app/api/saved-deals/[id]/investor-summary/route"

function makeRequest() {
  return new Request("http://localhost/api/saved-deals/deal-1/investor-summary", {
    method: "GET",
  })
}

describe("investor summary get route", () => {
  beforeEach(() => {
    getInvestorSummaryForDealMock.mockReset()
  })

  it("returns 200 with the approved envelope for a valid id", async () => {
    const investorSummary = {
      deal: { dealId: "deal-1", address: "1 Lake View Road" },
      purchasePrice: 125000,
    }
    getInvestorSummaryForDealMock.mockResolvedValueOnce(investorSummary)

    const response = await GET(makeRequest(), { params: { id: " deal-1 " } })

    expect(response.status).toBe(200)
    expect(getInvestorSummaryForDealMock).toHaveBeenCalledTimes(1)
    expect(getInvestorSummaryForDealMock).toHaveBeenCalledWith("deal-1")
    await expect(response.json()).resolves.toEqual({
      success: true,
      investorSummary,
    })
  })

  it("returns 400 for blank or whitespace-only ids and does not call the repository", async () => {
    const missingResponse = await GET(makeRequest(), { params: {} })
    const blankResponse = await GET(makeRequest(), { params: { id: "   " } })

    expect(missingResponse.status).toBe(400)
    expect(blankResponse.status).toBe(400)
    expect(getInvestorSummaryForDealMock).not.toHaveBeenCalled()
    await expect(missingResponse.json()).resolves.toEqual({
      success: false,
      error: "INVESTOR_SUMMARY_INVALID_ID",
    })
    await expect(blankResponse.json()).resolves.toEqual({
      success: false,
      error: "INVESTOR_SUMMARY_INVALID_ID",
    })
  })

  it("returns 404 when the repository signals a missing deal", async () => {
    getInvestorSummaryForDealMock.mockResolvedValueOnce(null)

    const response = await GET(makeRequest(), { params: { id: "missing" } })

    expect(response.status).toBe(404)
    expect(getInvestorSummaryForDealMock).toHaveBeenCalledTimes(1)
    expect(getInvestorSummaryForDealMock).toHaveBeenCalledWith("missing")
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "INVESTOR_SUMMARY_NOT_FOUND",
    })
  })

  it("returns a safe 500 response when the repository fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    getInvestorSummaryForDealMock.mockRejectedValueOnce(
      new Error("postgresql://user:password@host/db secret token DATABASE_URL=shadow")
    )

    const response = await GET(makeRequest(), { params: { id: "deal-1" } })

    expect(response.status).toBe(500)
    expect(getInvestorSummaryForDealMock).toHaveBeenCalledTimes(1)

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("INVESTOR_SUMMARY_READ_FAILED")
    expect(typeof payload.traceId).toBe("string")
    expect(payload.diagnostic.routeName).toBe("saved-deals.investor-summary")
    expect(payload.diagnostic.errorName).toBe("Error")
    expect(payload.diagnostic.errorCode).toBeNull()
    expect(payload.diagnostic.errorMessage).not.toContain("postgresql://")
    expect(payload.diagnostic.errorMessage).not.toContain("password")
    expect(payload.diagnostic.errorMessage).not.toContain("secret")
    expect(payload.diagnostic.errorMessage).not.toContain("token")
    expect(payload.diagnostic.errorMessage).not.toContain("DATABASE_URL")
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it("keeps the route source limited to GET and safe read-only wiring", () => {
    const routeSource = readFileSync(
      path.resolve(process.cwd(), "app/api/saved-deals/[id]/investor-summary/route.ts"),
      "utf8"
    )

    expect(routeSource).toContain("export async function GET")
    expect(routeSource).not.toContain("export async function POST")
    expect(routeSource).not.toContain("export async function PATCH")
    expect(routeSource).not.toContain("export async function PUT")
    expect(routeSource).not.toContain("export async function DELETE")
    expect(routeSource).not.toContain("getSavedDealById")
    expect(routeSource).not.toContain("loadAndEvaluateInvestorShield")
    expect(routeSource).not.toContain("listTasksForDeal")
    expect(routeSource).not.toContain("listOffersForDeal")
    expect(routeSource).not.toContain("composeInvestorSummaryViewModel")
    expect(routeSource).not.toContain("pg.Pool")
    expect(routeSource).not.toContain("DATABASE_URL")
  })
})
