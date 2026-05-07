import type { RiskFlagOutput, RiskRadarOutput, RiskSeverity } from "@/types/phase2"
import type { ApplyGovernanceResult } from "@/types/phase2-governance"
import type { NegotiationPositionResult, Phase2IntelligenceInput, TimeRiskResult } from "@/types/phase2-intelligence"

function severityRank(severity: RiskSeverity): number {
  if (severity === "FATAL") return 4
  if (severity === "HIGH") return 3
  if (severity === "MEDIUM") return 2
  return 1
}

function uniqueFlags(flags: RiskFlagOutput[]): RiskFlagOutput[] {
  const seen = new Set<string>()
  const result: RiskFlagOutput[] = []

  for (const flag of flags) {
    if (seen.has(flag.code)) continue
    seen.add(flag.code)
    result.push(flag)
  }

  return result
}

function pushFlag(
  flags: RiskFlagOutput[],
  code: string,
  label: string,
  severity: RiskSeverity,
  explanation: string,
  source: string
) {
  flags.push({ code, label, severity, explanation, source })
}

export function buildRiskRadar(
  input: Phase2IntelligenceInput,
  governanceResult: ApplyGovernanceResult,
  timeRisk: TimeRiskResult,
  negotiation: NegotiationPositionResult
): RiskRadarOutput {
  const flags: RiskFlagOutput[] = [...governanceResult.riskRadar.riskFlags]
  const comparablesCount = input.comparablesCount ?? 0
  const refurbExposure = governanceResult.metrics.refurbExposure

  if (input.gdvEvidenceStrength === "WEAK") {
    pushFlag(flags, "GDV_EVIDENCE_WEAK", "Weak GDV evidence", "HIGH", "GDV evidence is weak.", "gdv")
  }
  if (input.gdvEvidenceStrength === "MISSING") {
    pushFlag(flags, "GDV_EVIDENCE_MISSING", "Missing GDV evidence", "HIGH", "GDV evidence is missing.", "gdv")
  }
  if (comparablesCount === 0) {
    pushFlag(flags, "COMPARABLES_MISSING", "Missing comparables", "HIGH", "No comparables support the valuation case.", "comparables")
  } else if (comparablesCount < 3) {
    pushFlag(flags, "COMPARABLES_THIN", "Thin comparable coverage", "MEDIUM", "Comparable support is limited.", "comparables")
  }
  if (refurbExposure !== null && refurbExposure > 0.25) {
    pushFlag(flags, "REFURB_EXPOSURE_HIGH", "Heavy refurb exposure", "HIGH", "Refurb exposure is high relative to entry price.", "refurb")
  }
  if (typeof input.loanToValue === "number" && input.loanToValue > 0.8) {
    pushFlag(flags, "LEVERAGE_HIGH", "High leverage", "HIGH", "Leverage exceeds conservative range.", "finance")
  }
  if (input.hasRefinanceRisk) {
    pushFlag(flags, "REFINANCE_RISK", "Refinance risk", "HIGH", "Refinance path is uncertain.", "finance")
  }
  if (timeRisk.severity !== "LOW") {
    pushFlag(
      flags,
      `TIME_RISK_${timeRisk.severity}`,
      "Time/bridge risk",
      timeRisk.severity,
      timeRisk.explanation,
      "timeline"
    )
  }
  if (negotiation.unsupportedUrgency) {
    pushFlag(
      flags,
      "FALSE_HOT_URGENCY",
      "False HOT urgency unsupported",
      "MEDIUM",
      "Urgency language is not backed by credible seller motivation.",
      "listing"
    )
  }

  const riskFlags = uniqueFlags(flags)
  const overallRisk = riskFlags.reduce<RiskSeverity>(
    (current, flag) => (severityRank(flag.severity) > severityRank(current) ? flag.severity : current),
    "LOW"
  )

  return {
    overallRisk,
    riskFlags,
    fatalRisks: riskFlags.filter((flag) => flag.severity === "FATAL").map((flag) => flag.label),
    reviewRisks: riskFlags
      .filter((flag) => flag.severity === "HIGH" || flag.severity === "MEDIUM")
      .map((flag) => flag.label),
    explanation:
      "Risk radar combines governance blockers, evidence gaps, finance and time risk, refurb exposure, and unsupported urgency signals.",
  }
}
