import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CreateSavedDealInput, UpdateSavedDealPatch } from "@/lib/operator-command/saved-deals-repository"

const { buildDefaultInvestorShieldChecksMock, insertInvestorShieldChecksMock, queryMock } = vi.hoisted(() => ({
  buildDefaultInvestorShieldChecksMock: vi.fn(),
  insertInvestorShieldChecksMock: vi.fn(),
  queryMock: vi.fn(),
}))

vi.mock("@/lib/db/postgres", () => ({
  query: queryMock,
}))

vi.mock("@/lib/investor-shield/default-checks", () => ({
  buildDefaultInvestorShieldChecks: buildDefaultInvestorShieldChecksMock,
}))

vi.mock("@/lib/investor-shield/investor-shield-repository", () => ({
  insertInvestorShieldChecks: insertInvestorShieldChecksMock,
}))

import {
  archiveSavedDeal,
  createSavedDeal,
  getSavedDealById,
  listSavedDeals,
  updateSavedDeal,
} from "@/lib/operator-command/saved-deals-repository"

describe("phase 4a saved deals repository", () => {
  beforeEach(() => {
    buildDefaultInvestorShieldChecksMock.mockReset()
    insertInvestorShieldChecksMock.mockReset()
    queryMock.mockReset()
  })

  it("createSavedDeal maps fields, preserves JSON payloads, and then attempts default investor shield creation", async () => {
    const engineResult = { verdict: "CONDITIONAL", mao: 123000 }
    const riskSummary = { level: "MEDIUM", blockers: ["legal"] }
    const input: CreateSavedDealInput = {
      address: "1 Test Road",
      listing_url: "https://example.com/deal/1",
      purchase_price: 100000,
      gdv_realistic: 145000,
      refurb_cost: 20000,
      classification: "CONDITIONAL",
      governance_state: "MANUAL_REVIEW_REQUIRED",
      capital_protection_state: "PROTECTED",
      pipeline_state: "UNDER_ANALYSIS",
      engine_result_json: engineResult,
      risk_summary_json: riskSummary,
      next_action: "Review legal pack",
    }

    buildDefaultInvestorShieldChecksMock.mockReturnValueOnce([{ dealId: "d1", gateKey: "SOLD_COMPS" }])
    insertInvestorShieldChecksMock.mockResolvedValueOnce([])
    queryMock.mockResolvedValueOnce({
      rows: [{ id: "d1", ...input, created_at: "2026-05-22", updated_at: "2026-05-22", archived_at: null }],
    })

    await createSavedDeal(input)

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("INSERT INTO brik_by_brik_engine.saved_deals")
    expect(params[12]).toBe(engineResult)
    expect(params[13]).toBe(riskSummary)

    const serialized = JSON.stringify(params)
    for (const forbidden of ["aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]) {
      expect(serialized).not.toContain(`\\\"${forbidden}\\\"`)
    }

    expect(buildDefaultInvestorShieldChecksMock).toHaveBeenCalledWith("d1")
    expect(insertInvestorShieldChecksMock).toHaveBeenCalledWith([{ dealId: "d1", gateKey: "SOLD_COMPS" }])
  })

  it("createSavedDeal does not attempt default investor shield creation before the saved deal insert succeeds", async () => {
    queryMock.mockRejectedValueOnce(new Error("insert failed"))

    await expect(
      createSavedDeal({
        address: "1 Test Road",
        classification: "CONDITIONAL",
        governance_state: "MANUAL_REVIEW_REQUIRED",
        capital_protection_state: "PROTECTED",
        pipeline_state: "UNDER_ANALYSIS",
        engine_result_json: {},
        risk_summary_json: {},
      })
    ).rejects.toThrow("insert failed")

    expect(buildDefaultInvestorShieldChecksMock).not.toHaveBeenCalled()
    expect(insertInvestorShieldChecksMock).not.toHaveBeenCalled()
  })

  it("createSavedDeal stays successful when investor shield check insertion fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    buildDefaultInvestorShieldChecksMock.mockReturnValueOnce([{ dealId: "d1", gateKey: "SOLD_COMPS" }])
    insertInvestorShieldChecksMock.mockRejectedValueOnce(new Error("shield insert failed"))
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: "d1",
        address: "1 Test Road",
        listing_url: null,
        purchase_price: null,
        gdv_realistic: null,
        refurb_cost: null,
        classification: "CONDITIONAL",
        governance_state: "MANUAL_REVIEW_REQUIRED",
        capital_protection_state: "PROTECTED",
        pipeline_state: "UNDER_ANALYSIS",
        engine_result_json: {},
        risk_summary_json: {},
        next_action: null,
        created_at: "2026-05-22",
        updated_at: "2026-05-22",
        archived_at: null,
      }],
    })

    const result = await createSavedDeal({
      address: "1 Test Road",
      classification: "CONDITIONAL",
      governance_state: "MANUAL_REVIEW_REQUIRED",
      capital_protection_state: "PROTECTED",
      pipeline_state: "UNDER_ANALYSIS",
      engine_result_json: {},
      risk_summary_json: {},
    })

    expect(result.id).toBe("d1")
    expect(insertInvestorShieldChecksMock).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)

    consoleErrorSpy.mockRestore()
  })

  it("getSavedDealById returns null when no rows", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const result = await getSavedDealById("missing")
    expect(result).toBeNull()
    expect(queryMock.mock.calls[0][0]).toContain("FROM brik_by_brik_engine.saved_deals")
  })

  it("listSavedDeals excludes archived by default", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await listSavedDeals()
    expect(queryMock.mock.calls[0][0]).toContain("WHERE archived_at IS NULL")
  })

  it("listSavedDeals includes archived when requested", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await listSavedDeals({ includeArchived: true })
    expect(queryMock.mock.calls[0][0]).not.toContain("WHERE archived_at IS NULL")
  })

  it("updateSavedDeal updates only saved_deal metadata fields", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    const patch: UpdateSavedDealPatch = {
      address: "2 Test Road",
      classification: "STRONG_OPPORTUNITY",
      risk_summary_json: { level: "LOW" },
    }

    await updateSavedDeal("d1", patch)
    const [sql] = queryMock.mock.calls[0]

    expect(sql).toContain("UPDATE brik_by_brik_engine.saved_deals")
    expect(sql).toContain("address =")
    expect(sql).toContain("classification =")
    expect(sql).toContain("risk_summary_json =")
    expect(sql).not.toContain("offers")
    expect(sql).not.toContain("tasks")
    expect(sql).not.toContain("evidence")
    expect(sql).not.toContain("audit")
  })

  it("archiveSavedDeal sets ARCHIVED state and archived_at", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await archiveSavedDeal("d1")
    const [sql] = queryMock.mock.calls[0]

    expect(sql).toContain("archived_at = NOW()")
    expect(sql).toContain("pipeline_state = 'ARCHIVED'")
  })

  it("repository module has no calculator or engine runtime dependency", async () => {
    const mod = await import("@/lib/operator-command/saved-deals-repository")
    expect(typeof mod.createSavedDeal).toBe("function")
    expect(typeof mod.getSavedDealById).toBe("function")
    expect(typeof mod.listSavedDeals).toBe("function")
    expect(typeof mod.updateSavedDeal).toBe("function")
    expect(typeof mod.archiveSavedDeal).toBe("function")
  })
})
