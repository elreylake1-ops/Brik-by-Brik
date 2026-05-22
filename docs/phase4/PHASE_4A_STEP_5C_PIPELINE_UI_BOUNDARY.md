# Phase 4A Step 5C Pipeline UI Boundary

## Purpose
This document defines the minimum safe boundary for adding pipeline movement UI after the guarded pipeline API route.

## Current Capability
- saved deals can be created
- saved deals can be listed
- saved deals can be opened read-only
- pipeline API route exists
- pipeline API enforces guard before update
- no pipeline UI exists yet

## Pipeline UI Goal
- James should be able to request a pipeline state change from the selected saved deal detail panel
- UI should call `POST /api/saved-deals/[id]/pipeline`
- UI should show allowed/blocked/review-required result safely
- UI should refresh selected saved deal after successful update
- UI must not recalculate engine result
- UI must not mutate `engine_result_json`

## Recommended Minimal Path
1. Add a small pipeline state select in the saved deal read-only panel.
2. Add one `Update Pipeline` button.
3. Call `POST /api/saved-deals/[id]/pipeline`.
4. Show loading/success/error/blocked state.
5. Refresh selected saved deal after successful update.
6. Keep offers/tasks/notes/command view out of scope.

## Pipeline States To Show
- `UNDER_ANALYSIS`
- `READY_FOR_OFFER`
- `OFFER_SENT`
- `NEGOTIATING`
- `DUE_DILIGENCE`
- `COMPLETED`
- `REJECTED`
- `ARCHIVED`

## Boundaries
- no offer behavior yet
- no task behavior yet
- no command view yet
- no archive/edit UI yet beyond `pipeline_state` update
- no deterministic recalculation
- no engine snapshot mutation
- guard response should be displayed, not bypassed

## Recommended Next Step
Phase 4A Step 5D - Minimal Pipeline UI Only.
