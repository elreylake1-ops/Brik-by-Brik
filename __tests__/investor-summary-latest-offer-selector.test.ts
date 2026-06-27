import { describe, expect, it } from "vitest"
import type { DealOfferRecord } from "@/lib/operator-command/deal-offers-repository"
import { selectLatestInvestorSummaryOffer } from "@/lib/investor-summary/select-latest-investor-summary-offer"

function makeOffer(overrides: Partial<DealOfferRecord> = {}): DealOfferRecord {
  return {
    id: "offer-base",
    deal_id: "deal-1",
    offer_amount: 100000,
    offer_type: "INITIAL",
    offer_status: "DRAFT",
    offer_rationale: "Initial offer",
    seller_response: null,
    created_at: "2026-01-17T08:45:00.000Z",
    ...overrides,
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue)
    }
  }

  return value
}

describe("selectLatestInvestorSummaryOffer", () => {
  it("returns null for empty input", () => {
    expect(selectLatestInvestorSummaryOffer([])).toBeNull()
  })

  it("maps one offer to the Investor Summary offer contract", () => {
    const offer = makeOffer({
      id: "offer-1",
      offer_amount: 175000,
      offer_type: "INITIAL",
      offer_status: "PENDING",
      offer_rationale: "Aligned to MAO with evidence caveat.",
      seller_response: "Considering",
      created_at: "2026-01-17T08:45:00.000Z",
    })

    expect(selectLatestInvestorSummaryOffer([offer])).toEqual({
      offerId: "offer-1",
      amount: 175000,
      offerType: "INITIAL",
      offerStatus: "PENDING",
      rationale: "Aligned to MAO with evidence caveat.",
      sellerResponse: "Considering",
      createdAt: "2026-01-17T08:45:00.000Z",
    })
  })

  it("selects the first supplied record", () => {
    const first = makeOffer({
      id: "offer-first",
      offer_amount: 90000,
      offer_status: "DRAFT",
      created_at: "2026-01-18T09:00:00.000Z",
    })
    const second = makeOffer({
      id: "offer-second",
      offer_amount: 120000,
      offer_status: "ACCEPTED",
      created_at: "2026-01-19T09:00:00.000Z",
    })

    expect(selectLatestInvestorSummaryOffer([first, second])?.offerId).toBe("offer-first")
  })

  it("does not choose the highest amount", () => {
    const first = makeOffer({
      id: "offer-low",
      offer_amount: 50000,
      offer_status: "DRAFT",
    })
    const second = makeOffer({
      id: "offer-high",
      offer_amount: 250000,
      offer_status: "PENDING",
    })

    expect(selectLatestInvestorSummaryOffer([first, second])?.amount).toBe(50000)
  })

  it("does not choose based on offer status", () => {
    const first = makeOffer({
      id: "offer-draft",
      offer_amount: 70000,
      offer_status: "DRAFT",
    })
    const second = makeOffer({
      id: "offer-accepted",
      offer_amount: 71000,
      offer_status: "ACCEPTED",
    })

    expect(selectLatestInvestorSummaryOffer([first, second])?.offerStatus).toBe("DRAFT")
  })

  it("does not compare or reorder timestamps", () => {
    const first = makeOffer({
      id: "offer-newer-first",
      created_at: "2026-01-20T09:00:00.000Z",
    })
    const second = makeOffer({
      id: "offer-older-second",
      created_at: "2026-01-18T09:00:00.000Z",
    })

    expect(selectLatestInvestorSummaryOffer([first, second])?.createdAt).toBe(
      "2026-01-20T09:00:00.000Z"
    )
  })

  it("preserves nullable rationale", () => {
    const offer = makeOffer({
      id: "offer-null-rationale",
      offer_rationale: null,
    })

    expect(selectLatestInvestorSummaryOffer([offer])?.rationale).toBeNull()
  })

  it("preserves nullable seller response", () => {
    const offer = makeOffer({
      id: "offer-null-response",
      seller_response: null,
    })

    expect(selectLatestInvestorSummaryOffer([offer])?.sellerResponse).toBeNull()
  })

  it("does not mutate the input array", () => {
    const offers = deepFreeze([
      makeOffer({ id: "offer-1" }),
      makeOffer({ id: "offer-2", offer_status: "PENDING" }),
    ])
    const snapshot = structuredClone(offers)

    selectLatestInvestorSummaryOffer(offers)

    expect(offers).toEqual(snapshot)
  })

  it("does not mutate input offer records", () => {
    const offer = deepFreeze(
      makeOffer({
        id: "offer-immutable",
        offer_status: "COUNTERED",
        seller_response: "Counter pending",
      })
    )
    const snapshot = structuredClone(offer)

    selectLatestInvestorSummaryOffer([offer])

    expect(offer).toEqual(snapshot)
  })

  it("preserves duplicate offers upstream and selects the first record", () => {
    const offer = makeOffer({
      id: "offer-duplicate",
      offer_amount: 0,
      offer_status: "DRAFT",
      offer_rationale: null,
      seller_response: null,
    })

    const result = selectLatestInvestorSummaryOffer([offer, offer])

    expect(result).toEqual({
      offerId: "offer-duplicate",
      amount: 0,
      offerType: "INITIAL",
      offerStatus: "DRAFT",
      rationale: null,
      sellerResponse: null,
      createdAt: "2026-01-17T08:45:00.000Z",
    })
  })

  it("preserves zero offer amounts", () => {
    const offer = makeOffer({
      id: "offer-zero",
      offer_amount: 0,
      offer_status: "DRAFT",
    })

    expect(selectLatestInvestorSummaryOffer([offer])?.amount).toBe(0)
  })
})
