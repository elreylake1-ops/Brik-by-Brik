# Phase 4A Step 4L-B Saved Deal Repository

## Purpose
Implement server-side saved_deals repository helpers only for Phase 4A MVP persistence preparation.

## Repository Helpers
- `createSavedDeal(input)`
- `getSavedDealById(id)`
- `listSavedDeals(options)`
- `updateSavedDeal(id, patch)`
- `archiveSavedDeal(id)`

## saved_deals Schema Dependency
- repository targets `saved_deals`
- required columns:
  - `id`
  - `created_at`
  - `updated_at`
  - `archived_at`
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

## Migration Adjustment
- added: `db/migrations/20260522_phase4a_saved_deals_table.sql`
- scope is limited to creating `saved_deals` only
- older seven-table migration remains unchanged

## Test Approach
- no live DB required
- `lib/db/postgres` `query` helper is mocked
- tests verify SQL/table targeting and parameter mapping
- tests verify JSON pass-through for `engine_result_json` and `risk_summary_json`
- tests verify archived filtering behavior in `listSavedDeals`
- tests verify archive behavior sets `archived_at` and `pipeline_state = ARCHIVED`

## Runtime Boundary
- no offers/tasks/notes/evidence/audit/command view behavior added
- no API routes or UI added
- no calculator wiring added
- deterministic engine behavior remains untouched

## Live DB Limitation
- tests do not validate live Supabase connectivity in this step

## Recommended Next Step
Phase 4A next step: wire repository usage only where explicitly approved, still keeping API/UI/calculator wiring scoped separately.

Status note: Phase 4A Step 4L-C integration boundary created. No API/server action/UI/command view/pipeline/offers/tasks/notes behavior added.
