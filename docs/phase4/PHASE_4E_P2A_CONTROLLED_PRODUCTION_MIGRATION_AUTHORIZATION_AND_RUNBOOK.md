# Phase 4E-P2A Controlled Production Evidence Lite Migration Authorization and Execution Runbook

## Purpose

Document the controlled production runbook for the reviewed Evidence Lite table migration without executing any database change, creating any production record, or changing the UI boundary.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `15fca12d43a6d67ec187576dec14416558af034f` |
| `origin/main` | `15fca12d43a6d67ec187576dec14416558af034f` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this document | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `db/migrations/20260622_phase4e_deal_evidence_table.sql`
- `types/evidence-lite.ts`
- `lib/evidence-lite/evidence-lite-validation.ts`
- `lib/evidence-lite/evidence-lite-repository.ts`
- `app/api/saved-deals/[id]/evidence/route.ts`
- `app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts`
- `components/evidence-lite/EvidenceLitePanel.tsx`
- `docs/phase4/PHASE_4E_P1_MIGRATION_EXECUTION_PLAN_AND_ROLLBACK_APPROVAL.md`
- `docs/phase4/PHASE_4E_P1A_PRODUCTION_BACKUP_AND_RECOVERY_READINESS_VERIFICATION.md`
- `docs/phase4/PHASE_4E_P0A_PRODUCTION_DATABASE_URL_CORRECTION_AND_REDEPLOYMENT.md`
- `docs/phase4/PHASE_4E_9_EVIDENCE_LITE_LOCAL_SPRINT_CLOSURE_AND_PRODUCTION_READINESS_AUDIT.md`

## Reviewed Migration

| Item | Value |
| --- | --- |
| Filename | `db/migrations/20260622_phase4e_deal_evidence_table.sql` |
| Local SHA-256 | `0567D0B92E805F140434B83168C8AE59B9A97DD109AA3BA939E4A70CB9C7DAD0` |
| Target schema/table | `brik_by_brik_engine.deal_evidence` |
| Migration status | unexecuted |

### Object Inventory

| Object | Detail |
| --- | --- |
| Schema | `brik_by_brik_engine` |
| Table | `brik_by_brik_engine.deal_evidence` |
| Primary key | `id TEXT PRIMARY KEY` |
| Deal reference | `deal_id TEXT NOT NULL` with foreign key to `brik_by_brik_engine.saved_deals(id)` |
| Delete behavior | `ON DELETE CASCADE` |
| Evidence type | `evidence_type TEXT NOT NULL` |
| Linked gate | `linked_gate TEXT NOT NULL` |
| Title | `title TEXT NOT NULL` |
| Note | `note TEXT NOT NULL` |
| Status | `status TEXT NOT NULL DEFAULT 'MISSING'` |
| Reviewed flag | `reviewed BOOLEAN NOT NULL DEFAULT FALSE` |
| Reviewer note | `reviewer_note TEXT NULL` |
| Timestamps | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| Check constraints | evidence type, linked gate, and status constraints |
| Indexes | `idx_deal_evidence_deal_id`, `idx_deal_evidence_deal_id_linked_gate` |

## Contract Alignment

- `reviewer_note` is now represented in the repository as `EvidenceLiteRecord.reviewerNote: string | null`.
- `SOLICITOR_FEEDBACK` is a validation-only alias and is not stored as a canonical database value.
- `GENERAL` is rejected by the validation and repository contract.
- The migration values match the Evidence Lite enums in `types/evidence-lite.ts`.
- The repository still uses the shared Postgres adapter and does not add a new persistence path.
- `updated_at` remains repository-managed and is not trigger-driven.

## Production Target Identity

| Item | Value |
| --- | --- |
| Vercel project | `brik-by-brik-engine` |
| Vercel team | `brikbybrik-engine` |
| Production alias | `https://brik-by-brik-engine-chi.vercel.app` |
| Production deployment | `dpl_UBzdfaxQwjFbmbZnvvm76nLBKDTY` |
| Deployed application commit | `22f83b604cb6f969c5bd80ab28dd960dfc26da3f` |
| Production `DATABASE_URL` | present in Production, verified through a read-only live env audit without exposing the value |

## Authorization Status

| Check | Status |
| --- | --- |
| Migration file identified | PASS |
| Migration hash confirmed | PASS |
| Production target identified | PASS |
| Production `DATABASE_URL` presence confirmed | PASS |
| Backup and rollback procedure documented | PASS |
| Execution authorization status | PENDING HUMAN SIGN-OFF |
| Migration execution started | NO |
| Production UI activation started | NO |
| Evidence Lite records created | NO |

This document defines the runbook. It does not execute the migration and does not self-authorize production database mutation.

## Controlled Execution Runbook

1. Confirm the approved production target and the exact deployment baseline.
2. Confirm Production `DATABASE_URL` is present and readable by the approved operator, without printing the value.
3. Confirm the reviewed migration hash matches the approved file.
4. Confirm the backup and rollback path are still valid before any SQL session begins.
5. Open one controlled production database session using the secure placeholder below:

```text
<SECURE_PRODUCTION_DATABASE_SESSION>
```

6. Run the reviewed migration exactly once with an explicit transaction boundary if the chosen session tool supports it.
7. Stop immediately on any SQL error.
8. Do not edit the SQL interactively.
9. Do not create, update, or delete any Evidence Lite records during migration execution.
10. Do not activate or remove any UI guard in this phase.
11. Close the session only after schema verification succeeds.

### Suggested Execution Shape

Do not include a raw production connection string in the command example.

```powershell
psql "<SECURE_PRODUCTION_DATABASE_SESSION>" --single-transaction --set ON_ERROR_STOP=1 --file "db/migrations/20260622_phase4e_deal_evidence_table.sql"
```

## Verification Plan

After successful execution, verify with read-only queries only:

- `brik_by_brik_engine.deal_evidence` exists.
- All reviewed columns exist with the reviewed types and nullability.
- The foreign key still targets `brik_by_brik_engine.saved_deals(id)`.
- `ON DELETE CASCADE` is present.
- Both indexes exist.
- No duplicate or partial object state exists.
- Existing production read routes still pass.
- No Evidence Lite record was created as a side effect of migration execution.

Recommended query families:

- `information_schema.tables`
- `information_schema.columns`
- `information_schema.table_constraints`
- `pg_indexes`

## Rollback Plan

If the migration fails before commit, abort the transaction and leave the database unchanged.

If a post-commit rollback is required and no production Evidence Lite records exist yet, use this order:

```sql
DROP INDEX IF EXISTS brik_by_brik_engine.idx_deal_evidence_deal_id_linked_gate;
DROP INDEX IF EXISTS brik_by_brik_engine.idx_deal_evidence_deal_id;
DROP TABLE IF EXISTS brik_by_brik_engine.deal_evidence;
```

If any production Evidence Lite records exist, rollback requires separate backup or export review and explicit human approval.

## Production Readiness Baseline

- Existing read routes were previously re-proven after the Production `DATABASE_URL` correction.
- Baseline results recorded in the repo docs are:
  - `GET /` -> `200`
  - `GET /api/saved-deals` -> `200`
  - missing saved-deal route -> `404`
  - missing Investor Shield UI route -> `404`
- The Evidence Lite production UI remains inactive until a separate UI-activation phase is explicitly approved.

## Explicit Non-Implementation

Confirmed not done in this phase:

- no migration execution
- no DDL or DML mutation
- no production record creation
- no API route change
- no UI activation
- no auth integration
- no upload, OCR, AI, storage, or PDF work
- no tests changed
- no runtime code changed
- no package change
- no `.gitignore` change

## Verdict

`PHASE 4E-P2A COMPLETE - EXECUTION RUNBOOK PUBLISHED`

## Recommended Next Step

`Phase 4E-P2 - Controlled Migration Execution`
