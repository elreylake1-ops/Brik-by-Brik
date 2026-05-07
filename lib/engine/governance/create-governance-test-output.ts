import type { Phase2AnalysisOutput, Phase2Strategy } from "@/types/phase2"
import type { ApplyGovernanceResult, Phase2GovernanceInput } from "@/types/phase2-governance"

type GovernanceTestOutputOptions = {
  analysisId?: string
  engineVersion?: string
  createdAt?: string
}

function inferBand(input: Phase2GovernanceInput): Phase2AnalysisOutput["dealHeatScore"]["band"] {
  if (input.rawClassification === "HOT") return "HOT"
  if (input.rawClassification === "WARM") return "WARM"
  if (input.rawClassification === "MARGINAL") return "MARGINAL"

  const score = input.rawHeatScore ?? 0
  if (score >= 80) return "HOT"
  if (score >= 65) return "WARM"
  if (score >= 50) return "MARGINAL"
  return "COLD"
}

function inferStrategy(result: ApplyGovernanceResult): Phase2Strategy {
  if (result.governance.state === "BLOCKED") return "NO_DEAL"
  if (result.governance.state === "REVIEW_REQUIRED") return "MANUAL_REVIEW"
  return "FLIP"
}

export function createGovernanceTestOutput(
  input: Phase2GovernanceInput,
  result: ApplyGovernanceResult,
  options: GovernanceTestOutputOptions = {}
): Phase2AnalysisOutput {
  const band = inferBand(input)
  const score = input.rawHeatScore ?? 0
  const recommendedStrategy = inferStrategy(result)

  return {
    metadata: {
      analysisId: options.analysisId ?? input.scenarioId ?? "phase2-governance-test",
      engineVersion: options.engineVersion ?? "2.0.0-governance",
      createdAt: options.createdAt ?? "2026-01-01T00:00:00.000Z",
      deterministic: true,
      source: "PHASE_2_ENGINE",
      scenarioId: input.scenarioId,
      notes: ["Governance-only scaffold output for Phase 2C tests."],
    },
    dealHeatScore: {
      score,
      band,
      positiveSignals: [],
      negativeSignals: result.reviewReasons,
      deductions: result.fatalReasons,
      explanation: "Placeholder heat-score section for governance tests only. No scoring engine runs here.",
    },
    riskRadar: result.riskRadar,
    strategyMatch: {
      recommendedStrategy,
      viableStrategies: recommendedStrategy === "FLIP" ? ["FLIP"] : [],
      rejectedStrategies:
        recommendedStrategy === "NO_DEAL"
          ? [
              { strategy: "BRRR", reason: "Governance blocked progression." },
              { strategy: "FLIP", reason: "Governance blocked progression." },
              { strategy: "BUY_TO_LET", reason: "Governance blocked progression." },
            ]
          : [],
      explanation: "Placeholder strategy section for governance tests only. No strategy engine runs here.",
    },
    governance: result.governance,
    investorSummary: {
      headline:
        result.governance.state === "BLOCKED"
          ? "Governance blocked deal."
          : result.governance.state === "REVIEW_REQUIRED"
            ? "Governance requires review."
            : "Governance passed deal.",
      summary: result.governance.explanation,
      decision: result.governance.finalClassification,
      keyReasons:
        result.fatalReasons.length > 0
          ? result.fatalReasons
          : result.reviewReasons.length > 0
            ? result.reviewReasons
            : ["No fatal or review blocker identified."],
      keyRisks: result.riskRadar.riskFlags.map((flag) => flag.label),
      recommendedNextStep:
        result.governance.state === "BLOCKED"
          ? "Do not proceed until blocker is cleared."
          : result.governance.state === "REVIEW_REQUIRED"
            ? "Complete review before progression."
            : "Proceed under existing classification.",
      investorWarnings:
        result.governance.governanceOverrideApplied
          ? ["Governance overrode raw classification."]
          : [],
    },
    decisionGates: result.decisionGates,
    evidenceStatus: result.evidenceStatus,
    dataConfidence: result.dataConfidence,
    nextActions: [
      {
        id: "governance-next-step",
        priority:
          result.governance.state === "BLOCKED"
            ? "URGENT"
            : result.governance.state === "REVIEW_REQUIRED"
              ? "HIGH"
              : "LOW",
        action:
          result.governance.state === "BLOCKED"
            ? "Resolve blocker or reject deal."
            : result.governance.state === "REVIEW_REQUIRED"
              ? "Complete manual review."
              : "Proceed with current governance status.",
        owner: "analyst",
        reason: result.governance.explanation,
        blocksOfferSubmission: result.governance.state !== "PASS",
      },
    ],
    assumptions: [],
    overrides: [],
    limitations: [
      {
        code: "PHASE2C_GOVERNANCE_TEST_SCAFFOLD",
        limitation: "Output is scaffolded for governance tests.",
        impact: "Heat score, strategy, and investor summary are placeholders in this helper.",
        recommendedRefinement: "Replace placeholders when Phase 2D intelligence modules exist.",
      },
    ],
  }
}
