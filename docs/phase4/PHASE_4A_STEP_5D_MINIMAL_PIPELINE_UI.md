# Phase 4A Step 5D Minimal Pipeline UI

## Purpose
Add minimal pipeline state controls in the selected saved deal detail panel using the existing guarded pipeline API route.

## UI Added
- file: `app/page.tsx`
- added pipeline state select in the selected saved deal read-only panel
- added `Update Pipeline` button
- calls `POST /api/saved-deals/[id]/pipeline`
- refreshes selected saved deal detail and saved deals list after successful update

## Pipeline States Shown
- `UNDER_ANALYSIS`
- `READY_FOR_OFFER`
- `OFFER_SENT`
- `NEGOTIATING`
- `DUE_DILIGENCE`
- `COMPLETED`
- `REJECTED`
- `ARCHIVED`

## Guard Response Handling
- shows loading while request is in flight
- success response shows updated pipeline confirmation
- blocked/review-required/error response shows safe error message from API
- no bypass of guard outcomes in UI

## Test Approach
- no new UI interaction test infrastructure added
- relied on existing guarded pipeline route tests plus full project regression checks (`test/build/lint`)

## Limitations
- no command view
- no offers/tasks/notes/evidence/audit behavior
- no archive/edit UI beyond pipeline state update
- no additional workflow actions from guard-required outcomes

## Boundary Confirmation
- no deterministic recalculation
- no `engine_result_json` mutation
- calculator/engine logic unchanged

## Recommended Next Step
Phase 4A Step 5E - Pipeline UI refinement for guard reason visibility and clearer blocked-state messaging.
