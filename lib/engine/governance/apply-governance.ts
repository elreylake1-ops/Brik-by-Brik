import type {
  FinalDealClassification,
  GovernanceOutput,
  RiskFlagOutput,
  RiskRadarOutput,
  RiskSeverity,
} from "@/types/phase2"
import type { ApplyGovernanceResult, Phase2GovernanceInput } from "@/types/phase2-governance"
import { evaluateDataConfidence } from "@/lib/engine/governance/data-confidence-engine"
import { evaluateDealFatalRisk } from "@/lib/engine/governance/deal-fatal-engine"
import { evaluateDecisionGates } from "@/lib/engine/governance/decision-gate-engine"
import { evaluateEvidenceStatus } from "@/lib/engine/governance/evidence-status-engine"
import { evaluateHumanReview } from "@/lib/engine/governance/human-review-engine"

function severityRank(severity: RiskSeverity): number {
  if (severity === "FATAL") return 4
  if (severity === "HIGH") return 3
  if (severity === "MEDIUM") return 2
  return 1
}

function uniqueRiskFlags(flags: RiskFlagOutput[]): RiskFlagOutput[] {
  const seen = new Set<string>()
  const result: RiskFlagOutput[] = []

  for (const flag of flags) {
    if (seen.has(flag.code)) continue
    seen.add(flag.code)
    result.push(flag)
  }

  return result
}

function buildRiskRadar(
  fatalFlags: RiskFlagOutput[],
  reviewReasons: string[],
  decisionGates: ApplyGovernanceResult["decisionGates"]
): RiskRadarOutput {
  const gateFlags = decisionGates
    .filter((gate) => gate.status !== "PASS")
    .map<RiskFlagOutput>((gate) => ({
      code: gate.gateId.toUpperCase().replace(/-/g, "_"),
      label: gate.label,
      severity: gate.severity,
      explanation: gate.explanation,
      source: "governance_gate",
    }))

  const riskFlags = uniqueRiskFlags([...fatalFlags, ...gateFlags])
  const overallRisk = riskFlags.reduce<RiskSeverity>(
    (current, flag) => (severityRank(flag.severity) > severityRank(current) ? flag.severity : current),
    "LOW"
  )

  return {
    overallRisk,
    riskFlags,
    fatalRisks: fatalFlags.map((flag) => flag.explanation),
    reviewRisks: [...new Set(reviewReasons)],
    explanation:
      "Risk radar is derived from fatal blockers and non-pass decision gates. No weighted scoring is used here.",
  }
}

function determinePassClassification(
  rawClassification: FinalDealClassification | undefined
): FinalDealClassification {
  return rawClassification ?? "REVIEW_REQUIRED"
}

function buildGovernanceExplanation(
  state: GovernanceOutput["state"],
  fatalRisk: boolean,
  reviewRequired: boolean
): string {
  if (state === "BLOCKED") {
    return fatalRisk
      ? "Governance overrides scoring because a fatal blocker exists."
      : "Governance blocks progression because a fatal gate failed."
  }

  if (state === "REVIEW_REQUIRED") {
    return reviewRequired
      ? "Governance runs above scoring and requires human review before progression."
      : "Governance requires review because critical evidence is missing."
  }

  return "Governance found no fatal or review-level blocker, so raw classification is preserved."
}

export function applyGovernance(input: Phase2GovernanceInput): ApplyGovernanceResult {
  const evidenceStatus = evaluateEvidenceStatus(input)
  const dataConfidence = evaluateDataConfidence(input, evidenceStatus)
  const fatalResult = evaluateDealFatalRisk(input)
  const decisionGates = evaluateDecisionGates(input, fatalResult, evidenceStatus)
  const reviewResult = evaluateHumanReview(input, evidenceStatus, fatalResult)

  const hasFatalGateFailure = decisionGates.some(
    (gate) => gate.status === "FAIL" && gate.severity === "FATAL"
  )
  const missingCriticalEvidence = evidenceStatus.missingCriticalEvidence.length > 0

  let state: GovernanceOutput["state"] = "PASS"
  let finalClassification: FinalDealClassification = determinePassClassification(input.rawClassification)
  let reviewRequired = false
  let reviewReasons: string[] = []

  if (fatalResult.fatalRisk || hasFatalGateFailure) {
    state = "BLOCKED"
    finalClassification = "NO_DEAL"
    reviewRequired = Boolean(input.manualReviewRequested)
    reviewReasons = input.manualReviewRequested
      ? [
          ...reviewResult.reviewReasons,
          "Fatal blocker must be independently cleared before reconsideration.",
        ]
      : []
  } else if (missingCriticalEvidence) {
    state = "REVIEW_REQUIRED"
    finalClassification = "REVIEW_REQUIRED"
    reviewRequired = true
    reviewReasons = ["Critical evidence is missing.", ...reviewResult.reviewReasons]
  } else if (reviewResult.reviewRequired) {
    state = "REVIEW_REQUIRED"
    finalClassification = "REVIEW_REQUIRED"
    reviewRequired = true
    reviewReasons = [...reviewResult.reviewReasons]
  }

  reviewReasons = [...new Set(reviewReasons)]

  const governance: GovernanceOutput = {
    state,
    finalClassification,
    scoreBeforeGovernance: input.rawHeatScore ?? null,
    classificationBeforeGovernance: input.rawClassification ?? null,
    governanceOverrideApplied:
      input.rawClassification !== undefined && input.rawClassification !== finalClassification,
    fatalRisk: fatalResult.fatalRisk || hasFatalGateFailure,
    fatalReasons: fatalResult.fatalReasons,
    blockedBy: decisionGates
      .filter((gate) => gate.status === "FAIL")
      .map((gate) => gate.gateId),
    reviewRequired,
    reviewReasons,
    explanation: buildGovernanceExplanation(state, fatalResult.fatalRisk, reviewRequired),
  }

  const riskRadar = buildRiskRadar(fatalResult.fatalFlags, reviewReasons, decisionGates)

  return {
    governance,
    decisionGates,
    evidenceStatus,
    dataConfidence,
    riskRadar,
    reviewRequired,
    reviewReasons,
    fatalRisk: governance.fatalRisk,
    fatalReasons: governance.fatalReasons,
    metrics: fatalResult.metrics,
  }
}
