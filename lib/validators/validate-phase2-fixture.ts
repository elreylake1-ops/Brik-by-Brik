import {
  PHASE2_COMPARABLE_COVERAGE,
  PHASE2_GDV_EVIDENCE_STRENGTHS,
  PHASE2_GOVERNANCE_STATES,
  PHASE2_NEXT_ACTIONS,
  PHASE2_REFURB_CONFIDENCE_LEVELS,
  PHASE2_RISK_FLAGS,
  PHASE2_STRUCTURAL_RISK_LEVELS,
} from "@/types/phase2-validation"

export type Phase2FixtureValidationResult = {
  valid: boolean
  errors: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function hasOnlyNonEmptyStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString)
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean"
}

function isOptionalFiniteNumber(value: unknown): boolean {
  return value === undefined || isFiniteNumber(value)
}

export function validatePhase2Fixture(fixture: unknown): Phase2FixtureValidationResult {
  const errors: string[] = []

  if (!isRecord(fixture)) {
    return { valid: false, errors: ["Fixture must be an object."] }
  }

  const {
    scenarioId,
    name,
    description,
    input,
    expectedClassification,
    expectedGovernanceState,
    expectedRiskFlags,
    expectedNextAction,
    expectedStrategyOutcome,
    expectedReviewRequired,
    notes,
  } = fixture

  if (!isNonEmptyString(scenarioId)) errors.push("scenarioId must be a non-empty string.")
  if (!isNonEmptyString(name)) errors.push("name must be a non-empty string.")
  if (!isNonEmptyString(description)) errors.push("description must be a non-empty string.")
  if (!["STRONG_DEAL", "MARGINAL", "NO_DEAL"].includes(String(expectedClassification))) {
    errors.push("expectedClassification must be STRONG_DEAL, MARGINAL, or NO_DEAL.")
  }
  if (!PHASE2_GOVERNANCE_STATES.includes(expectedGovernanceState as never)) {
    errors.push(`expectedGovernanceState must be one of: ${PHASE2_GOVERNANCE_STATES.join(", ")}.`)
  }
  if (!PHASE2_NEXT_ACTIONS.includes(expectedNextAction as never)) {
    errors.push(`expectedNextAction must be one of: ${PHASE2_NEXT_ACTIONS.join(", ")}.`)
  }
  if (!["BRRR_OR_FLIP", "FLIP_ONLY_OR_RENEGOTIATE", "NO_DEAL"].includes(String(expectedStrategyOutcome))) {
    errors.push("expectedStrategyOutcome must match the current due-diligence engine strategy outputs.")
  }
  if (typeof expectedReviewRequired !== "boolean") {
    errors.push("expectedReviewRequired must be a boolean.")
  }
  if (!hasOnlyNonEmptyStrings(notes) || notes.length === 0) {
    errors.push("notes must be a non-empty string array.")
  }

  if (!Array.isArray(expectedRiskFlags)) {
    errors.push("expectedRiskFlags must be an array.")
  } else {
    const invalidFlags = expectedRiskFlags.filter(
      (flag) => !PHASE2_RISK_FLAGS.includes(flag as never)
    )
    const uniqueFlags = new Set(expectedRiskFlags)

    if (invalidFlags.length > 0) {
      errors.push(`expectedRiskFlags contains unknown flags: ${invalidFlags.join(", ")}.`)
    }

    if (uniqueFlags.size !== expectedRiskFlags.length) {
      errors.push("expectedRiskFlags must not contain duplicates.")
    }
  }

  if (!isRecord(input)) {
    errors.push("input must be an object.")
  } else {
    const { dueDiligence, governanceSignals } = input

    if (!isRecord(dueDiligence)) {
      errors.push("input.dueDiligence must be an object.")
    } else {
      const dueDiligenceNumbers = [
        "purchasePrice",
        "gdvRealistic",
        "refurbCost",
        "stampDuty",
        "legalCosts",
        "saleCosts",
        "bridgeTermMonths",
        "bridgeInterestRateAnnual",
        "arrangementFeePercent",
        "exitFeePercent",
      ] as const

      for (const field of dueDiligenceNumbers) {
        if (!isFiniteNumber(dueDiligence[field])) {
          errors.push(`input.dueDiligence.${field} must be a finite number.`)
        }
      }

      if (
        dueDiligence.gdvDownside !== undefined &&
        !isFiniteNumber(dueDiligence.gdvDownside)
      ) {
        errors.push("input.dueDiligence.gdvDownside must be a finite number when provided.")
      }

      if (
        dueDiligence.gdvStrong !== undefined &&
        !isFiniteNumber(dueDiligence.gdvStrong)
      ) {
        errors.push("input.dueDiligence.gdvStrong must be a finite number when provided.")
      }
    }

    if (!isRecord(governanceSignals)) {
      errors.push("input.governanceSignals must be an object.")
    } else {
      if (!PHASE2_GDV_EVIDENCE_STRENGTHS.includes(governanceSignals.gdvEvidenceStrength as never)) {
        errors.push(
          `input.governanceSignals.gdvEvidenceStrength must be one of: ${PHASE2_GDV_EVIDENCE_STRENGTHS.join(", ")}.`
        )
      }
      if (!isFiniteNumber(governanceSignals.comparableCount) || governanceSignals.comparableCount < 0) {
        errors.push("input.governanceSignals.comparableCount must be a non-negative number.")
      }
      if (!PHASE2_COMPARABLE_COVERAGE.includes(governanceSignals.comparableCoverage as never)) {
        errors.push(
          `input.governanceSignals.comparableCoverage must be one of: ${PHASE2_COMPARABLE_COVERAGE.join(", ")}.`
        )
      }
      if (!PHASE2_REFURB_CONFIDENCE_LEVELS.includes(governanceSignals.refurbEstimateConfidence as never)) {
        errors.push(
          `input.governanceSignals.refurbEstimateConfidence must be one of: ${PHASE2_REFURB_CONFIDENCE_LEVELS.join(", ")}.`
        )
      }
      if (!PHASE2_STRUCTURAL_RISK_LEVELS.includes(governanceSignals.structuralRiskLevel as never)) {
        errors.push(
          `input.governanceSignals.structuralRiskLevel must be one of: ${PHASE2_STRUCTURAL_RISK_LEVELS.join(", ")}.`
        )
      }
      if (typeof governanceSignals.hotDealClaimed !== "boolean") {
        errors.push("input.governanceSignals.hotDealClaimed must be a boolean.")
      }
      if (!hasOnlyNonEmptyStrings(governanceSignals.manualReviewTriggers)) {
        errors.push("input.governanceSignals.manualReviewTriggers must be a string array.")
      }
      if (
        governanceSignals.legalEvidenceStrength !== undefined &&
        !PHASE2_GDV_EVIDENCE_STRENGTHS.includes(governanceSignals.legalEvidenceStrength as never)
      ) {
        errors.push(
          `input.governanceSignals.legalEvidenceStrength must be one of: ${PHASE2_GDV_EVIDENCE_STRENGTHS.join(", ")} when provided.`
        )
      }
      if (
        governanceSignals.exitStrategyPreference !== undefined &&
        !["BRRR", "FLIP", "BUY_TO_LET"].includes(String(governanceSignals.exitStrategyPreference))
      ) {
        errors.push(
          "input.governanceSignals.exitStrategyPreference must be BRRR, FLIP, or BUY_TO_LET when provided."
        )
      }
      if (!isOptionalFiniteNumber(governanceSignals.loanToValue)) {
        errors.push("input.governanceSignals.loanToValue must be a finite number when provided.")
      }
      if (
        isFiniteNumber(governanceSignals.loanToValue) &&
        (governanceSignals.loanToValue < 0 || governanceSignals.loanToValue > 1.5)
      ) {
        errors.push("input.governanceSignals.loanToValue must be between 0 and 1.5 when provided.")
      }
      if (!isOptionalBoolean(governanceSignals.hasLegalTitleRisk)) {
        errors.push("input.governanceSignals.hasLegalTitleRisk must be a boolean when provided.")
      }
      if (!isOptionalBoolean(governanceSignals.hasPlanningRisk)) {
        errors.push("input.governanceSignals.hasPlanningRisk must be a boolean when provided.")
      }
      if (!isOptionalBoolean(governanceSignals.hasRefinanceRisk)) {
        errors.push("input.governanceSignals.hasRefinanceRisk must be a boolean when provided.")
      }
      if (!isOptionalBoolean(governanceSignals.hasUnrealisticGdvRisk)) {
        errors.push("input.governanceSignals.hasUnrealisticGdvRisk must be a boolean when provided.")
      }
      if (!isOptionalBoolean(governanceSignals.hasMissingCriticalEvidence)) {
        errors.push("input.governanceSignals.hasMissingCriticalEvidence must be a boolean when provided.")
      }
      if (!isOptionalBoolean(governanceSignals.manualReviewRequested)) {
        errors.push("input.governanceSignals.manualReviewRequested must be a boolean when provided.")
      }
      if (
        governanceSignals.motivationSignals !== undefined &&
        !hasOnlyNonEmptyStrings(governanceSignals.motivationSignals)
      ) {
        errors.push("input.governanceSignals.motivationSignals must be a string array when provided.")
      }
      if (
        governanceSignals.listingSignals !== undefined &&
        !hasOnlyNonEmptyStrings(governanceSignals.listingSignals)
      ) {
        errors.push("input.governanceSignals.listingSignals must be a string array when provided.")
      }
    }
  }

  if (expectedGovernanceState === "PASS" && expectedReviewRequired) {
    errors.push("PASS fixtures must not require manual review.")
  }

  if (expectedGovernanceState === "MANUAL_REVIEW" && !expectedReviewRequired) {
    errors.push("MANUAL_REVIEW fixtures must set expectedReviewRequired=true.")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
