# Phase 2 Validation Return Package

## Executive Summary

Brik Engine Phase 2 has been completed as an engine-first validation phase focused on investor safety, deterministic behavior, governance control, and structured output quality.

The Phase 2 validation package demonstrates that the engine:
- behaves consistently under repeated execution
- blocks unsafe deals
- protects capital through hard governance gates
- handles uncertainty explicitly
- produces explainable structured outputs
- remains deterministic with no output drift across the stress suite

Phase 2 validates investor safety and engine control quality, not UI polish.

## Client Review Index

- [Phase 2 Final Review Package](./PHASE_2_FINAL_REVIEW_PACKAGE.md)
- [Actual Outputs for All 15 Tested Scenarios](./PHASE_2_SCENARIO_ACTUAL_OUTPUTS.md)
- [Phase 2 Manual Review Checklist](./PHASE_2_MANUAL_REVIEW_CHECKLIST.md)
- [Phase 2 JSON Samples](./PHASE_2_JSON_SAMPLES.md)
- [Phase 2 Architecture Notes](./PHASE_2_ARCHITECTURE_NOTES.md)
- [Phase 2 Recommended Refinements](./PHASE_2_RECOMMENDED_REFINEMENTS.md)

## Review Surface Map

- `/`: live calculator for manual walkthrough screenshots and normal deal analysis.
- `/phase-2-live-review`: live Phase 2 engine runner for the locked 15 validation fixtures.
- `/phase-2-review`: static saved validation report viewer.
- `docs/validation/phase2-stress-test-results.json`: machine-readable validation outputs.

The normal calculator route must not be described as proof for hidden governance or evidence scenarios that require locked fixture fields not exposed by the calculator form.

## Phase 2 Validation Objective

The objective of Phase 2 was to prove that Brik Engine can evaluate deals using deterministic, rules-based logic before any Phase 3 expansion.

This included validation of:
- raw intelligence/scoring outputs
- governance override behavior
- evidence and confidence handling
- stress behavior across 15 real-world investor scenarios
- structured JSON outputs for future downstream use

## Engine Execution Order

1. Fixture and input validation
2. Data mapping into Phase 2 intelligence input
3. Raw deterministic intelligence scoring
4. Governance execution
5. Final classification determination
6. Output contract validation
7. Repeated-run consistency testing

## Architecture Overview

Phase 2 is organized into five layers:
- Validation harness: fixture structure and scenario contracts
- Output contracts: deterministic JSON shapes for all major output sections
- Governance engines: fatal-risk checks, decision gates, evidence status, confidence, review logic
- Intelligence engines: raw heat score, risk radar, strategy match, investor summary, next actions
- Validation runner: end-to-end execution, expected-vs-actual comparison, and consistency testing

Governance sits above scoring by design. A strong raw score can be overridden to `REVIEW_REQUIRED` or `NO_DEAL` if the safety layer detects fatal or review-grade issues.

## Stress Test Suite Summary

The completed stress suite contains 15 investor scenarios:
1. Strong BRRR candidate
2. Marginal deal
3. No deal
4. Downside loss
5. Weak GDV evidence
6. Heavy refurb exposure
7. High finance cost
8. False HOT deal
9. Structural / fatal risk
10. Missing evidence / manual review
11. Missing comparables
12. Unrealistic GDV
13. Long bridge term
14. Zero refurb edge case
15. High leverage scenario

All 15 scenarios execute successfully and all 15 currently pass.

## Full 15-Scenario Pass/Fail Matrix

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

Phase 2 explicitly proves that governance overrides scoring.

Examples:
- False HOT deal: raw score remains attractive, but governance forces `REVIEW_REQUIRED`
- Structural / fatal risk: raw score remains attractive, but governance forces `NO_DEAL`

Core proof point:
- unsafe deals cannot remain `HOT` once governance detects a fatal or review-grade blocker

## Consistency Testing Proof

Each scenario is executed repeatedly with identical inputs.

Result:
- all 15 scenarios show no drift
- output classification, risk level, fatal state, and strategy recommendation remain stable
- engine behavior is deterministic and rules-based

## Edge-Case Testing Proof

Edge-case validation confirms:
- zero-refurb scenarios do not crash
- missing comparables cannot pass as clean HOT cases
- unrealistic GDV creates blocking risk
- long bridge terms create time/finance review risk
- high leverage creates blocking or review-grade leverage risk
- negative-profit cases fail capital protection

## JSON Output Contract Summary

Phase 2 returns structured JSON sections for:
- metadata
- deal heat score
- risk radar
- strategy match
- governance
- investor summary
- decision gates
- evidence status
- data confidence
- next actions
- assumptions
- overrides
- known limitations

These outputs are deterministic, explainable, and suitable for future downstream packaging, integration, and review workflows.

## Known Limitations

Phase 2 remains intentionally conservative and does not yet include:
- AI dependency
- live market integrations
- automated sold-price validation
- automated listing extraction
- persistent analysis history
- automated lender validation

Current known limitations remain documented in the validation package and should remain visible during future planning.

## Recommended Refinements Before Phase 3

- Sold comparable ingestion and validation
- Deterministic sold-price cross-checks
- Optional listing extraction later, only if explicitly approved
- Live Rightmove/Zoopla/Land Registry integration later, only if explicitly approved
- Builder quote and scope-validation refinement
- Legal and survey evidence intake refinement
- Persistent analysis history later, only if approved
- Lender and refinance validation later, only if approved

## Client Review Package Additions

The client-facing review package now includes:

- a final Phase 2 review document with the full 15-scenario matrix
- a live calculator walkthrough checklist covering 15 validated screenshots from `/`
- compact JSON output examples for manual inspection
- architecture notes and recommended refinements as supporting references

## Live Calculator Walkthrough Screenshots

These screenshots were manually validated from the deployed calculator route at `/`. They are separate from the locked validation runner outputs at `/phase-2-live-review`.

- `01-calculator-strong-profitable-deal.png`: Strong profitable deal — The calculator shows a clean GO / Proceed decision where purchase price, generated refurb cost, fees, finance, and GDV produce a strong profit margin and safe capital protection.
- `02-calculator-marginal-renegotiate-deal.png`: Marginal renegotiate deal — The calculator shows a positive-profit but thin-margin deal being classified as MARGINAL / Renegotiate, proving that weak profit buffers are not presented as strong opportunities and require price negotiation or assumption validation before proceeding.
- `03-calculator-no-go-negative-profit-deal.png`: No-go negative-profit deal — The calculator shows a loss-making deal being classified as NO-GO / Reject, proving that negative profit, capital overexposure, and downside risk are blocked from proceeding.
- `04-calculator-downside-sensitive-deal.png`: Downside-sensitive deal — The calculator shows a profitable deal that still requires caution because capital exposure and downside sensitivity can weaken the investment case, proving that the app does not rely on headline profit alone.
- `05-calculator-heavy-refurb-exposure.png`: Heavy refurb exposure — The calculator shows that a larger, more complex refurbishment increases cost, timeline, and execution risk, proving that the app does not treat heavy capex projects as clean deals without caution or scope validation.
- `06-calculator-high-finance-long-bridge-term.png`: High finance / long bridge term — The calculator shows how a longer bridge period increases finance cost and reduces profitability, proving that the app accounts for time and funding drag instead of relying only on purchase price and GDV.
- `07-calculator-zero-refurb-edge-case.png`: Zero refurb edge case — The calculator handles a £0 refurb input without crashing or producing invalid values, proving that edge-case inputs still return a complete investment analysis with profit, margin, capital protection, and decision output.
- `08-calculator-unsupported-scope-warning.png`: Unsupported scope warning — The calculator shows that when a selected refurb scope has no cost template, the deal is downgraded to CONDITIONAL / Verify Scope, proving that uncosted assumptions cannot appear as a clean proceed decision.
- `09-calculator-capital-exposure-caution.png`: Capital exposure caution — The calculator shows a profitable deal being marked CONDITIONAL / Proceed With Caution because capital exposure remains above the preferred safe threshold, proving that the app protects investor capital even when projected profit is positive.
- `10-calculator-high-purchase-mao-fail.png`: High purchase / MAO fail — The calculator shows that when the purchase price is too high against the MAO targets, the deal is no longer treated as safe, proving that the app protects investors from overpaying even when the GDV appears attractive.
- `11-calculator-large-kitchen-cost-impact.png`: Large kitchen cost impact — The calculator shows that a larger kitchen increases the generated refurb cost and reduces projected profit, proving that the refurb engine scales costs based on scope and room size rather than using one flat assumption.
- `12-calculator-two-bathroom-scaling.png`: Two-bathroom scaling — The calculator shows that adding a second bathroom increases generated refurb cost and reduces projected profit, proving that the refurb engine scales costs by room count rather than using a fixed one-size estimate.
- `13-calculator-flooring-area-scaling.png`: Flooring area scaling — The calculator shows that increasing floor area increases whole-property flooring cost and reduces projected profit, proving that the refurb engine scales area-based work instead of using one flat flooring assumption.
- `14-calculator-major-works-impact.png`: Major works impact — The calculator shows that selecting full rewire, boiler replacement, and roof works increases generated refurb cost, trade exposure, and project risk, proving that major capex items are reflected in the investment decision.
- `15-calculator-missing-scope-completeness-guard.png`: Missing scope completeness guard — The calculator prevents selected-but-uncosted refurb scope from appearing as a clean deal, proving that incomplete cost assumptions are flagged before an investor relies on the projected profit.

## Phase 3 Readiness Recommendation

Phase 2 is validated and suitable for client review.

Recommendations:
- Governance override behavior is functioning correctly
- Deterministic execution is proven
- Structured JSON outputs are stable
- Investor safety controls are active

Phase 3 should begin only after client review and formal acceptance of this Phase 2 validation package.
