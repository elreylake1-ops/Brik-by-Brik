import { buildPhase2Analysis } from "@/lib/engine/intelligence/build-phase2-analysis"
import { mapPhase2FixtureToInput } from "@/lib/engine/intelligence/map-phase2-fixture-to-input"
import { validatePhase2Fixture } from "@/lib/validators/validate-phase2-fixture"
import { validatePhase2Output } from "@/lib/validators/validate-phase2-output"
import type { FinalDealClassification, GovernanceState, Phase2AnalysisOutput } from "@/types/phase2"
import type {
  Phase2EdgeCaseValidationResult,
  Phase2GovernanceOverrideValidationResult,
  Phase2NextAction,
  Phase2RiskFlag,
  Phase2ScenarioFixture,
  Phase2ScenarioValidationResult,
  Phase2ValidationRunResult,
} from "@/types/phase2-validation"

export const PHASE2_VALIDATION_GENERATED_AT = "2026-05-07T00:00:00.000Z"

const KNOWN_LIMITATIONS = [
  {
    code: "MANUAL_COMPARABLE_INPUT_ONLY",
    limitation: "Comparable evidence remains manual input only.",
    impact: "GDV quality depends on the operator supplying sold comparables.",
    recommendedRefinement: "Add sold-comparable ingestion and validation workflows in a later approved phase.",
  },
  {
    code: "NO_AUTOMATED_SOLD_PRICE_VALIDATION",
    limitation: "No automated sold-price validation exists yet.",
    impact: "The engine cannot independently verify claimed sold evidence.",
    recommendedRefinement: "Add deterministic sold-price cross-checks before Phase 3 approval.",
  },
  {
    code: "NO_AI_LISTING_EXTRACTION",
    limitation: "No AI listing extraction is implemented.",
    impact: "Listing and motivation signals depend on structured user input only.",
    recommendedRefinement: "Keep extraction manual unless a later approved phase explicitly permits AI.",
  },
  {
    code: "NO_LIVE_MARKET_INTEGRATIONS",
    limitation: "No live Rightmove, Zoopla, or Land Registry integration is implemented.",
    impact: "The engine cannot verify live market context in real time.",
    recommendedRefinement: "Add approved deterministic data integrations in a later phase if required.",
  },
  {
    code: "RULES_BASED_REFURB_ASSUMPTIONS",
    limitation: "Refurb estimation remains rules-based and assumption-driven.",
    impact: "Capex confidence still depends on user-supplied scope and evidence quality.",
    recommendedRefinement: "Expand builder-quote and scope validation rules in future calibration phases.",
  },
  {
    code: "GDV_CONFIDENCE_USER_DEPENDENT",
    limitation: "GDV confidence depends on user-provided evidence quality.",
    impact: "Weak or missing comparable evidence still requires manual challenge.",
    recommendedRefinement: "Add stronger comparable coverage and valuation challenge workflows.",
  },
  {
    code: "LEGAL_STRUCTURAL_USER_INDICATED",
    limitation: "Legal and structural risks are user-indicated, not independently verified.",
    impact: "The engine can block declared risks but cannot discover them autonomously.",
    recommendedRefinement: "Add approved survey/legal evidence intake rules before scaling progression.",
  },
  {
    code: "NO_PERSISTENT_ANALYSIS_HISTORY",
    limitation: "No persistent analysis history database exists yet.",
    impact: "Validation output is deterministic per run but not stored as historical deal memory.",
    recommendedRefinement: "Add persistence only in a later approved phase.",
  },
  {
    code: "NO_AUTOMATED_LENDER_VALIDATION",
    limitation: "No automated lender or refinance validation exists yet.",
    impact: "Leverage and refinance checks remain rules-based rather than lender-confirmed.",
    recommendedRefinement: "Add lender policy validation only if later approved.",
  },
] as const

function normalizeGovernanceState(
  value: Phase2ScenarioFixture["expectedGovernanceState"]
): GovernanceState {
  if (value === "BLOCK") return "BLOCKED"
  if (value === "MANUAL_REVIEW") return "REVIEW_REQUIRED"
  return "PASS"
}

function getExpectedFinalClassification(
  fixture: Phase2ScenarioFixture
): { summary: string; allowed: FinalDealClassification[] } {
  const normalizedGovernance = normalizeGovernanceState(fixture.expectedGovernanceState)

  if (normalizedGovernance === "BLOCKED") {
    return { summary: "NO_DEAL", allowed: ["NO_DEAL"] }
  }

  if (normalizedGovernance === "REVIEW_REQUIRED") {
    return { summary: "REVIEW_REQUIRED", allowed: ["REVIEW_REQUIRED"] }
  }

  if (fixture.expectedClassification === "STRONG_DEAL") {
    return { summary: "HOT_OR_WARM", allowed: ["HOT", "WARM"] }
  }

  if (fixture.expectedClassification === "MARGINAL") {
    return { summary: "MARGINAL", allowed: ["MARGINAL"] }
  }

  return { summary: "NO_DEAL", allowed: ["NO_DEAL"] }
}

function matchesExpectedRiskFlag(expectedFlag: Phase2RiskFlag, output: Phase2AnalysisOutput): boolean {
  const riskCodes = new Set(output.riskRadar.riskFlags.map((flag) => flag.code))
  const gateById = new Map(output.decisionGates.map((gate) => [gate.gateId, gate]))
  const hasNonPassGate = (gateId: string) => gateById.get(gateId)?.status !== "PASS"

  switch (expectedFlag) {
    case "Low profit margin":
      return (
        output.dealHeatScore.negativeSignals.some((signal) => signal.includes("margin")) ||
        hasNonPassGate("capital-protection")
      )
    case "Capital overexposure":
      return hasNonPassGate("capital-protection")
    case "High finance cost":
      return hasNonPassGate("finance-time-risk") || [...riskCodes].some((code) => code.startsWith("TIME_RISK_"))
    case "High refurb exposure":
      return riskCodes.has("REFURB_EXPOSURE_HIGH") || hasNonPassGate("refurb-exposure")
    case "Downside GDV creates a loss":
      return hasNonPassGate("downside-loss") || riskCodes.has("DOWNSIDE_FATAL_LOSS")
    case "Weak GDV evidence":
      return riskCodes.has("GDV_EVIDENCE_WEAK") || hasNonPassGate("gdv-evidence")
    case "False urgency / HOT deal unsupported":
      return riskCodes.has("FALSE_HOT_URGENCY")
    case "Structural / fatal risk":
      return output.governance.fatalRisk || riskCodes.has("STRUCTURAL_FATAL")
    case "Missing evidence":
      return (
        output.evidenceStatus.missingCriticalEvidence.length > 0 ||
        hasNonPassGate("missing-critical-evidence")
      )
    case "Manual review required":
      return output.governance.reviewRequired
    case "Missing comparables":
      return riskCodes.has("COMPARABLES_MISSING") || hasNonPassGate("comparable-evidence")
    case "Unrealistic GDV assumption":
      return (
        riskCodes.has("GDV_EVIDENCE_WEAK") ||
        riskCodes.has("COMPARABLES_THIN") ||
        hasNonPassGate("gdv-evidence")
      )
    case "Long bridge term":
      return [...riskCodes].some((code) => code.startsWith("TIME_RISK_")) || hasNonPassGate("finance-time-risk")
    default:
      return false
  }
}

function matchesExpectedNextAction(expectedAction: Phase2NextAction, output: Phase2AnalysisOutput): boolean {
  const actionIds = new Set(output.nextActions.map((action) => action.id))

  switch (expectedAction) {
    case "PROCEED":
      return actionIds.has("proceed-under-governance")
    case "PROCEED_WITH_CAUTION":
      return output.governance.state === "PASS" && !output.nextActions.some((action) => action.blocksOfferSubmission)
    case "RENEGOTIATE":
      return (
        actionIds.has("slow-urgency-pressure") ||
        actionIds.has("builder-scope-validation") ||
        actionIds.has("finance-timeline-review")
      )
    case "REQUEST_EVIDENCE":
      return (
        actionIds.has("obtain-comparables") ||
        actionIds.has("validate-gdv") ||
        actionIds.has("legal-title-review")
      )
    case "REQUEST_COMPARABLES":
      return actionIds.has("obtain-comparables")
    case "VERIFY_GDV":
      return actionIds.has("validate-gdv") || actionIds.has("verify-downside-gdv")
    case "TIGHTEN_FINANCE_ASSUMPTIONS":
      return (
        actionIds.has("tighten-finance-assumptions") ||
        actionIds.has("finance-timeline-review") ||
        actionIds.has("lender-refinance-validation")
      )
    case "COMMISSION_SURVEY":
      return output.governance.fatalRisk && actionIds.has("resolve-fatal-risk")
    case "REJECT":
      return output.governance.finalClassification === "NO_DEAL"
    default:
      return false
  }
}

function shouldCompareStrategy(output: Phase2AnalysisOutput): boolean {
  return output.governance.state === "PASS"
}

function matchesExpectedStrategy(fixture: Phase2ScenarioFixture, output: Phase2AnalysisOutput): boolean {
  if (!shouldCompareStrategy(output)) return true

  switch (fixture.expectedStrategyOutcome) {
    case "BRRR_OR_FLIP":
      return ["BRRR", "FLIP"].includes(output.strategyMatch.recommendedStrategy)
    case "FLIP_ONLY_OR_RENEGOTIATE":
      return output.strategyMatch.recommendedStrategy === "FLIP"
    case "NO_DEAL":
      return output.strategyMatch.recommendedStrategy === "NO_DEAL"
    default:
      return false
  }
}

function buildExpectedSummary(fixture: Phase2ScenarioFixture) {
  const expectedFinal = getExpectedFinalClassification(fixture)

  return {
    finalClassification: expectedFinal.summary,
    governanceState: normalizeGovernanceState(fixture.expectedGovernanceState),
    riskFlags: fixture.expectedRiskFlags,
    nextAction: fixture.expectedNextAction,
    strategyOutcome: fixture.expectedStrategyOutcome,
    reviewRequired: fixture.expectedReviewRequired,
  }
}

function buildActualSummary(output: Phase2AnalysisOutput) {
  return {
    finalClassification: output.governance.finalClassification,
    governanceState: output.governance.state,
    rawHeatScore: output.dealHeatScore.score,
    rawHeatBand: output.dealHeatScore.band,
    fatalRisk: output.governance.fatalRisk,
    overallRisk: output.riskRadar.overallRisk,
    strategyOutcome: output.strategyMatch.recommendedStrategy,
    nextAction: output.nextActions[0]?.id ?? null,
    reviewRequired: output.governance.reviewRequired,
    riskFlags: output.riskRadar.riskFlags.map((flag) => flag.label),
  }
}

function buildConsistencySnapshot(output: Phase2AnalysisOutput) {
  return {
    score: output.dealHeatScore.score,
    band: output.dealHeatScore.band,
    governanceState: output.governance.state,
    finalClassification: output.governance.finalClassification,
    fatalRisk: output.governance.fatalRisk,
    overallRisk: output.riskRadar.overallRisk,
    recommendedStrategy: output.strategyMatch.recommendedStrategy,
  }
}

function compareOutputs(
  fixture: Phase2ScenarioFixture,
  output: Phase2AnalysisOutput,
  outputValidationErrors: string[]
): Phase2ScenarioValidationResult {
  const failures: string[] = []
  const expected = buildExpectedSummary(fixture)
  const actual = buildActualSummary(output)
  const expectedFinal = getExpectedFinalClassification(fixture)

  if (!expectedFinal.allowed.includes(output.governance.finalClassification)) {
    failures.push(
      `Final classification expected ${expected.finalClassification} but got ${output.governance.finalClassification}.`
    )
  }

  if (output.governance.state !== expected.governanceState) {
    failures.push(
      `Governance state expected ${expected.governanceState} but got ${output.governance.state}.`
    )
  }

  if (output.governance.reviewRequired !== fixture.expectedReviewRequired) {
    failures.push(
      `reviewRequired expected ${fixture.expectedReviewRequired} but got ${output.governance.reviewRequired}.`
    )
  }

  for (const expectedRiskFlag of fixture.expectedRiskFlags) {
    if (!matchesExpectedRiskFlag(expectedRiskFlag, output)) {
      failures.push(`Expected risk flag not represented: ${expectedRiskFlag}.`)
    }
  }

  if (!matchesExpectedNextAction(fixture.expectedNextAction, output)) {
    failures.push(`Expected next action not represented: ${fixture.expectedNextAction}.`)
  }

  if (!matchesExpectedStrategy(fixture, output)) {
    failures.push(
      `Expected strategy outcome ${fixture.expectedStrategyOutcome} is not represented by ${output.strategyMatch.recommendedStrategy}.`
    )
  }

  failures.push(...outputValidationErrors.map((error) => `Output validation: ${error}`))

  return {
    scenarioId: fixture.scenarioId,
    name: fixture.name,
    pass: failures.length === 0,
    failures,
    expected,
    actual,
    actualOutput: output,
  }
}

function buildGovernanceOverrideResults(
  scenarioResults: Phase2ScenarioValidationResult[]
): Phase2GovernanceOverrideValidationResult[] {
  const targetIds = ["phase2-008", "phase2-009"]

  return scenarioResults
    .filter((result) => targetIds.includes(result.scenarioId) && result.actualOutput)
    .map((result) => {
      const output = result.actualOutput as Phase2AnalysisOutput
      const isFatalOverrideCase = result.scenarioId === "phase2-009"
      const pass = isFatalOverrideCase
        ? output.governance.fatalRisk &&
          output.governance.finalClassification === "NO_DEAL" &&
          output.governance.governanceOverrideApplied &&
          ["HOT", "WARM", "MARGINAL"].includes(output.governance.classificationBeforeGovernance ?? "")
        : ["HOT", "WARM"].includes(output.dealHeatScore.band) &&
          output.governance.state === "REVIEW_REQUIRED" &&
          output.governance.governanceOverrideApplied

      return {
        scenarioId: result.scenarioId,
        name: result.name,
        pass,
        rawHeatScore: output.dealHeatScore.score,
        rawHeatBand: output.dealHeatScore.band,
        governanceState: output.governance.state,
        finalClassification: output.governance.finalClassification,
        governanceOverrideApplied: output.governance.governanceOverrideApplied,
        fatalRisk: output.governance.fatalRisk,
        explanation: output.investorSummary.headline,
      }
    })
}

function buildEdgeCaseResults(
  scenarioResults: Phase2ScenarioValidationResult[]
): Phase2EdgeCaseValidationResult[] {
  const getOutput = (scenarioId: string) =>
    scenarioResults.find((result) => result.scenarioId === scenarioId)?.actualOutput ?? null

  const zeroRefurb = getOutput("phase2-014")
  const missingComparables = getOutput("phase2-011")
  const unrealisticGdv = getOutput("phase2-012")
  const longBridge = getOutput("phase2-013")
  const highLeverage = getOutput("phase2-015")
  const negativeProfit = getOutput("phase2-003")

  return [
    {
      caseId: "zero-refurb-safe-execution",
      scenarioId: "phase2-014",
      pass: Boolean(
        zeroRefurb &&
          Number.isFinite(zeroRefurb.dealHeatScore.score) &&
          zeroRefurb.governance.fatalRisk === false
      ),
      explanation:
        zeroRefurb?.investorSummary.headline ?? "Zero refurb case failed to produce a valid governance output.",
    },
    {
      caseId: "missing-comparables-not-clean-hot",
      scenarioId: "phase2-011",
      pass: Boolean(
        missingComparables &&
          missingComparables.governance.state !== "PASS" &&
          missingComparables.governance.finalClassification !== "HOT" &&
          missingComparables.nextActions.some((action) => action.id === "obtain-comparables")
      ),
      explanation:
        missingComparables?.investorSummary.headline ??
        "Missing comparable case did not produce the expected evidence challenge output.",
    },
    {
      caseId: "unrealistic-gdv-risk-created",
      scenarioId: "phase2-012",
      pass: Boolean(
        unrealisticGdv &&
          unrealisticGdv.governance.state !== "PASS" &&
          unrealisticGdv.riskRadar.riskFlags.some(
            (flag) => flag.code === "GDV_EVIDENCE_WEAK" || flag.code === "COMPARABLES_THIN"
          )
      ),
      explanation:
        unrealisticGdv?.investorSummary.headline ??
        "Unrealistic GDV case did not surface valuation risk cleanly.",
    },
    {
      caseId: "long-bridge-time-risk-created",
      scenarioId: "phase2-013",
      pass: Boolean(
        longBridge &&
          longBridge.riskRadar.riskFlags.some((flag) => flag.code.startsWith("TIME_RISK_")) &&
          longBridge.nextActions.some((action) => action.id === "finance-timeline-review")
      ),
      explanation:
        longBridge?.investorSummary.headline ?? "Long bridge case did not create the expected time-risk output.",
    },
    {
      caseId: "high-leverage-review-risk-created",
      scenarioId: "phase2-015",
      pass: Boolean(
        highLeverage &&
          highLeverage.riskRadar.riskFlags.some((flag) => flag.code === "LEVERAGE_HIGH") &&
          highLeverage.nextActions.some((action) => action.id === "lender-refinance-validation")
      ),
      explanation:
        highLeverage?.investorSummary.headline ??
        "High leverage case did not create the expected leverage validation output.",
    },
    {
      caseId: "negative-profit-blocks-capital-protection",
      scenarioId: "phase2-003",
      pass: Boolean(
        negativeProfit &&
          negativeProfit.governance.finalClassification === "NO_DEAL" &&
          negativeProfit.decisionGates.some(
            (gate) => gate.gateId === "capital-protection" && gate.status === "FAIL"
          )
      ),
      explanation:
        negativeProfit?.investorSummary.headline ??
        "Negative profit case did not fail capital protection as expected.",
    },
  ]
}

export function runPhase2Validation(
  fixtures: Phase2ScenarioFixture[]
): Phase2ValidationRunResult {
  const scenarioResults: Phase2ScenarioValidationResult[] = []
  const consistencyResults: Phase2ValidationRunResult["consistencyResults"] = []

  for (const fixture of fixtures) {
    const fixtureValidation = validatePhase2Fixture(fixture)

    if (!fixtureValidation.valid) {
      scenarioResults.push({
        scenarioId: fixture.scenarioId,
        name: fixture.name,
        pass: false,
        failures: fixtureValidation.errors.map((error) => `Fixture validation: ${error}`),
        expected: buildExpectedSummary(fixture),
        actual: null,
        actualOutput: null,
      })
      continue
    }

    const input = mapPhase2FixtureToInput(fixture)
    const runs = [buildPhase2Analysis(input), buildPhase2Analysis(input), buildPhase2Analysis(input)]
    const snapshots = runs.map(buildConsistencySnapshot)
    const baseline = JSON.stringify(snapshots[0])
    const driftFields = snapshots.flatMap((snapshot, index) => {
      if (index === 0) return []

      const fields = Object.entries(snapshot).flatMap(([field, value]) =>
        JSON.stringify(value) === JSON.stringify(snapshots[0][field as keyof typeof snapshot])
          ? []
          : [field]
      )

      return fields
    })
    const uniqueDriftFields = [...new Set(driftFields)]

    consistencyResults.push({
      scenarioId: fixture.scenarioId,
      name: fixture.name,
      consistent: snapshots.every((snapshot) => JSON.stringify(snapshot) === baseline),
      driftFields: uniqueDriftFields,
      runs: snapshots,
    })

    const output = runs[0]
    const outputValidation = validatePhase2Output(output)
    const scenarioResult = compareOutputs(
      fixture,
      output,
      outputValidation.valid ? [] : outputValidation.errors
    )

    if (uniqueDriftFields.length > 0) {
      scenarioResult.pass = false
      scenarioResult.failures.push(
        `Determinism drift detected across repeated runs: ${uniqueDriftFields.join(", ")}.`
      )
    }

    scenarioResults.push(scenarioResult)
  }

  const governanceOverrideResults = buildGovernanceOverrideResults(scenarioResults)
  const edgeCaseResults = buildEdgeCaseResults(scenarioResults)
  const passed = scenarioResults.filter((result) => result.pass).length
  const failed = scenarioResults.length - passed
  const engineVersion =
    scenarioResults.find((result) => result.actualOutput)?.actualOutput?.metadata.engineVersion ??
    "2.0.0-intelligence"

  return {
    generatedAt: PHASE2_VALIDATION_GENERATED_AT,
    engineVersion,
    totalScenarios: fixtures.length,
    passed,
    failed,
    scenarioResults,
    consistencyResults,
    governanceOverrideResults,
    edgeCaseResults,
  }
}

export function buildPhase2StressTestResultsJson(
  result: Phase2ValidationRunResult
) {
  return {
    generatedAt: result.generatedAt,
    engineVersion: result.engineVersion,
    totalScenarios: result.totalScenarios,
    passed: result.passed,
    failed: result.failed,
    scenarioResults: result.scenarioResults.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      name: scenario.name,
      pass: scenario.pass,
      failures: scenario.failures,
      expected: scenario.expected,
      actual: scenario.actual,
    })),
    consistencyResults: result.consistencyResults,
    governanceOverrideResults: result.governanceOverrideResults,
    edgeCaseResults: result.edgeCaseResults,
  }
}

export function buildPhase2KnownLimitationsMarkdown(): string {
  return [
    "# Phase 2 Known Limitations",
    "",
    "These limitations remain open after Phase 2E and must stay visible before any Phase 3 discussion.",
    "",
    ...KNOWN_LIMITATIONS.flatMap((entry) => [
      `## ${entry.code}`,
      "",
      `- Limitation: ${entry.limitation}`,
      `- Impact: ${entry.impact}`,
      `- Recommended refinement: ${entry.recommendedRefinement}`,
      "",
    ]),
  ].join("\n")
}

export function buildPhase2StressTestReportMarkdown(
  result: Phase2ValidationRunResult
): string {
  const scenarioRows = result.scenarioResults.map((scenario) => {
    const actual = scenario.actual

    return `| ${scenario.name} | ${scenario.expected.governanceState} / ${scenario.expected.finalClassification} | ${actual?.governanceState ?? "N/A"} / ${actual?.finalClassification ?? "N/A"} | ${scenario.pass ? "PASS" : "FAIL"} | ${scenario.failures.length === 0 ? "None" : scenario.failures.join("; ")} |`
  })
  const overrideRows = result.governanceOverrideResults.map(
    (entry) =>
      `| ${entry.name} | ${entry.rawHeatScore} (${entry.rawHeatBand}) | ${entry.governanceState} | ${entry.finalClassification} | ${entry.governanceOverrideApplied ? "Yes" : "No"} | ${entry.pass ? "PASS" : "FAIL"} |`
  )
  const consistencyRows = result.consistencyResults.map(
    (entry) =>
      `| ${entry.name} | ${entry.consistent ? "PASS" : "FAIL"} | ${entry.driftFields.length === 0 ? "None" : entry.driftFields.join(", ")} |`
  )
  const edgeRows = result.edgeCaseResults.map(
    (entry) => `| ${entry.caseId} | ${entry.scenarioId} | ${entry.pass ? "PASS" : "FAIL"} | ${entry.explanation} |`
  )

  return [
    "# Phase 2 Stress Test Report",
    "",
    "## Purpose",
    "",
    "Phase 2E runs all 15 stress fixtures through the completed deterministic Phase 2 engine to prove consistency, capital protection, explainability, and governance override behavior before any Phase 3 discussion.",
    "",
    "## Engine Execution Order",
    "",
    "1. Validate Phase 2 fixture shape.",
    "2. Map fixture input into Phase 2 intelligence input.",
    "3. Run `buildPhase2Analysis()`.",
    "4. Validate `Phase2AnalysisOutput` structure.",
    "5. Re-run identical input three times to prove deterministic output stability.",
    "6. Compare expected vs actual governance, classification, risk, action, strategy, and review state.",
    "",
    "## Scenario Table",
    "",
    `- Total scenarios: ${result.totalScenarios}`,
    `- Passed: ${result.passed}`,
    `- Failed: ${result.failed}`,
    "",
    "| Scenario | Expected Governance / Final | Actual Governance / Final | Result | Notes |",
    "| --- | --- | --- | --- | --- |",
    ...scenarioRows,
    "",
    "## Expected vs Actual Summary",
    "",
    ...result.scenarioResults.flatMap((scenario) => [
      `### ${scenario.name}`,
      "",
      `- Expected: ${scenario.expected.governanceState}, ${scenario.expected.finalClassification}, next action ${scenario.expected.nextAction}.`,
      scenario.actual
        ? `- Actual: ${scenario.actual.governanceState}, ${scenario.actual.finalClassification}, raw ${scenario.actual.rawHeatScore}/${scenario.actual.rawHeatBand}, next action ${scenario.actual.nextAction ?? "none"}.`
        : "- Actual: output not produced.",
      `- Result: ${scenario.pass ? "PASS" : "FAIL"}`,
      ...(scenario.failures.length > 0
        ? scenario.failures.map((failure) => `- Failure: ${failure}`)
        : ["- Failure: none"]),
      "",
    ]),
    "## Pass/Fail Matrix",
    "",
    "| Scenario | Result |",
    "| --- | --- |",
    ...result.scenarioResults.map((scenario) => `| ${scenario.name} | ${scenario.pass ? "PASS" : "FAIL"} |`),
    "",
    "## Governance Override Proof",
    "",
    "| Scenario | Raw Heat | Governance State | Final Classification | Override Applied | Result |",
    "| --- | --- | --- | --- | --- | --- |",
    ...overrideRows,
    "",
    "## Consistency Testing Proof",
    "",
    "| Scenario | Deterministic Across 3 Runs | Drift Fields |",
    "| --- | --- | --- |",
    ...consistencyRows,
    "",
    "## Edge-Case Testing Proof",
    "",
    "| Case | Scenario | Result | Explanation |",
    "| --- | --- | --- | --- |",
    ...edgeRows,
    "",
    "## Known Limitations",
    "",
    ...KNOWN_LIMITATIONS.map(
      (entry) => `- ${entry.code}: ${entry.limitation} ${entry.impact}`
    ),
    "",
    "## Recommended Refinements Before Phase 3",
    "",
    "- Review any failing scenario rows before client acceptance.",
    "- Calibrate raw heat scoring where the pass-state matrix still diverges from conservative fixture intent.",
    "- Consider whether weak or stretched GDV scenarios need stronger governance escalation in a later approved phase.",
    "- Keep Phase 3 blocked until the client accepts this validation package.",
    "",
  ].join("\n")
}
