// Phase 3A-3 Step 3 — Enforcement contract validation helper.
// Pure function only. No side effects, no external calls, no runtime enforcement.
// No engine/orchestrator/UI wiring. No persistence. No AI. No scraping.
// Validates structural shape and invariants of Phase3EnforcementResult only.
// Advisory outputs may increase review burden, but they may not reduce deterministic risk.
// IF UNCERTAIN → BLOCK, DOWNGRADE OR ESCALATE.

import type {
  Phase3EnforcementResult,
  Phase3ViolationType,
  Phase3EnforcementSystem,
  Phase3EnforcementOutcome,
  Phase3RuntimeSafeFailAction,
} from "../../types/phase3-enforcement"
import {
  PHASE3_VIOLATION_TYPES,
  PHASE3_ENFORCEMENT_SYSTEMS,
  PHASE3_ENFORCEMENT_OUTCOMES,
  PHASE3_RUNTIME_SAFE_FAIL_ACTIONS,
} from "../../types/phase3-enforcement"

export type Phase3EnforcementContractValidationResult = {
  valid: boolean
  errors: readonly string[]
  warnings: readonly string[]
  advisoryOnly: true
}

const FORBIDDEN_RUNTIME_KEYS = [
  "execute",
  "enforce",
  "apply",
  "mutate",
  "persist",
  "fetch",
  "api",
  "aiModel",
  "database",
  "routeHandler",
  "handler",
] as const

const FATAL_OR_HIGH_SEVERITIES = ["fatal", "high"] as const

export function validatePhase3EnforcementResult(
  result: Phase3EnforcementResult
): Phase3EnforcementContractValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (result.advisoryOnly !== true) {
    errors.push("result.advisoryOnly must be true")
  }

  if (!Array.isArray(result.violations)) {
    errors.push("result.violations must be an array")
  }

  if (!Array.isArray(result.warnings)) {
    errors.push("result.warnings must be an array")
  }

  if (!Array.isArray(result.safeFailActions)) {
    errors.push("result.safeFailActions must be an array")
  }

  if (!PHASE3_ENFORCEMENT_OUTCOMES.includes(result.outcome as Phase3EnforcementOutcome)) {
    errors.push(`result.outcome "${result.outcome}" is not a known Phase3EnforcementOutcome`)
  }

  if (result.valid === false && result.violations.length === 0 && result.warnings.length === 0) {
    errors.push("result.valid is false but violations and warnings are both empty")
  }

  for (const resultKey of Object.keys(result)) {
    if (FORBIDDEN_RUNTIME_KEYS.includes(resultKey as typeof FORBIDDEN_RUNTIME_KEYS[number])) {
      errors.push(`result contains forbidden runtime key: "${resultKey}"`)
    }
  }

  if (Array.isArray(result.violations)) {
    for (const violation of result.violations) {
      if (violation.advisoryOnly !== true) {
        errors.push(`violation "${violation.violationId}" advisoryOnly must be true`)
      }

      if (!PHASE3_VIOLATION_TYPES.includes(violation.violationType as Phase3ViolationType)) {
        errors.push(`violation "${violation.violationId}" has unknown violationType: "${violation.violationType}"`)
      }

      if (!PHASE3_ENFORCEMENT_SYSTEMS.includes(violation.detectedBy as Phase3EnforcementSystem)) {
        errors.push(`violation "${violation.violationId}" has unknown detectedBy: "${violation.detectedBy}"`)
      }

      if (!PHASE3_ENFORCEMENT_OUTCOMES.includes(violation.outcome as Phase3EnforcementOutcome)) {
        errors.push(`violation "${violation.violationId}" has unknown outcome: "${violation.outcome}"`)
      }

      if (!PHASE3_RUNTIME_SAFE_FAIL_ACTIONS.includes(violation.safeFailAction as Phase3RuntimeSafeFailAction)) {
        errors.push(`violation "${violation.violationId}" has unknown safeFailAction: "${violation.safeFailAction}"`)
      }

      if (
        Array.isArray(result.safeFailActions) &&
        PHASE3_RUNTIME_SAFE_FAIL_ACTIONS.includes(violation.safeFailAction as Phase3RuntimeSafeFailAction) &&
        !result.safeFailActions.includes(violation.safeFailAction)
      ) {
        errors.push(
          `violation "${violation.violationId}" safeFailAction "${violation.safeFailAction}" not present in result.safeFailActions`
        )
      }

      if (
        FATAL_OR_HIGH_SEVERITIES.includes(violation.severity as typeof FATAL_OR_HIGH_SEVERITIES[number]) &&
        result.outcome === "passed"
      ) {
        errors.push(
          `violation "${violation.violationId}" severity "${violation.severity}" is incompatible with result.outcome "passed"`
        )
      }

      for (const violationKey of Object.keys(violation)) {
        if (FORBIDDEN_RUNTIME_KEYS.includes(violationKey as typeof FORBIDDEN_RUNTIME_KEYS[number])) {
          errors.push(`violation "${violation.violationId}" contains forbidden runtime key: "${violationKey}"`)
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    advisoryOnly: true,
  }
}
