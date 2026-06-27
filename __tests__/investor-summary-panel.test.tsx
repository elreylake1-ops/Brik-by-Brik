import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import InvestorSummaryPanel from "@/components/investor-summary/InvestorSummaryPanel"
import {
  INVESTOR_SUMMARY_PRESENTATION_BLOCKED_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_COMPLETE_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_EMPTY_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_UNAVAILABLE_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_WARNING_FIXTURE,
} from "./fixtures/investor-summary-fixtures"

function renderSummary(summary: typeof INVESTOR_SUMMARY_PRESENTATION_COMPLETE_FIXTURE): string {
  return renderToStaticMarkup(<InvestorSummaryPanel summary={summary} />)
}

function expectOrder(html: string, values: readonly string[]): void {
  let cursor = -1
  for (const value of values) {
    const index = html.indexOf(value)
    expect(index).toBeGreaterThan(cursor)
    cursor = index
  }
}

describe("InvestorSummaryPanel", () => {
  it("renders the complete summary sections and canonical values", () => {
    const html = renderSummary(INVESTOR_SUMMARY_PRESENTATION_COMPLETE_FIXTURE)

    expect(html).toContain("Investor Summary")
    expect(html).toContain("22 Lake View Road, Leeds")
    expect(html).toContain("Classification: STRONG_DEAL")
    expect(html).toContain("Capital Protection: SAFE")
    expect(html).toContain("Overall Status: CLEAR")
    expect(html).toContain("\u00A3125,000.00")
    expect(html).toContain("\u00A3200,000.00")
    expect(html).toContain("\u00A3123,800.00")
    expect(html).toContain("Review lender criteria and solicitor evidence")
    expect(html).toContain("Review lender criteria")
    expect(html).toContain("Latest Offer")
    expect(html).toContain("Warnings and Unavailable Data")
    expect(html).toContain("No warnings or unavailable fields.")
    expectOrder(html, [
      "Financial Snapshot",
      "Capital Protection and Investor Shield",
      "Recommended Actions",
      "Active Tasks and Blockers",
      "Latest Offer",
      "Warnings and Unavailable Data",
    ])
  })

  it("renders blocked risk prominently without softening deterministic status", () => {
    const html = renderSummary(INVESTOR_SUMMARY_PRESENTATION_BLOCKED_FIXTURE)

    expect(html).toContain("Classification: MARGINAL")
    expect(html).toContain("Capital Protection: CAUTION")
    expect(html).toContain("Overall Status: BLOCKED")
    expect(html).toContain("Title Review")
    expect(html).toContain("Refurb Certainty")
    expect(html).toContain("Review title and refurb evidence")
    expect(html).toContain("Collect title pack")
    expect(html).toContain("Initial offer with evidence caveat.")
    expect(html).toContain("Deterministic risk remains visible when blocked or cautionary values are present.")
  })

  it("renders unavailable money as unavailable and preserves real zero", () => {
    const unavailableHtml = renderSummary(INVESTOR_SUMMARY_PRESENTATION_UNAVAILABLE_FIXTURE)
    const warningHtml = renderSummary(INVESTOR_SUMMARY_PRESENTATION_WARNING_FIXTURE)

    expect(unavailableHtml).toContain("Purchase price unavailable.")
    expect(unavailableHtml).toContain("GDV downside unavailable.")
    expect(unavailableHtml).toContain("True MAO 20% unavailable.")
    expect(unavailableHtml).toContain("Latest offer unavailable.")
    expect(unavailableHtml).toContain("Recommended action unavailable.")
    expect(unavailableHtml).toContain("Unavailable")
    expect(unavailableHtml).not.toContain("\u00A30.00")

    expect(warningHtml).toContain("\u00A30.00")
    expect(warningHtml).toContain("GDV realistic unavailable.")
    expect(warningHtml).toContain("True MAO 20% unavailable.")
  })

  it("renders deliberate empty states for actions, tasks, and latest offer", () => {
    const html = renderSummary(INVESTOR_SUMMARY_PRESENTATION_EMPTY_FIXTURE)

    expect(html).toContain("No active tasks.")
    expect(html).toContain("No latest offer available.")
    expect(html).toContain("Unavailable")
    expect(html).toContain("Latest offer unavailable.")
    expect(html).toContain("Recommended action unavailable.")
    expect(html).not.toContain("No warnings or unavailable fields.")
  })

  it("keeps warning-heavy content explicit and readable", () => {
    const html = renderSummary(INVESTOR_SUMMARY_PRESENTATION_WARNING_FIXTURE)

    expect(html).toContain("Investor Shield Status")
    expect(html).toContain("Overall Status: CAUTION")
    expect(html).toContain("Lender Criteria")
    expect(html).toContain("Rental Demand Advisory")
    expect(html).toContain("Request lender criteria evidence")
    expect(html).toContain("Warnings and Unavailable Data")
    expect(html).toContain("GDV realistic unavailable.")
    expect(html).toContain("True MAO 20% unavailable.")
  })

  it("preserves canonical task and offer ordering", () => {
    const html = renderSummary(INVESTOR_SUMMARY_PRESENTATION_COMPLETE_FIXTURE)

    expectOrder(html, [
      "Review lender criteria",
      "Confirm solicitor review",
      "\u00A3118,000.00",
      "Awaiting reply",
    ])
  })

  it("stays server-compatible and fetch-free", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "components/investor-summary/InvestorSummaryPanel.tsx"),
      "utf8"
    )

    expect(source).not.toContain('"use client"')
    expect(source).not.toContain("fetch(")
    expect(source).not.toContain("getInvestorSummaryForDeal")
    expect(source).not.toContain("composeInvestorSummaryViewModel")
    expect(source).not.toContain("InvestorSummaryRepository")
    expect(source).not.toContain("route.ts")
    expect(source).not.toContain("pg.Pool")
  })
})
