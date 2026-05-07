import type { DecisionGateOutput, RiskSeverity } from "@/types/phase2"
import type { EvidenceStatusOutput } from "@/types/phase2"
import type { FatalRiskResult, Phase2GovernanceInput } from "@/types/phase2-governance"

function buildGate(
  gateId: string,
  label: string,
  status: "PASS" | "FAIL" | "REVIEW",
  severity: RiskSeverity,
  explanation: string,
  triggeredBy: string[],
  requiredAction?: string
): DecisionGateOutput {
  return {
    gateId,
    label,
    status,
    severity,
    explanation,
    triggeredBy,
    requiredAction,
  }
}

export function evaluateDecisionGates(
  input: Phase2GovernanceInput,
  fatalResult: FatalRiskResult,
  evidenceStatus: EvidenceStatusOutput
): DecisionGateOutput[] {
  const gates: DecisionGateOutput[] = []
  const capitalRatio = fatalResult.metrics.capitalRatio
  const realisticProfit = fatalResult.metrics.realisticProfit
  const downsideProfit = fatalResult.metrics.downsideProfit
  const downsideThreshold = fatalResult.metrics.downsideThreshold
  const refurbExposure = fatalResult.metrics.refurbExposure
  const financeRatio =
    fatalResult.metrics.financeCost !== null && input.gdvRealistic > 0
      ? fatalResult.metrics.financeCost / input.gdvRealistic
      : null

  if (capitalRatio === null) {
    gates.push(
      buildGate(
        "capital-protection",
        "Capital Protection Gate",
        "REVIEW",
        "HIGH",
        "Capital protection cannot be fully tested without enough inputs.",
        ["purchasePrice", "gdvRealistic", "refurbCost", "financeCost"],
        "Provide enough inputs to calculate capital usage."
      )
    )
  } else if (realisticProfit !== null && realisticProfit < 0) {
    gates.push(
      buildGate(
        "capital-protection",
        "Capital Protection Gate",
        "FAIL",
        "FATAL",
        "Realistic-case profit is negative, so capital protection fails.",
        ["gdvRealistic", "purchasePrice", "refurbCost", "financeCost"],
        "Reject deal or materially reduce basis."
      )
    )
  } else if (capitalRatio > 1) {
    gates.push(
      buildGate(
        "capital-protection",
        "Capital Protection Gate",
        "FAIL",
        "FATAL",
        "Total investment basis exceeds realistic GDV.",
        ["capitalRatio", "gdvRealistic"],
        "Reject deal or reduce basis before proceeding."
      )
    )
  } else if (capitalRatio > 0.85) {
    gates.push(
      buildGate(
        "capital-protection",
        "Capital Protection Gate",
        "REVIEW",
        "HIGH",
        "Capital usage is stretched above preferred range.",
        ["capitalRatio"],
        "Review leverage and basis before offering."
      )
    )
  } else {
    gates.push(
      buildGate(
        "capital-protection",
        "Capital Protection Gate",
        "PASS",
        capitalRatio < 0.8 ? "LOW" : "MEDIUM",
        "Capital usage remains within acceptable range.",
        ["capitalRatio"]
      )
    )
  }

  if (downsideProfit === null || downsideThreshold === null) {
    gates.push(
      buildGate(
        "downside-loss",
        "Downside Loss Gate",
        "REVIEW",
        "HIGH",
        "Downside loss cannot be fully tested without enough inputs.",
        ["gdvDownside", "gdvRealistic", "financeCost"],
        "Provide enough inputs to model downside."
      )
    )
  } else if (downsideProfit <= -downsideThreshold) {
    gates.push(
      buildGate(
        "downside-loss",
        "Downside Loss Gate",
        "FAIL",
        "FATAL",
        "Downside loss breaches safe threshold.",
        ["gdvDownside", "downsideProfit"],
        "Reject deal or reduce downside exposure."
      )
    )
  } else if (downsideProfit < 0) {
    gates.push(
      buildGate(
        "downside-loss",
        "Downside Loss Gate",
        "REVIEW",
        "HIGH",
        "Downside case is loss-making but not beyond fatal threshold.",
        ["gdvDownside", "downsideProfit"],
        "Review downside assumptions."
      )
    )
  } else {
    gates.push(
      buildGate(
        "downside-loss",
        "Downside Loss Gate",
        "PASS",
        "LOW",
        "Downside case remains profitable.",
        ["downsideProfit"]
      )
    )
  }

  if (input.hasUnrealisticGdvRisk) {
    gates.push(
      buildGate(
        "unrealistic-gdv-assumption",
        "Unrealistic GDV Assumption Gate",
        "FAIL",
        "FATAL",
        "GDV assumption is stretched beyond credible evidence and blocks safe progression.",
        ["gdvEvidenceStrength", "comparablesCount", "hasUnrealisticGdvRisk"],
        "Block deal unless GDV is independently reset from stronger evidence."
      )
    )
  } else {
    gates.push(
      buildGate(
        "unrealistic-gdv-assumption",
        "Unrealistic GDV Assumption Gate",
        "PASS",
        "LOW",
        "No explicit unrealistic GDV blocker identified.",
        ["hasUnrealisticGdvRisk"]
      )
    )
  }

  const comparableCount = input.comparablesCount ?? 0
  const gdvStrength = input.gdvEvidenceStrength ?? "MISSING"

  if (gdvStrength === "MISSING") {
    gates.push(
      buildGate(
        "gdv-evidence",
        "GDV Evidence Gate",
        "FAIL",
        "HIGH",
        "GDV evidence is missing.",
        ["gdvEvidenceStrength"],
        "Provide credible GDV support."
      )
    )
  } else if (gdvStrength === "WEAK") {
    gates.push(
      buildGate(
        "gdv-evidence",
        "GDV Evidence Gate",
        "REVIEW",
        "HIGH",
        "GDV evidence is weak and needs challenge.",
        ["gdvEvidenceStrength"],
        "Verify GDV against stronger evidence."
      )
    )
  } else if (gdvStrength === "MODERATE") {
    gates.push(
      buildGate(
        "gdv-evidence",
        "GDV Evidence Gate",
        "REVIEW",
        "MEDIUM",
        "GDV evidence is only moderate.",
        ["gdvEvidenceStrength"]
      )
    )
  } else {
    gates.push(
      buildGate(
        "gdv-evidence",
        "GDV Evidence Gate",
        "PASS",
        "LOW",
        "GDV evidence is strong.",
        ["gdvEvidenceStrength"]
      )
    )
  }

  if (comparableCount === 0) {
    gates.push(
      buildGate(
        "comparable-evidence",
        "Comparable Evidence Gate",
        "FAIL",
        "HIGH",
        "No comparables support the valuation case.",
        ["comparablesCount"],
        "Add comparable evidence before offering."
      )
    )
  } else if (comparableCount < 3) {
    gates.push(
      buildGate(
        "comparable-evidence",
        "Comparable Evidence Gate",
        "REVIEW",
        "HIGH",
        "Comparable coverage is thin.",
        ["comparablesCount"],
        "Expand comparable coverage."
      )
    )
  } else {
    gates.push(
      buildGate(
        "comparable-evidence",
        "Comparable Evidence Gate",
        "PASS",
        "LOW",
        "Comparable coverage is sufficient.",
        ["comparablesCount"]
      )
    )
  }

  if (refurbExposure === null) {
    gates.push(
      buildGate(
        "refurb-exposure",
        "Refurb Exposure Gate",
        "REVIEW",
        "MEDIUM",
        "Refurb exposure cannot be fully assessed.",
        ["refurbCost", "purchasePrice"]
      )
    )
  } else if (refurbExposure > 0.3) {
    gates.push(
      buildGate(
        "refurb-exposure",
        "Refurb Exposure Gate",
        "REVIEW",
        "HIGH",
        "Refurb exposure is high relative to purchase price.",
        ["refurbCost", "purchasePrice"],
        "Review capex assumptions and contingency."
      )
    )
  } else if (refurbExposure > 0.2) {
    gates.push(
      buildGate(
        "refurb-exposure",
        "Refurb Exposure Gate",
        "REVIEW",
        "MEDIUM",
        "Refurb exposure is elevated.",
        ["refurbCost", "purchasePrice"]
      )
    )
  } else {
    gates.push(
      buildGate(
        "refurb-exposure",
        "Refurb Exposure Gate",
        "PASS",
        "LOW",
        "Refurb exposure is within normal range.",
        ["refurbCost", "purchasePrice"]
      )
    )
  }

  const bridgeTerm = input.bridgeTermMonths ?? null
  if (bridgeTerm === null && financeRatio === null) {
    gates.push(
      buildGate(
        "finance-time-risk",
        "Finance/Time Risk Gate",
        "REVIEW",
        "MEDIUM",
        "Finance and time risk cannot be fully assessed.",
        ["bridgeTermMonths", "financeCost"]
      )
    )
  } else if ((bridgeTerm !== null && bridgeTerm > 18) || (financeRatio !== null && financeRatio > 0.16)) {
    gates.push(
      buildGate(
        "finance-time-risk",
        "Finance/Time Risk Gate",
        "FAIL",
        "HIGH",
        "Finance drag or bridge duration is outside safe range.",
        ["bridgeTermMonths", "financeCost"],
        "Tighten finance assumptions or shorten term."
      )
    )
  } else if ((bridgeTerm !== null && bridgeTerm > 12) || (financeRatio !== null && financeRatio > 0.08)) {
    gates.push(
      buildGate(
        "finance-time-risk",
        "Finance/Time Risk Gate",
        "REVIEW",
        "HIGH",
        "Finance drag or bridge duration needs review.",
        ["bridgeTermMonths", "financeCost"],
        "Review finance terms and timeline."
      )
    )
  } else {
    gates.push(
      buildGate(
        "finance-time-risk",
        "Finance/Time Risk Gate",
        "PASS",
        "LOW",
        "Finance drag and timeline are within tolerance.",
        ["bridgeTermMonths", "financeCost"]
      )
    )
  }

  if (fatalResult.fatalRisk) {
    gates.push(
      buildGate(
        "fatal-risk",
        "Fatal Risk Gate",
        "FAIL",
        "FATAL",
        fatalResult.fatalReasons.join(" "),
        fatalResult.fatalFlags.map((flag) => flag.code),
        "Reject deal unless fatal issue is independently cleared."
      )
    )
  } else {
    gates.push(
      buildGate(
        "fatal-risk",
        "Fatal Risk Gate",
        "PASS",
        "LOW",
        "No fatal governance blocker identified.",
        ["fatalRisk"]
      )
    )
  }

  if (evidenceStatus.missingCriticalEvidence.length > 0) {
    gates.push(
      buildGate(
        "missing-critical-evidence",
        "Missing Critical Evidence Gate",
        "REVIEW",
        "HIGH",
        "Critical evidence is missing for safe offer progression.",
        evidenceStatus.missingCriticalEvidence,
        "Collect missing critical evidence before offering."
      )
    )
  } else {
    gates.push(
      buildGate(
        "missing-critical-evidence",
        "Missing Critical Evidence Gate",
        "PASS",
        "LOW",
        "No critical evidence gap identified.",
        ["missingCriticalEvidence"]
      )
    )
  }

  return gates
}
