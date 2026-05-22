# Phase 4A Shared Supabase Namespace Plan

## Purpose
Define safe table namespacing for Phase 4A before running migrations in a shared Supabase project.

## Why Namespacing Is Required
- The Supabase instance is shared across multiple projects.
- Current Phase 4A migrations create unqualified table names in the default schema context.
- Unqualified names increase risk of cross-project data mixing and accidental query overlap.

## Chosen Namespace
- Dedicated Postgres schema: `lake_views_property`

## Target Tables
- `lake_views_property.saved_deals`
- `lake_views_property.deal_offers`
- `lake_views_property.deal_tasks`

## Migration Adjustment Required
Before applying Phase 4A migrations to shared Supabase, update migrations to:
- create schema if not exists `lake_views_property`
- create tables with schema-qualified names
- qualify FK references to the schema-qualified parent table

Expected pattern:
- `create table if not exists lake_views_property.saved_deals (...)`
- `create table if not exists lake_views_property.deal_offers (... deal_id text not null references lake_views_property.saved_deals(id) on delete cascade ...)`
- `create table if not exists lake_views_property.deal_tasks (... deal_id text not null references lake_views_property.saved_deals(id) on delete cascade ...)`

## Repository/Query Adjustment Required
Current repository SQL uses unqualified names:
- `saved_deals`
- `deal_offers`
- `deal_tasks`

Preferred approach:
- update repository SQL to schema-qualified names:
  - `lake_views_property.saved_deals`
  - `lake_views_property.deal_offers`
  - `lake_views_property.deal_tasks`

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
- update Phase 4A migrations and repository SQL to `lake_views_property` schema
- then run live DB QA against the shared Supabase project
