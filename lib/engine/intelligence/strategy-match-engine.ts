import type { StrategyMatchOutput, Phase2Strategy } from "@/types/phase2"
import type { ApplyGovernanceResult } from "@/types/phase2-governance"
import type { DealHeatScoreOutput } from "@/types/phase2"
import type { Phase2IntelligenceInput, TimeRiskResult } from "@/types/phase2-intelligence"

function reject(strategy: Phase2Strategy, reason: string): StrategyMatchOutput["rejectedStrategies"][number] {
  return { strategy, reason }
}

export function matchStrategy(
  input: Phase2IntelligenceInput,
  governanceResult: ApplyGovernanceResult,
  heatScore: DealHeatScoreOutput,
  timeRisk: TimeRiskResult
): StrategyMatchOutput {
  if (governanceResult.governance.finalClassification === "NO_DEAL") {
    return {
      recommendedStrategy: "NO_DEAL",
      viableStrategies: [],
      rejectedStrategies: [
        reject("BRRR", "Governance blocked progression."),
        reject("FLIP", "Governance blocked progression."),
        reject("BUY_TO_LET", "Governance blocked progression."),
      ],
      explanation: "Strategy is NO_DEAL because governance blocked the case.",
    }
  }

  const rejectedStrategies: StrategyMatchOutput["rejectedStrategies"] = []
  const viableStrategies: Phase2Strategy[] = []
  const metrics = governanceResult.metrics
  const realisticMargin =
    metrics.realisticProfit !== null && input.gdvRealistic > 0
      ? metrics.realisticProfit / input.gdvRealistic
      : 0

  const brrrViable =
    !input.hasRefinanceRisk &&
    (input.comparablesCount ?? 0) >= 3 &&
    input.gdvEvidenceStrength === "STRONG" &&
    (metrics.refurbExposure ?? 0) <= 0.25 &&
    realisticMargin >= 0.15

  const flipViable =
    realisticMargin > 0 &&
    timeRisk.severity !== "FATAL" &&
    !input.hasPlanningRisk &&
    !input.hasLegalTitleRisk

  if (brrrViable) viableStrategies.push("BRRR")
  else rejectedStrategies.push(reject("BRRR", "BRRR needs stronger refinance path, evidence, and manageable exposure."))

  if (flipViable) viableStrategies.push("FLIP")
  else rejectedStrategies.push(reject("FLIP", "Flip needs positive margin, clean execution path, and manageable time risk."))

  rejectedStrategies.push(
    reject("BUY_TO_LET", "Phase 2D does not model rental evidence deeply enough to claim BUY_TO_LET viability.")
  )

  if (governanceResult.governance.state === "REVIEW_REQUIRED") {
    return {
      recommendedStrategy: "MANUAL_REVIEW",
      viableStrategies,
      rejectedStrategies,
      explanation: "Potential strategies exist, but governance requires review before any strategy can be approved.",
    }
  }

  let recommendedStrategy: StrategyMatchOutput["recommendedStrategy"] = "FLIP"

  if (input.exitStrategyPreference && viableStrategies.includes(input.exitStrategyPreference)) {
    recommendedStrategy = input.exitStrategyPreference
  } else if (brrrViable && (heatScore.band === "HOT" || heatScore.band === "WARM")) {
    recommendedStrategy = "BRRR"
  } else if (!flipViable && brrrViable) {
    recommendedStrategy = "BRRR"
  }

  return {
    recommendedStrategy,
    viableStrategies,
    rejectedStrategies,
    explanation:
      recommendedStrategy === "BRRR"
        ? "BRRR is recommended because refinance viability, evidence quality, and margin are acceptable."
        : "FLIP is recommended because it is the clearest viable exit under the current evidence set.",
  }
}
