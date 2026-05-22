# Phase 4A Shared Supabase Namespace Plan

## Purpose
Define safe table namespacing for Phase 4A before running migrations in a shared Supabase project.

## Why Namespacing Is Required
- The Supabase instance is shared across multiple projects.
- Current Phase 4A migrations create unqualified table names in the default schema context.
- Unqualified names increase risk of cross-project data mixing and accidental query overlap.

## Chosen Namespace
- Dedicated Postgres schema: `brik_by_brik_engine`

## Target Tables
- `brik_by_brik_engine.saved_deals`
- `brik_by_brik_engine.deal_offers`
- `brik_by_brik_engine.deal_tasks`

## Migration Adjustment Required
Before applying Phase 4A migrations to shared Supabase, update migrations to:
- create schema if not exists `brik_by_brik_engine`
- create tables with schema-qualified names
- qualify FK references to the schema-qualified parent table

Expected pattern:
- `create table if not exists brik_by_brik_engine.saved_deals (...)`
- `create table if not exists brik_by_brik_engine.deal_offers (... deal_id text not null references brik_by_brik_engine.saved_deals(id) on delete cascade ...)`
- `create table if not exists brik_by_brik_engine.deal_tasks (... deal_id text not null references brik_by_brik_engine.saved_deals(id) on delete cascade ...)`

## Repository/Query Adjustment Required
Current repository SQL uses unqualified names:
- `saved_deals`
- `deal_offers`
- `deal_tasks`

Preferred approach:
- update repository SQL to schema-qualified names:
  - `brik_by_brik_engine.saved_deals`
  - `brik_by_brik_engine.deal_offers`
  - `brik_by_brik_engine.deal_tasks`

Reason:
- explicit schema qualification is safer and clearer in shared environments than relying on implicit resolution.

## DATABASE_URL and search_path Considerations
- Keep `DATABASE_URL` as the standard connection variable.
- Never print `DATABASE_URL` or credentials.
- Avoid relying only on `search_path` unless intentionally configured and documented.
- Preferred for clarity and operational safety: schema-qualified SQL in repository queries.

## Live DB QA Gate
Live DB QA should not proceed until namespace alignment is confirmed in:
- Phase 4A migration SQL
- repository SQL query targets

## Explicit Warning
Do not run current unqualified Phase 4A migrations in the shared Supabase project until schema namespacing is applied.

## Recommended Next Step
Phase 4A Namespace Alignment Patch:
- update Phase 4A migrations and repository SQL to `brik_by_brik_engine` schema
- then run live DB QA against the shared Supabase project
`r`nStatus note: Phase 4A namespace alignment patch completed. Migrations and repository SQL now use brik_by_brik_engine schema. No migrations applied, no feature expansion, no new API/UI, and no engine behavior added.
