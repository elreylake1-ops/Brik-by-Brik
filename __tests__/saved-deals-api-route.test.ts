import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { createSavedDealMock, listSavedDealsMock } = vi.hoisted(() => ({
  createSavedDealMock: vi.fn(),
  listSavedDealsMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  createSavedDeal: createSavedDealMock,
  listSavedDeals: listSavedDealsMock,
}))

import { GET, POST } from "@/app/api/saved-deals/route"

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/saved-deals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeGetRequest(query = "") {
  return new Request(`http://localhost/api/saved-deals${query}`, {
    method: "GET",
  })
}

describe("phase 4a saved deals route", () => {
  beforeEach(() => {
    createSavedDealMock.mockReset()
    listSavedDealsMock.mockReset()
  })

  it("GET returns 200 and success true", async () => {
    listSavedDealsMock.mockResolvedValueOnce([{ id: "d1" }])

    const response = await GET(makeGetRequest())
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.success).toBe(true)
    expect(Array.isArray(payload.deals)).toBe(true)
  })

  it("GET calls listSavedDeals with includeArchived false by default", async () => {
    listSavedDealsMock.mockResolvedValueOnce([])

    await GET(makeGetRequest())
    expect(listSavedDealsMock).toHaveBeenCalledWith({ includeArchived: false })
  })

  it("GET with includeArchived=true calls listSavedDeals with includeArchived true", async () => {
    listSavedDealsMock.mockResolvedValueOnce([])

    await GET(makeGetRequest("?includeArchived=true"))
    expect(listSavedDealsMock).toHaveBeenCalledWith({ includeArchived: true })
  })

  it("GET repository failure returns safe 500 metadata", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    listSavedDealsMock.mockRejectedValueOnce(
      new Error("postgresql://user:password@host/db token=secret DATABASE_URL=shadow")
    )

    const response = await GET(makeGetRequest())
    expect(response.status).toBe(500)

    const payload = await response.json()
    expect(payload.success).toBe(false)
    expect(payload.error).toBe("SAVED_DEALS_READ_FAILED")
    expect(typeof payload.traceId).toBe("string")
    expect(payload.diagnostic.routeName).toBe("saved-deals.list")
    expect(payload.diagnostic.errorMessage).not.toContain("postgresql://")
    expect(payload.diagnostic.errorMessage).not.toContain("password")
    expect(payload.diagnostic.errorMessage).not.toContain("token")
    expect(payload.diagnostic.errorMessage).not.toContain("secret")
    expect(payload.diagnostic.errorMessage).not.toContain("DATABASE_URL")
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it("POST returns 201 and success true when input is valid", async () => {
    createSavedDealMock.mockResolvedValueOnce({ id: "deal-1" })

    const engineResult = { verdict: "CONDITIONAL", score: 77 }
    const response = await POST(
      makePostRequest({
        address: "1 Test Road",
        listing_url: "https://example.com/1",
        purchase_price: 100000,
        gdv_realistic: 145000,
        refurb_cost: 25000,
        classification: "CONDITIONAL",
        governance_state: "MANUAL_REVIEW_REQUIRED",
        capital_protection_state: "PROTECTED",
        pipeline_state: "UNDER_ANALYSIS",
        engine_result_json: engineResult,
        risk_summary_json: { risk: "MEDIUM" },
        next_action: "Review",
      })
    )

    expect(response.status).toBe(201)

    const payload = await response.json()
    expect(payload.success).toBe(true)
    expect(payload.deal.id).toBe("deal-1")
  })

  it("POST calls createSavedDeal with pass-through engine_result_json", async () => {
    const engineResult = { exact: true, nested: { x: 1 } }
    createSavedDealMock.mockResolvedValueOnce({ id: "deal-2" })

    await POST(
      makePostRequest({
        address: "2 Test Road",
        classification: "CONDITIONAL",
        governance_state: "MANUAL_REVIEW_REQUIRED",
        capital_protection_state: "PROTECTED",
        pipeline_state: "UNDER_ANALYSIS",
        engine_result_json: engineResult,
      })
    )

    expect(createSavedDealMock).toHaveBeenCalledTimes(1)
    expect(createSavedDealMock.mock.calls[0][0].engine_result_json).toStrictEqual(engineResult)
  })

  it("POST returns 400 when address is missing", async () => {
    const response = await POST(
      makePostRequest({
        classification: "CONDITIONAL",
        governance_state: "MANUAL_REVIEW_REQUIRED",
        capital_protection_state: "PROTECTED",
        pipeline_state: "UNDER_ANALYSIS",
        engine_result_json: {},
      })
    )

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.success).toBe(false)
  })

  it("POST returns 400 when engine_result_json is missing", async () => {
    const response = await POST(
      makePostRequest({
        address: "3 Test Road",
        classification: "CONDITIONAL",
        governance_state: "MANUAL_REVIEW_REQUIRED",
        capital_protection_state: "PROTECTED",
        pipeline_state: "UNDER_ANALYSIS",
      })
    )

    expect(response.status).toBe(400)
    const payload = await response.json()
    expect(payload.success).toBe(false)
  })

  it("POST repository failure returns safe 500 response", async () => {
    createSavedDealMock.mockRejectedValueOnce(new Error("database exploded with internal details"))

    const response = await POST(
      makePostRequest({
        address: "4 Test Road",
        classification: "CONDITIONAL",
        governance_state: "MANUAL_REVIEW_REQUIRED",
        capital_protection_state: "PROTECTED",
        pipeline_state: "UNDER_ANALYSIS",
        engine_result_json: {},
      })
    )

    expect(response.status).toBe(500)
    const payload = await response.json()
    expect(payload).toEqual({ success: false, error: "Unable to save deal at this time." })
  })

  it("route does not import calculator or engine modules", () => {
    const routeSource = readFileSync(path.resolve(process.cwd(), "app/api/saved-deals/route.ts"), "utf8")

    expect(routeSource).not.toContain("@/lib/engine")
    expect(routeSource).not.toContain("@/lib/calculations")
    expect(routeSource).not.toContain("@/app/page")
  })

  it("does not introduce forbidden runtime keys", async () => {
    listSavedDealsMock.mockResolvedValueOnce([{ id: "deal-3" }])

    const response = await GET(makeGetRequest())

    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    for (const forbidden of ["aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`)
    }
  })
})
