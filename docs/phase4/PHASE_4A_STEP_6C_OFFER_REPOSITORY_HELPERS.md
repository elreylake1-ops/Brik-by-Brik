# Phase 4A Step 6C Offer Repository Helpers

## Purpose
Add minimal server-side `deal_offers` repository helpers only.

## Helper List
- `createOffer(dealId, input)`
- `listOffersForDeal(dealId)`
- `updateOfferStatus(offerId, status)`
- `updateSellerResponse(offerId, sellerResponse)`

## Table Dependency
- depends on `deal_offers` table from:
  - `db/migrations/20260522_phase4a_deal_offers_table.sql`

## Test Approach
- mocked `lib/db/postgres` query helper
- verifies SQL target/field behavior for create/list/update helpers
- verifies no `saved_deals`/`engine_result_json` mutation path
- verifies no calculator/engine imports and no forbidden runtime keys

## Limitations
- no offer API routes
- no offer UI
- no task/note/evidence/audit/command view behavior
- no guard integration at repository layer

## Deterministic Engine Boundary
- deterministic engine remains untouched
- no engine recalculation
- no engine snapshot mutation

## Recommended Next Step
Phase 4A Step 6D - Offer API routes only (`POST` and `GET` for deal offers).

Status note: Phase 4A Step 6D offer API route boundary created. No offer API route, UI, task, note, command view, or engine behavior added.
