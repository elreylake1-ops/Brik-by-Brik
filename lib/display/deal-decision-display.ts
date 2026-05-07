import type { DealVerdictStatus } from "@/lib/engine/analyze-deal-with-refurb"
import type { CapitalProtectionStatus } from "@/types/due-diligence"
import type { FinalDealClassification, GovernanceState } from "@/types/phase2"

export const CALCULATION_CONFIDENCE_LABEL = "Calculation Confidence"
export const CALCULATION_CONFIDENCE_HELP =
  "Calculation confidence summarizes warning level, override usage, and input completeness. It is not a deal-quality recommendation."

type DealDecisionDisplayInput = {
  profit: number
  profitMargin: number
  engineVerdictStatus: DealVerdictStatus
  engineVerdictReason: string
  capitalProtectionStatus?: CapitalProtectionStatus
  riskFlags?: string[]
  phase2FinalClassification?: FinalDealClassification
  phase2GovernanceState?: GovernanceState
}

export type DealDecisionDisplay = {
  statusLabel: string
  actionLabel: string
  summary: string
  tone: "green" | "amber" | "red"
  warning?: string
  additionalWarnings?: string[]
}

const NEGATIVE_PROFIT_WARNING =
  "Projected profit is negative. Reject this deal unless purchase price, GDV, or refurb assumptions materially change."
const THIN_MARGIN_WARNING =
  "Profit margin is below 5%. Renegotiate purchase price or verify GDV/refurb assumptions before proceeding."
const CAPITAL_EXPOSURE_WARNING =
  "Projected profit is positive, but capital exposure is above the preferred safe threshold. Proceed only with verified GDV, refurb, and exit assumptions."
const HEAVY_REFURB_WARNING =
  "Refurb cost is high relative to GDV. Validate builder quote, scope, and contingency before offer."

function normalizeProfitMarginPercent(value: number): number {
  if (!isFinite(value) || isNaN(value)) return 0
  if (Math.abs(value) <= 1) return value * 100
  return value
}

export function getTechnicalVerdictDetail(
  status: DealVerdictStatus,
  reason: string
): string {
  return `Engine verdict: ${status}. ${reason}`
}

function getAdditionalWarnings(input: DealDecisionDisplayInput, primaryWarning?: string): string[] | undefined {
  const warnings: string[] = []
  const hasHighRefurbExposure = input.riskFlags?.some((flag) => flag.toLowerCase() === "high refurb exposure")

  if (hasHighRefurbExposure && primaryWarning !== HEAVY_REFURB_WARNING) {
    warnings.push(HEAVY_REFURB_WARNING)
  }

  return warnings.length > 0 ? warnings : undefined
}

export function getDealDecisionDisplay(
  input: DealDecisionDisplayInput
): DealDecisionDisplay {
  const profitMarginPercent = normalizeProfitMarginPercent(input.profitMargin)

  if (
    input.phase2GovernanceState === "BLOCKED" ||
    input.phase2FinalClassification === "NO_DEAL"
  ) {
    return {
      statusLabel: "NO-GO",
      actionLabel: "Reject",
      summary: "Governance has blocked the deal. Unsafe deals cannot proceed as-is.",
      tone: "red",
    }
  }

  if (
    input.phase2GovernanceState === "REVIEW_REQUIRED" ||
    input.phase2FinalClassification === "REVIEW_REQUIRED"
  ) {
    return {
      statusLabel: "REVIEW REQUIRED",
      actionLabel: "Verify Before Proceeding",
      summary:
        "Governance requires additional review before this deal can be treated as investable.",
      tone: "amber",
    }
  }

  if (input.profit < 0 || profitMarginPercent < 0) {
    return {
      statusLabel: "NO-GO",
      actionLabel: "Reject",
      summary: "Projected profit is negative. The deal does not support a safe proceed decision.",
      tone: "red",
      warning: NEGATIVE_PROFIT_WARNING,
      additionalWarnings: getAdditionalWarnings(input, NEGATIVE_PROFIT_WARNING),
    }
  }

  if (profitMarginPercent < 5) {
    return {
      statusLabel: "MARGINAL",
      actionLabel: "Renegotiate",
      summary: "Thin profit buffer. Not safe to proceed as-is.",
      tone: "red",
      warning: THIN_MARGIN_WARNING,
      additionalWarnings: getAdditionalWarnings(input, THIN_MARGIN_WARNING),
    }
  }

  if (profitMarginPercent < 10) {
    return {
      statusLabel: "CAUTION",
      actionLabel: "Needs Stronger Buffer",
      summary: "Profit buffer is thin and should be strengthened before treating the deal as clean.",
      tone: "amber",
      additionalWarnings: getAdditionalWarnings(input),
    }
  }

  if (
    input.capitalProtectionStatus === "CAUTION" ||
    input.capitalProtectionStatus === "HIGH_RISK"
  ) {
    return {
      statusLabel: "CONDITIONAL",
      actionLabel: "Proceed With Caution",
      summary: "Projected profit is positive, but capital exposure remains above the preferred safe threshold.",
      tone: "amber",
      warning: CAPITAL_EXPOSURE_WARNING,
      additionalWarnings: getAdditionalWarnings(input, CAPITAL_EXPOSURE_WARNING),
    }
  }

  if (
    input.capitalProtectionStatus === "NO_DEAL" ||
    input.engineVerdictStatus === "NO-GO"
  ) {
    return {
      statusLabel: "NO-GO",
      actionLabel: "Reject",
      summary: "Capital protection or verdict checks do not support progression.",
      tone: "red",
      additionalWarnings: getAdditionalWarnings(input),
    }
  }

  if (
    input.engineVerdictStatus === "CONDITIONAL"
  ) {
    return {
      statusLabel: "CONDITIONAL",
      actionLabel: "Proceed With Caution",
      summary: input.engineVerdictReason,
      tone: "amber",
      additionalWarnings: getAdditionalWarnings(input),
    }
  }

  if (input.engineVerdictStatus === "GO") {
    return {
      statusLabel: "GO",
      actionLabel: "Proceed",
      summary: input.engineVerdictReason,
      tone: "green",
      additionalWarnings: getAdditionalWarnings(input),
    }
  }

  return {
    statusLabel: "ANALYSIS ONLY",
    actionLabel: "Complete Core Inputs",
    summary: input.engineVerdictReason,
    tone: "amber",
    additionalWarnings: getAdditionalWarnings(input),
  }
}
