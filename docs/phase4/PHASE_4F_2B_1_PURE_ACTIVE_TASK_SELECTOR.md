# Phase 4F-2B-1 Pure Active Task Selector

## Purpose
Create a pure selector that converts canonical persisted task rows into the already-selected Investor Summary task summaries used by the Phase 4F mapper.

This phase does not connect the selector to a repository, API route, or UI.

## Files Created or Changed

- `lib/investor-summary/select-active-investor-summary-tasks.ts`
- `__tests__/investor-summary-active-task-selector.test.ts`
- `docs/phase4/PHASE_4F_2B_1_PURE_ACTIVE_TASK_SELECTOR.md`

## Canonical Task Sources Inspected

- `types/operator-command.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `app/api/saved-deals/[id]/tasks/route.ts`
- `lib/investor-shield/persist-investor-shield-task-drafts.ts`
- `app/page.tsx`
- `__tests__/deal-tasks-repository.test.ts`
- `__tests__/deal-tasks-api-route.test.ts`
- `__tests__/persist-investor-shield-task-drafts.test.ts`
- `__tests__/fixtures/operator-command/operator-command-fixtures.ts`

## Proven Task Status Values

### `OPEN`

- Source: `types/operator-command.ts`
- Source: `app/api/saved-deals/[id]/tasks/route.ts`
- Source: `__tests__/deal-tasks-api-route.test.ts`
- Source: `__tests__/persist-investor-shield-task-drafts.test.ts`
- Source: `__tests__/fixtures/operator-command/operator-command-fixtures.ts`

### `IN_PROGRESS`

- Source: `types/operator-command.ts`
- Source: `__tests__/fixtures/operator-command/operator-command-fixtures.ts`
- Source: `__tests__/investor-summary-fixtures.test.ts`

### `BLOCKED`

- Source: `types/operator-command.ts`
- Source: `lib/operator-command/deal-tasks-repository.ts` via `markTaskBlocked()`
- Source: `__tests__/deal-tasks-repository.test.ts`
- Source: `lib/investor-shield/persist-investor-shield-task-drafts.ts` via `openLikeStatus`

### `COMPLETE`

- Source: `types/operator-command.ts`
- Source: `lib/operator-command/deal-tasks-repository.ts` via `completeTask()`
- Source: `__tests__/deal-tasks-repository.test.ts`
- Source: `lib/investor-shield/persist-investor-shield-task-drafts.ts` via `openLikeStatus`

### `CANCELLED`

- Source: `types/operator-command.ts`
- Source: `lib/investor-shield/persist-investor-shield-task-drafts.ts` via `openLikeStatus`

## Active-Task Rule

The proven current repository behavior treats tasks as active-like unless they are terminal.

Selector rule:

- include every task whose `task_status` is not `COMPLETE`
- include every task whose `task_status` is not `CANCELLED`
- exclude only the terminal statuses proven by current code

This keeps `OPEN`, `IN_PROGRESS`, and `BLOCKED` rows in the selected list.

## Selector Input

- `readonly DealTaskRecord[]`
- canonical persisted task rows only
- no database access
- no repository aggregation
- no route input

## Selector Output

- `readonly InvestorSummaryTaskSummary[]`
- already-shaped task summaries for the Phase 4F mapper
- empty array when no active tasks exist

## Field Mapping

Mapped fields:

- `id` -> `taskId`
- `task_title` -> `title`
- `task_type` -> `taskType`
- `task_status` -> `status`
- `priority` -> `priority`
- `due_date` -> `dueDate`
- `blocker_reason` -> `blockerReason`
- `created_at` -> `createdAt`
- `completed_at` -> `completedAt`

Rules:

- preserve nullable values
- do not rewrite titles
- do not infer due dates
- do not synthesize blocker reasons
- do not change task status names

## Ordering Behavior

Input order is preserved exactly for included records.

- no sort by priority
- no sort by due date
- no sort by created timestamp
- no sort by task status

The repository query order remains authoritative upstream.

## Duplicate Behavior

Duplicates are preserved.

Reason:

- current repository behavior does not define a selector-side deduplication rule
- the investor-shield draft dedupe helper is for persistence, not display-time filtering
- the selector therefore keeps every included active record

## Purity and Immutability

- no I/O
- no database access
- no environment access
- no mutation of the input array
- no mutation of source task records
- deterministic output for the same input

## Tests Added

- every proven active status is included
- every proven terminal status is excluded
- mapping to the current task contract is correct
- input order is preserved
- empty input returns empty array
- all-terminal input returns empty array
- nullable due date remains nullable
- nullable blocker reason remains nullable
- input array is not mutated
- input task records are not mutated
- duplicate active records are preserved

## Deferred Work

- latest-offer selection
- repository aggregation
- API
- UI
- mapper edge-case closure
- production integration

## Explicit Non-Implementation

- no database access
- no repository aggregation
- no latest-offer selector
- no API route
- no UI
- no page integration
- no task persistence
- no migration
- no SQL
- no production change
- no deterministic-engine change
- no Investor Shield reevaluation

## Acceptance Conditions

1. Canonical task statuses inspected. Pass.
2. Active-task semantics proven from current repository behavior. Pass.
3. Pure selector created. Pass.
4. Only proven active statuses included. Pass.
5. Terminal statuses excluded. Pass.
6. Input ordering preserved. Pass.
7. No sorting added. Pass.
8. No new deduplication policy added. Pass.
9. Existing Investor Summary task contract reused. Pass.
10. Nullable fields preserved. Pass.
11. Inputs not mutated. Pass.
12. Focused selector tests pass. Pass.
13. Full build/lint/test suite passes. Pass.

## Verdict

`PHASE 4F-2B-1 COMPLETE — READY FOR PHASE 4F-2B-2`

## Recommended Next Step

`Phase 4F-2B-2 — Pure Latest Offer Selector`
