import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getSavedDealByIdMock, loadInvestorShieldUiModelForDealMock } = vi.hoisted(() => ({
  getSavedDealByIdMock: vi.fn(),
  loadInvestorShieldUiModelForDealMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: getSavedDealByIdMock,
}))

vi.mock("@/lib/investor-shield/load-investor-shield-ui-model", () => ({
  loadInvestorShieldUiModelForDeal: loadInvestorShieldUiModelForDealMock,
}))

import { GET } from "@/app/api/saved-deals/[id]/investor-shield-ui/route"

function makeRequest() {
  return new Request("http://localhost/api/saved-deals/deal-1/investor-shield-ui", {
    method: "GET",
  })
}

describe("investor shield ui route", () => {
  beforeEach(() => {
    getSavedDealByIdMock.mockReset()
    loadInvestorShieldUiModelForDealMock.mockReset()
  })

  it("returns success true and model for a valid id", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    loadInvestorShieldUiModelForDealMock.mockResolvedValueOnce({
      dealId: "deal-1",
      gateSummaries: [{ key: "TITLE", label: "Title" }],
    })

    const response = await GET(makeRequest(), { params: { id: "deal-1" } })

    expect(response.status).toBe(200)
    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-1")
    expect(loadInvestorShieldUiModelForDealMock).toHaveBeenCalledWith("deal-1")

    const payload = await response.json()
    expect(payload).toEqual({
      success: true,
      model: {
        dealId: "deal-1",
        gateSummaries: [{ key: "TITLE", label: "Title" }],
      },
    })
  })

  it("returns a safe 400 error for missing or blank ids", async () => {
    const missingResponse = await GET(makeRequest(), { params: {} })
    const blankResponse = await GET(makeRequest(), { params: { id: "   " } })

    expect(missingResponse.status).toBe(400)
    expect(blankResponse.status).toBe(400)

    await expect(missingResponse.json()).resolves.toEqual({
      success: false,
      error: "Investor Shield status could not be loaded. Pipeline rules remain unchanged.",
    })
    await expect(blankResponse.json()).resolves.toEqual({
      success: false,
      error: "Investor Shield status could not be loaded. Pipeline rules remain unchanged.",
    })
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(loadInvestorShieldUiModelForDealMock).not.toHaveBeenCalled()
  })

  it("returns 404 when saved deal is missing", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    const response = await GET(makeRequest(), { params: { id: "missing" } })

    expect(response.status).toBe(404)
    expect(loadInvestorShieldUiModelForDealMock).not.toHaveBeenCalled()

    const payload = await response.json()
    expect(payload).toEqual({ success: false, error: "Saved deal not found." })
  })

  it("returns a safe 500 error when the loader fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })
    loadInvestorShieldUiModelForDealMock.mockRejectedValueOnce(
      new Error("postgresql://user:password@host/db secret token")
    )

    const response = await GET(makeRequest(), { params: { id: "deal-1" } })

    expect(response.status).toBe(500)

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("INVESTOR_SHIELD_UI_READ_FAILED")
    expect(typeof payload.traceId).toBe("string")
    expect(payload.diagnostic.routeName).toBe("saved-deals.investor-shield-ui")
    expect(payload.diagnostic.errorMessage).not.toContain("postgresql://")
    expect(payload.diagnostic.errorMessage).not.toContain("password")
    expect(payload.diagnostic.errorMessage).not.toContain("secret")
    expect(payload.diagnostic.errorMessage).not.toContain("token")
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it("only implements GET and stays clear of write and pipeline helpers", () => {
    const routeSource = readFileSync(
      path.resolve(process.cwd(), "app/api/saved-deals/[id]/investor-shield-ui/route.ts"),
      "utf8"
    )

    expect(routeSource).toContain("export async function GET")
    expect(routeSource).not.toContain("export async function POST")
    expect(routeSource).not.toContain("export async function PATCH")
    expect(routeSource).not.toContain("export async function DELETE")
    expect(routeSource).not.toContain("persistInvestorShieldTaskDrafts")
    expect(routeSource).not.toContain("updateSavedDealPipelineState")
    expect(routeSource).not.toContain("@/app/page")
    expect(routeSource).not.toContain("app/api/saved-deals/[id]/pipeline/route")
  })
})
