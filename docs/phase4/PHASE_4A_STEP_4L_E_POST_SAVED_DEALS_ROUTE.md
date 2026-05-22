# Phase 4A Step 4L-E POST Saved Deals Route

## Purpose
Implement the first saved-deal server runtime boundary using only `POST /api/saved-deals`.

## Route Created
- `app/api/saved-deals/route.ts`
- implemented only `POST`

## Accepted Input
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

## Response Shape
- success: `201` with `{ success: true, deal }`
- invalid input: `400` with `{ success: false, error }`
- repository/server failure: `500` with `{ success: false, error }`

## Test Approach
- route tests mock `createSavedDeal`
- no live DB required
- verifies status codes and response payloads
- verifies `engine_result_json` pass-through to repository
- verifies safe failure message for repository errors

## Live DB Limitation
- runtime persistence still requires `DATABASE_URL` and applied `saved_deals` migration in the deployment environment

## Deterministic Engine Boundary
- route does not import calculator/engine modules
- route does not recalculate deterministic engine output
- `engine_result_json` is persisted from input payload

## Recommended Next Step
Phase 4A Step 4L-F - Add minimal non-UI integration test coverage for route payload shaping from existing analysis result surface.
