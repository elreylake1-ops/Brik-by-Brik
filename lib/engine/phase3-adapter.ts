import type { Phase2AnalysisOutput } from "@/types/phase2"
import type {
  FinalDealClassification,
  GovernanceState,
} from "@/types/phase2"
import type { Phase3DeterministicSnapshot } from "@/types/phase3-orchestration"

const SAFE_GOVERNANCE_STATE_FALLBACK: GovernanceState = "REVIEW_REQUIRED"
const SAFE_FINAL_CLASSIFICATION_FALLBACK: FinalDealClassification = "REVIEW_REQUIRED"

const GOVERNANCE_STATE_VALUES: readonly GovernanceState[] = [
  "PASS",
  "REVIEW_REQUIRED",
  "BLOCKED",
]

const FINAL_CLASSIFICATION_VALUES: readonly FinalDealClassification[] = [
  "HOT",
  "WARM",
  "MARGINAL",
  "NO_DEAL",
  "REVIEW_REQUIRED",
]

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string")
}

function asBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false
}

function normalizeGovernanceState(value: unknown): GovernanceState {
  if (
    typeof value === "string" &&
    GOVERNANCE_STATE_VALUES.includes(value as GovernanceState)
  ) {
    return value as GovernanceState
  }

  return SAFE_GOVERNANCE_STATE_FALLBACK
}

function normalizeFinalClassification(value: unknown): FinalDealClassification {
  if (
    typeof value === "string" &&
    FINAL_CLASSIFICATION_VALUES.includes(value as FinalDealClassification)
  ) {
    return value as FinalDealClassification
  }

  return SAFE_FINAL_CLASSIFICATION_FALLBACK
}

function flattenRiskFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const flattened: string[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue

    const code = "code" in entry && typeof entry.code === "string" ? entry.code : ""
    const label = "label" in entry && typeof entry.label === "string" ? entry.label : ""
    const resolved = code || label

    if (resolved) {
      flattened.push(resolved)
    }
  }

  return flattened
}

export function mapPhase2OutputToPhase3Snapshot(
  output: Phase2AnalysisOutput
): Phase3DeterministicSnapshot {
  const governance = (output as Partial<Phase2AnalysisOutput>).governance
  const evidenceStatus = (output as Partial<Phase2AnalysisOutput>).evidenceStatus
  const riskRadar = (output as Partial<Phase2AnalysisOutput>).riskRadar

  return {
    governanceState: normalizeGovernanceState(governance?.state),
    finalClassification: normalizeFinalClassification(governance?.finalClassification),
    fatalRisk: asBoolean(governance?.fatalRisk),
    reviewRequired: asBoolean(governance?.reviewRequired),
    missingCriticalEvidence: asStringArray(evidenceStatus?.missingCriticalEvidence),
    blockedBy: asStringArray(governance?.blockedBy),
    riskFlags: flattenRiskFlags(riskRadar?.riskFlags),
  }
}
