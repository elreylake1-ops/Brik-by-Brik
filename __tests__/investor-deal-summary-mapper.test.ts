import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { mapInvestorReviewToDealSummary } from "@/lib/investor-summary/map-investor-review-to-deal-summary"
import { makeSampleInvestorReviewReadyViewModel } from "./fixtures/investor-deal-summary-fixtures"

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue)
    }
  }

  return value
}

describe("mapInvestorReviewToDealSummary", () => {
  it("copies property identity, executive decision fields, and canonical financials without altering source meaning", () => {
    const review = makeSampleInvestorReviewReadyViewModel()
    const result = mapInvestorReviewToDealSummary({
      review,
      generatedAt: "2026-07-26T00:00:00.000Z",
    })

    expect(result.header.propertyIdentity).toBe(review.overview.propertyIdentity.value)
    expect(result.executiveDecisionSnapshot).toEqual([
      { label: "Verdict", value: "GO", tone: "success" },
      { label: "Persisted classification", value: "MARGINAL" },
      {
        label: review.overview.governance.label,
        value: review.overview.governance.value,
        tone: review.overview.governance.tone ?? "neutral",
      },
      { label: "Capital protection", value: "CAUTION", tone: "caution" },
      {
        label: review.overview.pipeline.label,
        value: review.overview.pipeline.value,
        tone: review.overview.pipeline.tone ?? "neutral",
      },
      {
        label: "Investor Shield progression",
        value: review.decisionSummary.progressionDecision.value,
        tone: review.decisionSummary.progressionDecision.tone ?? "neutral",
      },
      { label: "Professional readiness", value: "Ready for review", tone: "informational" },
    ])

    expect(result.coreFinancialPosition.map((field) => [field.label, field.value])).toEqual([
      ["Purchase price", "£125,000.00"],
      ["Realistic GDV", "£200,000.00"],
      ["Downside GDV", "£180,000.00"],
      ["Strong GDV", "£220,000.00"],
      ["Refurbishment cost", "£25,000.00"],
      ["Stamp duty", "£3,600.00"],
      ["Legal costs", "£2,000.00"],
      ["Sale costs", "£3,000.00"],
      ["Finance cost", "£12,600.00"],
      ["Total investment", "£166,200.00"],
      ["Projected profit", "+£33,800.00"],
      ["Profit margin", "16.90%"],
    ])
  })

  it("does not calculate missing values, exposes all three True MAO bands unchanged, and creates no selected band", () => {
    const review = makeSampleInvestorReviewReadyViewModel()
    review.dealFormulation.financialSummary.financeCost = {
      amount: null,
      availability: "UNAVAILABLE",
      unavailableReason: "Finance cost unavailable.",
    }
    review.dealFormulation.financialSummary.totalInvestment = {
      amount: null,
      availability: "UNAVAILABLE",
      unavailableReason: "Total investment unavailable.",
    }

    const result = mapInvestorReviewToDealSummary({
      review,
      generatedAt: "2026-07-26T00:00:00.000Z",
    })

    expect(result.coreFinancialPosition.find((field) => field.label === "Finance cost")).toEqual({
      label: "Finance cost",
      value: "Not available",
      supportingText: "Finance cost unavailable.",
      tone: undefined,
    })
    expect(result.coreFinancialPosition.find((field) => field.label === "Total investment")).toEqual({
      label: "Total investment",
      value: "Not available",
      supportingText: "Total investment unavailable.",
      tone: undefined,
    })
    expect(result.unsupportedValues).toEqual([
      {
        label: "Acquisition-cost aggregate",
        value: "Not available",
        reason: "No canonical acquisition-cost aggregate currently exists.",
      },
      {
        label: "ROI",
        value: "Not available",
        reason: "ROI is not available from the current canonical engine output.",
      },
    ])
    expect(result.trueMao.bands.map((field) => field.value)).toEqual([
      "£103,800.00",
      "£113,800.00",
      "£123,800.00",
    ])
    expect(result.trueMao.note).toBe(
      "No single investor-facing True MAO band has been selected in the current canonical model."
    )
  })

  it("preserves latest offer, creates no offer ladder, preserves Shield fields, readiness, and Evidence Lite rows", () => {
    const review = makeSampleInvestorReviewReadyViewModel()
    const result = mapInvestorReviewToDealSummary({
      review,
      generatedAt: "2026-07-26T00:00:00.000Z",
    })

    expect(result.offerPosition.latestRecordedOfferAmount.value).toBe("£118,000.00")
    expect(result.offerPosition.latestRecordedOfferStatus.value).toBe("PENDING")
    expect(result.offerPosition.unsupportedOfferValues.map((field) => field.value)).toEqual([
      "Not available",
      "Not available",
      "Not available",
      "Not available",
      "Not available",
    ])

    expect(result.investorShield.summaryFields).toEqual([
      {
        label: "Overall status",
        value: review.decisionSummary.overallStatus.value,
        tone: review.decisionSummary.overallStatus.tone ?? "neutral",
      },
      {
        label: "Progression",
        value: review.decisionSummary.progressionDecision.value,
        tone: review.decisionSummary.progressionDecision.tone ?? "neutral",
      },
      {
        label: "Can progress",
        value: review.decisionSummary.canProgress.value,
        tone: review.decisionSummary.canProgress.tone ?? "neutral",
      },
      {
        label: "Blocking-gate count",
        value: review.decisionSummary.blockedGateCount.value,
        tone: review.decisionSummary.blockedGateCount.tone ?? "neutral",
      },
      {
        label: "Caution-gate count",
        value: String(review.advisoryItems.length),
        tone: "caution",
      },
      {
        label: "Missing-evidence count",
        value: review.decisionSummary.missingEvidenceCount.value,
        tone: review.decisionSummary.missingEvidenceCount.tone ?? "neutral",
      },
    ])
    expect(result.investorShield.requiredHardGates).toHaveLength(review.requiredGateRows.length)
    expect(result.investorShield.advisoryGates).toHaveLength(review.advisoryItems.length)
    expect(result.professionalReadiness.displayLabel).toBe(
      review.professionalEvidenceGateway.readinessPresentation.displayLabel
    )
    expect(result.evidenceLite.rows).toHaveLength(review.evidenceLiteRows.length)
  })

  it("does not mutate input, returns deep-equal output on repeated calls, and reuses one supplied timestamp", () => {
    const review = deepFreeze(makeSampleInvestorReviewReadyViewModel())

    const first = mapInvestorReviewToDealSummary({
      review,
      generatedAt: "2026-07-26T00:00:00.000Z",
    })
    const second = mapInvestorReviewToDealSummary({
      review,
      generatedAt: "2026-07-26T00:00:00.000Z",
    })

    expect(second).toEqual(first)
    expect(first.header.generatedAt).toBe("2026-07-26T00:00:00.000Z")
    expect(first.footer.generatedAt).toBe("2026-07-26T00:00:00.000Z")
    expect(review.dealFormulation.trueMao.selectedBand).toBeNull()
  })

  it("requires no database, API, environment, randomness, or clock access", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/investor-summary/map-investor-review-to-deal-summary.ts"
      ),
      "utf8"
    )

    expect(source).not.toContain("async function")
    expect(source).not.toContain("process.env")
    expect(source).not.toContain("fetch(")
    expect(source).not.toContain("query(")
    expect(source).not.toContain("getSavedDealById")
    expect(source).not.toContain("loadDealFormulationViewModel")
    expect(source).not.toContain("loadPdfEvidencePackForDeal")
    expect(source).not.toContain("Math.random")
    expect(source).not.toContain("Date.now")
    expect(source).not.toContain("new Date(")
  })
})
