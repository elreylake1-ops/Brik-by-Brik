// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import path from "node:path"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import InvestorSummaryRoutePanel from "@/components/investor-summary/InvestorSummaryRoutePanel"
import { INVESTOR_SUMMARY_PRESENTATION_COMPLETE_FIXTURE } from "./fixtures/investor-summary-fixtures"

const fetchMock = vi.fn()
let mountedRoot: Root | null = null
let mountedContainer: HTMLDivElement | null = null

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function renderPanel(savedDealId: string | null): Promise<HTMLElement> {
  document.body.innerHTML = ""
  vi.stubGlobal("fetch", fetchMock)

  mountedContainer = document.createElement("div")
  document.body.appendChild(mountedContainer)
  mountedRoot = createRoot(mountedContainer)

  await act(async () => {
    mountedRoot?.render(<InvestorSummaryRoutePanel savedDealId={savedDealId} />)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  await flushEffects()
  return mountedContainer
}

afterEach(() => {
  mountedRoot?.unmount()
  mountedRoot = null
  mountedContainer?.remove()
  mountedContainer = null
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  document.body.innerHTML = ""
})

describe("InvestorSummaryRoutePanel", () => {
  it("shows the local prompt before a saved deal is selected", async () => {
    const container = await renderPanel(null)

    expect(container.textContent).toContain("Select a saved deal to view read-only Investor Summary.")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("loads and renders the investor summary from the approved GET route", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        investorSummary: INVESTOR_SUMMARY_PRESENTATION_COMPLETE_FIXTURE,
      })
    )

    const container = await renderPanel(" deal-1 ")

    expect(fetchMock).toHaveBeenCalledWith("/api/saved-deals/deal-1/investor-summary", {
      method: "GET",
      headers: { accept: "application/json" },
    })
    expect(container.textContent).toContain("Investor Summary")
    expect(container.textContent).toContain("22 Lake View Road, Leeds")
    expect(container.textContent).toContain("Review lender criteria and solicitor evidence")
  })

  it("renders a safe not-found state for a missing deal", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse(
        {
          success: false,
          error: "INVESTOR_SUMMARY_NOT_FOUND",
        },
        404
      )
    )

    const container = await renderPanel("deal-404")

    expect(container.textContent).toContain("Investor Summary not found for this saved deal.")
    expect(container.textContent).not.toContain("INVESTOR_SUMMARY_NOT_FOUND")
  })

  it("renders a safe failure state with trace id when the route fails", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse(
        {
          success: false,
          error: "INVESTOR_SUMMARY_READ_FAILED",
          traceId: "trace-123",
        },
        500
      )
    )

    const container = await renderPanel("deal-500")

    expect(container.textContent).toContain("Investor Summary could not be loaded.")
    expect(container.textContent).toContain("Trace ID: trace-123")
  })

  it("is wired into the main saved-deal detail surface", () => {
    const pageSource = readFileSync(path.resolve(process.cwd(), "app/page.tsx"), "utf8")

    expect(pageSource).toContain('import InvestorSummaryRoutePanel from "@/components/investor-summary/InvestorSummaryRoutePanel"')
    expect(pageSource).toContain("<InvestorSummaryRoutePanel savedDealId={selectedSavedDeal.id} />")
    expect(pageSource).toContain("<SavedDealInvestorShieldPanel")
    expect(pageSource.indexOf("<InvestorSummaryRoutePanel savedDealId={selectedSavedDeal.id} />")).toBeLessThan(
      pageSource.indexOf("<SavedDealInvestorShieldPanel")
    )
    expect(pageSource).not.toContain("getInvestorSummaryForDeal")
    expect(pageSource).not.toContain("@/lib/investor-summary/investor-summary-repository")
  })
})
