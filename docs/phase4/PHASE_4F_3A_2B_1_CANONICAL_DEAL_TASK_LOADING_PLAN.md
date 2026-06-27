# Phase 4F-3A-2B-1 Canonical Deal Task Loading Plan

## Purpose

Document the canonical deal-task source layer and loading boundary needed by the future Phase 4F Investor Summary loader.

This phase is inspection-only. No loader, repository, API, UI, database query, or test change is added.

## Repository Baseline

- Branch: `main`
- `HEAD`: `7ef786cb07bd39123bf1f5d38a05345ff0353837`
- `origin/main`: `7ef786cb07bd39123bf1f5d38a05345ff0353837`
- `origin`: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing unstaged `.gitignore` modification

## Files Inspected

- `docs/phase4/PHASE_4F_0C_CANONICAL_INVESTOR_SUMMARY_FIELD_MAPPING.md`
- `docs/phase4/PHASE_4F_1A_CANONICAL_INVESTOR_SUMMARY_TYPE_CONTRACTS.md`
- `docs/phase4/PHASE_4F_2B_1_PURE_ACTIVE_TASK_SELECTOR.md`
- `docs/phase4/PHASE_4F_2B_3A_PURE_SELECTOR_TO_MAPPER_COMPOSITION.md`
- `docs/phase4/PHASE_4F_2B_3B_2_COMPOSITION_EDGE_CASE_CLOSURE.md`
- `docs/phase4/PHASE_4F_3A_1_SAVED_DEAL_AND_ENGINE_RESULT_EXTRACTION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2A_CANONICAL_INVESTOR_SHIELD_LOADING_PLAN.md`
- `types/investor-summary.ts`
- `types/operator-command.ts`
- `lib/investor-summary/select-active-investor-summary-tasks.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/investor-shield/persist-investor-shield-task-drafts.ts`
- `app/api/saved-deals/[id]/tasks/route.ts`
- `app/page.tsx`
- `db/migrations/20260522_phase4a_deal_tasks_table.sql`
- `__tests__/deal-tasks-repository.test.ts`
- `__tests__/deal-tasks-api-route.test.ts`
- `__tests__/persist-investor-shield-task-drafts.test.ts`
- `__tests__/phase4a-migration-consistency.test.ts`

## Current Phase 4F Task Input Requirements

The current investor-summary composition helper expects task data in this shape:

```text
readonly DealTaskRecord[]
```

The downstream selector and mapper contract is already explicit:

- repository rows are loaded first
- active-task filtering is handled by `selectActiveInvestorSummaryTasks(...)`
- view-model composition then consumes the selector output

For Phase 4F, the canonical task-loading boundary should stop at the repository row set and preserve the existing selector as the only active-task filter.

## Canonical Task Persistence

The canonical persisted task record is the `deal_tasks` row in `brik_by_brik_engine.deal_tasks`.

Current row shape, as exposed by the repository:

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

Current schema defaults:

- `task_type` defaults to `DUE_DILIGENCE`
- `task_status` defaults to `OPEN`
- `priority` defaults to `MEDIUM`

The repository is the canonical read path for these persisted rows.

## Existing Task Repository

Canonical repository function:

- `lib/operator-command/deal-tasks-repository.ts:listTasksForDeal(dealId)`

Observed behavior:

- returns `Promise<DealTaskRecord[]>`
- queries `brik_by_brik_engine.deal_tasks`
- filters by `deal_id = $1`
- orders by `created_at DESC`
- does not filter terminal statuses
- does not dedupe rows
- does not join against engine-calculation tables

Canonical write helpers in the same repository exist, but they are not the loading source for this phase:

- `createTask(...)`
- `updateTaskStatus(...)`
- `markTaskBlocked(...)`
- `completeTask(...)`

## Database and Schema Assumptions

The task-loading plan relies on the existing migration contract:

- `deal_tasks.id` is a UUID primary key
- `deal_tasks.deal_id` references `saved_deals(id)` with `ON DELETE CASCADE`
- task state is stored as plain text fields, not as a normalized status table
- there is no uniqueness constraint that prevents duplicate task rows for the same deal and title

Implications for loading:

- the repository must be treated as the authoritative persisted task list
- terminal-state filtering is a selector concern, not a SQL concern
- duplicates remain valid persisted data unless a future schema change says otherwise

## Repository Ordering

Current repository ordering:

```text
created_at DESC
```

That order is canonical for the persisted row set and should be preserved by the loading plan.

Implications:

- new tasks appear before older tasks
- selector output should inherit the repository order
- no secondary sort should be introduced in the loading boundary unless the canonical repository contract changes

## Active-Task Responsibility Boundary

Canonical active-task selector:

- `lib/investor-summary/select-active-investor-summary-tasks.ts`

Selector behavior:

- includes all tasks except `COMPLETE` and `CANCELLED`
- preserves input order
- preserves duplicates
- maps repository fields directly into investor-summary task summaries

Responsibility split:

- repository: fetch persisted rows
- selector: decide which rows remain active for summary presentation
- mapper: format the final view model

The Phase 4F loading plan should not move active-task filtering into the repository.

## Task Creation and Persistence Context

There is already a write-side persistence helper:

- `lib/investor-shield/persist-investor-shield-task-drafts.ts`

Its job is draft persistence, not investor-summary loading.

Observed write-side behavior:

- dedupes drafts by `idempotencyKey`
- checks existing persisted tasks with `listTasksForDeal(dealId)`
- treats non-terminal rows as open-like tasks
- blocks duplicate inserts by title or blocker marker

This matters because the same persisted rows that are valid for shield drafting are also the canonical input rows for summary loading.

## Duplicate Behavior

Duplicates are allowed in the persisted table and the selector preserves them.

Canonical loading rule:

- do not dedupe in the repository read path
- do not dedupe in the active-task selector
- do not dedupe before summary composition

Reason:

- the persisted row set is the source of truth
- dedupe would silently discard valid historical rows
- existing code already treats duplicate prevention as a write-side concern

## Missing Deal Versus No Tasks

These are different states and should stay different.

- Missing deal: caller-level 404 or not-found handling
- Existing deal with zero tasks: valid empty task list

The task repository itself only answers whether rows exist for the deal id it receives.

## Malformed or Legacy Task Records

The current repository trusts the database row contract and returns typed rows without runtime validation.

Loading implication:

- task loading should not invent new normalization rules
- malformed rows should not be silently converted into fake canonical tasks
- if a future validation layer is added, it should be explicit and should not change the canonical persisted-row contract

## Proposed Task-Loading Boundary

Proposed future boundary for investor-summary task loading:

```text
deal id
-> listTasksForDeal(dealId)
-> selectActiveInvestorSummaryTasks(taskRecords)
-> composeInvestorSummaryViewModel(...)
```

Why this boundary is canonical:

- repository owns persisted deal-task retrieval
- selector owns active-task semantics
- composition owns summary assembly

What should not happen inside this boundary:

- no task creation
- no status mutation
- no duplicate suppression
- no terminal-status reinterpretation
- no UI formatting

## Error and Observability Ownership

Canonical error split:

- repository/query failure: infrastructure error
- empty task result: valid data state
- missing deal: upstream not-found handling

The current API route follows this model by returning a safe failure message when the repository read fails, while still returning a normal `tasks` array on success.

For future summary loading, logging and telemetry should stay attached to the repository/load boundary, not the selector.

## Functions and Types to Reuse

Reuse directly:

- `listTasksForDeal(dealId)`
- `selectActiveInvestorSummaryTasks(taskRecords)`
- `DealTaskRecord`
- `InvestorSummaryTaskSummary`

Reuse as-is conceptually:

- the repository ordering contract
- the selector's `COMPLETE` / `CANCELLED` exclusion rule
- the existing route-level empty-array behavior on success

## Functions and Approaches Not to Use

Do not use these as the canonical loading source:

- `createTask(...)`
- `updateTaskStatus(...)`
- `markTaskBlocked(...)`
- `completeTask(...)`
- `persistInvestorShieldTaskDrafts(...)`

Do not add these behaviors to the loading path:

- SQL-side active filtering
- dedupe by title
- dedupe by blocker marker
- status normalization beyond the repository contract
- mapping directly from API route JSON instead of repository rows

## Future Test Matrix

The current codebase already covers the core repository and route behavior, so the future loading plan should keep the same semantics under test.

Recommended future checks:

- repository returns rows ordered by `created_at DESC`
- repository returns all persisted rows for a deal, including terminal rows
- selector excludes only `COMPLETE` and `CANCELLED`
- selector preserves duplicates and input order
- composition uses selector output rather than raw repository rows
- empty task set remains a valid success case
- repository failure remains an infrastructure error

## Risks and Unresolved Items

- The repository does not validate row shape at runtime.
- Duplicate rows remain legal in storage.
- Task status is plain text, so future schema drift could affect callers if not guarded.
- The current loading flow depends on caller discipline to keep repository read logic separate from selector logic.

These are known constraints, not blockers for documenting the canonical loading path.

## Explicit Non-Implementation

This document does not:

- add a task loader
- change the deal-task repository
- change the API route
- change the investor-summary selector
- change the investor-summary mapper
- add or modify tests
- change database schema
- add UI code

## Verdict

The canonical deal-task source for Phase 4F is the persisted row set returned by `listTasksForDeal(dealId)`.

The canonical active-task filter remains `selectActiveInvestorSummaryTasks(...)`, and the loading plan should preserve the existing repository-first, selector-second boundary.

## Recommended Next Step

Use this loading contract as the basis for the future investor-summary task pipeline, while keeping all task mutation and duplicate-prevention logic on the write side.
