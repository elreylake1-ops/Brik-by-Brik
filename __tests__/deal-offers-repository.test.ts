import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}))

vi.mock("@/lib/db/postgres", () => ({
  query: queryMock,
}))

import {
  createOffer,
  listOffersForDeal,
  updateOfferStatus,
  updateSellerResponse,
} from "@/lib/operator-command/deal-offers-repository"

describe("phase 4a deal offers repository", () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it("createOffer inserts into deal_offers with expected fields", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: "offer-1",
        deal_id: "deal-1",
        offer_amount: 100000,
        offer_type: "INITIAL",
        offer_status: "DRAFT",
        offer_rationale: "start low",
        seller_response: null,
        created_at: "2026-05-22",
      }],
    })

    await createOffer("deal-1", {
      offer_amount: 100000,
      offer_rationale: "start low",
    })

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("INSERT INTO lake_views_property.deal_offers")
    expect(sql).toContain("deal_id")
    expect(sql).toContain("offer_amount")
    expect(sql).toContain("offer_type")
    expect(sql).toContain("offer_status")
    expect(sql).toContain("offer_rationale")
    expect(sql).toContain("seller_response")
    expect(params[0]).toBe("deal-1")
    expect(params[1]).toBe(100000)
  })

  it("createOffer returns mapped offer row", async () => {
    const row = {
      id: "offer-2",
      deal_id: "deal-1",
      offer_amount: 102500,
      offer_type: "COUNTER",
      offer_status: "PENDING",
      offer_rationale: null,
      seller_response: "countered",
      created_at: "2026-05-22",
    }
    queryMock.mockResolvedValueOnce({ rows: [row] })

    const result = await createOffer("deal-1", {
      offer_amount: 102500,
      offer_type: "COUNTER",
      offer_status: "PENDING",
      seller_response: "countered",
    })

    expect(result).toEqual(row)
  })

  it("listOffersForDeal queries by deal_id", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await listOffersForDeal("deal-abc")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("FROM lake_views_property.deal_offers")
    expect(sql).toContain("WHERE deal_id = $1")
    expect(params).toEqual(["deal-abc"])
  })

  it("updateOfferStatus updates only offer_status", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await updateOfferStatus("offer-1", "ACCEPTED")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("UPDATE lake_views_property.deal_offers")
    expect(sql).toContain("SET offer_status = $2")
    expect(sql).not.toContain("seller_response =")
    expect(params).toEqual(["offer-1", "ACCEPTED"])
  })

  it("updateSellerResponse updates only seller_response", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await updateSellerResponse("offer-1", "accepted verbally")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("UPDATE lake_views_property.deal_offers")
    expect(sql).toContain("SET seller_response = $2")
    expect(sql).not.toContain("offer_status =")
    expect(params).toEqual(["offer-1", "accepted verbally"])
  })

  it("helpers do not touch saved_deals or engine_result_json", async () => {
    queryMock.mockResolvedValue({ rows: [] })
    await listOffersForDeal("deal-1")

    const sqlTexts = queryMock.mock.calls.map(([sql]) => String(sql)).join("\n")
    expect(sqlTexts).not.toContain("saved_deals")
    expect(sqlTexts).not.toContain("engine_result_json")
  })

  it("repository module has no calculator/engine imports", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "lib/operator-command/deal-offers-repository.ts"),
      "utf8"
    )
    expect(source).not.toContain("@/lib/engine")
    expect(source).not.toContain("@/lib/calculations")
    expect(source).not.toContain("@/app/page")
  })

  it("does not introduce forbidden runtime keys", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: "offer-3",
        deal_id: "deal-1",
        offer_amount: 90000,
        offer_type: "INITIAL",
        offer_status: "DRAFT",
        offer_rationale: null,
        seller_response: null,
        created_at: "2026-05-22",
      }],
    })

    const payload = await createOffer("deal-1", { offer_amount: 90000 })
    const serialized = JSON.stringify(payload)

    for (const forbidden of ["aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`)
    }
  })
})

