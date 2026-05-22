import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { createOfferMock, listOffersForDealMock } = vi.hoisted(() => ({
  createOfferMock: vi.fn(),
  listOffersForDealMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/deal-offers-repository", () => ({
  createOffer: createOfferMock,
  listOffersForDeal: listOffersForDealMock,
}))

import { GET, POST } from "@/app/api/saved-deals/[id]/offers/route"

function makeGetRequest() {
  return new Request("http://localhost/api/saved-deals/deal-1/offers", { method: "GET" })
}

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/saved-deals/deal-1/offers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("phase 4a deal offers api route", () => {
  beforeEach(() => {
    createOfferMock.mockReset()
    listOffersForDealMock.mockReset()
  })

  it("GET returns 200 and offers array", async () => {
    listOffersForDealMock.mockResolvedValueOnce([{ id: "offer-1" }])

    const response = await GET(makeGetRequest(), { params: { id: "deal-1" } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, offers: [{ id: "offer-1" }] })
  })

  it("GET invalid/missing id returns 400", async () => {
    const missing = await GET(makeGetRequest(), { params: {} })
    expect(missing.status).toBe(400)

    const blank = await GET(makeGetRequest(), { params: { id: "  " } })
    expect(blank.status).toBe(400)
  })

  it("GET repository failure returns safe 500", async () => {
    listOffersForDealMock.mockRejectedValueOnce(new Error("db details"))
    const response = await GET(makeGetRequest(), { params: { id: "deal-1" } })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: "Unable to load deal offers at this time.",
    })
  })

  it("POST valid body returns 201 and created offer", async () => {
    createOfferMock.mockResolvedValueOnce({ id: "offer-2" })
    const response = await POST(
      makePostRequest({
        offer_amount: 100000,
        offer_type: "INITIAL",
        offer_status: "DRAFT",
        offer_rationale: "test",
        seller_response: null,
      }),
      { params: { id: "deal-1" } }
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ success: true, offer: { id: "offer-2" } })
  })

  it("POST defaults offer_type to INITIAL if missing", async () => {
    createOfferMock.mockResolvedValueOnce({ id: "offer-3" })

    await POST(makePostRequest({ offer_amount: 120000 }), { params: { id: "deal-1" } })
    expect(createOfferMock).toHaveBeenCalledWith(
      "deal-1",
      expect.objectContaining({ offer_type: "INITIAL" })
    )
  })

  it("POST defaults offer_status to DRAFT if missing", async () => {
    createOfferMock.mockResolvedValueOnce({ id: "offer-4" })

    await POST(makePostRequest({ offer_amount: 120000 }), { params: { id: "deal-1" } })
    expect(createOfferMock).toHaveBeenCalledWith(
      "deal-1",
      expect.objectContaining({ offer_status: "DRAFT" })
    )
  })

  it("POST missing/invalid offer_amount returns 400", async () => {
    const missing = await POST(makePostRequest({}), { params: { id: "deal-1" } })
    expect(missing.status).toBe(400)

    const invalid = await POST(makePostRequest({ offer_amount: "x" }), { params: { id: "deal-1" } })
    expect(invalid.status).toBe(400)
  })

  it("POST repository failure returns safe 500", async () => {
    createOfferMock.mockRejectedValueOnce(new Error("db details"))
    const response = await POST(makePostRequest({ offer_amount: 100000 }), { params: { id: "deal-1" } })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: "Unable to create deal offer at this time.",
    })
  })

  it("route does not import calculator/engine modules", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "app/api/saved-deals/[id]/offers/route.ts"),
      "utf8"
    )
    expect(source).not.toContain("@/lib/engine")
    expect(source).not.toContain("@/lib/calculations")
    expect(source).not.toContain("@/app/page")
  })

  it("route does not touch saved_deals or engine_result_json", async () => {
    listOffersForDealMock.mockResolvedValueOnce([])
    await GET(makeGetRequest(), { params: { id: "deal-1" } })

    const source = readFileSync(
      path.resolve(process.cwd(), "app/api/saved-deals/[id]/offers/route.ts"),
      "utf8"
    )
    expect(source).not.toContain("saved_deals")
    expect(source).not.toContain("engine_result_json")
  })

  it("does not introduce forbidden runtime keys", async () => {
    listOffersForDealMock.mockResolvedValueOnce([{ id: "offer-5" }])
    const response = await GET(makeGetRequest(), { params: { id: "deal-1" } })
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    for (const forbidden of ["aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`)
    }
  })
})
