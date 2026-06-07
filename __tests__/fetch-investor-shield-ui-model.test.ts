import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchInvestorShieldUiModel,
  type FetchInvestorShieldUiModelResult,
} from "@/lib/investor-shield/fetch-investor-shield-ui-model"

const fetchMock = vi.fn()

describe("fetchInvestorShieldUiModel", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns safe failure without calling fetch for an empty deal id", async () => {
    const result = await fetchInvestorShieldUiModel("   ")

    expect(result).toEqual({
      success: false,
      error: "Investor Shield status could not be loaded. Pipeline rules remain unchanged.",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("calls the correct GET endpoint for a valid id", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        success: true,
        model: { dealId: "deal-1" },
      }),
    })

    await fetchInvestorShieldUiModel("deal-1")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/saved-deals/deal-1/investor-shield-ui",
      expect.objectContaining({
        method: "GET",
      })
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init?.method).toBe("GET")
    expect(init?.method).not.toBe("POST")
    expect(init?.method).not.toBe("PATCH")
    expect(init?.method).not.toBe("DELETE")
  })

  it("returns a model on success response", async () => {
    const model = {
      dealId: "deal-1",
      gateSummaries: [{ key: "TITLE", label: "Title" }],
    }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        success: true,
        model,
      }),
    })

    const result = (await fetchInvestorShieldUiModel("deal-1")) as FetchInvestorShieldUiModelResult

    expect(result).toEqual({
      success: true,
      model,
    })
  })

  it("returns a safe error for a failed response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValueOnce({
        success: false,
        error: "route failure details",
      }),
    })

    const result = await fetchInvestorShieldUiModel("deal-1")

    expect(result).toEqual({
      success: false,
      error: "route failure details",
    })
  })

  it("returns a safe error for a rejected fetch", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network stack trace"))

    const result = await fetchInvestorShieldUiModel("deal-1")

    expect(result).toEqual({
      success: false,
      error: "Investor Shield status could not be loaded. Pipeline rules remain unchanged.",
    })
  })

  it("does not call pipeline or task endpoints", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        success: true,
        model: { dealId: "deal-1" },
      }),
    })

    await fetchInvestorShieldUiModel("deal-1")

    const [[url]] = fetchMock.mock.calls as [[string, RequestInit]]
    expect(url).toContain("/api/saved-deals/deal-1/investor-shield-ui")
    expect(url).not.toContain("/pipeline")
    expect(url).not.toContain("/tasks")
  })
})
