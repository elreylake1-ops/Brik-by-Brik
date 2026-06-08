## Purpose
Diagnose production saved-deals runtime after manual Supabase SQL verification showed the expected schema exists in `brik_by_brik_engine`.

## Baseline
- Current branch: `main`
- Latest commit: `7c01e53`
- Production URL: `https://lakeviewsproperty.vercel.app`
- Vercel project: `lakeviewsproperty`
- Linked repo: `karloangeloalamares-cyber/Brik-by-Brik`
- Production branch: `main`
- Deployment commit: latest deployed commit on the verified Ready deployment
- Deployment status: `Ready`
- DATABASE_URL presence: `yes`, value not shown

## Confirmed Production Schema
Manual Supabase SQL confirmed:
- schema `brik_by_brik_engine` exists
- `brik_by_brik_engine.saved_deals` exists
- `brik_by_brik_engine.deal_offers` exists
- `brik_by_brik_engine.deal_tasks` exists
- `brik_by_brik_engine.investor_shield_checks` exists
- `brik_by_brik_engine.evidence_items` exists
- `brik_by_brik_engine.risk_flags` exists
- `brik_by_brik_engine.manual_overrides` exists
- `brik_by_brik_engine.builder_proposals` exists
- `brik_by_brik_engine.builder_contract_checks` exists
- `saved_deals.id` is `text`
- documented proof ID `768e352c-1784-40b4-8169-a31716dee0e9` does not exist
- `saved_deals` columns are:
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

## Route / Repository Contract Comparison

### `GET /api/saved-deals`
- Expected contract: `listSavedDeals()` projection in `lib/operator-command/saved-deals-repository.ts`
- Repository fields: match the production `saved_deals` columns above
- Contract mismatch: no
- Safe empty-state behavior: yes, list route should still return `200` with `[]`

### `GET /api/saved-deals/[id]`
- Expected contract: same `SAVED_DEAL_FIELDS` projection
- Repository fields: match the production `saved_deals` columns above
- Contract mismatch: no
- Safe missing-ID behavior: yes, code returns `404` when no deal exists

### `GET /api/saved-deals/[id]/investor-shield-ui`
- Expected contract:
  - `investor_shield_checks`: `id`, `deal_id`, `gate_key`, `sub_gate_key`, `status`, `severity`, `confidence`, `required_evidence`, `summary`, `created_at`, `updated_at`
  - `evidence_items`: `id`, `deal_id`, `gate_key`, `sub_gate_key`, `evidence_type`, `source`, `label`, `notes`, `file_url`, `advisory_only`, `created_at`
  - `risk_flags`: `id`, `deal_id`, `gate_key`, `severity`, `message`, `source`, `created_at`
  - `manual_overrides`: `id`, `deal_id`, `gate_key`, `reason`, `approved_by`, `created_at`
  - `builder_proposals`: `id`, `deal_id`, `builder_name`, `quoted_amount`, `scope_summary`, `status`, `created_at`
  - `builder_contract_checks`: `id`, `deal_id`, `builder_proposal_id`, `status`, `has_signed_contract`, `has_payment_schedule`, `has_scope_of_works`, `has_start_date`, `has_insurance_evidence`, `notes`, `created_at`
- Repository fields: match the production table layouts verified in SQL
- Contract mismatch: no
- Safe empty-child-table behavior: yes in read-model path, arrays can be empty
- Safe missing-parent-deal behavior: not explicitly enforced at route boundary

## Empty / Missing ID Handling
- List route with zero rows: handled safely in code
- Detail route with missing ID: handled safely in code with `404`
- Investor Shield route with missing child rows: should degrade to empty read-model arrays
- Investor Shield route with missing parent deal: not explicitly checked before child-table load
- Documented proof ID handling: the known proof ID is absent in production, so any route depending on that exact ID cannot be retested as a success-path proof

## Production Log Evidence
- `vercel logs https://lakeviewsproperty.vercel.app --since 30m` returned no log lines for the failure window
- No runtime stack trace, SQL error code, or route-specific exception was captured
- No evidence of column-mismatch error was found in logs
- Logs are insufficient for a definitive runtime failure class

## Root Cause
UNKNOWN

Evidence does not support a schema contract mismatch. The production schema matches the repository contract, and the documented proof ID is missing. The remaining failure class is therefore more likely a route/runtime issue, a missing parent-record path, or an unlogged connection/auth problem.

## Minimal Fix Plan
Smallest safe next step:
- add temporary safe runtime error logging around saved-deals and Investor Shield read paths
- capture non-secret error class, route context, and database error code if present
- if the route is failing on missing parent deal, return explicit `404`
- if the route is failing on DB connection/auth, fix the connection helper rather than the schema
- keep production data unchanged

## Safety Confirmation
- no migrations run
- no production data mutated
- no env values printed
- no Vercel or Supabase settings changed
- no schema changes made
- no production-ready classification changed

## Result
BLOCKED

## Recommended Next Step
Phase 4A-R10D - safe runtime logging patch and targeted repro
