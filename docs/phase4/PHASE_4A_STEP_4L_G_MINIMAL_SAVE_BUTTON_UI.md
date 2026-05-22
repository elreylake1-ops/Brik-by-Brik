# Phase 4A Step 4L-G Minimal Save Button UI

## Purpose
Add a minimal UI path to save the current analysed deal through existing `POST /api/saved-deals`.

## UI Added
- file: `app/page.tsx`
- save panel shown only when analysis output is visible (`hasDealInput`)
- fields added:
  - `address` (required)
  - `listing_url` (optional)
  - `next_action` (optional)
- button added: `Save Deal`
- loading state while request is in flight
- success message shows saved deal id
- failure message shows safe error text

## Payload Mapping Summary
- `address`: from save input
- `listing_url`: optional input or `null`
- `purchase_price`: `inputs.purchasePrice`
- `gdv_realistic`: `inputs.gdv`
- `refurb_cost`: generated refurb total when scope mode is active; otherwise `inputs.refurbCost`
- `classification`: `result.dueDiligence?.decision.dealClassification` fallback `result.verdict.status`
- `governance_state`: `result.verdict.status`
- `capital_protection_state`: `result.dueDiligence?.decision.capitalProtectionStatus` fallback `"UNKNOWN"`
- `pipeline_state`: `UNDER_ANALYSIS`
- `engine_result_json`: current `result` object as-is
- `risk_summary_json`: `{ riskFlags, warnings }` from current result surface
- `next_action`: optional input or `null`

## Test Approach
- relied on existing API route tests and full project regression checks (`test/build/lint`)
- no new UI interaction tests added because current suite is primarily static-render/unit oriented and does not include browser-style interaction tooling

## Limitations
- no reopen/list UI
- no command view
- no pipeline movement
- no offers/tasks/notes/evidence/audit behavior
- no retry/backoff UX beyond simple loading/error handling

## Boundary Confirmation
- no repository imports in UI
- no deterministic recalculation
- no calculator/engine logic changes
- save uses existing API route only

## Recommended Next Step
Phase 4A Step 4L-H - Minimal Save UI Interaction Test Coverage and small UX hardening (non-functional).

Status note: Phase 4A Step 4L-H saved-deal reopen/list boundary created. No GET route, list UI, reopen UI, command view, pipeline, offers, tasks, or notes behavior added.
