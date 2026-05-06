import { describe, expect, it } from "vitest"
import { calculateDueDiligence } from "@/lib/engine/due-diligence-engine"
import type { DueDiligenceInput } from "@/types/due-diligence"

const sampleInput: DueDiligenceInput = {
  purchasePrice: 120000,
  gdvRealistic: 200000,
  refurbCost: 25000,
  stampDuty: 3600,
  legalCosts: 2000,
  saleCosts: 3000,
  bridgeTermMonths: 6,
  bridgeInterestRateAnnual: 0.15,
  arrangementFeePercent: 0.02,
  exitFeePercent: 0.01,
}

describe("calculateDueDiligence", () => {
  it("auto GDV range creates 90% downside and 110% strong", () => {
    const result = calculateDueDiligence(sampleInput)

    expect(result.gdvRange.downside).toBe(180000)
    expect(result.gdvRange.realistic).toBe(200000)
    expect(result.gdvRange.strong).toBe(220000)
    expect(result.assumptions).toEqual([
      "Downside GDV defaulted to 90% of realistic GDV.",
      "Strong GDV defaulted to 110% of realistic GDV.",
    ])
  })

  it("explicit gdvDownside and gdvStrong override defaults", () => {
    const result = calculateDueDiligence({
      ...sampleInput,
      gdvDownside: 170000,
      gdvStrong: 230000,
    })

    expect(result.gdvRange.downside).toBe(170000)
    expect(result.gdvRange.strong).toBe(230000)
    expect(result.assumptions).toEqual([])
  })

  it("finance cost includes interest, arrangement fee, and exit fee", () => {
    const result = calculateDueDiligence(sampleInput)

    expect(result.finance.interest).toBe(9000)
    expect(result.finance.arrangementFee).toBe(2400)
    expect(result.finance.exitFee).toBe(1200)
    expect(result.finance.totalFinanceCost).toBe(12600)
  })

  it("total cost includes purchase, refurb, stamp duty, legal, sale, and finance", () => {
    const result = calculateDueDiligence(sampleInput)

    expect(result.dealSummary.totalCost).toBe(166200)
  })

  it("profit scenarios and margins calculate correctly", () => {
    const result = calculateDueDiligence(sampleInput)

    expect(result.dealSummary.profitDownside).toBe(13800)
    expect(result.dealSummary.profitRealistic).toBe(33800)
    expect(result.dealSummary.profitStrong).toBe(53800)
    expect(result.dealSummary.profitMarginDownside).toBeCloseTo(13800 / 180000)
    expect(result.dealSummary.profitMarginRealistic).toBeCloseTo(33800 / 200000)
    expect(result.dealSummary.profitMarginStrong).toBeCloseTo(53800 / 220000)
  })

  it("capital protection boundary SAFE when capital used is below 80%", () => {
    const result = calculateDueDiligence({
      purchasePrice: 79,
      gdvRealistic: 100,
      refurbCost: 0,
      stampDuty: 0,
      legalCosts: 0,
      saleCosts: 0,
      bridgeTermMonths: 0,
      bridgeInterestRateAnnual: 0,
      arrangementFeePercent: 0,
      exitFeePercent: 0,
    })

    expect(result.decision.capitalProtectionStatus).toBe("SAFE")
  })

  it("capital protection boundary CAUTION when capital used is 80% to 85%", () => {
    const result = calculateDueDiligence({
      purchasePrice: 85,
      gdvRealistic: 100,
      refurbCost: 0,
      stampDuty: 0,
      legalCosts: 0,
      saleCosts: 0,
      bridgeTermMonths: 0,
      bridgeInterestRateAnnual: 0,
      arrangementFeePercent: 0,
      exitFeePercent: 0,
    })

    expect(result.decision.capitalProtectionStatus).toBe("CAUTION")
  })

  it("capital protection boundary HIGH_RISK when capital used is above 85% up to 90%", () => {
    const result = calculateDueDiligence({
      purchasePrice: 90,
      gdvRealistic: 100,
      refurbCost: 0,
      stampDuty: 0,
      legalCosts: 0,
      saleCosts: 0,
      bridgeTermMonths: 0,
      bridgeInterestRateAnnual: 0,
      arrangementFeePercent: 0,
      exitFeePercent: 0,
    })

    expect(result.decision.capitalProtectionStatus).toBe("HIGH_RISK")
  })

  it("capital protection boundary NO_DEAL when capital used is above 90%", () => {
    const result = calculateDueDiligence({
      purchasePrice: 91,
      gdvRealistic: 100,
      refurbCost: 0,
      stampDuty: 0,
      legalCosts: 0,
      saleCosts: 0,
      bridgeTermMonths: 0,
      bridgeInterestRateAnnual: 0,
      arrangementFeePercent: 0,
      exitFeePercent: 0,
    })

    expect(result.decision.capitalProtectionStatus).toBe("NO_DEAL")
  })

  it("classifies STRONG_DEAL correctly", () => {
    const result = calculateDueDiligence({
      purchasePrice: 120000,
      gdvRealistic: 200000,
      refurbCost: 0,
      stampDuty: 0,
      legalCosts: 0,
      saleCosts: 0,
      bridgeTermMonths: 0,
      bridgeInterestRateAnnual: 0,
      arrangementFeePercent: 0,
      exitFeePercent: 0,
    })

    expect(result.decision.dealClassification).toBe("STRONG_DEAL")
  })

  it("classifies MARGINAL correctly for blueprint sample", () => {
    const result = calculateDueDiligence(sampleInput)

    expect(result.dealSummary.capitalUsedPercent).toBeCloseTo(0.831)
    expect(result.decision.capitalProtectionStatus).toBe("CAUTION")
    expect(result.decision.dealClassification).toBe("MARGINAL")
  })

  it("classifies NO_DEAL correctly", () => {
    const result = calculateDueDiligence({
      purchasePrice: 180000,
      gdvRealistic: 200000,
      refurbCost: 0,
      stampDuty: 0,
      legalCosts: 0,
      saleCosts: 0,
      bridgeTermMonths: 0,
      bridgeInterestRateAnnual: 0,
      arrangementFeePercent: 0,
      exitFeePercent: 0,
    })

    expect(result.decision.dealClassification).toBe("NO_DEAL")
  })

  it("maps strategy for STRONG_DEAL to BRRR_OR_FLIP", () => {
    const result = calculateDueDiligence({
      purchasePrice: 120000,
      gdvRealistic: 200000,
      refurbCost: 0,
      stampDuty: 0,
      legalCosts: 0,
      saleCosts: 0,
      bridgeTermMonths: 0,
      bridgeInterestRateAnnual: 0,
      arrangementFeePercent: 0,
      exitFeePercent: 0,
    })

    expect(result.decision.strategyRecommendation).toBe("BRRR_OR_FLIP")
  })

  it("maps strategy for MARGINAL to FLIP_ONLY_OR_RENEGOTIATE", () => {
    const result = calculateDueDiligence(sampleInput)

    expect(result.decision.strategyRecommendation).toBe("FLIP_ONLY_OR_RENEGOTIATE")
  })

  it("maps strategy for NO_DEAL to NO_DEAL", () => {
    const result = calculateDueDiligence({
      purchasePrice: 180000,
      gdvRealistic: 200000,
      refurbCost: 0,
      stampDuty: 0,
      legalCosts: 0,
      saleCosts: 0,
      bridgeTermMonths: 0,
      bridgeInterestRateAnnual: 0,
      arrangementFeePercent: 0,
      exitFeePercent: 0,
    })

    expect(result.decision.strategyRecommendation).toBe("NO_DEAL")
  })

  it("adds all blueprint risk flags when thresholds are breached", () => {
    const result = calculateDueDiligence({
      purchasePrice: 100,
      gdvRealistic: 100,
      refurbCost: 30,
      stampDuty: 0,
      legalCosts: 0,
      saleCosts: 0,
      bridgeTermMonths: 12,
      bridgeInterestRateAnnual: 0.12,
      arrangementFeePercent: 0.02,
      exitFeePercent: 0.01,
    })

    expect(result.decision.riskFlags).toEqual([
      "Low profit margin",
      "Capital overexposure",
      "High finance cost",
      "High refurb exposure",
      "Downside GDV creates a loss",
    ])
    expect(result.warnings).toEqual(result.decision.riskFlags)
  })

  it("final JSON shape includes inputs, gdvRange, finance, dealSummary, trueMAO, decision, and uiColours", () => {
    const result = calculateDueDiligence(sampleInput)

    expect(result).toHaveProperty("inputs")
    expect(result).toHaveProperty("gdvRange")
    expect(result).toHaveProperty("finance")
    expect(result).toHaveProperty("dealSummary")
    expect(result).toHaveProperty("trueMAO")
    expect(result).toHaveProperty("decision")
    expect(result).toHaveProperty("uiColours")
    expect(result.inputs).toEqual(sampleInput)
    expect(result.profitScenarios).toHaveLength(3)
    expect(result.trueMAO.at15Percent).toBe(123800)
    expect(result.trueMAO.at20Percent).toBe(113800)
    expect(result.trueMAO.at25Percent).toBe(103800)
    expect(result.uiColours).toEqual({
      profit: "amber",
      capitalProtection: "amber",
      dealClassification: "amber",
    })
  })
})
