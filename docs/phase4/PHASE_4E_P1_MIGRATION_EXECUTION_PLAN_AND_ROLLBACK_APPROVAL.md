## Purpose

Create an execution-ready, reversible, independently reviewable production migration plan for the existing Evidence Lite migration without applying any database change.

## Starting Production Baseline

- P0A verdict: `PHASE 4E-P0A VERIFIED — READY FOR P1 MIGRATION EXECUTION PLANNING`
- production alias: `https://brik-by-brik-engine-chi.vercel.app`
- P0A deployment ID: `dpl_UBzdfaxQwjFbmbZnvvm76nLBKDTY`
- deployed application commit: `22f83b604cb6f969c5bd80ab28dd960dfc26da3f`
- current repository documentation commit: `389eeb8a74ecb9fe4f3bedd5b1d7975dbf56cda8`
- documentation-only difference: the deployed application code matched `origin/main` when the P0A deployment was created; the current repository tip is later because of documentation-only commits made after deployment
- existing read-route results: `GET /` `200`, `GET /api/saved-deals` `200`, missing saved-deal route `404`, missing Investor Shield UI route `404`
- DATABASE_URL applicability: `PRESENT AND DEPLOYMENT APPLICABILITY VERIFIED`
- migration status: exists and remains unexecuted
- UI status: production Evidence Lite UI remains inactive behind the development-only boundary

## Migration Identification

| Item | Value |
|---|---|
| Filename | `db/migrations/20260622_phase4e_deal_evidence_table.sql` |
| Local SHA-256 | `C76DF4F8F63066638280F09E10990EEDF7D230F360FD9958724F49CB1AF8655C` |
| Target schema/table | `brik_by_brik_engine.deal_evidence` |
| Static review classification | `STATIC MIGRATION REVIEW PASSED` |

The hash was computed locally with `Get-FileHash -Algorithm SHA256`.

## Migration Object Inventory

| Object | Detail |
|---|---|
| Schema | `brik_by_brik_engine` created with `CREATE SCHEMA IF NOT EXISTS` |
| Table | `brik_by_brik_engine.deal_evidence` created with `CREATE TABLE IF NOT EXISTS` |
| Primary key | `id TEXT PRIMARY KEY` |
| Deal reference | `deal_id TEXT NOT NULL` |
| Foreign key | `deal_id` references `brik_by_brik_engine.saved_deals(id)` |
| Delete behavior | `ON DELETE CASCADE` |
| Evidence type | `evidence_type TEXT NOT NULL` |
| Linked gate | `linked_gate TEXT NOT NULL` |
| Title | `title TEXT NOT NULL` |
| Note | `note TEXT NOT NULL` |
| Status | `status TEXT NOT NULL DEFAULT 'MISSING'` |
| Reviewed flag | `reviewed BOOLEAN NOT NULL DEFAULT FALSE` |
| Timestamps | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| Check constraints | evidence type, linked gate, and status constraints |
| Indexes | `idx_deal_evidence_deal_id`, `idx_deal_evidence_deal_id_linked_gate` |

## Contract-to-Schema Consistency

- `saved_deals.id` is `TEXT PRIMARY KEY` in the Phase 4A saved-deals migration, so `deal_id TEXT NOT NULL` is type-aligned.
- `id TEXT PRIMARY KEY` is aligned with the repository's text-ID strategy for Evidence Lite records.
- Evidence type values in `types/evidence-lite.ts` match the migration check constraint values exactly.
- Linked gate values in `types/evidence-lite.ts` match the migration check constraint values exactly.
- `status` values in `types/evidence-lite.ts` match the migration check constraint values exactly.
- `reviewed BOOLEAN` matches the repository contract and the validator contract.
- `SOLICITOR_FEEDBACK` is not stored in the table and remains a validation-only alias.
- `GENERAL` is excluded from both the repository contract and the migration.
- `updated_at` is not trigger-driven; the repository sets `updated_at = NOW()` on update.
- No repository field requires a database column that is absent from the migration.
- No migration column is introduced that the repository and validators do not already understand.

## Target Identity Requirements

The exact authorized target remains:

- Vercel project: `brik-by-brik-engine`
- Vercel team: `brikbybrik-engine`
- production database source: Production `DATABASE_URL`
- authorized environment: Production only

Future P2 target checks should be read-only and non-secret, and should confirm:

- current database name or another approved non-secret identifier
- active schema names
- presence of `brik_by_brik_engine.saved_deals`
- `saved_deals.id` type
- presence and current state of existing Phase 4A tables
- whether `brik_by_brik_engine.deal_evidence` already exists

Do not execute those target checks in P1.

## Backup Readiness

Backup readiness classification: `UNVERIFIED`

Reason:

- no provider-managed backup proof was captured in this step
- no point-in-time recovery proof was captured in this step
- no approved schema/data export proof was captured in this step
- no rollback-capable backup mechanism was documented with evidence in this step

P2 must not proceed until backup mechanism, recency, ownership, procedure, and approval are documented.

## Execution Procedure

Future P2 procedure, for approval only:

1. Confirm the approved target.
2. Confirm backup and rollback readiness.
3. Confirm baseline production read routes.
4. Confirm the exact migration hash.
5. Open one controlled database session.
6. Use a single explicit transaction if the chosen session/tool supports it.
7. Execute the reviewed migration exactly once.
8. Stop on any SQL error.
9. Do not edit the SQL interactively.
10. Verify schema objects before commit if transaction semantics allow.
11. Commit once.
12. Close the session.
13. Do not activate the UI.
14. Do not create Evidence Lite records during P2.

Use a secure placeholder when documenting the session:

```text
<SECURE_PRODUCTION_DATABASE_SESSION>
```

Do not include `DATABASE_URL` in a command example.

## Structural Verification Plan

After a future approved P2 execution, perform read-only verification for:

- schema exists
- table exists
- required columns exist
- column types match the reviewed SQL
- nullability matches the reviewed SQL
- defaults match the reviewed SQL
- foreign key exists and targets `brik_by_brik_engine.saved_deals(id)`
- delete behavior is `ON DELETE CASCADE`
- check constraints exist
- indexes exist
- no duplicate object or partial migration state exists
- existing Phase 4A tables remain intact

Suggested verification query families for later use only:

- `information_schema.tables`
- `information_schema.columns`
- `information_schema.table_constraints`
- `pg_indexes`

Do not call application Evidence Lite routes in P2.

## Rollback Triggers

Rollback must be considered if any of the following occur:

- SQL error before completion
- wrong schema or wrong target
- saved-deal foreign-key type mismatch
- missing expected constraint
- missing expected index
- partial object creation
- baseline route regression after migration
- unexpected lock or availability impact
- application startup/read failure after migration
- schema differs from the reviewed migration result

## Transaction Rollback

If failure occurs before commit, abort the session and roll back the transaction.

Use this path only when the migration has not been committed.

## Post-Commit Rollback

Post-commit rollback is only for explicit incident approval after the migration has been committed.

If data has been written to `brik_by_brik_engine.deal_evidence`, do not drop objects without backup/export review.

## Rollback SQL Plan

Exact order for the empty, newly created Evidence Lite surface:

```sql
DROP INDEX IF EXISTS brik_by_brik_engine.idx_deal_evidence_deal_id_linked_gate;
DROP INDEX IF EXISTS brik_by_brik_engine.idx_deal_evidence_deal_id;
DROP TABLE IF EXISTS brik_by_brik_engine.deal_evidence;
```

Rollback is safe only before production Evidence Lite records exist.

If records exist, rollback requires backup/export review and explicit approval first.

## Lock and Availability Considerations

- The migration only creates new objects.
- It does not alter existing tables.
- It does not backfill existing rows.
- It does not change existing application code paths.
- Foreign-key creation only references the existing `saved_deals` table.
- Expected lock scope is brief and limited to DDL metadata activity for new objects.
- Index creation on an empty new table should be short-lived.
- Recommended execution window: low-traffic production window.
- Expected duration category: short, not zero-risk.
- Stop if lock waits, catalog delays, or unexpected existing objects appear.

## P2 Approval Checkpoint

P2 MIGRATION EXECUTION APPROVAL

Target verified:
Migration filename:
Migration SHA-256:
Backup readiness:
Rollback readiness:
Authorized operator:
Approved execution window:
Approved by:
Approval date:
Special conditions:

## Explicit Non-Implementation

P1 performed:

- no migration
- no DDL or DML
- no SQL mutation
- no database record mutation
- no Evidence Lite API call
- no Vercel environment change
- no redeployment
- no UI activation
- no code/package/migration change

## P1 Acceptance Conditions

| # | Condition | Status |
|---|---|---|
| 1 | Exact migration identified. | PASS |
| 2 | Migration hash recorded. | PASS |
| 3 | Target schema/table identified. | PASS |
| 4 | Foreign-key type matches saved-deal ID. | PASS |
| 5 | Repository fields match migration. | PASS |
| 6 | Validation enums align with constraints. | PASS |
| 7 | Static migration review passes. | PASS |
| 8 | Production target requirements documented. | PASS |
| 9 | Backup readiness verified. | UNVERIFIED |
| 10 | Transaction procedure documented. | PASS |
| 11 | Structural verification documented. | PASS |
| 12 | Rollback triggers documented. | PASS |
| 13 | Rollback SQL/order documented. | PASS |
| 14 | Lock/availability risks documented. | PASS |
| 15 | Approval checkpoint prepared. | PASS |
| 16 | No migration or database mutation occurred. | PASS |

## Verdict

`PHASE 4E-P1 PARTIALLY READY — BACKUP OR ROLLBACK EVIDENCE REQUIRED`

## Recommended Next Step

## P1A Status Note

P1A backup and recovery verification was performed for the reviewed Evidence Lite migration.

- provider / target identity: `VERIFIED`
- backup readiness: `PARTIALLY VERIFIED`
- recovery readiness: `NOT AVAILABLE`
- ownership status: `UNASSIGNED`
- P1A verdict: `PHASE 4E-P1A BLOCKED - ADEQUATE BACKUP OR RECOVERY NOT AVAILABLE`
- migration remains unexecuted
- production Evidence Lite UI remains inactive
- next step: `Phase 4E-P1A-3 - Production Backup Strategy Resolution`

## P1A-3 Status Note

P1A-3 strategy resolution selected controlled encrypted logical backup as the approved near-term path.

- selected strategy: `Option 2 - Controlled Encrypted Logical Backup`
- approval requirement: `Required before any backup creation`
- migration remains unexecuted
- production Evidence Lite UI remains inactive
- next step: `Phase 4E-P1A-2 - Authorized Production Logical Backup Creation and Verification`

## P1A-3B Status Note

P1A-3B recorded the ownership and approval draft for the controlled encrypted logical backup path.

- approval status: `PENDING HUMAN SIGN-OFF`
- backup creator: `James`
- backup verifier: `Karlo`
- restore operator: `Karlo`
- business approval owner: `James`
- secure backup custodian: `James`
- encryption method: `7-Zip AES-256`
- restore-test target: `separate non-production PostgreSQL sandbox VM`
- next step after sign-off: `Phase 4E-P1A-2 - Authorized Production Logical Backup Creation and Verification`

## P1A-3C Status Note

P1A-3C recorded the final human sign-off review for the controlled encrypted logical backup path.

- approval status: `PARTIALLY APPROVED`
- remaining gaps: retention maximum / review date unresolved, backup window not yet finalized, sandbox owner not explicitly confirmed
- migration remains unexecuted
- production Evidence Lite UI remains inactive
- next step: `Human Decision — Complete Logical Backup Approval Record`

`Phase 4E-P1A — Production Backup and Recovery Readiness Verification Only`
