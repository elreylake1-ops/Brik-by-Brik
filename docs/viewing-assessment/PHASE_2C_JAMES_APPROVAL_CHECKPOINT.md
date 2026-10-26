# Phase 2C-R — James Approval Checkpoint

## Purpose

The PostgreSQL reservation design is implementation-ready at the architecture level. Phase 2D remains blocked pending explicit business-risk approval and isolated PostgreSQL validation.

## Technical contracts already locked

- Lock order: run → budget period → reservation → usage/completion.
- One dispatch owner; reservation replay does not grant dispatch permission.
- Timeout and uncertain outcomes retain conservative `UNKNOWN` holds.
- Lease expiry does not grant redispatch rights.
- Settled reservation usage is counted once through the ledger linkage.
- Reservation settlement and usage insertion must be atomic.
- Exact-once external provider billing is not claimed.
- Legacy usage remains supported.
- Reservation month attribution is immutable.
- All costs use integer micro-dollars.

These are not open approval questions unless James requests a change.

## Decisions requiring approval

### Decision 1 — Monthly budget ceiling

Please approve:

- the monthly paid-AI ceiling;
- whether it is global or environment-specific;
- who may change it;
- whether changes require recorded approval metadata.

**STATUS: REQUIRES JAMES APPROVAL**

No monetary value is assumed here.

### Decision 2 — `UNKNOWN` reservation policy

`UNKNOWN` means the provider may have been dispatched or charged, but the application cannot prove the final outcome.

Recommended default:

- retain the full reservation hold;
- prohibit automatic release;
- prohibit automatic redispatch;
- require reconciliation.

Please approve or amend this policy.

**STATUS: REQUIRES JAMES APPROVAL**

### Decision 3 — `EXPIRED` reservation policy

Reservation or run-lease expiry does not prove that a provider request was never sent.

Recommended default:

- retain the reservation hold when dispatch certainty is unavailable;
- do not restore budget automatically;
- route uncertain cases to reconciliation.

Please approve or amend this policy.

**STATUS: REQUIRES JAMES APPROVAL**

### Decision 4 — Reconciliation authority

Please identify who may resolve:

- `UNKNOWN` reservations;
- `EXPIRED` reservations;
- incomplete settlements;
- ambiguous provider outcomes.

Conceptual options are deterministic automated reconciliation only when evidence is conclusive, authorized operator reconciliation, or owner/admin-only reconciliation. No new role is being created by this package.

**STATUS: REQUIRES JAMES APPROVAL**

### Decision 5 — Automatic release

Recommended default:

> No automatic release when a paid provider invocation may have occurred.

If exceptions are desired, they must be stated explicitly before Phase 2D.

**STATUS: REQUIRES JAMES APPROVAL**

### Decision 6 — Actual cost above reservation

Proposed behavior when actual provider cost exceeds the reserved worst-case amount:

- fail closed;
- do not silently increase committed budget;
- escalate for reconciliation.

Please approve or amend this policy.

**STATUS: REQUIRES JAMES APPROVAL**

### Decision 7 — PostgreSQL validation authorization

Please authorize the next technical phase to use an isolated PostgreSQL environment for:

- additive migration development;
- concurrency tests;
- transaction tests;
- rollback and crash/recovery tests.

This would not authorize Production, Preview, Supabase, paid Claude activation, Production provider dispatch, or Vercel changes.

**STATUS: REQUIRES JAMES APPROVAL**

## Approval table

| Decision | Recommended Default | James Decision | Status |
|---|---|---|---|
| Monthly ceiling | No assumed value |  | Pending |
| `UNKNOWN` policy | Retain hold + reconcile |  | Pending |
| `EXPIRED` policy | Retain uncertain hold |  | Pending |
| Reconciliation authority | Explicit authorized actor |  | Pending |
| Automatic uncertain release | Prohibited |  | Pending |
| Actual cost > reservation | Fail closed |  | Pending |
| Isolated PostgreSQL validation | Allowed after approval |  | Pending |

## Phase 2D entry gate

Phase 2D may begin only when:

1. James’s required policy decisions are recorded.
2. Reconciliation authority is defined.
3. Monthly ceiling policy is approved.
4. Isolated PostgreSQL testing is explicitly authorized.
5. Protected references remain preserved.
6. An isolated test database is identified.
7. Production changes and paid provider activation remain separately prohibited.

## Paid AI activation remains separate

Approval for Phase 2D PostgreSQL work is not approval for paid AI activation.

Paid AI remains blocked until separate authorization, budget, provider, operational, and production-readiness gates pass.

## James response

1. **APPROVE AS RECOMMENDED** — approve the conservative policies above and authorize isolated PostgreSQL validation.
2. **APPROVE WITH CHANGES** — list requested policy changes.
3. **HOLD** — do not start Phase 2D.
4. **REVIEW MEETING REQUIRED** — resolve the listed decisions before continuing.

**PHASE 2C-R COMPLETE — PHASE 2D REMAINS BLOCKED PENDING JAMES APPROVAL**
