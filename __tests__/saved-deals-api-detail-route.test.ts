import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getSavedDealByIdMock } = vi.hoisted(() => ({
  getSavedDealByIdMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: getSavedDealByIdMock,
}))

import { GET } from "@/app/api/saved-deals/[id]/route"

function makeRequest() {
  return new Request("http://localhost/api/saved-deals/deal-1", { method: "GET" })
}

describe("phase 4a saved deal detail route", () => {
  beforeEach(() => {
    getSavedDealByIdMock.mockReset()
  })

  it("GET returns 200 and success true when deal exists", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })

    const response = await GET(makeRequest(), { params: { id: "deal-1" } })
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.success).toBe(true)
    expect(payload.deal.id).toBe("deal-1")
  })

  it("GET returns 404 when no deal exists", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    const response = await GET(makeRequest(), { params: { id: "missing" } })
    expect(response.status).toBe(404)

    const payload = await response.json()
    expect(payload).toEqual({ success: false, error: "Saved deal not found." })
  })

  it("GET returns 400 for missing or blank id", async () => {
    const missingResponse = await GET(makeRequest(), { params: {} })
    expect(missingResponse.status).toBe(400)

    const blankResponse = await GET(makeRequest(), { params: { id: "   " } })
    expect(blankResponse.status).toBe(400)
  })

  it("repository failure returns safe 500", async () => {
    getSavedDealByIdMock.mockRejectedValueOnce(new Error("db failure details"))

    const response = await GET(makeRequest(), { params: { id: "deal-1" } })
    expect(response.status).toBe(500)

    const payload = await response.json()
    expect(payload).toEqual({ success: false, error: "Unable to load saved deal at this time." })
  })

  it("route does not import calculator or engine modules", () => {
    const routeSource = readFileSync(path.resolve(process.cwd(), "app/api/saved-deals/[id]/route.ts"), "utf8")

    expect(routeSource).not.toContain("@/lib/engine")
    expect(routeSource).not.toContain("@/lib/calculations")
    expect(routeSource).not.toContain("@/app/page")
  })

  it("does not introduce forbidden runtime keys", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce({ id: "deal-1" })

    const response = await GET(makeRequest(), { params: { id: "deal-1" } })
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    for (const forbidden of ["aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`)
    }
  })
})
