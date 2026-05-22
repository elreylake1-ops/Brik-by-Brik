# Phase 4A Step 7G Minimal Task UI

## Purpose
Add a minimal task form and task history section to the selected saved deal panel.

## UI Added
- file: `app/page.tsx`
- added `Tasks` section in selected saved deal detail panel
- fetches tasks with `GET /api/saved-deals/[id]/tasks`
- creates tasks with `POST /api/saved-deals/[id]/tasks`

## Task Fields Shown
- `task_title`
- `task_type`
- `task_status`
- `priority`
- `due_date`
- `blocker_reason`
- `created_at`
- `completed_at`

## Add Task Behavior
- requires `task_title`
- defaults form values: `task_type = DUE_DILIGENCE`, `task_status = OPEN`, `priority = MEDIUM`
- submits through `Add Task` button
- shows loading plus safe success/error messages
- refreshes task list after successful add

## Test Approach
- no additional UI interaction test was added
- relied on existing API route tests plus full project checks (`npm run test`, `npm run build`, `npm run lint`)

## Limitations
- no task status update controls
- no block/complete controls
- no notes/evidence/audit/command view behavior

## Boundary Confirmation
- no saved_deals mutation
- no pipeline mutation
- no engine recalculation
- no `engine_result_json` mutation

## Recommended Next Step
Phase 4A Step 7H - Task status/block/complete route boundary.
