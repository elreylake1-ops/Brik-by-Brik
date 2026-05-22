# Phase 4A Step 6E Offer API Routes

## Purpose
Add minimal offer API routes for creating and listing offers per saved deal.

## Routes Created
- `POST /api/saved-deals/[id]/offers`
- `GET /api/saved-deals/[id]/offers`
- file: `app/api/saved-deals/[id]/offers/route.ts`

## Request/Response Shape
- `GET`
  - request: route param `id`
  - response `200`: `{ success: true, offers }`
  - invalid id: `400`
  - server/repository failure: safe `500`
- `POST`
  - request: route param `id`, JSON body:
    - `offer_amount` (required number)
    - `offer_type` (optional, defaults `INITIAL`)
    - `offer_status` (optional, defaults `DRAFT`)
    - `offer_rationale` (optional nullable string)
    - `seller_response` (optional nullable string)
  - response `201`: `{ success: true, offer }`
  - invalid input: `400`
  - server/repository failure: safe `500`

## Test Approach
- mocked deal-offers repository helpers
- verifies GET/POST success and validation/error paths
- verifies defaulting behavior for `offer_type` and `offer_status`
- verifies no calculator/engine imports and no saved_deals/engine snapshot mutation paths

## Limitations
- no offer UI
- no offer status update route yet
- no seller response update route yet
- no tasks/notes/evidence/audit/command view behavior

## Deterministic Engine Boundary
- deterministic engine untouched
- no engine recalculation
- no `engine_result_json` mutation

## Recommended Next Step
Phase 4A Step 6F - Minimal Offer UI boundary and safe wiring plan.

Status note: Phase 4A Step 6F offer UI boundary created. No offer UI, status update route, seller-response route, task, note, command view, saved-deal mutation, pipeline mutation, or engine behavior added.
