# Phase 4D-5A Task Recommendation / Existing Task Display Plan

## Purpose
This document plans read-only display of Investor Shield task recommendations and existing related tasks, but makes no code or runtime changes.

## Current Baseline
- The evaluator can produce task recommendations.
- The task draft builder exists.
- The task persistence helper exists but is not automatically triggered by the UI.
- The existing saved deal task list exists.
- The Investor Shield panel is read-only.
- No task creation controls exist in the Investor Shield panel.

## Proposed Display Surface
Plan only:
- Keep task recommendations inside the existing Investor Shield panel or near it.
- Existing persisted deal tasks remain in the existing task section.
- Avoid duplicating full task management UI.
- Do not move the panel.

## Task Recommendation Display Rules
Plan:
- Show recommendation title.
- Show related gate.
- Show reason / next action.
- Show priority or severity if available.
- Clearly label recommendations as recommendations, not completed tasks.
- Do not imply risk is resolved until evidence is provided.

## Existing Task Display Rules
Plan:
- If existing Investor Shield-related tasks are already present in the saved deal task list, they may be referenced read-only.
- Do not create tasks from the panel.
- Do not edit task status from the panel.
- Do not duplicate the full task list inside the panel unless separately approved.

## Idempotency / Duplicate Safety
- Backend task persistence already has idempotency behavior.
- UI must not trigger duplicate task creation.
- Task source/idempotency markers should remain backend-facing unless needed for debugging.

## Read-Only Boundaries
Future implementation must not:
- create tasks
- update tasks
- delete tasks
- upload evidence
- edit gates
- edit waivers
- mutate pipeline state
- add AI/image/video review

## Future Test Expectations
Future implementation should test:
- recommendation title/reason/gate displays
- recommendations are labeled read-only
- no create/edit/delete task controls render
- existing task list behavior remains unchanged
- no task persistence helper is called from UI viewing

## Recommended Next Step
Phase 4D-5B - Task Recommendation Display Only

This should modify only the isolated Investor Shield panel if possible, not task APIs or task persistence.
