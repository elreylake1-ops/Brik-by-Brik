# Phase 4A Step 7B Deal Tasks Migration

## Purpose
Add the minimal `deal_tasks` table schema required to start Phase 4A task/blocker persistence.

## Table Created
- `deal_tasks`

## Field List
- `id` UUID primary key default `gen_random_uuid()`
- `deal_id` TEXT not null references `saved_deals(id)` on delete cascade
- `task_title` TEXT not null
- `task_type` TEXT not null default `'DUE_DILIGENCE'`
- `task_status` TEXT not null default `'OPEN'`
- `priority` TEXT not null default `'MEDIUM'`
- `due_date` DATE nullable
- `blocker_reason` TEXT nullable
- `created_at` TIMESTAMPTZ not null default `NOW()`
- `completed_at` TIMESTAMPTZ nullable

## Migration Boundary
- schema-only change
- one new table only
- no runtime behavior changes

## Intentionally Not Added
- no task repository helpers
- no task API routes
- no task UI
- no notes/evidence/audit/command view
- no triggers, RLS, seed data, or extra indexes
- no deterministic engine or snapshot changes

## Recommended Next Step
Phase 4A Step 7C - Task Repository Helpers Only.

Status note: Phase 4A Step 7C task repository helpers created. No task API, UI, note, evidence, command view, saved-deal mutation, pipeline mutation, or engine behavior added.
