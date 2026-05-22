# Phase 4A Step 5B Pipeline API Route

## Purpose
Add a minimal governance-guarded pipeline movement API route for saved deals.

## Route Created
- `POST /api/saved-deals/[id]/pipeline`
- file: `app/api/saved-deals/[id]/pipeline/route.ts`

## Guard Behavior
- route fetches the saved deal first
- route builds `OperatorGuardInput` from saved deal fields and requested pipeline state
- route calls `evaluateOperatorGuard` before any update
- `BLOCK`, `REQUIRE_REVIEW`, and `REQUIRE_TASK` return `409` and do not update
- `WARN` and `ALLOW` follow `guard.allowed`; update occurs only when allowed

## Update Scope
- added `updateSavedDealPipelineState(id, pipelineState)` repository helper
- helper updates only `pipeline_state` and `updated_at`
- no update to `engine_result_json`, classification, governance, or capital protection fields

## Test Approach
- added isolated route tests with mocked repository and guard
- verifies success, validation, not-found, blocked/review/task conflict, and safe 500 behavior
- verifies guard input mapping and no calculator/engine imports

## Limitations
- no pipeline UI yet
- no offers/tasks/notes/evidence/audit behavior
- no command view
- no archive/edit behavior
- no task creation from guard-required outcomes yet

## Deterministic Engine Boundary
- no deterministic recalculation
- no engine module imports
- no `engine_result_json` mutation

## Recommended Next Step
Phase 4A Step 5C - Minimal pipeline UI trigger with guard outcome display.

Status note: Phase 4A Step 5C pipeline UI boundary created. No pipeline UI, command view, offers, tasks, notes, evidence, audit, or engine behavior added.
