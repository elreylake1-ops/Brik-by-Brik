# Phase 4A Step 6G Minimal Offer UI

## Purpose
Add a minimal offer form and offer history UI inside the selected saved deal panel.

## UI Added
- file: `app/page.tsx`
- added Offer section in selected saved deal detail panel
- fetches offer history via `GET /api/saved-deals/[id]/offers`
- adds offers via `POST /api/saved-deals/[id]/offers`

## Offer Fields Shown
- `offer_amount`
- `offer_type`
- `offer_status`
- `offer_rationale`
- `seller_response`
- `created_at`

## Add Offer Behavior
- requires valid `offer_amount`
- defaults form to `offer_type = INITIAL`, `offer_status = DRAFT`
- submits with `Add Offer` button
- shows loading state and safe success/error messages
- refreshes offer history after successful add

## Test Approach
- no new UI interaction test infrastructure added
- relied on existing offer API route tests and full project checks (`test/build/lint`)

## Limitations
- no offer status update route
- no seller-response update route
- no tasks/notes/evidence/audit/command view behavior

## Boundary Confirmation
- no saved_deals mutation
- no pipeline mutation
- no engine recalculation
- no `engine_result_json` mutation

## Recommended Next Step
Phase 4A Step 6H - Offer status/seller-response update route boundary.

Status note: Phase 4A Step 7A task engine boundary created. No task table, repository, API, UI, note, evidence, command view, or engine behavior added.
