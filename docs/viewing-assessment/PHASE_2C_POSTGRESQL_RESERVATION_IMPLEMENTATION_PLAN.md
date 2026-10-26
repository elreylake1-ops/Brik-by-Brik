# Phase 2C — PostgreSQL AI Reservation Implementation Plan

## Current checkpoint

HEAD: `2b121796bb13e0e96d0fd11df8220fa2cbd27cfd` on `feat/viewing-assessment-ui-polish`.

This is a design only. No migration, database access, provider integration, or paid AI activation is included. The unconditional Claude authorization blocker remains mandatory.

## Verified schema

Source: `db/migrations/20261020_task2_viewing_assessment_tables.sql`.

### Analysis runs

`brik_by_brik_engine.viewing_analysis_runs` contains:

| Column | Type | Nullability / rule |
|---|---|---|
| `id` | `TEXT` | primary key, not null |
| `assessment_id` | `TEXT` | not null, FK to `viewing_assessments(id)` |
| `idempotency_key` | `TEXT` | not null |
| `provider` | `TEXT` | not null; `mock`, `fixture`, or `claude` |
| `model_version` | `TEXT` | not null |
| `status` | `TEXT` | not null; `RUNNING`, `READY_FOR_REVIEW`, `PARTIAL`, `FAILED` |
| `attempt_count` | `INTEGER` | not null, default 1, `>= 1` |
| `proposals_count` | `INTEGER` | not null, default 0, `>= 0` |
| `rejected_count` | `INTEGER` | not null, default 0, `>= 0` |
| `error_code` | `TEXT` | nullable |
| `created_by` | `TEXT` | not null |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | not null, default `NOW()` |

Unique keys are `(assessment_id, idempotency_key)` and `(id, assessment_id)`. The latter makes composite child foreign keys valid. There is no database lease column; lease expiry is derived from `updated_at`.

### Usage ledger

`viewing_ai_usage` contains:

| Column | Type | Nullability / rule |
|---|---|---|
| `id` | `TEXT` | primary key |
| `run_id`, `assessment_id` | `TEXT` | not null; composite FK to runs |
| `attempt` | `INTEGER` | not null, `>= 1` |
| provider/model/prompt | `TEXT` | not null; provider is `fixture` or `claude` |
| token counts | `BIGINT` | not null, non-negative |
| `cost_micros` | `BIGINT` | not null, non-negative |
| `simulated` | `BOOLEAN` | not null; simulated cost must be zero |
| `outcome` | `TEXT` | not null; fixed outcome enum |
| `created_at` | `TIMESTAMPTZ` | not null, default `NOW()` |

Unique `(run_id, attempt)` prevents duplicate usage rows. An append-only trigger rejects update, delete, and truncate. Existing rows must remain valid when reservation linkage is added.

## Proposed additive schema

### Budget periods

Future table: `brik_by_brik_engine.viewing_ai_budget_periods`.

- `month_start TIMESTAMPTZ PRIMARY KEY`, normalized to UTC month start.
- `monthly_ceiling_micros BIGINT NULL`.
- `per_run_ceiling_micros BIGINT NULL`.
- `approved_by TEXT NULL`.
- `approved_at TIMESTAMPTZ NULL`.
- `created_at`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

Ceilings remain nullable until explicitly approved. If populated, each must be positive and approval metadata must be present. No migration seeds a business value. The period row is a lock target, not a second usage ledger.

### Reservations

Future table: `brik_by_brik_engine.viewing_ai_reservations`.

- `id TEXT PRIMARY KEY` or UUID-compatible text identity.
- `run_id TEXT NOT NULL`.
- `assessment_id TEXT NOT NULL`.
- `attempt INTEGER NOT NULL CHECK (attempt >= 1)`.
- `month_start TIMESTAMPTZ NOT NULL` FK to budget periods.
- `provider TEXT NOT NULL CHECK (provider = 'claude')`.
- `model_version TEXT NOT NULL`.
- `reserved_cost_micros BIGINT NOT NULL CHECK (reserved_cost_micros >= 0)`.
- `actual_cost_micros BIGINT NULL CHECK (actual_cost_micros >= 0)`.
- `state TEXT NOT NULL` with the Phase 2B states: `RESERVED`, `SETTLED`, `RELEASED`, `UNKNOWN`, `EXPIRED`.
- `dispatch_state TEXT NOT NULL`: `UNCLAIMED`, `CLAIMED`, `UNKNOWN`.
- `dispatch_owner_token TEXT NULL`.
- `dispatch_lease_expires_at TIMESTAMPTZ NULL`.
- `created_at`, `expires_at`, `settled_at TIMESTAMPTZ`.
- `reconciled_at`, `reconciled_by`, `reconciliation_code` nullable.

Constraints and indexes:

- unique `(run_id, attempt)` prevents duplicate logical holds;
- composite FK `(run_id, assessment_id)` references the existing unique run key;
- FK `month_start` references the budget-period primary key;
- index `(month_start, state)` supports budget accounting;
- index `(state, expires_at)` supports stale inspection;
- index `(assessment_id, run_id)` supports scoped reconciliation;
- reservation identity, month, amount, provider and creation fields are immutable after creation;
- release is guarded by transition logic requiring `dispatch_state = 'UNCLAIMED'`;
- a `CHECK` can restrict values, but cannot validate transition history; guarded repository transactions or an approved trigger are required.

Actual cost greater than reserved cost is rejected. It is never silently capped.

## Usage-ledger linkage

Add nullable `reservation_id TEXT NULL` to `viewing_ai_usage`.

- FK to `viewing_ai_reservations(id)`, preferably `ON DELETE RESTRICT`;
- unique partial index on `reservation_id WHERE reservation_id IS NOT NULL`;
- legacy rows remain null and valid;
- the existing append-only trigger remains unchanged;
- a reservation-linked usage row must match the reservation’s run and attempt, enforced by a composite ownership constraint or settlement transaction.

Settled reservation-linked usage is counted through this ledger link. The settled reservation is not added again as a separate paid amount.

## Canonical lock order

All overlapping operations use:

1. analysis run row;
2. UTC budget-period row;
3. reservation row;
4. usage ledger and completion writes.

Reservation creation, settlement, reconciliation, and run completion all follow this order. Lease reclamation locks the run first. Period-only accounting locks the period and must never subsequently acquire a run lock. This removes the Phase 2A settlement inversion.

## Repository operations

| Operation | Locks | Order | Transaction | Failure behavior |
|---|---|---|---|---|
| Lock period | period row | period | yes | missing/unapproved period blocks live AI |
| Create/replay reservation | run, period, reservation | run → period → reservation | yes | unique replay; conflict rolls back |
| Claim dispatch | run, period, reservation | run → period → reservation | yes | second owner rejected |
| Mark dispatch unknown | run, period, reservation | run → period → reservation | yes | stale owner rejected |
| Release | run, period, reservation | run → period → reservation | yes | only unclaimed release allowed |
| Settle | run, period, reservation, usage | run → period → reservation → usage | yes | rollback on any validation or insert error |
| Reconcile | run, period, reservation | run → period → reservation | yes | operator authorization required |
| Lease reclaim | run | run | yes | attempt fence prevents stale completion |
| Run completion with settlement | run, period, reservation, usage | canonical order | yes | all writes commit or roll back |

## Transaction boundaries

### Reservation creation/replay

Begin, lock the run, insert or lock the month row, lock the period, inspect the unique run/attempt reservation, validate ceilings and accounting, insert or return the reservation, commit. Provider dispatch permission is not implied by replay.

### Dispatch claim

Begin, lock run → period → reservation, verify current attempt and `RUNNING` status, require `UNCLAIMED`, claim one owner token, commit. The provider call starts only after commit.

### Settlement

Begin, lock run → period → reservation, validate attempt/status/owner and settlement state, insert the usage row, transition the reservation, update run completion/proposals, commit. No externally successful settlement is visible between usage insertion and reservation transition.

### Reconciliation

Begin, lock run → period → reservation, verify authorized operator and evidence, apply only an approved conservative transition, commit. Automatic release is prohibited where dispatch may have occurred.

### Period-only accounting

Lock only the period, calculate usage plus holds, and never acquire a run lock afterward.

## State transitions

### Reservation state

| From | To | Rule |
|---|---|---|
| `RESERVED` | `SETTLED` | known actual cost; ledger insert is same transaction |
| `RESERVED` | `RELEASED` | only proven no-dispatch and dispatch `UNCLAIMED` |
| `RESERVED` | `UNKNOWN` | timeout or uncertain billing/dispatch |
| `RESERVED` | `EXPIRED` | expiry observation; hold remains conservative |
| `UNKNOWN` | `SETTLED` | only authorized reconciliation with reliable usage |
| `UNKNOWN` | `RELEASED` | prohibited automatically; `REQUIRES JAMES APPROVAL` |
| `EXPIRED` | `SETTLED` | only authorized reconciliation |
| `EXPIRED` | `RELEASED` | prohibited automatically; `REQUIRES JAMES APPROVAL` |
| terminal | same terminal state | identical settlement is idempotent |
| terminal | conflicting state | forbidden; fail closed |

### Dispatch state

| From | To | Rule |
|---|---|---|
| `UNCLAIMED` | `CLAIMED` | one owner token and lease |
| `CLAIMED` | `UNKNOWN` | owner reports uncertain dispatch |
| `CLAIMED` | `UNCLAIMED` | forbidden after claim; lease expiry does not transfer ownership |
| `UNKNOWN` | any release/claim | forbidden automatically |

## Accounting model

Monthly consumption is:

```text
legacy paid usage attributed to month
+ reservation-linked settled ledger usage attributed to immutable reservation month
+ RESERVED holds
+ UNKNOWN holds
+ EXPIRED holds
+ zero for RELEASED
```

Settled reservation amounts are not separately added when their linked ledger row is included. A settled reservation without a linked usage row is incomplete and remains blocked/reconcilable. Legacy rows without a reservation link remain included using their UTC ledger month until a formal migration policy says otherwise.

## Deadlock scenarios

- Reserve vs settle: both lock run first; one waits on the run, so no cycle.
- Settle vs lease reclaim: both lock run first; stale attempt loses the run fence.
- Settle vs run completion: both lock run first; completion or settlement waits, then rechecks status/attempt.
- Reconcile vs settle: both lock run → period → reservation; one waits without circular order.
- Two reservations: both serialize on the same period row after run locking; one passes or rejects against committed state.
- Period accounting vs reservation: period-only accounting never acquires a run afterward; no inversion is introduced.
- Duplicate dispatch claim: both lock the same run and reservation in order; one owner commits, the other rejects.

No intentional schedule should deadlock if every future path follows this order. Any legacy method that acquires a reservation or period first must be changed before implementation.

## Crash and recovery matrix

| Crash point | Persisted state | Hold | Retry / reconciliation |
|---|---|---|---|
| Before reservation commit | none | none | retry reservation |
| After reservation commit, before claim | `RESERVED/UNCLAIMED` | retained | safe to inspect; claim only once |
| After claim, before provider call | `RESERVED/CLAIMED` | retained | no automatic owner transfer; prove non-dispatch or reconcile |
| In flight | `RESERVED/CLAIMED` | retained | no redispatch from another owner |
| Provider may have accepted, no response | `UNKNOWN/UNKNOWN` | retained | operator/provider reconciliation |
| Response received, before settlement | claimed or unknown | retained | retry settlement only with same owner/result identity |
| During settlement before commit | prior state | prior hold retained | whole transaction rolls back |
| After settlement commit | terminal plus ledger | actual or conservative amount | duplicate settlement is idempotent |
| During run completion | prior fenced state | retained | stale attempt cannot complete later |

## Reconciliation authority

Automated reconciliation may only replay an identical, already-known terminal result. It must not release a reservation based solely on lease expiry, process restart, timeout, or missing response.

Resolution of `UNKNOWN`, `EXPIRED`, incomplete settlement, and provider-result ambiguity requires an explicitly authorized operator and evidence of provider billing/non-dispatch.

`REQUIRES JAMES APPROVAL`:

- who may reconcile;
- acceptable evidence;
- whether any automatic release is ever permitted;
- maximum age and review process for conservative holds.

## PostgreSQL concurrency validation plan

Use two independent database connections and transaction barriers, not timing-only sleeps.

Required tests:

1. same run/attempt reservation: one insert, one idempotent replay;
2. same-month competing reservations: ceiling cannot be exceeded;
3. same-owner dispatch replay;
4. conflicting dispatch owner rejection;
5. settle versus lease reclaim;
6. settle versus reconciliation;
7. stale-attempt settlement rejection;
8. rollback during settlement leaves hold and no usage row;
9. unique reservation-to-usage ownership;
10. incomplete settlement remains held;
11. monthly ceiling under concurrent load;
12. period-only accounting never acquires a run lock afterward.

Each test must assert committed state after both connections finish and use deterministic lock barriers/timeouts.

## Migration sequence and rollback

Future additive sequence:

1. create budget-period table;
2. create reservation table;
3. add nullable usage `reservation_id`;
4. add composite foreign keys, partial unique indexes, checks and query indexes;
5. add guarded transition enforcement if approved;
6. validate legacy rows and absence of seeded budget values;
7. run isolated concurrency tests before any provider activation.

Rollback must preserve all existing usage and analysis records. Before reservations exist, unused new structures may be removed. After reservations exist, rollback requires export and an operator-approved archival strategy; destructive ledger rollback is prohibited.

## James approval gates

- monthly and per-run ceiling values;
- approval metadata format and approving role;
- `UNKNOWN` reconciliation policy;
- `EXPIRED` reconciliation policy;
- operator authority and audit requirements;
- whether any automatic release is permitted;
- budget-period rollover policy;
- production rollout and emergency rollback sequence;
- criteria for removing the unconditional Claude blocker.

## Remaining risks

- External provider exact-once billing cannot be guaranteed by PostgreSQL.
- Crash after provider dispatch still requires conservative reconciliation.
- Existing repository methods must be audited for lock-order compliance before migration.
- PostgreSQL isolation and trigger behavior require real isolated QA validation.
- No budget values are approved or active.

## GO / NO-GO

**GO** for a future offline repository-interface and SQL-review implementation task.

**NO-GO** for migration execution, database access, provider integration, or paid AI activation until James’s approvals and isolated PostgreSQL concurrency/recovery tests pass.
