import type { DealHeatScoreOutput } from "@/types/phase2"
import type { Phase2IntelligenceInput } from "@/types/phase2-intelligence"
import { evaluateDealFatalRisk } from "@/lib/engine/governance/deal-fatal-engine"
import { evaluateNegotiationPosition } from "@/lib/engine/intelligence/negotiation-position-engine"
import { evaluateTimeRisk } from "@/lib/engine/intelligence/time-risk-engine"

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}

function mapBand(score: number): DealHeatScoreOutput["band"] {
  if (score >= 80) return "HOT"
  if (score >= 65) return "WARM"
  if (score >= 50) return "MARGINAL"
  return "COLD"
}

function pushDelta(
  scoreRef: { value: number },
  delta: number,
  message: string,
  positiveSignals: string[],
  negativeSignals: string[],
  deductions: string[]
) {
  scoreRef.value += delta
  deductions.push(`${delta >= 0 ? "+" : ""}${delta}: ${message}`)
  if (delta >= 0) positiveSignals.push(message)
  else negativeSignals.push(message)
}

export function calculateDealHeatScore(input: Phase2IntelligenceInput): DealHeatScoreOutput {
  const fatalResult = evaluateDealFatalRisk(input)
  const negotiation = evaluateNegotiationPosition(input)
  const timeRisk = evaluateTimeRisk(input.bridgeTermMonths, fatalResult.metrics.refurbExposure)
  const positiveSignals: string[] = []
  const negativeSignals: string[] = []
  const deductions: string[] = []
  const score = { value: 50 }
  const realisticMargin =
    fatalResult.metrics.realisticProfit !== null && input.gdvRealistic > 0
      ? fatalResult.metrics.realisticProfit / input.gdvRealistic
      : null
  const downsideProfit = fatalResult.metrics.downsideProfit
  const refurbExposure = fatalResult.metrics.refurbExposure
  const capitalRatio = fatalResult.metrics.capitalRatio
  const comparablesCount = input.comparablesCount ?? 0

  if (realisticMargin !== null) {
    if (realisticMargin >= 0.2) {
      pushDelta(score, 15, "Strong realistic profit margin.", positiveSignals, negativeSignals, deductions)
    } else if (realisticMargin >= 0.15) {
      pushDelta(score, 10, "Healthy realistic profit margin.", positiveSignals, negativeSignals, deductions)
    } else if (realisticMargin > 0) {
      pushDelta(score, 4, "Positive but thin realistic margin.", positiveSignals, negativeSignals, deductions)
    } else {
      pushDelta(score, -20, "Negative realistic profit margin.", positiveSignals, negativeSignals, deductions)
    }
  }

  if (downsideProfit !== null) {
    if (downsideProfit > 0) {
      pushDelta(score, 10, "Downside scenario remains profitable.", positiveSignals, negativeSignals, deductions)
    } else {
      pushDelta(score, -12, "Downside scenario creates a loss.", positiveSignals, negativeSignals, deductions)
    }
  }

  if (input.gdvEvidenceStrength === "STRONG") {
    pushDelta(score, 8, "Strong GDV evidence.", positiveSignals, negativeSignals, deductions)
  } else if (input.gdvEvidenceStrength === "MODERATE") {
    pushDelta(score, 4, "Moderate GDV evidence.", positiveSignals, negativeSignals, deductions)
  } else if (input.gdvEvidenceStrength === "WEAK") {
    pushDelta(score, -8, "Weak GDV evidence.", positiveSignals, negativeSignals, deductions)
  } else if (input.gdvEvidenceStrength === "MISSING") {
    pushDelta(score, -15, "Missing GDV evidence.", positiveSignals, negativeSignals, deductions)
  }

  if (comparablesCount >= 3) {
    pushDelta(score, 6, "Comparable coverage is sufficient.", positiveSignals, negativeSignals, deductions)
  } else if (comparablesCount > 0) {
    pushDelta(score, -4, "Comparable coverage is thin.", positiveSignals, negativeSignals, deductions)
  } else {
    pushDelta(score, -10, "Comparable evidence is missing.", positiveSignals, negativeSignals, deductions)
  }

  if (refurbExposure !== null) {
    if (refurbExposure <= 0.2) {
      pushDelta(score, 6, "Refurb exposure is manageable.", positiveSignals, negativeSignals, deductions)
    } else if (refurbExposure > 0.35) {
      pushDelta(score, -12, "Refurb exposure is very heavy.", positiveSignals, negativeSignals, deductions)
    } else if (refurbExposure > 0.25) {
      pushDelta(score, -8, "Refurb exposure is heavy.", positiveSignals, negativeSignals, deductions)
    }
  }

  if (timeRisk.severity === "LOW") {
    pushDelta(score, 4, "Bridge term is short.", positiveSignals, negativeSignals, deductions)
  } else if (timeRisk.severity === "MEDIUM") {
    pushDelta(score, -4, "Time risk is moderate.", positiveSignals, negativeSignals, deductions)
  } else if (timeRisk.severity === "HIGH") {
    pushDelta(score, -8, "Time risk is high.", positiveSignals, negativeSignals, deductions)
  } else {
    pushDelta(score, -12, "Time risk is fatal.", positiveSignals, negativeSignals, deductions)
  }

  if (typeof input.loanToValue === "number") {
    if (input.loanToValue <= 0.75) {
      pushDelta(score, 5, "Leverage is conservative.", positiveSignals, negativeSignals, deductions)
    } else if (input.loanToValue > 0.9) {
      pushDelta(score, -12, "Leverage is extreme.", positiveSignals, negativeSignals, deductions)
    } else if (input.loanToValue > 0.8) {
      pushDelta(score, -8, "Leverage is high.", positiveSignals, negativeSignals, deductions)
    }
  } else if (capitalRatio !== null) {
    if (capitalRatio <= 0.8) {
      pushDelta(score, 4, "Capital usage is efficient.", positiveSignals, negativeSignals, deductions)
    } else if (capitalRatio > 0.9) {
      pushDelta(score, -12, "Capital usage is overstretched.", positiveSignals, negativeSignals, deductions)
    } else if (capitalRatio > 0.85) {
      pushDelta(score, -8, "Capital usage is high.", positiveSignals, negativeSignals, deductions)
    }
  }

  if (negotiation.heatModifier !== 0) {
    pushDelta(
      score,
      negotiation.heatModifier,
      negotiation.explanation,
      positiveSignals,
      negativeSignals,
      deductions
    )
  }

  if (negotiation.unsupportedUrgency) {
    pushDelta(score, -6, "Urgency language is unsupported by evidence.", positiveSignals, negativeSignals, deductions)
  }

  if (input.hasRefinanceRisk) {
    pushDelta(score, -8, "Refinance risk is present.", positiveSignals, negativeSignals, deductions)
  }
  if (input.hasLegalTitleRisk) {
    pushDelta(score, -8, "Legal/title risk is present.", positiveSignals, negativeSignals, deductions)
  }
  if (input.hasPlanningRisk) {
    pushDelta(score, -8, "Planning risk is present.", positiveSignals, negativeSignals, deductions)
  }
  if (input.hasStructuralRisk) {
    pushDelta(score, -8, "Structural risk is present.", positiveSignals, negativeSignals, deductions)
  }
  if (input.hasMissingCriticalEvidence) {
    pushDelta(score, -10, "Critical evidence is missing.", positiveSignals, negativeSignals, deductions)
  }

  const finalScore = clampScore(score.value)

  return {
    score: finalScore,
    band: mapBand(finalScore),
    positiveSignals: [...new Set(positiveSignals)],
    negativeSignals: [...new Set(negativeSignals)],
    deductions,
    explanation:
      "Raw heat score uses transparent additive and subtractive rules only. Governance remains final authority.",
  }
}
