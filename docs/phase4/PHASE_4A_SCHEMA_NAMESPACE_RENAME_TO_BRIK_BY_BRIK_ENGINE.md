# Phase 4A Schema Namespace Rename to Brik by Brik Engine

## Purpose
Record the Phase 4A namespace correction after production ownership/naming clarification from James.

## Reason for Rename
- The Upwork/account name is separate.
- Product/system name is Brik by Brik Engine.
- Production namespace must align with Brik by Brik Engine naming for the Brik by Brik Engine â€” Production Database.

## Namespace Change
- Old schema (deprecated): `superseded staging Vercel project`
- New schema (active): `brik_by_brik_engine`

## Affected Migrations
- `db/migrations/20260522_phase4a_saved_deals_table.sql`
- `db/migrations/20260522_phase4a_deal_offers_table.sql`
- `db/migrations/20260522_phase4a_deal_tasks_table.sql`

Applied rename scope in migration SQL:
- `CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;`
- `brik_by_brik_engine.saved_deals`
- `brik_by_brik_engine.deal_offers`
- `brik_by_brik_engine.deal_tasks`
- FK updates:
  - `brik_by_brik_engine.deal_offers(deal_id)` references `brik_by_brik_engine.saved_deals(id)`
  - `brik_by_brik_engine.deal_tasks(deal_id)` references `brik_by_brik_engine.saved_deals(id)`

## Affected Repositories
- `lib/operator-command/saved-deals-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`

All schema-qualified SQL references now target `brik_by_brik_engine`.

## Affected Tests
- `__tests__/saved-deals-repository.test.ts`
- `__tests__/deal-offers-repository.test.ts`
- `__tests__/deal-tasks-repository.test.ts`
- `__tests__/phase4a-migration-consistency.test.ts`

Test expectations now assert `brik_by_brik_engine` schema/table/FK naming.

## Safety Confirmations
- No migrations were applied in this step.
- No runtime behavior changed.
- No deterministic engine behavior changed.
- No feature expansion was added.
- No new API routes were added.
- No UI changes were added.

## Production Warning
Do not apply the old deprecated `superseded staging Vercel project` Phase 4A migration variant to production.
Use only the renamed `brik_by_brik_engine` migration files.

