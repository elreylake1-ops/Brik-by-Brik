import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { LoadInvestorReviewPageModelResult } from "@/lib/investor-review/load-investor-review-page-model"
import { makeSampleInvestorReviewReadyViewModel } from "./fixtures/investor-deal-summary-fixtures"

const { loadInvestorReviewPageModelMock, notFoundMock } = vi.hoisted(() => ({
  loadInvestorReviewPageModelMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

vi.mock("@/lib/investor-review/load-investor-review-page-model", () => ({
  loadInvestorReviewPageModel: loadInvestorReviewPageModelMock,
}))

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}))

import InvestorDealSummaryPage from "../app/saved-deals/[id]/summary/page"
import InvestorDealSummaryLoading from "../app/saved-deals/[id]/summary/loading"
import InvestorDealSummaryNotFound from "../app/saved-deals/[id]/summary/not-found"

describe("InvestorDealSummaryPage", () => {
  beforeEach(() => {
    loadInvestorReviewPageModelMock.mockReset()
    notFoundMock.mockClear()
  })

  it("calls loadInvestorReviewPageModel once with route id and renders summary document on ready result", async () => {
    loadInvestorReviewPageModelMock.mockResolvedValueOnce({
      status: "ready",
      viewModel: makeSampleInvestorReviewReadyViewModel(),
    } satisfies LoadInvestorReviewPageModelResult)

    const element = await InvestorDealSummaryPage({
      params: Promise.resolve({ id: "  deal-123  " }),
    })
    const html = renderToStaticMarkup(element)

    expect(loadInvestorReviewPageModelMock).toHaveBeenCalledTimes(1)
    expect(loadInvestorReviewPageModelMock).toHaveBeenCalledWith("  deal-123  ")
    expect(html).toContain("Brik by Brik Investor and Deal Summary")
    expect(html).toContain("Executive decision snapshot")
    expect(html).toContain("Investor Shield")
    expect(html).toContain("Recommended next action")
    expect(html).not.toContain("Brik by Brik Investor Review")
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it("invokes safe notFound behavior for not_found result", async () => {
    loadInvestorReviewPageModelMock.mockResolvedValueOnce({
      status: "not_found",
    } satisfies LoadInvestorReviewPageModelResult)

    await expect(
      InvestorDealSummaryPage({ params: Promise.resolve({ id: "deal-404" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND")

    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it("renders safe unavailable state without internal details for unavailable result", async () => {
    loadInvestorReviewPageModelMock.mockResolvedValueOnce({
      status: "unavailable",
    } satisfies LoadInvestorReviewPageModelResult)

    const element = await InvestorDealSummaryPage({
      params: Promise.resolve({ id: "deal-123" }),
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Investor and deal summary temporarily unavailable")
    for (const term of ["SELECT", "postgres", "supabase", "vercel", "stack trace", "DATABASE_URL"]) {
      expect(html.toLowerCase()).not.toContain(term.toLowerCase())
    }
    expect(html).not.toContain("Brik by Brik Investor and Deal Summary")
    expect(html).not.toContain("<button")
    expect(html).not.toContain("<form")
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it("renders stable loading and not-found documents with safe wording only", () => {
    const loadingHtml = renderToStaticMarkup(<InvestorDealSummaryLoading />)
    const notFoundHtml = renderToStaticMarkup(<InvestorDealSummaryNotFound />)

    expect(loadingHtml).toContain("aria-busy=\"true\"")
    expect(loadingHtml).toContain("Preparing investor and deal summary")
    expect(loadingHtml).not.toContain("Â£")
    expect(loadingHtml).not.toContain("<button")

    expect(notFoundHtml).toContain("Investor and deal summary not found")
    expect(notFoundHtml).toContain("The requested saved-deal summary could not be found.")
    for (const term of ["SELECT", "postgres", "supabase", "vercel", "stack trace"]) {
      expect(notFoundHtml.toLowerCase()).not.toContain(term.toLowerCase())
    }
  })

  it("keeps page server-rendered with no client fetch, repository import, db adapter import, or mutation action", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "app/saved-deals/[id]/summary/page.tsx"),
      "utf8"
    )

    expect(source).not.toContain("use client")
    expect(source).not.toContain("useEffect")
    expect(source).not.toContain("useState")
    expect(source).not.toContain("fetch(")
    expect(source).not.toContain("getSavedDealById")
    expect(source).not.toContain("@/lib/db/")
    expect(source).not.toContain("createOffer(")
    expect(source).not.toContain("download")
    expect(source).not.toContain("print")
  })
})
