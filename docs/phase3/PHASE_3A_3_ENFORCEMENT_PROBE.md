# Phase 3A-3 Enforcement Probe

## Purpose

Pure probe that evaluates representative existing Phase 3 outputs against the authority enforcement engine. Confirms existing advisory outputs satisfy the authority doctrine and detects intentionally bad scenarios.

Not wired to any runtime app flow.

## Probe Boundary

**May:**
- Call `evaluatePhase3AuthorityEnforcementScenario()` for each scenario
- Aggregate passed/violation counts
- Return `Phase3EnforcementProbeResult`

**May not:**
- Connect to app routes or UI
- Connect to the deterministic engine at runtime
- Persist or log results
- Perform external calls, AI, or scraping
- Produce timestamps or non-deterministic output

## Scenarios Covered (Clean — expect `passed`)

| Scenario ID | Phase 3 Output | Confirms |
| --- | --- | --- |
| `probe-no-deal-capital-protection-preserved` | `no-deal-with-weak-comparable-hints-merged.json` | capital_protection remains primary route; advisory hints don't displace it |
| `probe-review-required-legal-review-preserved` | `review-required-with-legal-conflict-hints-merged.json` | legal_review escalation preserved despite conflicting evidence hints |
| `probe-proceed-candidate-advisory-contained` | `clean-proceed-with-accepted-operator-note-merged.json` | accepted operator note does not imply deal approval |
| `probe-intake-missing-lender-contained` | `intake-with-missing-lender-hints-merged.json` | missing lender hint does not override deterministic escalation route |

All 4 clean scenarios use `attemptedLayer: "deterministic_governance"` vs `protectedAuthority: "deterministic_governance"` → authority check passes.

## Bad Scenarios Covered (expect violation)

| Scenario ID | Violation Type | Expected outcome |
| --- | --- | --- |
| `probe-bad-advisory-overrides-governance` | `advisory_overrides_governance` | `blocked` |
| `probe-bad-workflow-overrides-capital-protection` | `workflow_overrides_capital_protection` | `blocked` |
| `probe-bad-ui-softens-fatal` | `ui_softens_fatal_classification` | `review_required` |
| `probe-bad-advisory-route-replaces-capital-protection` | `advisory_route_replaces_capital_protection` | `blocked` |

## Expected Result Summary

- `scenarioCount`: 8
- `passedCount`: 4
- `violationCount`: 4
- All results carry `advisoryOnly: true`
- All results pass `validatePhase3EnforcementResult()`

## Guardrails

- No app/route imports
- No persistence
- No AI or scraping
- No timestamps or random values
- Output deterministic: identical input → identical output
- All outputs carry `advisoryOnly: true`

## No Runtime Wiring Confirmation

- No changes to deterministic engine
- No changes to orchestrator, evidence contracts, merge output, or UI
- No changes to formulas, True MAO, finance, governance thresholds, or deal classifications
- Probe module is pure validation only
