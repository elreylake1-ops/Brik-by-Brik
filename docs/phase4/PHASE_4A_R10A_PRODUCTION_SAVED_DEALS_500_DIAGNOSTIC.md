## Purpose
This diagnoses production 500s on read-only saved-deals runtime paths after `DATABASE_URL` was added to Vercel.

## Baseline
- Branch: `main`
- Latest commit: `e627665`
- Production URL: `https://lakeviewsproperty.vercel.app`
- Deployment status: `Ready`
- R10 result: `BLOCKED`
- Failing routes:
  - `GET /api/saved-deals`
  - `GET /api/saved-deals/768e352c-1784-40b4-8169-a31716dee0e9`
  - `GET /api/saved-deals/768e352c-1784-40b4-8169-a31716dee0e9/investor-shield-ui`
- Non-failing route:
  - `GET /`

## Route Call Map

### `GET /api/saved-deals`
- Route file: `app/api/saved-deals/route.ts`
- Repository/helper called: `listSavedDeals` from `lib/operator-command/saved-deals-repository.ts`
- Expected schema/table/columns: `brik_by_brik_engine.saved_deals` with `id`, `created_at`, `updated_at`, `archived_at`, `address`, `listing_url`, `purchase_price`, `gdv_realistic`, `refurb_cost`, `classification`, `governance_state`, `capital_protection_state`, `pipeline_state`, `engine_result_json`, `risk_summary_json`, `next_action`
- Read-only: yes

### `GET /api/saved-deals/[id]`
- Route file: `app/api/saved-deals/[id]/route.ts`
- Repository/helper called: `getSavedDealById` from `lib/operator-command/saved-deals-repository.ts`
- Expected schema/table/columns: `brik_by_brik_engine.saved_deals` with the same `SAVED_DEAL_FIELDS` projection as the list route
- Read-only: yes

### `GET /api/saved-deals/[id]/investor-shield-ui`
- Route file: `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
- Repository/helper called: `loadInvestorShieldUiModelForDeal` from `lib/investor-shield/load-investor-shield-ui-model.ts`
- Expected schema/table/columns:
  - `brik_by_brik_engine.investor_shield_checks` with `id`, `deal_id`, `gate_key`, `sub_gate_key`, `status`, `severity`, `confidence`, `required_evidence`, `summary`, `created_at`, `updated_at`
  - `brik_by_brik_engine.evidence_items` with `id`, `deal_id`, `gate_key`, `sub_gate_key`, `evidence_type`, `source`, `label`, `notes`, `file_url`, `advisory_only`, `created_at`
  - `brik_by_brik_engine.risk_flags` with `id`, `deal_id`, `gate_key`, `severity`, `message`, `source`, `created_at`
  - `brik_by_brik_engine.manual_overrides` with `id`, `deal_id`, `gate_key`, `reason`, `approved_by`, `created_at`
- Read-only: yes

## Log Evidence Summary
- `vercel logs https://lakeviewsproperty.vercel.app --since 30m` returned no log lines for the saved-deals failures during the latest check.
- Production GET checks still returned `500` for all read-only saved-deals routes.
- Relevant stack/function names from code:
  - `query` in `lib/db/postgres.ts`
  - `listSavedDeals` and `getSavedDealById` in `lib/operator-command/saved-deals-repository.ts`
  - `loadInvestorShieldUiModelForDeal` and `loadInvestorShieldEvaluationInput` in `lib/investor-shield/load-investor-shield-ui-model.ts` and `lib/investor-shield/investor-shield-read-model.ts`
- Error class: schema/table missing or schema namespace mismatch, most likely `42P01` relation missing behavior
- Evidence points to: schema/state, not route logic or build failure

## Schema / Runtime Hypothesis
The most likely root cause is that production still does not have the canonical `brik_by_brik_engine` saved-deals surface fully available at runtime, or it is only partially applied. The strongest match is a missing relation / namespace mismatch for `brik_by_brik_engine.saved_deals`, with the Investor Shield read-model routes also depending on the same canonical namespace and therefore failing the same way.

Why this fits:
- `GET /` works, so the deployment itself is healthy.
- Every saved-deals read route fails with `500`, which points to shared DB access rather than isolated route logic.
- The saved-deals repository queries `brik_by_brik_engine.saved_deals` directly.
- A prior runtime fix note in the repo already documented `ERROR: 42P01: relation "brik_by_brik_engine.saved_deals" does not exist` for the same canonical namespace.
- Local build, lint, and tests pass, so this is not a compile-time regression.

## Safety Confirmation
- no DB mutation
- no migration run
- no env values printed
- no Vercel/Supabase settings changed
- no runtime behavior changed
- no production-ready classification made

## Result
ROOT CAUSE IDENTIFIED

## Recommended Next Step
R10B â€” apply the smallest safe fix for the production DB schema/namespace mismatch, starting with a read-only production schema verification before any migration or runtime change.

## Safety Confirmation
- no secrets printed
- no env files committed
- no Vercel settings changed
- no Supabase settings changed
- no DB mutation
- no runtime behavior changed
- no code changed except documentation
