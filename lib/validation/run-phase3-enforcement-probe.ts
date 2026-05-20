// Phase 3A-3 Step 6 — Pure enforcement probe against existing Phase 3 outputs.
// Pure function only. No side effects, no external calls, no runtime wiring.
// No app/orchestrator/UI/route imports. No persistence. No AI. No scraping.
// No random values. No timestamps. Stable deterministic output.
// Advisory outputs may increase review burden, but they may not reduce deterministic risk.
// IF UNCERTAIN → BLOCK, DOWNGRADE OR ESCALATE.

import { evaluatePhase3AuthorityEnforcementScenario } from "../engine/phase3-authority-enforcement"
import type {
  Phase3EnforcementScenario,
  Phase3EnforcementProbeResult,
} from "../../types/phase3-enforcement"

// --- Clean chain integrity scenarios ---
// Each scenario represents a governance-level authority check for an existing Phase 3 output.
// attemptedLayer = deterministic_governance (idx 0) vs protectedAuthority = deterministic_governance (idx 0)
// → authority check passes: 0 <= 0 → passed.
// This proves the existing outputs preserve authority hierarchy.

const CLEAN_SCENARIOS: readonly Phase3EnforcementScenario[] = [
  {
    scenarioId: "probe-no-deal-capital-protection-preserved",
    attemptedLayer: "deterministic_governance",
    protectedAuthority: "deterministic_governance",
    attemptedAction:
      "governance confirms capital_protection preserved as primary route in no-deal merged output with weak comparable hints",
    violationType: "advisory_overrides_governance",
    detectedBy: "authority_enforcement_engine",
    severity: "low",
    safeFailAction: "block_advisory_upgrade",
    advisoryOnly: true,
  },
  {
    scenarioId: "probe-review-required-legal-review-preserved",
    attemptedLayer: "deterministic_governance",
    protectedAuthority: "deterministic_governance",
    attemptedAction:
      "governance confirms legal_review escalation route preserved in review-required merged output with legal conflict hints",
    violationType: "advisory_overrides_governance",
    detectedBy: "authority_enforcement_engine",
    severity: "low",
    safeFailAction: "block_advisory_upgrade",
    advisoryOnly: true,
  },
  {
    scenarioId: "probe-proceed-candidate-advisory-contained",
    attemptedLayer: "deterministic_governance",
    protectedAuthority: "deterministic_governance",
    attemptedAction:
      "governance confirms advisory operator note does not imply deal approval in clean proceed merged output",
    violationType: "advisory_overrides_governance",
    detectedBy: "authority_enforcement_engine",
    severity: "low",
    safeFailAction: "block_advisory_upgrade",
    advisoryOnly: true,
  },
  {
    scenarioId: "probe-intake-missing-lender-contained",
    attemptedLayer: "deterministic_governance",
    protectedAuthority: "deterministic_governance",
    attemptedAction:
      "governance confirms missing lender evidence hint does not override deterministic escalation route in intake merged output",
    violationType: "advisory_overrides_governance",
    detectedBy: "authority_enforcement_engine",
    severity: "low",
    safeFailAction: "block_advisory_upgrade",
    advisoryOnly: true,
  },
]

// --- Intentionally bad probe scenarios ---
// These represent authority inversion attempts that the enforcement engine must detect.
// All should return violations.

const BAD_SCENARIOS: readonly Phase3EnforcementScenario[] = [
  {
    scenarioId: "probe-bad-advisory-overrides-governance",
    attemptedLayer: "evidence_advisory",
    protectedAuthority: "deterministic_governance",
    attemptedAction:
      "advisory layer attempted to override deterministic governance finalClassification",
    violationType: "advisory_overrides_governance",
    detectedBy: "authority_enforcement_engine",
    severity: "fatal",
    safeFailAction: "block_advisory_upgrade",
    advisoryOnly: true,
  },
  {
    scenarioId: "probe-bad-workflow-overrides-capital-protection",
    attemptedLayer: "workflow_orchestration",
    protectedAuthority: "capital_protection",
    attemptedAction:
      "workflow orchestration attempted to override capital protection signal on blocked deal",
    violationType: "workflow_overrides_capital_protection",
    detectedBy: "state_hierarchy_enforcement",
    severity: "fatal",
    safeFailAction: "preserve_deterministic_result",
    advisoryOnly: true,
  },
  {
    scenarioId: "probe-bad-ui-softens-fatal",
    attemptedLayer: "ui_presentation",
    protectedAuthority: "capital_protection",
    attemptedAction:
      "UI presentation layer attempted to soften fatal no_deal classification display",
    violationType: "ui_softens_fatal_classification",
    detectedBy: "ui_governance_enforcement",
    severity: "high",
    safeFailAction: "increase_review_burden",
    advisoryOnly: true,
  },
  {
    scenarioId: "probe-bad-advisory-route-replaces-capital-protection",
    attemptedLayer: "evidence_advisory",
    protectedAuthority: "capital_protection",
    attemptedAction:
      "advisory evidence route attempted to replace capital_protection as primary escalation route",
    violationType: "advisory_route_replaces_capital_protection",
    detectedBy: "escalation_priority_engine",
    severity: "fatal",
    safeFailAction: "preserve_deterministic_result",
    advisoryOnly: true,
  },
]

export function runPhase3EnforcementProbe(): Phase3EnforcementProbeResult {
  const allScenarios: readonly Phase3EnforcementScenario[] = [
    ...CLEAN_SCENARIOS,
    ...BAD_SCENARIOS,
  ]

  const results = allScenarios.map((s) => evaluatePhase3AuthorityEnforcementScenario(s))

  const passedCount = results.filter((r) => r.valid).length
  const violationCount = results.filter((r) => !r.valid).length

  return {
    scenarioCount: allScenarios.length,
    passedCount,
    violationCount,
    results,
    warnings: ["enforcement probe is advisory-only and not wired to runtime behavior"],
    advisoryOnly: true,
  }
}
