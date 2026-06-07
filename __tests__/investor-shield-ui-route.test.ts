import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { loadInvestorShieldUiModelForDealMock } = vi.hoisted(() => ({
  loadInvestorShieldUiModelForDealMock: vi.fn(),
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
    loadInvestorShieldUiModelForDealMock.mockReset()
  })

  it("returns success true and model for a valid id", async () => {
    loadInvestorShieldUiModelForDealMock.mockResolvedValueOnce({
      dealId: "deal-1",
      gateSummaries: [{ key: "TITLE", label: "Title" }],
    })

    const response = await GET(makeRequest(), { params: { id: "deal-1" } })

    expect(response.status).toBe(200)
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
    expect(loadInvestorShieldUiModelForDealMock).not.toHaveBeenCalled()
  })

  it("returns a safe 500 error when the loader fails", async () => {
    loadInvestorShieldUiModelForDealMock.mockRejectedValueOnce(
      new Error("db failure details with secret stack trace")
    )

    const response = await GET(makeRequest(), { params: { id: "deal-1" } })

    expect(response.status).toBe(500)

    const payload = await response.json()
    expect(payload).toEqual({
      success: false,
      error: "Investor Shield status could not be loaded. Pipeline rules remain unchanged.",
    })

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain("db failure details")
    expect(serialized).not.toContain("secret")
    expect(serialized).not.toContain("stack trace")
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
