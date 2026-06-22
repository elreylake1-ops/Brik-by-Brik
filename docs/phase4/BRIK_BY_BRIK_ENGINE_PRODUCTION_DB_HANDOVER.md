# Brik by Brik Engine Production DB Handover (Phase 4A)

## Purpose
This document prepares the Phase 4A database handover from temporary/staging Supabase ownership into the Brik by Brik Engine — Production Database.

## Naming and Ownership Correction
- Product/system name: Brik by Brik Engine.
- Production database name/reference: Brik by Brik Engine — Production Database.
- The Upwork/account name is separate and must not be used as the production system/database name.
- The Supabase project used for live Phase 4A QA was temporary/staging only.
- Production ownership should sit under James' Brik by Brik Engine Supabase project.

## Raw SQL Migration Package
Apply these raw SQL files in order:
1. `db/migrations/20260522_phase4a_saved_deals_table.sql`
2. `db/migrations/20260522_phase4a_deal_offers_table.sql`
3. `db/migrations/20260522_phase4a_deal_tasks_table.sql`

These are the production handover migration files for Phase 4A.

## Schema and Tables
Phase 4A schema namespace:
- `brik_by_brik_engine`

Phase 4A tables:
- `brik_by_brik_engine.saved_deals`
- `brik_by_brik_engine.deal_offers`
- `brik_by_brik_engine.deal_tasks`

Notes:
- The schema namespace isolates Phase 4A objects and prevents pollution in a shared Supabase project.
- The `public` schema should remain clean of Phase 4A tables.

## Indexes, Policies, and Security
Phase 4A confirmation:
- No custom indexes added.
- No RLS policies added.
- No triggers added.
- No seed data added.
- No multi-user/auth model added.

Default relational constraints present:
- `brik_by_brik_engine.saved_deals`: primary key on `id`.
- `brik_by_brik_engine.deal_offers`: foreign key `deal_id` -> `brik_by_brik_engine.saved_deals(id)` with `ON DELETE CASCADE`.
- `brik_by_brik_engine.deal_tasks`: foreign key `deal_id` -> `brik_by_brik_engine.saved_deals(id)` with `ON DELETE CASCADE`.

## Required Environment Variables
- `DATABASE_URL` is required.
- `DATABASE_URL` must point to the Brik by Brik Engine — Production Database.
- `.env.local` is local-only and must not be committed.
- Real `DATABASE_URL` values and passwords must not be stored in repo files or documentation.

## Credential Safety Confirmation
Repository-level confirmation:
- The app connects through `DATABASE_URL` (no hardcoded Supabase host/project binding in runtime DB adapter/repositories).
- No hardcoded Supabase project references were found in the inspected runtime files.
- Do not print secrets in logs, reports, or handoff notes.

Issue found during safety scan:
- `.env.local`: contains a real database credential/connection string (local file). Treat as local secret only, rotate if exposure is suspected, and never commit.

## Production Application Instructions
For James:
1. Open the Brik by Brik Engine Supabase project.
2. Open SQL Editor.
3. Apply migration SQL in this order:
   - `db/migrations/20260522_phase4a_saved_deals_table.sql`
   - `db/migrations/20260522_phase4a_deal_offers_table.sql`
   - `db/migrations/20260522_phase4a_deal_tasks_table.sql`
4. Verify tables exist under `brik_by_brik_engine`.
5. Verify `public` schema has no accidental Phase 4A tables.
6. Set `DATABASE_URL` in local/server environment to the Brik by Brik Engine — Production Database.
7. Run Phase 4A acceptance QA against production DB.

Verification SQL:

```sql
-- 1) list tables in brik_by_brik_engine
select table_schema, table_name
from information_schema.tables
where table_schema = 'brik_by_brik_engine'
order by table_name;
```

```sql
-- 2) check public schema for accidental Phase 4A tables
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('saved_deals', 'deal_offers', 'deal_tasks')
order by table_name;
```

```sql
-- 3) verify FK links for deal_offers and deal_tasks
select
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema as foreign_table_schema,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'brik_by_brik_engine'
  and tc.table_name in ('deal_offers', 'deal_tasks')
order by tc.table_name, kcu.column_name;
```

## Test Data Handling
- Test/staging data can be discarded.
- Staging data does not need to be migrated unless James explicitly requests it.
- If export is requested later, export only rows from:
  - `brik_by_brik_engine.saved_deals`
  - `brik_by_brik_engine.deal_offers`
  - `brik_by_brik_engine.deal_tasks`
- Do not export secrets.

## Temporary/Staging Supabase Confirmation
- The current Supabase project used for Phase 4A validation was temporary/staging only.
- It is not production ownership.
- Production ownership target is James' Brik by Brik Engine — Production Database.

## Required Retest After Migration
After production DB setup, rerun Phase 4A against Brik by Brik Engine — Production Database:
1. Save analysed deal.
2. List saved deals.
3. Open saved deal.
4. Guarded pipeline update.
5. Add offer.
6. Add task/blocker.
7. Verify Operator Command section.
8. Verify `engine_result_json` snapshot safety.

## Phase 4B Scope Reminder
Phase 4B should begin only after James confirms production DB ownership and successful Phase 4A production retest.

Phase 4B scope:
- Evidence Lite
- Investor Summary only

Explicitly excluded:
- AI
- scraping
- CRM
- automation
- advanced dashboards
- multi-user systems
- heavy UI expansion

## Recommended Next Step
Proceed with Brik by Brik Engine — Production Database migration and Phase 4A production retest.
