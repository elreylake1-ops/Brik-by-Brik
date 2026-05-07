import type {
  AssumptionLogEntry,
  FinalDealClassification,
  KnownLimitationOutput,
  ManualOverrideTrace,
  Phase2AnalysisOutput,
} from "@/types/phase2"
import type { Phase2IntelligenceInput } from "@/types/phase2-intelligence"
import { applyGovernance } from "@/lib/engine/governance/apply-governance"
import { calculateDealHeatScore } from "@/lib/engine/intelligence/deal-heat-score-engine"
import { buildInvestorSummary } from "@/lib/engine/intelligence/investor-summary-engine"
import { buildNextActions } from "@/lib/engine/intelligence/next-action-priority-engine"
import { evaluateNegotiationPosition } from "@/lib/engine/intelligence/negotiation-position-engine"
import { buildRiskRadar } from "@/lib/engine/intelligence/risk-radar-engine"
import { matchStrategy } from "@/lib/engine/intelligence/strategy-match-engine"
import { evaluateTimeRisk } from "@/lib/engine/intelligence/time-risk-engine"

function mapBandToRawClassification(band: Phase2AnalysisOutput["dealHeatScore"]["band"]): FinalDealClassification {
  if (band === "HOT") return "HOT"
  if (band === "WARM") return "WARM"
  if (band === "MARGINAL") return "MARGINAL"
  return "NO_DEAL"
}

function buildAnalysisId(input: Phase2IntelligenceInput): string {
  if (input.scenarioId) return `phase2-${input.scenarioId}`

  return [
    "phase2",
    input.purchasePrice,
    input.gdvRealistic,
    input.refurbCost,
    input.bridgeTermMonths ?? "na",
    input.comparablesCount ?? "na",
  ].join("-")
}

function buildAssumptions(input: Phase2IntelligenceInput): AssumptionLogEntry[] {
  const assumptions: AssumptionLogEntry[] = []

  if (input.gdvDownside === undefined) {
    assumptions.push({
      id: "asm-gdv-downside-default",
      field: "gdvDownside",
      assumedValue: input.gdvRealistic * 0.9,
      reason: "No explicit downside GDV was supplied.",
      impact: "Downside resilience uses a deterministic 90% fallback.",
      confidence: "MEDIUM",
    })
  }

  if (input.gdvStrong === undefined) {
    assumptions.push({
      id: "asm-gdv-strong-default",
      field: "gdvStrong",
      assumedValue: input.gdvRealistic * 1.1,
      reason: "No explicit strong GDV was supplied.",
      impact: "Upside view uses a deterministic 110% fallback.",
      confidence: "MEDIUM",
    })
  }

  if (input.financeCost === undefined && input.bridgeTermMonths !== undefined) {
    assumptions.push({
      id: "asm-finance-estimate",
      field: "financeCost",
      assumedValue: "estimated-from-bridge-term",
      reason: "Explicit finance cost was not supplied.",
      impact: "Profitability and capital usage rely on deterministic finance estimation.",
      confidence: "LOW",
    })
  }

  return assumptions
}

function buildLimitations(): KnownLimitationOutput[] {
  return [
    {
      code: "PHASE2D_RAW_SCORE_NON_FINAL",
      limitation: "Raw heat scoring is non-final.",
      impact: "Final classification still belongs to governance.",
      recommendedRefinement: "Keep calibrating score bands against fixture matrix in Phase 2E.",
    },
    {
      code: "PHASE2D_NO_RENTAL_MODEL",
      limitation: "BUY_TO_LET viability is not deeply modeled.",
      impact: "Strategy engine avoids overclaiming BTL suitability.",
      recommendedRefinement: "Add rental and refinance evidence model in later phase if approved.",
    },
  ]
}

export function buildPhase2Analysis(input: Phase2IntelligenceInput): Phase2AnalysisOutput {
  const negotiation = evaluateNegotiationPosition(input)
  const heatScore = calculateDealHeatScore(input)
  const rawClassification = mapBandToRawClassification(heatScore.band)
  const governanceResult = applyGovernance({
    ...input,
    rawHeatScore: heatScore.score,
    rawClassification,
  })
  const timeRisk = evaluateTimeRisk(input.bridgeTermMonths, governanceResult.metrics.refurbExposure)
  const riskRadar = buildRiskRadar(input, governanceResult, timeRisk, negotiation)
  const strategyMatch = matchStrategy(input, governanceResult, heatScore, timeRisk)
  const nextActions = buildNextActions(input, governanceResult, timeRisk, negotiation)
  const investorSummary = buildInvestorSummary(
    governanceResult,
    heatScore,
    riskRadar,
    strategyMatch,
    governanceResult.evidenceStatus,
    nextActions
  )

  const overrides: ManualOverrideTrace[] = []

  return {
    metadata: {
      analysisId: buildAnalysisId(input),
      engineVersion: "2.0.0-intelligence",
      createdAt: "2026-01-01T00:00:00.000Z",
      deterministic: true,
      source: "PHASE_2_ENGINE",
      scenarioId: input.scenarioId,
      notes: [
        "Phase 2D deterministic intelligence output.",
        "Governance remains final authority over classification.",
      ],
    },
    dealHeatScore: heatScore,
    riskRadar,
    strategyMatch,
    governance: governanceResult.governance,
    investorSummary,
    decisionGates: governanceResult.decisionGates,
    evidenceStatus: governanceResult.evidenceStatus,
    dataConfidence: governanceResult.dataConfidence,
    nextActions,
    assumptions: buildAssumptions(input),
    overrides,
    limitations: buildLimitations(),
  }
}
