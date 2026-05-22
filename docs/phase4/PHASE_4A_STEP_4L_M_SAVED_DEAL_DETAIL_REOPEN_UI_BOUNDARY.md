# Phase 4A Step 4L-M Saved Deal Detail/Reopen UI Boundary

## Purpose
This document defines the minimum safe boundary for opening one saved deal from the saved deals list.

## Current Capability
- analysed deal can be saved
- saved deals can be listed in UI
- saved deal detail can be fetched through `GET /api/saved-deals/[id]`
- list currently has non-functional View affordance
- no detail/reopen UI exists yet

## Detail/Reopen Goal
- James should be able to click/open one saved deal
- UI should fetch `GET /api/saved-deals/[id]`
- UI should show stored saved deal data read-only
- UI should show stored `engine_result_json` read-only or compact summary
- reopening must not recalculate deterministic result
- reopening must not mutate saved data

## Recommended Minimal Path
1. Turn `View (soon)` into a simple local selection action.
2. Fetch `GET /api/saved-deals/[id]`.
3. Show a read-only detail panel in `app/page.tsx`.
4. Display `address`, `classification`, `governance_state`, `capital_protection_state`, `pipeline_state`, `purchase_price`, `gdv_realistic`, `refurb_cost`, and `next_action`.
5. Include a compact saved engine snapshot section if practical.
6. Do not build command view yet.

## Boundaries
- no edit yet
- no archive yet
- no pipeline movement yet
- no offers/tasks/notes yet
- no command view yet
- no deterministic recalculation
- no engine mutation

## Recommended Next Step
Phase 4A Step 4L-N - Minimal Saved Deal Detail/Reopen UI Only.
