# Phase 4A Step 8B Minimal Operator Command View

## Purpose
Add a compact Operator Command summary section in the selected saved deal panel using existing loaded state.

## UI Added
- file: `app/page.tsx`
- added read-only `Operator Command` section above pipeline, offer, and task controls
- uses existing selected deal, offers, and tasks state only

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

## Offer/Task Summary Behavior
- offer summary shows latest loaded offer amount and status if present
- if offers are loading: shows loading placeholder
- if no offers loaded: shows safe placeholder
- task summary shows open task count and blocked task count
- if tasks are loading: shows loading placeholder

## Test Approach
- no additional UI interaction tests were added
- relied on existing API route tests and full project checks (`npm run test`, `npm run build`, `npm run lint`)

## Limitations
- no command actions added from this section
- no AI summaries, exports, investor pack generation, automation, or evidence/notes/audit behavior
- no new persistence or calculations

## Boundary Confirmation
- no new API routes
- no new migrations
- deterministic engine remains untouched
- no `engine_result_json` mutation or recalculation

## Recommended Next Step
Phase 4A Step 8C - Command View Actions Boundary (read-only to guarded actions transition).
