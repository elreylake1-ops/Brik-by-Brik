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
  warnings?: string[]
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
const HARD_NO_GO_WARNING =
  "Projected economics fail the engine safety rules. Reject this deal unless purchase price, GDV, refurb, or cost assumptions materially change."
const THIN_MARGIN_WARNING =
  "Profit margin is below 5%. Renegotiate purchase price or verify GDV/refurb assumptions before proceeding."
const CAPITAL_EXPOSURE_WARNING =
  "Projected profit is positive, but capital exposure is above the preferred safe threshold. Proceed only with verified GDV, refurb, and exit assumptions."
const HEAVY_REFURB_WARNING =
  "Refurb cost is high relative to GDV. Validate builder quote, scope, and contingency before offer."
const UNCOSTED_SCOPE_WARNING =
  "Selected refurb scope has no cost template, so refurb cost may be understated. Validate scope and cost before offer."
const UNCOSTED_SCOPE_WARNING_MARKER =
  "has no task templates in Phase 1A. Cost not included."

function normalizeProfitMarginPercent(value: number): number {
  if (!isFinite(value) || isNaN(value)) return 0
  if (Math.abs(value) <= 1) return value * 100
  return value
}

export function getTechnicalVerdictDetail(
  status: DealVerdictStatus,
  reason: string
): string {
  if (status === "NO-GO") {
    return "Engine verdict: NO-GO by MAO target."
  }

  return `Engine verdict: ${status}. ${reason}`
}

export function getDealDecisionSummaryLine(
  decision: Pick<DealDecisionDisplay, "statusLabel" | "actionLabel">
): string {
  if (decision.statusLabel === "GO") return "Go — proceed"
  if (decision.statusLabel === "MARGINAL") return "Marginal — renegotiate before proceeding"
  if (decision.statusLabel === "NO-GO") return "No-go — reject"
  if (decision.statusLabel === "REVIEW REQUIRED") return "Review required — verify before proceeding"
  if (decision.statusLabel === "CAUTION") return "Caution — build stronger buffer before proceeding"

  if (decision.statusLabel === "CONDITIONAL") {
    if (decision.actionLabel === "Verify Scope") {
      return "Conditional — verify scope before proceeding"
    }

    return "Conditional — proceed with caution"
  }

  return "Analysis only — complete core inputs"
}

function hasUncostedSelectedScope(warnings?: string[]): boolean {
  return warnings?.some((warning) => warning.includes(UNCOSTED_SCOPE_WARNING_MARKER)) ?? false
}

function getAdditionalWarnings(input: DealDecisionDisplayInput, primaryWarning?: string): string[] | undefined {
  const warnings: string[] = []
  const hasHighRefurbExposure = input.riskFlags?.some((flag) => flag.toLowerCase() === "high refurb exposure")
  const hasUncostedScope = hasUncostedSelectedScope(input.warnings)

  if (hasUncostedScope && primaryWarning !== UNCOSTED_SCOPE_WARNING) {
    warnings.push(UNCOSTED_SCOPE_WARNING)
  }

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

  if (input.capitalProtectionStatus === "NO_DEAL") {
    return {
      statusLabel: "NO-GO",
      actionLabel: "Reject",
      summary: "Hard engine safety checks do not support progression.",
      tone: "red",
      warning: HARD_NO_GO_WARNING,
      additionalWarnings: getAdditionalWarnings(input, HARD_NO_GO_WARNING),
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

  if (input.engineVerdictStatus === "NO-GO") {
    return {
      statusLabel: "CONDITIONAL",
      actionLabel: "Proceed With Caution",
      summary: "Technical MAO targets were missed, so price and assumptions should be challenged before treating the deal as clean.",
      tone: "amber",
      additionalWarnings: getAdditionalWarnings(input),
    }
  }

  if (input.engineVerdictStatus === "GO") {
    if (hasUncostedSelectedScope(input.warnings)) {
      return {
        statusLabel: "CONDITIONAL",
        actionLabel: "Verify Scope",
        summary: "Selected scope includes items with no current cost template, so the refurb total may be understated.",
        tone: "amber",
        warning: UNCOSTED_SCOPE_WARNING,
        additionalWarnings: getAdditionalWarnings(input, UNCOSTED_SCOPE_WARNING),
      }
    }

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
