// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import path from "node:path"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import InvestorSummaryRoutePanel from "@/components/investor-summary/InvestorSummaryRoutePanel"
import {
  INVESTOR_SUMMARY_PRESENTATION_BLOCKED_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_COMPLETE_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_EMPTY_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_UNAVAILABLE_FIXTURE,
} from "./fixtures/investor-summary-fixtures"

const fetchMock = vi.fn()
let mountedRoot: Root | null = null
let mountedContainer: HTMLDivElement | null = null

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
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

function expectOrder(text: string, values: readonly string[]): void {
  let cursor = -1
  for (const value of values) {
    const index = text.indexOf(value)
    expect(index).toBeGreaterThan(cursor)
    cursor = index
  }
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

describe("Investor summary local validation", () => {
  it("keeps the approved host surface wired to the route panel", () => {
    const pageSource = readFileSync(path.resolve(process.cwd(), "app/page.tsx"), "utf8")

    expect(pageSource).toContain(
      'import InvestorSummaryRoutePanel from "@/components/investor-summary/InvestorSummaryRoutePanel"'
    )
    expect(pageSource).toContain("<InvestorSummaryRoutePanel savedDealId={selectedSavedDeal.id} />")
    expect(pageSource.indexOf("<InvestorSummaryRoutePanel savedDealId={selectedSavedDeal.id} />")).toBeLessThan(
      pageSource.indexOf("<SavedDealInvestorShieldPanel")
    )
  })

  it("renders the complete summary through the approved GET route after a visible loading state", async () => {
    const gate = deferred<Response>()
    fetchMock.mockReturnValueOnce(gate.promise)

    const container = await renderPanel(" deal-1 ")

    expect(fetchMock).toHaveBeenCalledWith("/api/saved-deals/deal-1/investor-summary", {
      method: "GET",
      headers: { accept: "application/json" },
    })
    expect(container.textContent).toContain("Loading Investor Summary...")
    expect(container.textContent).not.toContain("22 Lake View Road, Leeds")

    gate.resolve(
      makeJsonResponse({
        success: true,
        investorSummary: INVESTOR_SUMMARY_PRESENTATION_COMPLETE_FIXTURE,
      })
    )
    await flushEffects()

    expect(container.textContent).toContain("22 Lake View Road, Leeds")
    expect(container.textContent).toContain("£125,000.00")
    expect(container.textContent).toContain("Review lender criteria and solicitor evidence")
    expect(container.textContent).toContain("Review lender criteria")
    expect(container.textContent).toContain("Confirm solicitor review")
    expect(container.textContent).toContain("Awaiting reply")
    expect(container.textContent).toContain("No warnings or unavailable fields.")
    expectOrder(container.textContent ?? "", [
      "Financial Snapshot",
      "Capital Protection and Investor Shield",
      "Recommended Actions",
      "Active Tasks and Blockers",
      "Latest Offer",
      "Warnings and Unavailable Data",
    ])
    expectOrder(container.textContent ?? "", [
      "Review lender criteria",
      "Confirm solicitor review",
      "Awaiting reply",
    ])
  })

  it("preserves blocked, unavailable, and empty read-only states without recalculation", async () => {
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        investorSummary: INVESTOR_SUMMARY_PRESENTATION_BLOCKED_FIXTURE,
      })
    )

    const blockedContainer = await renderPanel("deal-blocked")
    expect(blockedContainer.textContent).toContain("BLOCKED")
    expect(blockedContainer.textContent).toContain("CAUTION")
    expect(blockedContainer.textContent).toContain("Deterministic risk remains visible when blocked or cautionary values are present.")
    expect(blockedContainer.textContent).toContain("Initial offer with evidence caveat.")
    expect(blockedContainer.textContent).toContain("Collect title pack")
    expect(blockedContainer.textContent).toContain("Request builder quote")

    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        investorSummary: INVESTOR_SUMMARY_PRESENTATION_UNAVAILABLE_FIXTURE,
      })
    )

    const unavailableContainer = await renderPanel("deal-unavailable")
    expect(unavailableContainer.textContent).toContain("Purchase price unavailable.")
    expect(unavailableContainer.textContent).toContain("Unavailable")
    expect(unavailableContainer.textContent).not.toContain("£0.00")
    expect(unavailableContainer.textContent).toContain("No latest offer available.")
    expect(unavailableContainer.textContent).toContain("Recommended action unavailable.")

    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        investorSummary: INVESTOR_SUMMARY_PRESENTATION_EMPTY_FIXTURE,
      })
    )

    const emptyContainer = await renderPanel("deal-empty")
    expect(emptyContainer.textContent).toContain("No active tasks.")
    expect(emptyContainer.textContent).toContain("No latest offer available.")
    expect(emptyContainer.textContent).toContain("Recommended action unavailable.")
    expect(emptyContainer.textContent).not.toContain("Collect title pack")
  })

  it("handles invalid, missing, malformed, and sensitive failures safely", async () => {
    const invalidContainer = await renderPanel(null)
    expect(invalidContainer.textContent).toContain("Select a saved deal to view read-only Investor Summary.")
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValueOnce(
      makeJsonResponse(
        {
          success: false,
          error: "INVESTOR_SUMMARY_NOT_FOUND",
        },
        404
      )
    )

    const missingContainer = await renderPanel("deal-404")
    expect(missingContainer.textContent).toContain("Investor Summary not found for this saved deal.")
    expect(missingContainer.textContent).not.toContain("INVESTOR_SUMMARY_NOT_FOUND")

    fetchMock.mockResolvedValueOnce(makeJsonResponse({ success: true }, 200))
    const malformedContainer = await renderPanel("deal-malformed")
    expect(malformedContainer.textContent).toContain("Investor Summary could not be loaded.")
    expect(malformedContainer.textContent).not.toContain("No warnings or unavailable fields.")

    fetchMock.mockResolvedValueOnce(
      makeJsonResponse(
        {
          success: false,
          error: "INVESTOR_SUMMARY_READ_FAILED",
          traceId: "trace-sensitive-1",
          diagnostic: {
            errorMessage: "select * from secret_table",
            stack: "Error: fake stack trace",
            dbHost: "postgres://user:pass@db.fake.internal/app",
            databaseUrl: "DATABASE_URL=postgres://user:pass@db.fake.internal/app",
            supabaseRef: "project-ref-123",
            windowsPath: "C:\\Users\\user\\secret\\db.ts",
          },
        },
        500
      )
    )

    const failureContainer = await renderPanel("deal-500")
    expect(failureContainer.textContent).toContain("Investor Summary could not be loaded.")
    expect(failureContainer.textContent).toContain("Trace ID: trace-sensitive-1")
    expect(failureContainer.textContent).not.toContain("select * from secret_table")
    expect(failureContainer.textContent).not.toContain("fake stack trace")
    expect(failureContainer.textContent).not.toContain("postgres://user:pass@db.fake.internal/app")
    expect(failureContainer.textContent).not.toContain("DATABASE_URL")
    expect(failureContainer.textContent).not.toContain("project-ref-123")
    expect(failureContainer.textContent).not.toContain("C:\\Users\\user\\secret\\db.ts")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
