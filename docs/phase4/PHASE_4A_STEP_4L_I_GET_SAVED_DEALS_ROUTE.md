# Phase 4A Step 4L-I GET Saved Deals Route

## Purpose
Add a minimal list retrieval route for saved deals without introducing reopen/detail UI.

## Route Created
- `GET /api/saved-deals` in `app/api/saved-deals/route.ts`

## Query Parameter
- optional: `includeArchived=true`
- default behavior excludes archived deals

## Response Shape
- success: `200` with `{ success: true, deals }`
- server/repository failure: `500` with `{ success: false, error }`

## Test Approach
- route tests mock repository helpers
- verifies GET success and includeArchived behavior
- verifies safe 500 failure message
- verifies no calculator/engine imports and no forbidden runtime keys

## Live DB Limitation
- tests do not use live Supabase/Postgres
- runtime data retrieval still requires `DATABASE_URL` and applied migrations

## Deterministic Engine Boundary
- route does not import calculator/engine modules
- route only reads saved deal rows
- no deterministic recalculation or mutation

## Recommended Next Step
Phase 4A Step 4L-J - Implement `GET /api/saved-deals/[id]` Detail Route Only.
