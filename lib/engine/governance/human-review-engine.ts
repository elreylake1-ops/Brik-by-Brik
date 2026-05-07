import type { EvidenceStatusOutput } from "@/types/phase2"
import type { FatalRiskResult, HumanReviewResult, Phase2GovernanceInput } from "@/types/phase2-governance"

function pushReason(reasons: string[], condition: boolean, reason: string) {
  if (condition) reasons.push(reason)
}

export function evaluateHumanReview(
  input: Phase2GovernanceInput,
  evidenceStatus: EvidenceStatusOutput,
  fatalResult: FatalRiskResult
): HumanReviewResult {
  const reasons: string[] = []
  const comparablesCount = input.comparablesCount ?? 0
  const refurbExposure = fatalResult.metrics.refurbExposure
  const capitalRatio = fatalResult.metrics.capitalRatio

  pushReason(
    reasons,
    input.gdvEvidenceStrength === "WEAK" || input.gdvEvidenceStrength === "MISSING",
    "GDV evidence is weak or missing."
  )
  pushReason(reasons, comparablesCount === 0, "Comparable evidence is missing.")
  pushReason(reasons, typeof input.bridgeTermMonths === "number" && input.bridgeTermMonths > 12, "Bridge term is longer than base-case tolerance.")
  pushReason(reasons, refurbExposure !== null && refurbExposure > 0.25, "Refurb exposure is high relative to purchase price.")
  pushReason(
    reasons,
    (typeof input.loanToValue === "number" && input.loanToValue > 0.75) ||
      (capitalRatio !== null && capitalRatio > 0.85),
    "Leverage or capital usage is high."
  )
  pushReason(reasons, Boolean(input.hasRefinanceRisk), "Refinance risk requires manual review.")
  pushReason(reasons, Boolean(input.manualReviewRequested), "Manual review was explicitly requested.")
  pushReason(
    reasons,
    evidenceStatus.missingCriticalEvidence.length > 0,
    "Critical evidence is missing."
  )

  return {
    reviewRequired: reasons.length > 0 && !fatalResult.fatalRisk,
    reviewReasons: [...new Set(reasons)],
  }
}
