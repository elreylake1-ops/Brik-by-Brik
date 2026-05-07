import type { ConfidenceLevel, DataConfidenceOutput } from "@/types/phase2"
import type { GovernanceEvidenceStrength, Phase2GovernanceInput } from "@/types/phase2-governance"
import type { EvidenceStatusOutput } from "@/types/phase2"

function confidenceFromStrength(strength: GovernanceEvidenceStrength | undefined): ConfidenceLevel {
  if (strength === "STRONG") return "HIGH"
  if (strength === "MODERATE") return "MEDIUM"
  if (strength === "WEAK") return "LOW"
  return "MISSING"
}

function lowestConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.includes("MISSING")) return "MISSING"
  if (levels.includes("LOW")) return "LOW"
  if (levels.includes("MEDIUM")) return "MEDIUM"
  return "HIGH"
}

export function evaluateDataConfidence(
  input: Phase2GovernanceInput,
  evidenceStatus: EvidenceStatusOutput
): DataConfidenceOutput {
  const comparablesCount = input.comparablesCount ?? 0

  const gdvConfidence =
    comparablesCount === 0
      ? "MISSING"
      : comparablesCount < 3
        ? "LOW"
        : confidenceFromStrength(input.gdvEvidenceStrength)

  const listingConfidence = gdvConfidence
  const refurbConfidence = confidenceFromStrength(input.refurbEvidenceStrength)
  const legalConfidence = confidenceFromStrength(input.legalEvidenceStrength)

  const financeConfidence: ConfidenceLevel =
    typeof input.financeCost === "number"
      ? "HIGH"
      : typeof input.bridgeTermMonths === "number"
        ? input.bridgeTermMonths > 12
          ? "LOW"
          : "MEDIUM"
        : "MISSING"

  const overallConfidence = lowestConfidence([
    listingConfidence,
    gdvConfidence,
    legalConfidence,
    refurbConfidence,
    financeConfidence,
  ])

  const confidenceWarnings: string[] = []

  if (gdvConfidence === "MISSING" || gdvConfidence === "LOW") {
    confidenceWarnings.push("GDV confidence is degraded by weak or missing comparable support.")
  }
  if (legalConfidence === "MISSING" || legalConfidence === "LOW") {
    confidenceWarnings.push("Legal confidence is degraded by weak or missing legal evidence.")
  }
  if (financeConfidence === "MISSING" || financeConfidence === "LOW") {
    confidenceWarnings.push("Finance confidence is degraded by estimated or missing finance inputs.")
  }
  if (evidenceStatus.missingCriticalEvidence.length > 0) {
    confidenceWarnings.push("Critical evidence is missing, so overall confidence is capped.")
  }

  return {
    overallConfidence,
    listingConfidence,
    refurbConfidence,
    gdvConfidence,
    legalConfidence,
    financeConfidence,
    explanation:
      "Confidence levels derive from evidence strength, comparable coverage, and whether finance inputs are verified or estimated.",
    confidenceWarnings,
  }
}
