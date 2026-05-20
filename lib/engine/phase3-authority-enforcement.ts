// Phase 3A-3 Step 5 — Pure authority enforcement engine.
// Pure function only. No side effects, no external calls, no runtime wiring.
// No app/orchestrator/UI/route imports. No persistence. No AI. No scraping.
// No random values. No timestamps. Stable deterministic output.
// Advisory outputs may increase review burden, but they may not reduce deterministic risk.
// IF UNCERTAIN → BLOCK, DOWNGRADE OR ESCALATE.

import { PHASE3_AUTHORITY_LAYERS } from "../../types/phase3-authority"
import type { Phase3AuthorityLayer } from "../../types/phase3-authority"
import type {
  Phase3EnforcementScenario,
  Phase3AuthorityViolation,
  Phase3EnforcementResult,
  Phase3EnforcementOutcome,
  Phase3RuntimeSafeFailAction,
} from "../../types/phase3-enforcement"

const ADVISORY_ONLY_WARNING =
  "enforcement advisory: this enforcement result is advisory-only and not wired to runtime behavior"

function safeFailToOutcome(action: Phase3RuntimeSafeFailAction): Phase3EnforcementOutcome {
  switch (action) {
    case "block":
      return "blocked"
    case "downgrade":
      return "downgraded"
    case "escalate":
      return "escalated"
    case "request_review":
      return "review_required"
    case "preserve_deterministic_result":
      return "blocked"
    case "block_advisory_upgrade":
      return "blocked"
    case "increase_review_burden":
      return "review_required"
    default:
      return "blocked"
  }
}

function resolveLayerIndex(layerName: string): number {
  const exact = PHASE3_AUTHORITY_LAYERS.indexOf(layerName as Phase3AuthorityLayer)
  if (exact !== -1) return exact
  // Prefix match for protectedAuthority strings like "deterministic_governance.finalClassification"
  const prefixMatch = PHASE3_AUTHORITY_LAYERS.find((layer) => layerName.startsWith(layer))
  return prefixMatch !== undefined ? PHASE3_AUTHORITY_LAYERS.indexOf(prefixMatch) : -1
}

export function evaluatePhase3AuthorityEnforcementScenario(
  scenario: Phase3EnforcementScenario
): Phase3EnforcementResult {
  const attemptedIdx = resolveLayerIndex(scenario.attemptedLayer)
  const protectedIdx = resolveLayerIndex(scenario.protectedAuthority)

  // If both layers are known and the attempted layer has equal or higher authority
  // (lower index in the hierarchy), the action is within bounds — no violation.
  if (attemptedIdx !== -1 && protectedIdx !== -1 && attemptedIdx <= protectedIdx) {
    return {
      valid: true,
      outcome: "passed",
      violations: [],
      warnings: [],
      safeFailActions: [],
      advisoryOnly: true,
    }
  }

  // Violation: attempted layer has lower authority than protected authority,
  // or one of the layers is unknown (fail closed per safe-fail doctrine).
  const outcome = safeFailToOutcome(scenario.safeFailAction)

  const violation: Phase3AuthorityViolation = {
    violationId: `v-${scenario.scenarioId}`,
    violationType: scenario.violationType,
    detectedBy: scenario.detectedBy,
    severity: scenario.severity,
    attemptedOverride: scenario.attemptedAction,
    protectedAuthority: scenario.protectedAuthority,
    safeFailAction: scenario.safeFailAction,
    outcome,
    advisoryOnly: true,
  }

  return {
    valid: false,
    outcome,
    violations: [violation],
    warnings: [ADVISORY_ONLY_WARNING],
    safeFailActions: [scenario.safeFailAction],
    advisoryOnly: true,
  }
}
