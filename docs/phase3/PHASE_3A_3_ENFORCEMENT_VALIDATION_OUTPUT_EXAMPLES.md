# Phase 3A-3 Enforcement Validation Output Examples

## Purpose

This document records the Phase 3A-3 Step 4 scope: locking expected validation outputs for the Phase 3A-3 enforcement contract fixtures.

Validation output fixtures prevent future changes from silently weakening enforcement-readiness guardrails. If a change to the validator causes a previously-passing contract to fail, or changes the output shape, the fixture comparison tests will catch it.

No runtime enforcement is implemented. Validation remains contract-level only.

## Enforcement Doctrine

> **"Advisory outputs may increase review burden, but they may not reduce deterministic risk."**

> **"IF UNCERTAIN → BLOCK, DOWNGRADE OR ESCALATE."**

## Source Enforcement Fixtures

Location: `__tests__/fixtures/phase3-enforcement/`

| File | Type | Violation Type / Purpose |
| --- | --- | --- |
| `advisory-overrides-governance-violation.json` | `Phase3AuthorityViolation` | `advisory_overrides_governance` — evidence hint overrides `finalClassification` |
| `workflow-overrides-capital-protection-violation.json` | `Phase3AuthorityViolation` | `workflow_overrides_capital_protection` — orchestrator overrides capital protection |
| `escalation-downgrade-violation.json` | `Phase3AuthorityViolation` | `merged_output_downgrades_escalation` — merge layer displaces `capital_protection` route |
| `ui-softens-fatal-classification-violation.json` | `Phase3AuthorityViolation` | `ui_softens_fatal_classification` — review surface hides capital protection warning |
| `valid-enforcement-result-clean.json` | `Phase3EnforcementResult` | Clean passing result — no violations |
| `enforcement-result-with-violations.json` | `Phase3EnforcementResult` | Blocked result with two fatal violations |

## Validation Output Fixtures

Location: `__tests__/fixtures/phase3-enforcement-validation/`

| File | Corresponds to | Expected output |
| --- | --- | --- |
| `advisory-overrides-governance-violation-validation.json` | `advisory-overrides-governance-violation.json` (wrapped) | `{valid: true, errors: [], warnings: [], advisoryOnly: true}` |
| `workflow-overrides-capital-protection-violation-validation.json` | `workflow-overrides-capital-protection-violation.json` (wrapped) | `{valid: true, errors: [], warnings: [], advisoryOnly: true}` |
| `escalation-downgrade-violation-validation.json` | `escalation-downgrade-violation.json` (wrapped) | `{valid: true, errors: [], warnings: [], advisoryOnly: true}` |
| `ui-softens-fatal-classification-violation-validation.json` | `ui-softens-fatal-classification-violation.json` (wrapped) | `{valid: true, errors: [], warnings: [], advisoryOnly: true}` |
| `valid-enforcement-result-clean-validation.json` | `valid-enforcement-result-clean.json` (direct) | `{valid: true, errors: [], warnings: [], advisoryOnly: true}` |
| `enforcement-result-with-violations-validation.json` | `enforcement-result-with-violations.json` (direct) | `{valid: true, errors: [], warnings: [], advisoryOnly: true}` |

**Note on "wrapped" fixtures:** The 4 violation fixtures contain single `Phase3AuthorityViolation` objects. These are not directly passable to `validatePhase3EnforcementResult()`, which takes a `Phase3EnforcementResult`. The test wraps each violation in a minimal result (using the violation's own `outcome` and `safeFailAction`) before validating. The locked output is for that wrapped result.

## Validation Behavior Summary

All 6 locked outputs are `{valid: true, errors: [], warnings: [], advisoryOnly: true}` because the source fixtures are structurally correct enforcement contracts.

The fixture-locking tests catch:
- Accidental validator changes that break previously-valid contracts
- Output shape regressions (added/removed fields)
- `advisoryOnly` boundary regressions

Invalid variants (e.g., `advisoryOnly: false`, unknown `violationType`, missing `safeFailAction` coverage, fatal+passed combination) are tested separately in the test file and are not fixture-locked. These are expected-failure tests, not golden outputs.

## Confirmation

- Validation is contract-level only.
- Validation does not enforce runtime behavior.
- No engine wiring exists.
- No orchestrator wiring exists.
- No UI enforcement behavior exists.
- No persistence added.
- No AI, scraping, or integration logic added.
- All validation outputs carry `advisoryOnly: true`.
- No changes to deterministic engine behavior, formulas, True MAO, finance calculations, governance thresholds, or deal classifications.
- No changes to Phase 2 review routes or `/phase-3-dev-review` runtime behavior.
