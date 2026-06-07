## Purpose
This document investigates the safe 500 responses from saved-deal read and Investor Shield read-only API routes.

## Reproduction Environment
- Local target/port: built production server on `http://127.0.0.1:3005`
- Branch: `main`
- Latest commit: `cbae93e`
- Production start command: `npm run start -- --port 3005 --hostname 127.0.0.1`
- Env reporting method: masked/presence-only

## Reproduction Result
- Saved-deal read route status/result shape: HTTP `500` with `{"success":false,"error":"Unable to load saved deal at this time."}`
- Investor Shield UI route status/result shape: HTTP `500` with `{"success":false,"error":"Investor Shield status could not be loaded. Pipeline rules remain unchanged."}`
- Root page still returns HTTP `200`
- No mutation occurred

## Diagnosis
The repository and read-model code paths are not failing in isolation. When invoked directly in-process with the same saved-deal id and the local database URL loaded from `.env.local`, both the saved-deal repository call and the Investor Shield UI loader return successfully with a valid row/model.

The safe 500 therefore appears to be specific to the spawned Next production server environment used for the HTTP proof, not to a saved-deal row-shape mismatch, repository mapping error, schema mismatch, or Investor Shield evaluation bug.

## Schema / Data Shape Findings
- `saved_deals` columns required by the repository are present:
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
- Investor Shield table columns are present:
  - `investor_shield_checks`: `id`, `deal_id`, `gate_key`, `sub_gate_key`, `status`, `severity`, `confidence`, `required_evidence`, `summary`, `created_at`, `updated_at`
  - `evidence_items`: `id`, `deal_id`, `gate_key`, `sub_gate_key`, `evidence_type`, `source`, `label`, `notes`, `file_url`, `advisory_only`, `created_at`
  - `risk_flags`: `id`, `deal_id`, `gate_key`, `severity`, `message`, `source`, `created_at`
  - `manual_overrides`: `id`, `deal_id`, `gate_key`, `reason`, `approved_by`, `created_at`
- `saved_deals.id` remains `text`
- No missing or mismatched fields were identified in the inspected schema surface

## Fix Applied
None.

## Safety Confirmation
- no secrets printed
- no env files committed
- no migrations run
- no inserts/updates/deletes
- no task creation
- no pipeline mutation
- no evidence upload
- no Vercel/Supabase setting changed

## Result
DIAGNOSED ONLY

## Recommended Next Step
Phase 4A-R7B â€” Safe Runtime Success Recheck with Confirmed DATABASE_URL Propagation.

