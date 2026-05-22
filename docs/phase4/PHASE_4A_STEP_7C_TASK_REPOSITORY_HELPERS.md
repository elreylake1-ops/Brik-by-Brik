# Phase 4A Step 7C Task Repository Helpers

## Purpose
Add minimal server-side `deal_tasks` repository helpers for task and blocker persistence.

## Helper List
- `createTask(dealId, input)`
- `listTasksForDeal(dealId)`
- `updateTaskStatus(taskId, status)`
- `markTaskBlocked(taskId, blockerReason)`
- `completeTask(taskId)`

## Table Dependency
- depends on `deal_tasks` from `db/migrations/20260522_phase4a_deal_tasks_table.sql`

## Test Approach
- unit tests in `__tests__/deal-tasks-repository.test.ts`
- mock `@/lib/db/postgres` query helper
- validate SQL table/field usage and parameter behavior
- verify no `saved_deals`, `engine_result_json`, or `pipeline_state` mutation paths
- verify no calculator/engine imports and no forbidden runtime keys

## Limitations
- no task API routes
- no task UI
- no notes/evidence/audit/command view behavior
- no live DB integration in tests (`DATABASE_URL` not required)

## Deterministic Engine Confirmation
- deterministic engine behavior remains untouched
- no recalculation and no `engine_result_json` mutation

## Recommended Next Step
Phase 4A Step 7D - Task API Route Boundary.
