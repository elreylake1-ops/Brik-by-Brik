# Phase 3A-3 Enforcement Contract Validation

## Purpose

This document records the Phase 3A-3 Step 3 scope: enforcement fixtures and a pure contract validation helper.

No runtime enforcement is implemented. This step adds representative fixture data and a structural validation function that operates at the contract level only.

## Enforcement Doctrine

> **"Advisory outputs may increase review burden, but they may not reduce deterministic risk."**

> **"IF UNCERTAIN → BLOCK, DOWNGRADE OR ESCALATE."**

These doctrines govern all enforcement design decisions. The validation helper preserves these doctrines by flagging any contract structure that would allow advisory outputs to weaken governance signals.

## Fixture List

Location: `__tests__/fixtures/phase3-enforcement/`

| File | Type | Violation Type / Purpose |
| --- | --- | --- |
| `advisory-overrides-governance-violation.json` | `Phase3AuthorityViolation` | `advisory_overrides_governance` — evidence hint attempts to override `finalClassification` |
| `workflow-overrides-capital-protection-violation.json` | `Phase3AuthorityViolation` | `workflow_overrides_capital_protection` — orchestrator attempts to set `proceed_candidate` on `NO_DEAL` result |
| `escalation-downgrade-violation.json` | `Phase3AuthorityViolation` | `merged_output_downgrades_escalation` — merge layer displaces `capital_protection` route |
| `ui-softens-fatal-classification-violation.json` | `Phase3AuthorityViolation` | `ui_softens_fatal_classification` — review surface renders `NO_DEAL` without capital protection warning |
| `valid-enforcement-result-clean.json` | `Phase3EnforcementResult` | Clean passing result — no violations, no warnings |
| `enforcement-result-with-violations.json` | `Phase3EnforcementResult` | Blocked result with two fatal violations and populated `safeFailActions` |

All fixtures carry `advisoryOnly: true`.

All fixtures use only fields defined in `types/phase3-enforcement.ts`.

No fixtures include runtime, persistence, database, API, timestamp, or AI fields.

## Validation Helper

Location: `lib/engine/phase3-enforcement-contract.ts`

Export:

```typescript
validatePhase3EnforcementResult(result: Phase3EnforcementResult): Phase3EnforcementContractValidationResult
```

Return type:

```typescript
type Phase3EnforcementContractValidationResult = {
  valid: boolean
  errors: readonly string[]
  warnings: readonly string[]
  advisoryOnly: true
}
```

### Validation Behavior Summary

The helper checks structural invariants only:

| Check | Description |
| --- | --- |
| `advisoryOnly: true` on result | Advisory boundary must be preserved |
| `advisoryOnly: true` on each violation | Each violation must carry advisory boundary |
| `violations` is array | Contract shape |
| `warnings` is array | Contract shape |
| `safeFailActions` is array | Contract shape |
| `outcome` is known value | Must be a `Phase3EnforcementOutcome` member |
| `valid: false` requires at least one violation or warning | Prevents silent false negatives |
| Fatal/high violation with `passed` outcome | Incompatible combination — signals authority hierarchy breach |
| Violation `safeFailAction` present in `result.safeFailActions` | Action coverage integrity |
| `violationType` is known value | Must be a `Phase3ViolationType` member |
| `detectedBy` is known value | Must be a `Phase3EnforcementSystem` member |
| Violation `outcome` is known value | Must be a `Phase3EnforcementOutcome` member |
| No forbidden runtime keys | `execute`, `enforce`, `apply`, `mutate`, `persist`, `fetch`, `api`, `aiModel`, `database`, `routeHandler`, `handler` |

### Validation Boundaries

The helper is contract-level only.

It does not:

- apply enforcement
- trigger safe-fail actions
- block or modify runtime outputs
- connect to the deterministic engine
- connect to the orchestrator
- connect to evidence contracts
- connect to merge output
- connect to UI
- perform external calls
- mutate its input

## Confirmation

- No runtime enforcement implementation added.
- No engine wiring added.
- No orchestrator wiring added.
- No UI enforcement behavior added.
- No persistence or audit database added.
- No AI, scraping, or integration logic added.
- No changes to deterministic engine behavior, formulas, True MAO, finance calculations, governance thresholds, or deal classifications.
- No changes to Phase 2 review routes or `/phase-3-dev-review` runtime behavior.
- All new code is advisory-only and carries `advisoryOnly: true`.
