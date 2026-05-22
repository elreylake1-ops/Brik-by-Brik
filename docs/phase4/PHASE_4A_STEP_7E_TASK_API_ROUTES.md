# Phase 4A Step 7E Task API Routes

## Purpose
Add minimal task API routes for creating and listing task records linked to a saved deal.

## Routes Created
- `GET /api/saved-deals/[id]/tasks`
- `POST /api/saved-deals/[id]/tasks`

## Request/Response Shape
- `GET`:
  - input: route param `id` (saved deal id)
  - `200`: `{ "success": true, "tasks": [...] }`
  - `400`: invalid id
  - `500`: safe error response
- `POST`:
  - input: `task_title` (required), `task_type` (default `DUE_DILIGENCE`), `task_status` (default `OPEN`), `priority` (default `MEDIUM`), `due_date` (optional nullable string), `blocker_reason` (optional nullable string)
  - `201`: `{ "success": true, "task": {...} }`
  - `400`: invalid input
  - `500`: safe error response

## Test Approach
- unit tests in `__tests__/deal-tasks-api-route.test.ts`
- mock task repository helpers
- validate GET/POST success and error paths
- validate POST defaults and `task_title` validation
- verify no calculator/engine imports and no forbidden behavior keys
- verify route source does not touch `saved_deals`, `pipeline_state`, or `engine_result_json`

## Limitations
- no task UI
- no task status update route
- no blocked route
- no complete route
- no notes/evidence/audit/command view behavior
- no live DB calls in tests

## Deterministic Engine Confirmation
- deterministic engine remains untouched
- no recalculation and no `engine_result_json` mutation

## Recommended Next Step
Phase 4A Step 7F - Task UI Boundary.

Status note: Phase 4A Step 7F task UI boundary created. No task UI, task status/block/complete UI, note, evidence, command view, saved-deal mutation, pipeline mutation, or engine behavior added.
