# Phase 4 Schema Namespace Runtime Fix

## Purpose
Provide a runtime-safe handoff for the Supabase namespace mismatch that blocked manual execution of the Phase 4B Investor Shield migration.

## Root Cause
- The Investor Shield draft migration correctly references `brik_by_brik_engine.saved_deals`.
- The Supabase runtime that raised `ERROR: 42P01: relation "brik_by_brik_engine.saved_deals" does not exist` did not have the canonical Phase 4A base table available under `brik_by_brik_engine` at execution time.
- This is a runtime namespace/state mismatch, not a reason to revert Investor Shield back to `superseded staging Vercel project`.

## Canonical Schema
- Canonical schema: `brik_by_brik_engine`
- Canonical Phase 4A base tables:
  - `brik_by_brik_engine.saved_deals`
  - `brik_by_brik_engine.deal_offers`
  - `brik_by_brik_engine.deal_tasks`
- Canonical Phase 4B draft migration dependency:
  - `brik_by_brik_engine.saved_deals`

## ID Type Safety
- Do not change `deal_id` columns to `UUID`.
- `saved_deals.id` remains `TEXT`.
- All dependent `deal_id` foreign-key columns must remain `TEXT` to stay type-aligned with `saved_deals.id`.

## Safe Supabase Checks First
Run these queries before executing any additional Phase 4 SQL:

```sql
select table_schema, table_name
from information_schema.tables
where table_name in ('saved_deals', 'deal_offers', 'deal_tasks');
```

```sql
select table_schema, table_name, column_name, data_type
from information_schema.columns
where table_name = 'saved_deals'
and column_name = 'id';
```

## Safe Remediation Options
### A. `brik_by_brik_engine` missing, `superseded staging Vercel project` exists
- Back up the existing data first.
- Review a namespace transition plan before moving or recreating tables.
- Do not run destructive drop statements against `superseded staging Vercel project` as part of this step.

### B. Neither schema path exists
- Apply the canonical Phase 4A migrations first:
  - `db/migrations/20260522_phase4a_saved_deals_table.sql`
  - `db/migrations/20260522_phase4a_deal_offers_table.sql`
  - `db/migrations/20260522_phase4a_deal_tasks_table.sql`

### C. Running Phase 4B Investor Shield
- Only run `db/migrations/20260524_phase4b_investor_shield_tables.sql` after `brik_by_brik_engine.saved_deals` exists in the target Supabase runtime.

## Safety Notes
- No live migration is applied from repo code in this step.
- No destructive migration is introduced here.
- If a transition SQL step is drafted later, it must be idempotent, backup-aware, and manually reviewed before any Supabase execution.

