import type {
  DealHeatScoreOutput,
  EvidenceStatusOutput,
  InvestorSummaryOutput,
  NextActionOutput,
  RiskRadarOutput,
  StrategyMatchOutput,
} from "@/types/phase2"
import type { ApplyGovernanceResult } from "@/types/phase2-governance"

export function buildInvestorSummary(
  governanceResult: ApplyGovernanceResult,
  heatScore: DealHeatScoreOutput,
  riskRadar: RiskRadarOutput,
  strategyMatch: StrategyMatchOutput,
  evidenceStatus: EvidenceStatusOutput,
  nextActions: NextActionOutput[]
): InvestorSummaryOutput {
  const firstAction = nextActions[0]
  const topRisks = riskRadar.riskFlags.slice(0, 3).map((flag) => flag.label)
  const warnings: string[] = []

  if (governanceResult.governance.governanceOverrideApplied) {
    warnings.push("Governance overrode raw scoring/classification.")
  }
  if (evidenceStatus.missingCriticalEvidence.length > 0) {
    warnings.push("Critical evidence is still missing.")
  }
  if (riskRadar.overallRisk === "HIGH" || riskRadar.overallRisk === "FATAL") {
    warnings.push("Risk concentration remains elevated.")
  }

  if (governanceResult.governance.state === "BLOCKED") {
    return {
      headline:
        heatScore.band === "HOT"
          ? "Raw HOT score blocked by governance."
          : "Deal blocked by governance.",
      summary:
        "Raw opportunity signals exist, but final progression is blocked by governance controls and/or fatal risk.",
      decision: governanceResult.governance.finalClassification,
      keyReasons:
        governanceResult.governance.fatalReasons.length > 0
          ? governanceResult.governance.fatalReasons
          : [governanceResult.governance.explanation],
      keyRisks: topRisks,
      recommendedNextStep: firstAction?.action ?? "Do not proceed until blocker is cleared.",
      investorWarnings: warnings,
    }
  }

  if (governanceResult.governance.state === "REVIEW_REQUIRED") {
    return {
      headline: "Deal requires manual review before offer.",
      summary:
        "Raw scoring may be promising, but review-level evidence or execution issues still need to be cleared.",
      decision: governanceResult.governance.finalClassification,
      keyReasons:
        governanceResult.governance.reviewReasons.length > 0
          ? governanceResult.governance.reviewReasons
          : [governanceResult.governance.explanation],
      keyRisks: topRisks,
      recommendedNextStep: firstAction?.action ?? "Complete manual review before offering.",
      investorWarnings: warnings,
    }
  }

  return {
    headline:
      heatScore.band === "HOT"
        ? "Governance pass with strong raw opportunity."
        : "Governance pass with workable opportunity.",
    summary:
      "Governance has not blocked the deal, and raw intelligence supports the current recommended strategy.",
    decision: strategyMatch.recommendedStrategy,
    keyReasons: heatScore.positiveSignals.slice(0, 3),
    keyRisks: topRisks,
    recommendedNextStep: firstAction?.action ?? "Proceed under current governance status.",
    investorWarnings: warnings,
  }
}
