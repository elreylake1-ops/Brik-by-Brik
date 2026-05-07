import type { NextActionOutput } from "@/types/phase2"
import type { ApplyGovernanceResult } from "@/types/phase2-governance"
import type { NegotiationPositionResult, Phase2IntelligenceInput, TimeRiskResult } from "@/types/phase2-intelligence"

function pushAction(actions: NextActionOutput[], action: NextActionOutput) {
  if (actions.some((entry) => entry.id === action.id)) return
  actions.push(action)
}

export function buildNextActions(
  input: Phase2IntelligenceInput,
  governanceResult: ApplyGovernanceResult,
  timeRisk: TimeRiskResult,
  negotiation: NegotiationPositionResult
): NextActionOutput[] {
  const actions: NextActionOutput[] = []
  const comparablesCount = input.comparablesCount ?? 0
  const refurbExposure = governanceResult.metrics.refurbExposure
  const downsideProfit = governanceResult.metrics.downsideProfit
  const financeGate = governanceResult.decisionGates.find((gate) => gate.gateId === "finance-time-risk")

  if (governanceResult.governance.fatalRisk) {
    pushAction(actions, {
      id: "resolve-fatal-risk",
      priority: "URGENT",
      action: "Reject deal or clear fatal governance blocker before any offer step.",
      owner: "decision-maker",
      reason: governanceResult.governance.fatalReasons.join(" "),
      blocksOfferSubmission: true,
    })
  }

  if (comparablesCount < 3) {
    pushAction(actions, {
      id: "obtain-comparables",
      priority: "HIGH",
      action: "Obtain sold comparables to support GDV.",
      owner: "analyst",
      reason:
        comparablesCount === 0
          ? "Comparable evidence is missing."
          : "Comparable evidence is too thin for safe GDV confidence.",
      blocksOfferSubmission: true,
    })
  }

  if (downsideProfit !== null && downsideProfit < 0) {
    pushAction(actions, {
      id: "verify-downside-gdv",
      priority: "HIGH",
      action: "Validate downside GDV and comparable evidence before offer.",
      owner: "analyst",
      reason: "Downside case becomes loss-making under current assumptions.",
      blocksOfferSubmission: true,
    })
  }

  if (input.gdvEvidenceStrength === "WEAK" || input.gdvEvidenceStrength === "MISSING") {
    pushAction(actions, {
      id: "validate-gdv",
      priority: "HIGH",
      action: "Validate GDV against stronger evidence.",
      owner: "analyst",
      reason: "GDV evidence is weak or missing.",
      blocksOfferSubmission: true,
    })
  }

  if (
    input.legalEvidenceStrength === "WEAK" ||
    input.legalEvidenceStrength === "MISSING" ||
    input.hasLegalTitleRisk
  ) {
    pushAction(actions, {
      id: "legal-title-review",
      priority: "HIGH",
      action: "Run legal/title review before progression.",
      owner: "solicitor",
      reason: "Legal evidence is weak, missing, or flagged.",
      blocksOfferSubmission: true,
    })
  }

  if (
    (refurbExposure !== null && refurbExposure > 0.25) ||
    input.refurbEvidenceStrength === "WEAK" ||
    input.refurbEvidenceStrength === "MISSING"
  ) {
    pushAction(actions, {
      id: "builder-scope-validation",
      priority: "HIGH",
      action: "Validate refurb scope and obtain builder quote.",
      owner: "builder",
      reason: "Refurb exposure or refurb evidence needs challenge.",
      blocksOfferSubmission: refurbExposure !== null && refurbExposure > 0.3,
    })
  }

  if (financeGate?.status === "REVIEW" || financeGate?.status === "FAIL") {
    pushAction(actions, {
      id: "tighten-finance-assumptions",
      priority: financeGate.status === "FAIL" ? "URGENT" : "HIGH",
      action: "Tighten finance assumptions and bridge timeline before offer.",
      owner: "broker",
      reason: financeGate.explanation,
      blocksOfferSubmission: true,
    })
  }

  if ((input.bridgeTermMonths ?? 0) > 12 || timeRisk.severity === "HIGH" || timeRisk.severity === "FATAL") {
    pushAction(actions, {
      id: "finance-timeline-review",
      priority: timeRisk.severity === "FATAL" ? "URGENT" : "HIGH",
      action: "Review bridge term, finance drag, and delivery timeline.",
      owner: "broker",
      reason: timeRisk.explanation,
      blocksOfferSubmission: true,
    })
  }

  if ((typeof input.loanToValue === "number" && input.loanToValue > 0.8) || input.hasRefinanceRisk) {
    pushAction(actions, {
      id: "lender-refinance-validation",
      priority: "HIGH",
      action: "Validate leverage and refinance path with lender/broker.",
      owner: "broker",
      reason: "Leverage or refinance assumptions are stretched.",
      blocksOfferSubmission: true,
    })
  }

  if (negotiation.unsupportedUrgency) {
    pushAction(actions, {
      id: "slow-urgency-pressure",
      priority: "MEDIUM",
      action: "Challenge urgency claims and renegotiate from evidence, not pressure.",
      owner: "analyst",
      reason: "Urgency language is unsupported by credible motivation signals.",
      blocksOfferSubmission: false,
    })
  }

  if (actions.length === 0) {
    actions.push({
      id: "proceed-under-governance",
      priority: "LOW",
      action: "Proceed under current governance status.",
      owner: "analyst",
      reason: "No high-priority intelligence action is outstanding.",
      blocksOfferSubmission: false,
    })
  }

  return actions
}
