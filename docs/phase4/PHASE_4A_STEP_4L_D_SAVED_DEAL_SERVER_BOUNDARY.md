# Phase 4A Step 4L-D Saved Deal Server Boundary

## Purpose
This document decides the smallest safe server boundary for saving analysed deals before UI wiring.

## Current App Findings
- no existing `app/api` route pattern found
- no existing saved-deal server action found
- main analysed result lives in `app/page.tsx`
- repository helper exists but is not wired
- live DB requires `DATABASE_URL` and applied `saved_deals` migration

## Server Boundary Options
1. Server action near `app/page.tsx` flow.
2. API route under `app/api/saved-deals`.
3. Defer server boundary and keep repository only.

## Recommended Decision
Use a small `app/api/saved-deals` route first.
- reason: current calculator is client-interactive, and an API route is simpler to call from UI later
- keep input validation minimal
- call `createSavedDeal` only
- do not implement `get`/`list`/reopen yet
- do not implement `update`/`archive` yet
- do not implement command view yet

## Future Route Contract
Planned endpoint: `POST /api/saved-deals` only.

Accepted input:
- `address`
- `listing_url`
- `purchase_price`
- `gdv_realistic`
- `refurb_cost`
- `classification`
- `governance_state`
- `capital_protection_state`
- `pipeline_state`
- `engine_result_json`
- `risk_summary_json`
- `next_action`

Response:
- `success` true/false
- saved deal id if successful
- safe error message if failed

## Boundaries
- route must be server-side only
- route must not recalculate deterministic output
- route must not change engine logic
- route must not create offers/tasks/notes
- route must not add UI
- route must not expose DB credentials

## Recommended Next Step
Phase 4A Step 4L-E - Implement `POST /api/saved-deals` Only.

Status note: Phase 4A Step 4L-E POST /api/saved-deals route created. No UI, command view, pipeline movement, offers, tasks, notes, evidence, or audit behavior added.
