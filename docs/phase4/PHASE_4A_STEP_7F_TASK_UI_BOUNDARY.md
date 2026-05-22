# Phase 4A Step 7F Task UI Boundary

## Purpose
Define the minimum safe UI boundary for adding task and blocker creation plus task history display after task POST/GET API routes are working.

## Current Capability
- saved deals can be created, listed, and opened read-only
- pipeline state can be updated with guard enforcement
- offers can be created and listed
- tasks can be created and listed through API
- no task UI exists yet

## Task UI Goal
- James should be able to create a task or blocker from the selected saved deal panel
- James should be able to see task history and open blockers for the selected saved deal
- UI should call `POST /api/saved-deals/[id]/tasks`
- UI should call `GET /api/saved-deals/[id]/tasks`
- task UI must not modify `saved_deals`
- task UI must not change pipeline state
- task UI must not recalculate engine result

## Recommended Minimal Path
1. Add a small task form inside the selected saved deal panel.
2. Fields:
   - `task_title`
   - `task_type`
   - `task_status`
   - `priority`
   - `due_date`
   - `blocker_reason`
3. Add `Add Task` button.
4. Fetch and display task list for the selected saved deal.
5. Refresh task list after successful add.
6. Keep status/block/complete update controls for later.

## Boundaries
- no automated task generation
- no reminders or notifications
- no task assignment or multi-user behavior
- no evidence uploads
- no command view
- no pipeline mutation from task UI
- no engine recalculation
- no snapshot mutation

## Recommended Next Step
Phase 4A Step 7G - Minimal Task UI Only.

Status note: Phase 4A Step 7G minimal task UI created. No task status/block/complete controls, note, evidence, command view, saved-deal mutation, pipeline mutation, or engine behavior added.
