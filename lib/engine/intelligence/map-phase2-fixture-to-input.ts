import { calculateDueDiligence } from "@/lib/engine/due-diligence-engine"
import type { GovernanceEvidenceStrength } from "@/types/phase2-governance"
import type { Phase2IntelligenceInput } from "@/types/phase2-intelligence"
import type { Phase2RefurbConfidenceLevel, Phase2ScenarioFixture } from "@/types/phase2-validation"

function mapRefurbConfidenceToEvidenceStrength(
  value: Phase2RefurbConfidenceLevel
): GovernanceEvidenceStrength {
  if (value === "HIGH") return "STRONG"
  if (value === "MEDIUM") return "MODERATE"
  return "WEAK"
}

export function mapPhase2FixtureToInput(
  fixture: Phase2ScenarioFixture
): Phase2IntelligenceInput {
  const { dueDiligence, governanceSignals } = fixture.input
  const dueDiligenceResult = calculateDueDiligence(dueDiligence)
  const listingSignals =
    governanceSignals.listingSignals ??
    (governanceSignals.hotDealClaimed ? ["hot deal claimed"] : [])

  return {
    scenarioId: fixture.scenarioId,
    purchasePrice: dueDiligence.purchasePrice,
    gdvRealistic: dueDiligence.gdvRealistic,
    gdvDownside: dueDiligence.gdvDownside,
    gdvStrong: dueDiligence.gdvStrong,
    refurbCost: dueDiligence.refurbCost,
    financeCost: dueDiligenceResult.finance.totalFinanceCost,
    bridgeTermMonths: dueDiligence.bridgeTermMonths,
    loanToValue: governanceSignals.loanToValue,
    comparablesCount: governanceSignals.comparableCount,
    gdvEvidenceStrength: governanceSignals.gdvEvidenceStrength,
    refurbEvidenceStrength: mapRefurbConfidenceToEvidenceStrength(
      governanceSignals.refurbEstimateConfidence
    ),
    legalEvidenceStrength: governanceSignals.legalEvidenceStrength ?? "STRONG",
    hasStructuralRisk: governanceSignals.structuralRiskLevel === "FATAL",
    hasLegalTitleRisk: governanceSignals.hasLegalTitleRisk,
    hasPlanningRisk: governanceSignals.hasPlanningRisk,
    hasRefinanceRisk: governanceSignals.hasRefinanceRisk,
    hasMissingCriticalEvidence: governanceSignals.hasMissingCriticalEvidence,
    manualReviewRequested:
      governanceSignals.manualReviewRequested ??
      governanceSignals.manualReviewTriggers.length > 0,
    motivationSignals: governanceSignals.motivationSignals,
    listingSignals,
    exitStrategyPreference: governanceSignals.exitStrategyPreference,
  }
}
