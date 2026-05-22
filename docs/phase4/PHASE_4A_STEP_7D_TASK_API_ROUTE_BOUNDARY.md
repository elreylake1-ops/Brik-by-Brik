# Phase 4A Step 7D Task API Route Boundary

## Purpose
Define the minimum safe API boundary for adding task and blocker routes after repository helpers are ready.

## Current Capability
- saved deals can be created, listed, and opened
- pipeline can be updated with guard enforcement
- offers can be created and listed
- `deal_tasks` table exists
- task repository helpers exist
- no task API routes exist yet

## Task API Goal
- James should be able to create a task or blocker for a saved deal
- James should be able to list tasks for a saved deal
- task routes must attach to saved deal id
- task routes must not rewrite `engine_result_json`
- task routes must not modify governance or pipeline state yet

## Recommended Minimal Path
1. Add `POST /api/saved-deals/[id]/tasks` only.
2. Add `GET /api/saved-deals/[id]/tasks` only.
3. Keep update status, block, and complete routes for later.
4. Add task UI only after route tests pass.

## Planned POST Input
- `task_title`
- `task_type`
- `task_status`
- `priority`
- `due_date`
- `blocker_reason`

## Planned GET Response
- `success`
- `tasks` array

## Boundaries
- no task UI yet
- no automated task generation
- no reminders or notifications
- no assignment or multi-user behavior
- no evidence uploads
- no command view
- no engine recalculation
- no snapshot mutation

## Recommended Next Step
Phase 4A Step 7E - Task POST/GET API Routes Only.

Status note: Phase 4A Step 7E task POST/GET API routes created. No task UI, task status route, blocked route, complete route, note, evidence, command view, saved-deal mutation, pipeline mutation, or engine behavior added.
