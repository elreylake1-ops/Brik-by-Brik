# Phase 4H-2B2 Database Backup and Recovery Documentation

## Current Recovery Boundary

- Database platform and connection boundary: PostgreSQL accessed only through `lib/db/postgres.ts`, which opens a shared pool from `DATABASE_URL`.
- Committed migrations are the schema reconstruction source: the `db/migrations/` files are the authoritative on-repo schema history for reconstructing the current tables.
- Existing backup/recovery evidence: Phase 4E production verification docs show the production project, backup capability status, PITR status, and the current recovery limits.
- Backup availability verified: not fully verified for an actual restorable backup in this repository evidence; platform-level capability is present, but recency is not available.
- Actual restore tested: no.
- Restore authority verified: partially verified only at the level of viewing backup status; restore execution authority remains unverified.

## Backup Procedure

Use only the approved provider-console or documented provider workflow already evidenced in the repository.

1. Confirm the correct production project.
2. Confirm backup availability and timestamp.
3. Record the application commit and migration state.
4. Avoid application writes during a controlled recovery window when required.
5. Do not expose credentials or downloaded backup files.

Do not invent CLI commands that are not already documented and verified in repository evidence.

## Recovery Procedure

Use a cautious high-level sequence only:

1. Confirm written recovery approval.
2. Identify the target backup or recovery point.
3. Confirm the target environment.
4. Protect the current state before restoration.
5. Restore using the approved provider process.
6. Confirm required schemas and tables.
7. Verify read-only application routes.
8. Run lint, build, and tests against the correct code revision where appropriate.
9. Record the recovery result.

Do not perform these steps in this documentation task.

## Post-Recovery Verification

Safe checks only:

- database connection succeeds
- required schema exists
- required tables exist
- `/api/saved-deals` returns safely
- controlled saved-deal detail returns safely
- Investor Shield read succeeds
- Evidence Lite read succeeds
- Investor Review page loads
- missing-deal 404 remains safe

Do not include write tests.

## Migration Recovery Boundary

- Migrations must not be reapplied blindly.
- Compare migration history and schema state first.
- Avoid destructive migration execution during incident recovery.
- Undocumented production drift remains a risk.

## Rollback Versus Database Recovery

Application rollback through Vercel and database restore or point-in-time recovery are separate actions.

Application rollback does not automatically revert database changes.

## Ownership and Permission Limitation

Exact backup visibility, restore authority, and production permissions remain for 4H-2C.

Do not claim who can restore the database unless that ability is proven.

## Known Limitations

- Actual restore execution remains unverified.
- Restore permissions remain unverified.
- Schema drift beyond committed migrations remains unverified.
- Recovery time and recovery-point objectives are not formally established unless documented.

## Explicit Non-Implementation

This step does not:

- create a backup
- perform a restore
- query production data
- change production data
- execute a migration
- change credentials
- view or change credentials
- update README
- create a release tag
- begin Phase 5 work

## Result

`PHASE 4H-2B2 DATABASE BACKUP AND RECOVERY DOCUMENTATION COMPLETE — READY FOR PHASE 4H-2C OWNERSHIP AND ACCESS VERIFICATION`
