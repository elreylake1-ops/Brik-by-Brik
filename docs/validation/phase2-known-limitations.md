# Phase 2 Known Limitations

These limitations remain open after Phase 2E and must stay visible before any Phase 3 discussion.

## MANUAL_COMPARABLE_INPUT_ONLY

- Limitation: Comparable evidence remains manual input only.
- Impact: GDV quality depends on the operator supplying sold comparables.
- Recommended refinement: Add sold-comparable ingestion and validation workflows in a later approved phase.

## NO_AUTOMATED_SOLD_PRICE_VALIDATION

- Limitation: No automated sold-price validation exists yet.
- Impact: The engine cannot independently verify claimed sold evidence.
- Recommended refinement: Add deterministic sold-price cross-checks before Phase 3 approval.

## NO_AI_LISTING_EXTRACTION

- Limitation: No AI listing extraction is implemented.
- Impact: Listing and motivation signals depend on structured user input only.
- Recommended refinement: Keep extraction manual unless a later approved phase explicitly permits AI.

## NO_LIVE_MARKET_INTEGRATIONS

- Limitation: No live Rightmove, Zoopla, or Land Registry integration is implemented.
- Impact: The engine cannot verify live market context in real time.
- Recommended refinement: Add approved deterministic data integrations in a later phase if required.

## RULES_BASED_REFURB_ASSUMPTIONS

- Limitation: Refurb estimation remains rules-based and assumption-driven.
- Impact: Capex confidence still depends on user-supplied scope and evidence quality.
- Recommended refinement: Expand builder-quote and scope validation rules in future calibration phases.

## GDV_CONFIDENCE_USER_DEPENDENT

- Limitation: GDV confidence depends on user-provided evidence quality.
- Impact: Weak or missing comparable evidence still requires manual challenge.
- Recommended refinement: Add stronger comparable coverage and valuation challenge workflows.

## LEGAL_STRUCTURAL_USER_INDICATED

- Limitation: Legal and structural risks are user-indicated, not independently verified.
- Impact: The engine can block declared risks but cannot discover them autonomously.
- Recommended refinement: Add approved survey/legal evidence intake rules before scaling progression.

## NO_PERSISTENT_ANALYSIS_HISTORY

- Limitation: No persistent analysis history database exists yet.
- Impact: Validation output is deterministic per run but not stored as historical deal memory.
- Recommended refinement: Add persistence only in a later approved phase.

## NO_AUTOMATED_LENDER_VALIDATION

- Limitation: No automated lender or refinance validation exists yet.
- Impact: Leverage and refinance checks remain rules-based rather than lender-confirmed.
- Recommended refinement: Add lender policy validation only if later approved.
