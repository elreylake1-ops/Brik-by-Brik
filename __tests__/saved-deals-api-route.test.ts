import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { createSavedDealMock } = vi.hoisted(() => ({
  createSavedDealMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  createSavedDeal: createSavedDealMock,
}))

import { POST } from "@/app/api/saved-deals/route"

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/saved-deals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("phase 4a saved deals POST route", () => {
  beforeEach(() => {
    createSavedDealMock.mockReset()
  })

  it("returns 201 and success true when input is valid", async () => {
    createSavedDealMock.mockResolvedValueOnce({ id: "deal-1" })

    const engineResult = { verdict: "CONDITIONAL", score: 77 }
    const response = await POST(
      makeRequest({
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

  it("calls createSavedDeal with pass-through engine_result_json", async () => {
    const engineResult = { exact: true, nested: { x: 1 } }
    createSavedDealMock.mockResolvedValueOnce({ id: "deal-2" })

    await POST(
      makeRequest({
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

  it("returns 400 when address is missing", async () => {
    const response = await POST(
      makeRequest({
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

  it("returns 400 when engine_result_json is missing", async () => {
    const response = await POST(
      makeRequest({
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

  it("returns safe 500 response when repository fails", async () => {
    createSavedDealMock.mockRejectedValueOnce(new Error("database exploded with internal details"))

    const response = await POST(
      makeRequest({
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
    createSavedDealMock.mockResolvedValueOnce({ id: "deal-3" })

    const response = await POST(
      makeRequest({
        address: "5 Test Road",
        classification: "CONDITIONAL",
        governance_state: "MANUAL_REVIEW_REQUIRED",
        capital_protection_state: "PROTECTED",
        pipeline_state: "UNDER_ANALYSIS",
        engine_result_json: {},
      })
    )

    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    for (const forbidden of ["aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`)
    }
  })
})
