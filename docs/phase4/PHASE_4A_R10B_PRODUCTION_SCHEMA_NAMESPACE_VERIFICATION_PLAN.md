## Purpose
This verifies production schema/table presence before any migration or runtime fix.

## Baseline
- Branch: `main`
- Latest commit: `b488122`
- Production URL: `https://lakeviewsproperty.vercel.app`
- R10 result: `BLOCKED`
- R10A result: `ROOT CAUSE IDENTIFIED` as likely schema/namespace mismatch, but not confirmed by live DB introspection
- Failing routes:
  - `GET /api/saved-deals`
  - `GET /api/saved-deals/768e352c-1784-40b4-8169-a31716dee0e9`
  - `GET /api/saved-deals/768e352c-1784-40b4-8169-a31716dee0e9/investor-shield-ui`
- Suspected root cause: production `brik_by_brik_engine` schema/table mismatch or missing relation

## Required Runtime Tables
- `brik_by_brik_engine.saved_deals`
  - Used by `listSavedDeals` and `getSavedDealById` in `lib/operator-command/saved-deals-repository.ts`
- `brik_by_brik_engine.investor_shield_checks`
  - Used by `loadInvestorShieldUiModelForDeal` through `listInvestorShieldChecksByDealId`
- `brik_by_brik_engine.evidence_items`
  - Used by `loadInvestorShieldUiModelForDeal`
- `brik_by_brik_engine.risk_flags`
  - Used by `loadInvestorShieldUiModelForDeal`
- `brik_by_brik_engine.manual_overrides`
  - Used by `loadInvestorShieldUiModelForDeal`
- `brik_by_brik_engine.deal_offers`
  - Required by saved-deal offer related runtime, though not directly exercised by the failing GET routes
- `brik_by_brik_engine.deal_tasks`
  - Required by saved-deal task runtime, though not directly exercised by the failing GET routes
- `brik_by_brik_engine.builder_proposals`
  - Required by Investor Shield repository helper
- `brik_by_brik_engine.builder_contract_checks`
  - Required by Investor Shield repository helper

## Read-Only Verification Results
Live DB introspection from the shell was not available.

| Check | Expected | Observed | Result | Notes |
|---|---|---|---|---|
| Schema `brik_by_brik_engine` exists | present | not checked | not checked | Shell query against local `.env.local` failed auth |
| `brik_by_brik_engine.saved_deals` | present | not checked | not checked | Manual SQL check required |
| `brik_by_brik_engine.deal_offers` | present | not checked | not checked | Manual SQL check required |
| `brik_by_brik_engine.deal_tasks` | present | not checked | not checked | Manual SQL check required |
| `brik_by_brik_engine.investor_shield_checks` | present | not checked | not checked | Manual SQL check required |
| `brik_by_brik_engine.evidence_items` | present | not checked | not checked | Manual SQL check required |
| `brik_by_brik_engine.risk_flags` | present | not checked | not checked | Manual SQL check required |
| `brik_by_brik_engine.manual_overrides` | present | not checked | not checked | Manual SQL check required |
| `brik_by_brik_engine.builder_proposals` | present | not checked | not checked | Manual SQL check required |
| `brik_by_brik_engine.builder_contract_checks` | present | not checked | not checked | Manual SQL check required |
| `saved_deals` columns `id`, `deal_name`, `analysis`, `pipeline_stage`, `created_at`, `updated_at` | present if table exists | not checked | not checked | The actual runtime schema currently expects a different column set in code; verify any legacy shape separately |
| Proof ID `768e352c-1784-40b4-8169-a31716dee0e9` | exists if table exists | not checked | not checked | Skip until table presence is confirmed |

## Legacy Namespace Findings
- `public.saved_deals`: not checked
- `lake_views_property.saved_deals`: not checked
- Other documented namespace: `brik_by_brik_engine` is the canonical target in repo docs, but live presence was not confirmed from shell

## Proof ID Check
Not checked because live DB introspection was unavailable from the shell.

## Root Cause Confirmation
PARTIAL: DB introspection unavailable

## Minimal Fix Plan
Smallest safe next step:
- Open Supabase SQL editor for the production project.
- Run the read-only introspection SQL below.
- If `brik_by_brik_engine.saved_deals` is missing, proceed with `R10C` production schema migration in controlled order.
- If the tables exist only in a legacy namespace, prepare a namespace migration/copy/rename plan instead of a blind rename.
- If columns differ from the route expectations, add only the missing columns with a backward-compatible migration.

Manual SQL checklist:

```sql
select schema_name
from information_schema.schemata
where schema_name = 'brik_by_brik_engine';
```

```sql
select table_schema, table_name
from information_schema.tables
where table_schema in ('brik_by_brik_engine', 'public', 'lake_views_property')
  and table_name in (
    'saved_deals',
    'deal_offers',
    'deal_tasks',
    'investor_shield_checks',
    'evidence_items',
    'risk_flags',
    'manual_overrides',
    'builder_proposals',
    'builder_contract_checks'
  )
order by table_schema, table_name;
```

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'brik_by_brik_engine'
  and table_name = 'saved_deals'
  and column_name in ('id', 'deal_name', 'analysis', 'pipeline_stage', 'created_at', 'updated_at')
order by ordinal_position;
```

```sql
select id
from brik_by_brik_engine.saved_deals
where id = '768e352c-1784-40b4-8169-a31716dee0e9'
limit 1;
```

## Safety Confirmation
- no DB mutation
- no migrations run
- no env values printed
- no Vercel/Supabase settings changed
- no code/runtime behavior changed
- no production-ready classification made

## Result
PARTIALLY VERIFIED

## Recommended Next Step
R10C â€” apply the smallest safe production schema/namespace migration or backward-compatible fix after manual SQL verification in Supabase.
