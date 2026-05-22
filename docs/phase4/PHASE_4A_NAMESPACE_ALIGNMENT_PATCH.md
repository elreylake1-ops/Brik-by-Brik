# Phase 4A Namespace Alignment Patch

## Purpose
Apply Phase 4A namespace alignment so shared Supabase usage is isolated to the dedicated schema without changing feature scope.

## Schema Used
- `brik_by_brik_engine`

## Migrations Updated
- `db/migrations/20260522_phase4a_saved_deals_table.sql`
- `db/migrations/20260522_phase4a_deal_offers_table.sql`
- `db/migrations/20260522_phase4a_deal_tasks_table.sql`

Changes made:
- added `CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;`
- table creation is now schema-qualified:
  - `brik_by_brik_engine.saved_deals`
  - `brik_by_brik_engine.deal_offers`
  - `brik_by_brik_engine.deal_tasks`
- FK references are schema-qualified:
  - `deal_offers.deal_id -> brik_by_brik_engine.saved_deals(id)`
  - `deal_tasks.deal_id -> brik_by_brik_engine.saved_deals(id)`

## Repository SQL Updated
- `lib/operator-command/saved-deals-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`

All table references are now schema-qualified to `brik_by_brik_engine`.

## Test Updates
- `__tests__/saved-deals-repository.test.ts`
- `__tests__/deal-offers-repository.test.ts`
- `__tests__/deal-tasks-repository.test.ts`
- `__tests__/phase4a-migration-consistency.test.ts`

Updated expectations now verify schema-qualified SQL and migration-level schema/FK alignment.

## Warning
Migrations have not been applied in this step.

## Recommended Next Step
Run controlled migration application in the target Supabase environment, then execute live DB acceptance QA.
