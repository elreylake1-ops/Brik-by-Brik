import type { EvidenceFieldStatusOutput, EvidenceStatusOutput, EvidenceStatus } from "@/types/phase2"
import type { GovernanceEvidenceStrength, Phase2GovernanceInput } from "@/types/phase2-governance"

function statusFromStrength(
  strength: GovernanceEvidenceStrength | undefined,
  weakStatus: EvidenceStatus = "ASSUMED"
): EvidenceStatus {
  if (strength === "STRONG") return "VERIFIED"
  if (strength === "MODERATE") return "ESTIMATED"
  if (strength === "WEAK") return weakStatus
  return "MISSING"
}

function pushField(
  fields: EvidenceFieldStatusOutput[],
  field: string,
  status: EvidenceStatus,
  explanation: string,
  requiredForOffer: boolean
) {
  fields.push({ field, status, explanation, requiredForOffer })
}

export function evaluateEvidenceStatus(input: Phase2GovernanceInput): EvidenceStatusOutput {
  const fields: EvidenceFieldStatusOutput[] = []
  const missingCriticalEvidence: string[] = []
  const assumedFields: string[] = []
  const verifiedFields: string[] = []
  const comparablesCount = input.comparablesCount ?? 0

  const gdvMissing =
    input.gdvEvidenceStrength === "MISSING" ||
    comparablesCount === 0
  const gdvStatus: EvidenceStatus = gdvMissing
    ? "MISSING"
    : input.gdvEvidenceStrength === "WEAK"
      ? "ESTIMATED"
      : statusFromStrength(input.gdvEvidenceStrength, "ESTIMATED")

  pushField(
    fields,
    "gdvRealistic",
    gdvStatus,
    gdvMissing
      ? "GDV evidence is missing or unsupported by comparables."
      : gdvStatus === "ESTIMATED"
        ? "GDV evidence is weak or only partially supported."
        : "GDV evidence is supported.",
    true
  )

  const comparablesMissing = input.comparablesCount === undefined || input.comparablesCount === 0
  const comparablesStatus: EvidenceStatus = comparablesMissing
    ? "MISSING"
    : comparablesCount < 3
      ? "ESTIMATED"
      : "VERIFIED"

  pushField(
    fields,
    "comparables",
    comparablesStatus,
    comparablesMissing
      ? "Comparable evidence is missing."
      : comparablesStatus === "ESTIMATED"
        ? "Comparable evidence exists but coverage is thin."
        : "Comparable evidence is sufficient.",
    true
  )

  const refurbStatus = statusFromStrength(input.refurbEvidenceStrength, "ASSUMED")
  pushField(
    fields,
    "refurbCost",
    refurbStatus,
    refurbStatus === "MISSING"
      ? "Refurb evidence is missing."
      : refurbStatus === "ASSUMED"
        ? "Refurb allowance is assumed from weak evidence."
        : refurbStatus === "ESTIMATED"
          ? "Refurb allowance is estimated from moderate evidence."
          : "Refurb evidence is verified.",
    true
  )

  const legalStatus = statusFromStrength(input.legalEvidenceStrength, "ASSUMED")
  pushField(
    fields,
    "legal",
    legalStatus,
    legalStatus === "MISSING"
      ? "Legal evidence is missing."
      : legalStatus === "ASSUMED"
        ? "Legal position is assumed from weak evidence."
        : legalStatus === "ESTIMATED"
          ? "Legal position is estimated from moderate evidence."
          : "Legal evidence is verified.",
    true
  )

  const financeStatus: EvidenceStatus =
    typeof input.financeCost === "number"
      ? "VERIFIED"
      : typeof input.bridgeTermMonths === "number"
        ? "ESTIMATED"
        : "MISSING"

  pushField(
    fields,
    "finance",
    financeStatus,
    financeStatus === "VERIFIED"
      ? "Finance cost is provided explicitly."
      : financeStatus === "ESTIMATED"
        ? "Finance cost can only be estimated from bridge term."
        : "Finance evidence is missing.",
    false
  )

  if (gdvStatus === "MISSING") missingCriticalEvidence.push("gdvRealistic")
  if (comparablesStatus === "MISSING") missingCriticalEvidence.push("comparables")
  if (legalStatus === "MISSING") missingCriticalEvidence.push("legal")
  if (input.hasMissingCriticalEvidence) missingCriticalEvidence.push("manual-critical-evidence-flag")

  for (const field of fields) {
    if (field.status === "ASSUMED") assumedFields.push(field.field)
    if (field.status === "VERIFIED") verifiedFields.push(field.field)
  }

  const uniqueMissing = [...new Set(missingCriticalEvidence)]
  const overallStatus: EvidenceStatus =
    uniqueMissing.length > 0
      ? "MISSING"
      : fields.some((field) => field.status === "ASSUMED")
        ? "ASSUMED"
        : fields.some((field) => field.status === "ESTIMATED")
          ? "ESTIMATED"
          : "VERIFIED"

  return {
    overallStatus,
    fields,
    missingCriticalEvidence: uniqueMissing,
    assumedFields: [...new Set(assumedFields)],
    verifiedFields: [...new Set(verifiedFields)],
  }
}
