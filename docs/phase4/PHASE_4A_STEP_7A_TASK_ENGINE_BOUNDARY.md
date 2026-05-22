# Phase 4A Step 7A Task Engine Boundary

## Purpose
Define the minimum safe boundary for adding task and blocker tracking after saved-deal, pipeline, and offer loops are working.

## Current Capability
- saved deals can be created, listed, and opened
- pipeline state can be updated with guard enforcement
- offers and counter-offers can be recorded and viewed
- no task engine exists yet

## Task Engine Goal
- James should be able to create tasks and blockers for a saved deal
- tasks must attach to a saved deal
- tasks must not rewrite `engine_result_json`
- tasks must not override governance state
- blockers should be visible later in command view

## Recommended Minimal Path
1. Add minimal `deal_tasks` migration/table only.
2. Add task repository helpers only.
3. Add `POST /api/saved-deals/[id]/tasks` only.
4. Add `GET /api/saved-deals/[id]/tasks` only.
5. Add minimal task UI after route tests pass.

## Minimal Task Fields
- `id`
- `deal_id`
- `task_title`
- `task_type`
- `task_status`
- `priority`
- `due_date`
- `blocker_reason`
- `created_at`
- `completed_at`

## Boundary Rules
- no automated task generation
- no reminders or notifications
- no task assignment or multi-user behavior
- no evidence uploads yet
- no command view yet
- no engine recalculation
- no snapshot mutation

## Recommended Next Step
Phase 4A Step 7B - Minimal `deal_tasks` Migration Only.

Status note: Phase 4A Step 7B minimal deal_tasks migration created. No task repository, API, UI, note, evidence, command view, or engine behavior added.
