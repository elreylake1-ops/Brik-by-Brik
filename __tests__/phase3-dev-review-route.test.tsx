import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import Phase3DevReviewPage from "@/app/phase-3-dev-review/page"

function readAppFile(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8")
}

describe("phase3 dev review route", () => {
  it("renders the phase-3-dev-review page with developer-only banner", () => {
    const html = renderToStaticMarkup(<Phase3DevReviewPage />)

    expect(html).toContain("Developer Review Only — Advisory Phase 3 Output")
    expect(html).toContain(
      "This page is fixture-only and does not change calculator, governance, or Phase 2 review behavior."
    )
  })

  it("renders deterministic source-of-truth content before advisory task content", () => {
    const html = renderToStaticMarkup(<Phase3DevReviewPage />)

    const deterministicIndex = html.indexOf("Deterministic Source Of Truth")
    const advisoryIndex = html.indexOf("Advisory Tasks")

    expect(deterministicIndex).toBeGreaterThan(-1)
    expect(advisoryIndex).toBeGreaterThan(-1)
    expect(deterministicIndex).toBeLessThan(advisoryIndex)
  })

  it("renders all four fixture labels and capital protection dominance copy", () => {
    const html = renderToStaticMarkup(<Phase3DevReviewPage />)

    expect(html).toContain("No Deal with Weak Comparable Hints")
    expect(html).toContain("Review Required with Legal Conflict Hints")
    expect(html).toContain("Clean Proceed with Accepted Operator Note")
    expect(html).toContain("Intake with Missing Lender Hints")
    expect(html).toContain("Capital protection remains dominant. Evidence hints do not soften this outcome.")
  })

  it("does not contain approve/send-offer/action/upload calls-to-action", () => {
    const html = renderToStaticMarkup(<Phase3DevReviewPage />)

    expect(html.toLowerCase()).not.toContain("approve deal")
    expect(html.toLowerCase()).not.toContain("send offer")
    expect(html.toLowerCase()).not.toContain("action button")
    expect(html.toLowerCase()).not.toContain("upload evidence")
  })

  it("contains no form or button elements", () => {
    const html = renderToStaticMarkup(<Phase3DevReviewPage />).toLowerCase()

    expect(html).not.toContain("<form")
    expect(html).not.toContain("<button")
  })

  it("states fixture-only behavior and no live data/service behavior", () => {
    const html = renderToStaticMarkup(<Phase3DevReviewPage />).toLowerCase()

    expect(html).toContain("fixture-only")
    expect(html).toContain("no persistence")
    expect(html).toContain("no scraping/integration data")
    expect(html).not.toContain("live user input")
    expect(html).not.toContain("database connected")
    expect(html).not.toContain("external service call")
  })

  it("does not claim active ai/scraping/integration behavior", () => {
    const html = renderToStaticMarkup(<Phase3DevReviewPage />).toLowerCase()

    expect(html).toContain("no ai extraction")
    expect(html).toContain("no scraping/integration data")
    expect(html).not.toContain("live ai extraction enabled")
    expect(html).not.toContain("active scraping integration")
  })

  it("existing routes are not modified to link to /phase-3-dev-review", () => {
    const homePage = readAppFile("app/page.tsx")
    const phase2Review = readAppFile("app/phase-2-review/page.tsx")
    const phase2LiveReview = readAppFile("app/phase-2-live-review/page.tsx")

    expect(homePage).not.toContain("/phase-3-dev-review")
    expect(phase2Review).not.toContain("/phase-3-dev-review")
    expect(phase2LiveReview).not.toContain("/phase-3-dev-review")
  })
})
