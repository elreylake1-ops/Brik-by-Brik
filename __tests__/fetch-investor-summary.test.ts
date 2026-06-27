import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchInvestorSummary,
  type FetchInvestorSummaryResult,
} from "@/lib/investor-summary/fetch-investor-summary"

const fetchMock = vi.fn()

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("fetchInvestorSummary", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns a safe invalid-id failure without calling fetch", async () => {
    const result = await fetchInvestorSummary("   ")

    expect(result).toEqual({
      success: false,
      status: 400,
      error: "Investor Summary deal id is required.",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("calls the approved GET route for a valid saved-deal id", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        investorSummary: {
          deal: { dealId: "deal-1", address: "10 Brik Street" },
        },
      })
    )

    await fetchInvestorSummary(" deal-1 ")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/saved-deals/deal-1/investor-summary", {
      method: "GET",
      headers: { accept: "application/json" },
    })
  })

  it("returns the composed investor summary on success", async () => {
    const investorSummary = {
      deal: { dealId: "deal-1", address: "10 Brik Street" },
      purchasePrice: 125000,
      gdvRange: { downside: 180000, realistic: 200000, strong: 220000 },
      trueMao: { fifteenPercent: 123800, twentyPercent: 113800, twentyFivePercent: 103800 },
      capitalProtectionState: "SAFE",
      classification: "STRONG_DEAL",
      investorShield: { overallStatus: "CLEAR", missingEvidenceCount: 0, blockedGates: [] },
      activeTasks: [],
      latestOffer: null,
      recommendedNextAction: { source: "PERSISTED_NEXT_ACTION", actionText: "Review lender criteria" },
    }

    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        investorSummary,
      })
    )

    const result = (await fetchInvestorSummary("deal-1")) as FetchInvestorSummaryResult

    expect(result).toEqual({
      success: true,
      investorSummary,
    })
  })

  it("returns the route failure and trace id for a missing deal", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse(
        {
          success: false,
          error: "INVESTOR_SUMMARY_NOT_FOUND",
        },
        404
      )
    )

    const result = await fetchInvestorSummary("deal-1")

    expect(result).toEqual({
      success: false,
      status: 404,
      error: "INVESTOR_SUMMARY_NOT_FOUND",
    })
  })

  it("returns a safe failure for network errors", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network stack trace"))

    const result = await fetchInvestorSummary("deal-1")

    expect(result).toEqual({
      success: false,
      status: 500,
      error: "Investor Summary could not be loaded.",
    })
  })
})
