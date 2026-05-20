# Phase 3A-3 Authority Enforcement Engine

## Purpose

Pure enforcement engine for evaluating authority hierarchy breach scenarios.

Takes a `Phase3EnforcementScenario` and returns a `Phase3EnforcementResult`. Deterministic, side-effect-free, advisory-only. Not wired to any runtime app flow.

## Engine Boundary

**May:**
- Evaluate authority hierarchy positions from `PHASE3_AUTHORITY_LAYERS`
- Build a `Phase3AuthorityViolation` record from scenario fields
- Return structured `Phase3EnforcementResult` with safe-fail action and outcome
- Return clean `passed` result when no violation detected

**May not:**
- Connect to the deterministic engine
- Connect to the orchestrator
- Connect to evidence contracts or merge output
- Connect to UI or review routes
- Perform external calls, persistence, AI, or scraping
- Produce timestamps, random values, or non-deterministic output
- Modify any runtime behavior

## Input / Output

Input: `Phase3EnforcementScenario` (from `types/phase3-enforcement.ts`)

Output: `Phase3EnforcementResult` (from `types/phase3-enforcement.ts`)

Export: `evaluatePhase3AuthorityEnforcementScenario(scenario) → Phase3EnforcementResult`

## Safe-Fail Mapping

| safeFailAction | outcome |
| --- | --- |
| `block` | `blocked` |
| `block_advisory_upgrade` | `blocked` |
| `preserve_deterministic_result` | `blocked` |
| `downgrade` | `downgraded` |
| `escalate` | `escalated` |
| `request_review` | `review_required` |
| `increase_review_burden` | `review_required` |

## Authority Hierarchy Detection

Engine uses `PHASE3_AUTHORITY_LAYERS` hierarchy index to determine if an action is a violation:

```
[0] deterministic_governance   ← highest authority
[1] capital_protection
[2] deal_classification
[3] workflow_orchestration
[4] evidence_advisory
[5] ui_presentation
[6] future_ai_assistance       ← lowest authority
```

If `attemptedLayer` index > `protectedAuthority` layer index → violation detected.

If `attemptedLayer` index ≤ `protectedAuthority` layer index → action within authority bounds → `passed`.

If either layer is unknown → fail closed → violation detected (per safe-fail doctrine).

## Fixture Coverage

Location: `__tests__/fixtures/phase3-enforcement-engine/`

| Fixture | Scenario | Expected outcome |
| --- | --- | --- |
| `advisory-overrides-governance-enforcement.json` | `evidence_advisory` vs `deterministic_governance` | `blocked` |
| `workflow-overrides-capital-protection-enforcement.json` | `workflow_orchestration` vs `capital_protection` | `blocked` |
| `escalation-downgrade-enforcement.json` | `evidence_advisory` vs `capital_protection` | `blocked` |
| `ui-softens-fatal-classification-enforcement.json` | `ui_presentation` vs `capital_protection` | `review_required` |
| `clean-enforcement-scenario.json` | `deterministic_governance` vs `deterministic_governance` | `passed` |

## Guardrails

- All outputs carry `advisoryOnly: true`
- Engine does not export `apply`, `enforce`, `execute`, `wire`, `mutate`, `persist`, `handler`
- Engine output passes `validatePhase3EnforcementResult()` for all 5 fixture scenarios
- ViolationId is stable: `v-${scenarioId}`
- Output is deterministic: identical input → identical output

## No Runtime Wiring Confirmation

- No app imports
- No orchestrator imports
- No UI/route imports
- No persistence
- No AI
- No scraping
- No changes to deterministic engine behavior
- No changes to formulas, True MAO, finance, governance thresholds, or deal classifications
