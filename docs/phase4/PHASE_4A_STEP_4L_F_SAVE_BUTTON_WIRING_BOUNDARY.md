# Phase 4A Step 4L-F Save Button Wiring Boundary

## Purpose
This document defines the minimum safe UI wiring boundary for saving the current analysed deal.

## Current UI Findings
- analysed result state is created in `app/page.tsx` via `analyzeDealWithRefurb(inputs, scope?)`
- result display is rendered through `ResultsDisplay` (`result.deal`) and `EngineAnalysisPanel` (`result` + `inputs`)
- eventual save button owner should be `app/page.tsx` (closest shared owner of `inputs` and full `result`)
- data must be mapped from `inputs` + `result` into `POST /api/saved-deals`
- missing user-entered fields today: `address`, `listing_url`, and optional `next_action`; these must be added later as minimal inputs or safe defaults

## Save Button Boundary
- save button should only appear when a valid analysis result exists
- save action should call `POST /api/saved-deals`
- save action should pass `engine_result_json` as-is
- save action should not recalculate analysis
- save action should not change the calculator result
- success should show saved deal id or confirmation only
- failure should show safe error only

## Minimal Payload Mapping
Planned mapping to:
- `address`: future manual input
- `listing_url`: future optional manual input (nullable)
- `purchase_price`: from `inputs.purchasePrice`
- `gdv_realistic`: from `inputs.gdv`
- `refurb_cost`: from `result.refurb?.totalRefurbCost` when generated, otherwise `inputs.refurbCost`
- `classification`: from `result.dueDiligence?.decision.dealClassification` (fallback string default later)
- `governance_state`: from existing deterministic/governance output surface (or fallback mapping in UI layer later)
- `capital_protection_state`: from `result.dueDiligence?.decision.capitalProtectionStatus` (fallback string default later)
- `pipeline_state`: initial fixed value for save flow (e.g. `UNDER_ANALYSIS`) in later implementation
- `engine_result_json`: full `result` object as provided
- `risk_summary_json`: compact object from existing warnings/risk flags in later implementation
- `next_action`: future optional manual input or derived safe suggestion later

## Explicit Non-Goals
- no UI implementation in this step
- no save button yet
- no command view
- no reopen/list UI
- no pipeline movement
- no offers/tasks/notes
- no deterministic recalculation
- no engine changes

## Recommended Next Step
Phase 4A Step 4L-G - Minimal Save Button UI Only.

Status note: Phase 4A Step 4L-G minimal save button UI created. No reopen/list UI, command view, pipeline, offers, tasks, or notes behavior added.
