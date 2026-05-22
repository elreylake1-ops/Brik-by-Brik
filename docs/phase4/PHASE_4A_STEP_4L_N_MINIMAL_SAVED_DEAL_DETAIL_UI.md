# Phase 4A Step 4L-N Minimal Saved Deal Detail/Reopen UI

## Purpose
Add a minimal read-only saved deal detail/reopen UI using the existing saved deal detail route.

## UI Added
- file: `app/page.tsx`
- replaced `View (soon)` with a local `View` action in the saved deals list
- fetches `GET /api/saved-deals/[id]` on click
- renders a read-only saved deal detail panel

## Fields Displayed
- `address`
- `classification`
- `governance_state`
- `capital_protection_state`
- `pipeline_state`
- `purchase_price`
- `gdv_realistic`
- `refurb_cost`
- `next_action`
- compact saved engine snapshot (`engine_result_json` key count)

## Loading/Error States
- loading: `Loading saved deal detail...`
- error: safe server error message
- empty selection: prompt to select a saved deal from list

## Test Approach
- no new UI interaction test infrastructure added
- relied on existing API route tests plus full project regression checks (`test/build/lint`)

## Limitations
- no edit behavior
- no archive behavior
- no pipeline movement
- no command view
- no offers/tasks/notes/evidence/audit behavior
- no calculator input reload from saved deal
- no deterministic recalculation or mutation of saved deal data

## Boundary Confirmation
- detail panel is read-only
- saved deal data is displayed from API response only
- calculator/engine logic remains unchanged

## Recommended Next Step
Phase 4A Step 4L-O - Define command view boundary and read-only command surface plan.

Status note: Phase 4A Step 5A pipeline movement boundary created. No pipeline API route, UI, offers, tasks, notes, command view, or engine behavior added.
