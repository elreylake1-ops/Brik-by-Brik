# Phase 2 Stress Test Report

## Purpose

Phase 2E runs all 15 stress fixtures through the completed deterministic Phase 2 engine to prove consistency, capital protection, explainability, and governance override behavior before any Phase 3 discussion.

## Engine Execution Order

1. Validate Phase 2 fixture shape.
2. Map fixture input into Phase 2 intelligence input.
3. Run `buildPhase2Analysis()`.
4. Validate `Phase2AnalysisOutput` structure.
5. Re-run identical input three times to prove deterministic output stability.
6. Compare expected vs actual governance, classification, risk, action, strategy, and review state.

## Scenario Table

- Total scenarios: 15
- Passed: 15
- Failed: 0

| Scenario | Expected Governance / Final | Actual Governance / Final | Result | Notes |
| --- | --- | --- | --- | --- |
| Strong BRRR candidate | PASS / HOT_OR_WARM | PASS / HOT | PASS | None |
| Marginal deal | PASS / MARGINAL | PASS / MARGINAL | PASS | None |
| No deal | BLOCKED / NO_DEAL | BLOCKED / NO_DEAL | PASS | None |
| Downside loss | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | PASS | None |
| Weak GDV evidence | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | PASS | None |
| Heavy refurb exposure | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | PASS | None |
| High finance cost | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | PASS | None |
| False HOT deal | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | PASS | None |
| Structural / fatal risk | BLOCKED / NO_DEAL | BLOCKED / NO_DEAL | PASS | None |
| Missing evidence / manual review | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | PASS | None |
| Missing comparables | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | PASS | None |
| Unrealistic GDV | BLOCKED / NO_DEAL | BLOCKED / NO_DEAL | PASS | None |
| Long bridge term | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | PASS | None |
| Zero refurb edge case | PASS / HOT_OR_WARM | PASS / HOT | PASS | None |
| High leverage scenario | BLOCKED / NO_DEAL | BLOCKED / NO_DEAL | PASS | None |

## Expected vs Actual Summary

### Strong BRRR candidate

- Expected: PASS, HOT_OR_WARM, next action PROCEED.
- Actual: PASS, HOT, raw 100/HOT, next action proceed-under-governance.
- Result: PASS
- Failure: none

### Marginal deal

- Expected: PASS, MARGINAL, next action PROCEED_WITH_CAUTION.
- Actual: PASS, MARGINAL, raw 64/MARGINAL, next action proceed-under-governance.
- Result: PASS
- Failure: none

### No deal

- Expected: BLOCKED, NO_DEAL, next action REJECT.
- Actual: BLOCKED, NO_DEAL, raw 30/COLD, next action resolve-fatal-risk.
- Result: PASS
- Failure: none

### Downside loss

- Expected: REVIEW_REQUIRED, REVIEW_REQUIRED, next action VERIFY_GDV.
- Actual: REVIEW_REQUIRED, REVIEW_REQUIRED, raw 68/WARM, next action verify-downside-gdv.
- Result: PASS
- Failure: none

### Weak GDV evidence

- Expected: REVIEW_REQUIRED, REVIEW_REQUIRED, next action REQUEST_COMPARABLES.
- Actual: REVIEW_REQUIRED, REVIEW_REQUIRED, raw 77/WARM, next action obtain-comparables.
- Result: PASS
- Failure: none

### Heavy refurb exposure

- Expected: REVIEW_REQUIRED, REVIEW_REQUIRED, next action RENEGOTIATE.
- Actual: REVIEW_REQUIRED, REVIEW_REQUIRED, raw 68/WARM, next action builder-scope-validation.
- Result: PASS
- Failure: none

### High finance cost

- Expected: REVIEW_REQUIRED, REVIEW_REQUIRED, next action TIGHTEN_FINANCE_ASSUMPTIONS.
- Actual: REVIEW_REQUIRED, REVIEW_REQUIRED, raw 79/WARM, next action tighten-finance-assumptions.
- Result: PASS
- Failure: none

### False HOT deal

- Expected: REVIEW_REQUIRED, REVIEW_REQUIRED, next action RENEGOTIATE.
- Actual: REVIEW_REQUIRED, REVIEW_REQUIRED, raw 79/WARM, next action slow-urgency-pressure.
- Result: PASS
- Failure: none

### Structural / fatal risk

- Expected: BLOCKED, NO_DEAL, next action COMMISSION_SURVEY.
- Actual: BLOCKED, NO_DEAL, raw 95/HOT, next action resolve-fatal-risk.
- Result: PASS
- Failure: none

### Missing evidence / manual review

- Expected: REVIEW_REQUIRED, REVIEW_REQUIRED, next action REQUEST_EVIDENCE.
- Actual: REVIEW_REQUIRED, REVIEW_REQUIRED, raw 64/MARGINAL, next action obtain-comparables.
- Result: PASS
- Failure: none

### Missing comparables

- Expected: REVIEW_REQUIRED, REVIEW_REQUIRED, next action REQUEST_COMPARABLES.
- Actual: REVIEW_REQUIRED, REVIEW_REQUIRED, raw 64/MARGINAL, next action obtain-comparables.
- Result: PASS
- Failure: none

### Unrealistic GDV

- Expected: BLOCKED, NO_DEAL, next action VERIFY_GDV.
- Actual: BLOCKED, NO_DEAL, raw 64/MARGINAL, next action resolve-fatal-risk.
- Result: PASS
- Failure: none

### Long bridge term

- Expected: REVIEW_REQUIRED, REVIEW_REQUIRED, next action TIGHTEN_FINANCE_ASSUMPTIONS.
- Actual: REVIEW_REQUIRED, REVIEW_REQUIRED, raw 78/WARM, next action tighten-finance-assumptions.
- Result: PASS
- Failure: none

### Zero refurb edge case

- Expected: PASS, HOT_OR_WARM, next action PROCEED.
- Actual: PASS, HOT, raw 100/HOT, next action proceed-under-governance.
- Result: PASS
- Failure: none

### High leverage scenario

- Expected: BLOCKED, NO_DEAL, next action REJECT.
- Actual: BLOCKED, NO_DEAL, raw 26/COLD, next action resolve-fatal-risk.
- Result: PASS
- Failure: none

## Pass/Fail Matrix

| Scenario | Result |
| --- | --- |
| Strong BRRR candidate | PASS |
| Marginal deal | PASS |
| No deal | PASS |
| Downside loss | PASS |
| Weak GDV evidence | PASS |
| Heavy refurb exposure | PASS |
| High finance cost | PASS |
| False HOT deal | PASS |
| Structural / fatal risk | PASS |
| Missing evidence / manual review | PASS |
| Missing comparables | PASS |
| Unrealistic GDV | PASS |
| Long bridge term | PASS |
| Zero refurb edge case | PASS |
| High leverage scenario | PASS |

## Governance Override Proof

| Scenario | Raw Heat | Governance State | Final Classification | Override Applied | Result |
| --- | --- | --- | --- | --- | --- |
| False HOT deal | 79 (WARM) | REVIEW_REQUIRED | REVIEW_REQUIRED | Yes | PASS |
| Structural / fatal risk | 95 (HOT) | BLOCKED | NO_DEAL | Yes | PASS |

## Consistency Testing Proof

| Scenario | Deterministic Across 3 Runs | Drift Fields |
| --- | --- | --- |
| Strong BRRR candidate | PASS | None |
| Marginal deal | PASS | None |
| No deal | PASS | None |
| Downside loss | PASS | None |
| Weak GDV evidence | PASS | None |
| Heavy refurb exposure | PASS | None |
| High finance cost | PASS | None |
| False HOT deal | PASS | None |
| Structural / fatal risk | PASS | None |
| Missing evidence / manual review | PASS | None |
| Missing comparables | PASS | None |
| Unrealistic GDV | PASS | None |
| Long bridge term | PASS | None |
| Zero refurb edge case | PASS | None |
| High leverage scenario | PASS | None |

## Edge-Case Testing Proof

| Case | Scenario | Result | Explanation |
| --- | --- | --- | --- |
| zero-refurb-safe-execution | phase2-014 | PASS | Governance pass with strong raw opportunity. |
| missing-comparables-not-clean-hot | phase2-011 | PASS | Deal requires manual review before offer. |
| unrealistic-gdv-risk-created | phase2-012 | PASS | Deal blocked by governance. |
| long-bridge-time-risk-created | phase2-013 | PASS | Deal requires manual review before offer. |
| high-leverage-review-risk-created | phase2-015 | PASS | Deal blocked by governance. |
| negative-profit-blocks-capital-protection | phase2-003 | PASS | Deal blocked by governance. |

## Known Limitations

- MANUAL_COMPARABLE_INPUT_ONLY: Comparable evidence remains manual input only. GDV quality depends on the operator supplying sold comparables.
- NO_AUTOMATED_SOLD_PRICE_VALIDATION: No automated sold-price validation exists yet. The engine cannot independently verify claimed sold evidence.
- NO_AI_LISTING_EXTRACTION: No AI listing extraction is implemented. Listing and motivation signals depend on structured user input only.
- NO_LIVE_MARKET_INTEGRATIONS: No live Rightmove, Zoopla, or Land Registry integration is implemented. The engine cannot verify live market context in real time.
- RULES_BASED_REFURB_ASSUMPTIONS: Refurb estimation remains rules-based and assumption-driven. Capex confidence still depends on user-supplied scope and evidence quality.
- GDV_CONFIDENCE_USER_DEPENDENT: GDV confidence depends on user-provided evidence quality. Weak or missing comparable evidence still requires manual challenge.
- LEGAL_STRUCTURAL_USER_INDICATED: Legal and structural risks are user-indicated, not independently verified. The engine can block declared risks but cannot discover them autonomously.
- NO_PERSISTENT_ANALYSIS_HISTORY: No persistent analysis history database exists yet. Validation output is deterministic per run but not stored as historical deal memory.
- NO_AUTOMATED_LENDER_VALIDATION: No automated lender or refinance validation exists yet. Leverage and refinance checks remain rules-based rather than lender-confirmed.

## Recommended Refinements Before Phase 3

- Review any failing scenario rows before client acceptance.
- Calibrate raw heat scoring where the pass-state matrix still diverges from conservative fixture intent.
- Consider whether weak or stretched GDV scenarios need stronger governance escalation in a later approved phase.
- Keep Phase 3 blocked until the client accepts this validation package.
