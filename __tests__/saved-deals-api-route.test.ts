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
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { DERIVED_FIELDS } from "@/lib/operator-command/derive-saved-deal-record"
import { operatorHeaders, registerTestOperator } from "./fixtures/operator-session"

registerTestOperator()

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/saved-deals", {
    method: "POST",
    headers: operatorHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  })
}

function makeGetRequest(query = "") {
  return new Request(`http://localhost/api/saved-deals${query}`, {
    method: "GET",
    headers: operatorHeaders(),
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

  const GOOD_INPUTS = { purchasePrice: 100000, gdv: 160000, refurbCost: 20000, stampDuty: 3000, legalCosts: 1500, saleCosts: 3000, bridgeTermMonths: 9 }
  const BAD_DEAL_INPUTS = { purchasePrice: 190000, gdv: 150000, refurbCost: 40000, stampDuty: 5000, legalCosts: 2000, saleCosts: 4000, bridgeTermMonths: 12 }
  const SCOPE = {
    bedrooms: 3,
    bathrooms: 1,
    kitchen: { scope: "refresh", size: "medium" },
    bathroom: { scope: "cosmetic" },
    bedroom: { scope: "paint" },
    flooring: { replaceWholeProperty: false },
    majorWorks: { rewire: false, boiler: false, roof: false },
  }

  it("POST derives every authoritative field on the server from the deal inputs", async () => {
    createSavedDealMock.mockResolvedValueOnce({ id: "deal-1" })

    const response = await POST(makePostRequest({ address: " 1 Test Road ", listing_url: "https://example.com/1", deal_inputs: GOOD_INPUTS, next_action: "Review" }))

    expect(response.status).toBe(201)
    expect((await response.json()).deal.id).toBe("deal-1")
    const expected = analyzeDealWithRefurb(GOOD_INPUTS)
    const saved = createSavedDealMock.mock.calls[0][0]
    expect(saved).toMatchObject({
      address: "1 Test Road",
      purchase_price: 100000,
      gdv_realistic: 160000,
      refurb_cost: 20000,
      governance_state: expected.verdict.status,
      classification: expected.dueDiligence?.decision.dealClassification ?? expected.verdict.status,
      capital_protection_state: expected.dueDiligence?.decision.capitalProtectionStatus ?? "UNKNOWN",
      pipeline_state: "UNDER_ANALYSIS",
      next_action: "Review",
    })
    expect(saved.engine_result_json).toEqual(JSON.parse(JSON.stringify(expected)))
  })

  it("POST with a refurb scope uses the engine-generated refurb cost, not a client figure", async () => {
    createSavedDealMock.mockResolvedValueOnce({ id: "deal-2" })
    await POST(makePostRequest({ address: "2 Test Road", deal_inputs: { ...GOOD_INPUTS, refurbCost: 1 }, scope: SCOPE }))
    const expected = analyzeDealWithRefurb({ ...GOOD_INPUTS, refurbCost: 1 }, SCOPE as never)
    expect(expected.refurbSource).toBe("generated")
    expect(createSavedDealMock.mock.calls[0][0].refurb_cost).toBe(expected.refurb?.totalRefurbCost)
  })

  it.each(DERIVED_FIELDS)("POST rejects a browser-supplied %s and stores nothing", async (field) => {
    const response = await POST(makePostRequest({ address: "3 Test Road", deal_inputs: BAD_DEAL_INPUTS, [field]: field.endsWith("_json") ? {} : "STRONG_OPPORTUNITY" }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain(field)
    expect(createSavedDealMock).not.toHaveBeenCalled()
  })

  it("POST forged governance for a losing deal is rejected, and the honest version is stored as NOT strong", async () => {
    const forged = await POST(makePostRequest({ address: "4 Test Road", deal_inputs: BAD_DEAL_INPUTS, governance_state: "STRONG_OPPORTUNITY", capital_protection_state: "PROTECTED", classification: "STRONG_DEAL", pipeline_state: "READY_FOR_OFFER" }))
    expect(forged.status).toBe(400)
    expect(createSavedDealMock).not.toHaveBeenCalled()

    createSavedDealMock.mockResolvedValueOnce({ id: "deal-4" })
    await POST(makePostRequest({ address: "4 Test Road", deal_inputs: BAD_DEAL_INPUTS }))
    const saved = createSavedDealMock.mock.calls[0][0]
    expect(saved.governance_state).not.toBe("STRONG_OPPORTUNITY")
    expect(saved.pipeline_state).toBe("UNDER_ANALYSIS")
  })

  it("POST does not let the browser choose the record id or timestamps", async () => {
    createSavedDealMock.mockResolvedValueOnce({ id: "deal-5" })
    await POST(makePostRequest({ address: "5 Test Road", deal_inputs: GOOD_INPUTS, id: "attacker-id", created_at: "1999-01-01T00:00:00Z", updated_at: "1999-01-01T00:00:00Z", archived_at: null }))
    const saved = createSavedDealMock.mock.calls[0][0]
    expect(saved).not.toHaveProperty("id")
    expect(saved).not.toHaveProperty("created_at")
    expect(saved).not.toHaveProperty("updated_at")
  })

  it.each([
    ["missing address", { deal_inputs: GOOD_INPUTS }],
    ["blank address", { address: "   ", deal_inputs: GOOD_INPUTS }],
    ["missing deal_inputs", { address: "6 Test Road" }],
    ["deal_inputs not an object", { address: "6 Test Road", deal_inputs: "x" }],
    ["negative price", { address: "6 Test Road", deal_inputs: { ...GOOD_INPUTS, purchasePrice: -1 } }],
    ["numeric string", { address: "6 Test Road", deal_inputs: { ...GOOD_INPUTS, gdv: "160000" } }],
    ["absurd value", { address: "6 Test Road", deal_inputs: { ...GOOD_INPUTS, gdv: 1e15 } }],
    ["missing field", { address: "6 Test Road", deal_inputs: { ...GOOD_INPUTS, saleCosts: undefined } }],
    ["bridge term too long", { address: "6 Test Road", deal_inputs: { ...GOOD_INPUTS, bridgeTermMonths: 5000 } }],
    ["unknown scope option", { address: "6 Test Road", deal_inputs: GOOD_INPUTS, scope: { ...SCOPE, kitchen: { scope: "gold_plated", size: "medium" } } }],
    ["fractional bedrooms", { address: "6 Test Road", deal_inputs: GOOD_INPUTS, scope: { ...SCOPE, bedrooms: 2.5 } }],
  ])("POST returns 400 for %s", async (_name, body) => {
    const response = await POST(makePostRequest(body))
    expect(response.status).toBe(400)
    expect((await response.json()).success).toBe(false)
    expect(createSavedDealMock).not.toHaveBeenCalled()
  })

  it("POST repository failure returns safe 500 response", async () => {
    createSavedDealMock.mockRejectedValueOnce(new Error("database exploded with internal details"))
    const response = await POST(makePostRequest({ address: "7 Test Road", deal_inputs: GOOD_INPUTS }))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: "Unable to save deal at this time." })
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
