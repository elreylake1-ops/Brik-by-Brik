## Purpose

Select an approved production backup and recovery strategy for the additive Evidence Lite migration before any backup creation or migration execution occurs.

## Starting Baseline

- branch: `main`
- HEAD / origin/main: `a8e0c90f1d69fc3ad57878dfb674074b05b24a97`
- origin: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- P1A result: `PHASE 4E-P1A BLOCKED - ADEQUATE BACKUP OR RECOVERY NOT AVAILABLE`
- production project: `Brik by Brik Engine`
- project ref: `jagjbwxodnbgbhhojuzo`
- organization: `tgunwmbzdqcdnguxqmco`
- region: `eu-west-1`
- project status: `ACTIVE_HEALTHY`
- target identity: `VERIFIED`
- production deployment: `dpl_UBzdfaxQwjFbmbZnvvm76nLBKDTY`
- deployed application commit: `22f83b604cb6f969c5bd80ab28dd960dfc26da3f`
- migration filename: `db/migrations/20260622_phase4e_deal_evidence_table.sql`
- migration SHA-256: `C76DF4F8F63066638280F09E10990EEDF7D230F360FD9958724F49CB1AF8655C`
- static migration result: `STATIC MIGRATION REVIEW PASSED`
- current read-route baseline: root `200`, saved-deals `200`, missing saved-deal `404`, missing Investor Shield UI `404`
- migration status: unexecuted
- production Evidence Lite UI status: inactive
- no production Evidence Lite route has been called

## Current Provider Recovery State

- provider physical backup capability exists at the platform level
- physical backup infrastructure reports `walg_enabled=true`
- physical backup count returned by the management API: `0`
- PITR: disabled
- no successful backup timestamp is available
- no verified restore point is available
- provider restore cannot currently be relied on for P2 approval
- logical backup tooling is available through `supabase db dump`
- no logical backup has been created or verified
- current plan metadata was not exposed in the CLI output, so plan entitlement remains partially unverified

## Strategy A - Provider Backup/PITR

Assessment:

- current project evidence does not show a usable provider backup
- PITR is disabled for the current project
- enabling provider-managed recovery would require a plan or billing change if the project is not already on a backup-entitled plan
- activation would be prospective only; a new backup cycle or PITR window would still be required before P2
- restore scope is project-level or database-level and is downtime-bearing
- operator permissions and approval ownership are not yet fully assigned
- business approval would be required if a plan or add-on change is needed

Safe interpretation:

- `walg_enabled=true` is not proof of a recoverable backup
- no verified recovery point exists yet

Classification:

`AVAILABLE WITH PLAN OR BILLING CHANGE`

## Strategy B - Encrypted Logical Backup

Safe command pattern:

```text
supabase db dump --linked --schema brik_by_brik_engine --file <encrypted-archive>
supabase db dump --linked --schema brik_by_brik_engine --data-only --file <encrypted-data-archive>
supabase db dump --linked --role-only --file <role-metadata-archive>
```

Equivalent lower-level tooling:

```text
pg_dump
```

Assessment:

- schema-only dump is supported
- data-only dump is supported
- combined dump is supported where the tooling and restore target allow it
- `brik_by_brik_engine` can be included explicitly
- `saved_deals` and other Phase 4 tables can be included through the schema selection
- provider-owned schemas should be excluded unless a separate recovery need exists
- roles may require a separate artifact if they matter for the restore target
- database settings are not fully captured by the main dump and should be treated separately
- extensions are usually represented in the schema dump, but restore verification must confirm the required extension availability
- large objects are not evidenced here and should be treated as a separate verification item if they exist
- secrets or credentials could appear in the artifact through data or object definitions, so encryption is required
- a SHA-256 checksum can be recorded safely
- restore can be tested to a separate non-production target if one is approved
- dump and restore permissions are only partially verified right now

Classification:

`SUITABLE WITH CONDITIONS`

## Strategy C - Additive Migration Rollback Safeguard

Assessment:

- the migration is additive
- it creates a new table and supporting indexes
- it adds a foreign key to the existing saved-deals table
- it does not rewrite existing saved-deal rows
- it does not activate production UI
- it does not create Evidence Lite records during P2
- transaction rollback protects only failures before commit
- dropping the new table after commit does not recover unrelated damage
- rollback is only safe while no Evidence Lite records or dependent systems exist
- this safeguard is helpful, but it is not a full production backup

Classification:

`USEFUL SECONDARY SAFEGUARD - INSUFFICIENT AS PRIMARY RECOVERY`

## Strategy Decision Matrix

| Criterion | Provider backup/PITR | Encrypted logical backup | Transaction/additive rollback |
| --- | --- | --- | --- |
| Existing data protected | Only once a verified recovery point exists | Yes, after a dump is created | No |
| Point-in-time recovery | Yes, if PITR is enabled | No, only to dump time | No |
| Restore independently testable | Yes, to a separate project or target | Yes, to a separate non-production target | No |
| Requires billing change | Likely yes | No | No |
| Requires production data export | No | Yes | No |
| Supports pre-migration proof | Not yet | Yes | Only for pre-commit failure |
| Recovery downtime | Yes | Yes for restore | Yes for post-commit table removal, but only narrowly |
| Operator permissions known | Partial | Partial | Limited and narrow |
| Suitable as primary recovery | Not currently | Yes, with conditions | No |

## Recommended Strategy

Selected strategy:

`Option 2 - Controlled Encrypted Logical Backup`

Reason:

- provider-managed recovery is not currently usable
- a logical backup can be created with existing authorized access
- the artifact can be encrypted and checksumed
- restore compatibility can be verified against a separate non-production target
- no plan change is required to proceed with the logical-backup path
- the additive migration is small enough that a logical backup plus limited rollback is a reasonable control set

Future next step:

`Phase 4E-P1A-2 - Authorized Production Logical Backup Creation and Verification`

## Logical Backup Security Requirements

- backup artifact stored outside the repository
- artifact path ignored by Git
- encryption at rest
- no artifact uploaded to chat, issue trackers, public cloud folders, or documentation
- no credentials embedded in filenames
- SHA-256 checksum recorded
- creation timestamp recorded
- operator recorded
- source project recorded using non-secret project identity
- retention period approved
- deletion procedure approved
- restore-test destination approved
- access restricted to authorized operators
- artifact never committed

## Restore Verification Requirements

- command completed successfully
- artifact exists and is non-empty
- checksum is recorded
- dump metadata can be inspected safely
- expected schema objects are present
- a restore command is documented
- restore permissions are verified
- restore is preferably tested against a separate non-production target
- restoration does not overwrite production
- recovery owner accepts the result

## Recovery Ownership

```text
Recovery Ownership

Migration operator: UNASSIGNED
Backup creator: UNASSIGNED
Backup verifier: UNASSIGNED
Rollback decision owner: UNASSIGNED
Restore operator: UNASSIGNED
Business approval owner: UNASSIGNED
Incident communication owner: UNASSIGNED
Secure backup custodian: UNASSIGNED
```

## Approval Checkpoint

```text
PRODUCTION BACKUP STRATEGY APPROVAL

Selected strategy: Option 2 - Controlled Encrypted Logical Backup
Reason: Provider recovery is not currently usable, and a verifiable encrypted logical backup is the safest near-term path.
Production target: Brik by Brik Engine
Backup method: supabase db dump / pg_dump with encrypted off-repo artifact
Encryption method: UNASSIGNED
Secure storage location category: UNASSIGNED
Retention period: UNASSIGNED
Restore verification method: Separate non-production restore target
Migration operator: UNASSIGNED
Backup creator: UNASSIGNED
Backup verifier: UNASSIGNED
Rollback decision owner: UNASSIGNED
Restore operator: UNASSIGNED
Business approval owner: UNASSIGNED
Approved by: UNASSIGNED
Approval date: UNASSIGNED
Conditions: Backup artifact, checksum, custody, and restore-test requirements must be approved before creation.
```

## Production Migration Impact

- migration stays blocked
- no P2 authorization is granted
- production UI remains inactive

## Explicit Non-Implementation

Confirmed:

- no backup created
- no PITR enabled
- no plan changed
- no restore
- no migration executed
- no DDL or DML
- no database mutation
- no Evidence Lite route called
- no environment change
- no redeployment
- no code, package, or migration change
- no production UI activation

## Acceptance Conditions

| # | Condition | Status |
| --- | --- | --- |
| 1 | Current recovery limitation documented. | PASS |
| 2 | Provider-managed strategy evaluated. | PASS |
| 3 | Logical backup strategy evaluated. | PASS |
| 4 | Additive rollback limitation documented. | PASS |
| 5 | Decision matrix completed. | PASS |
| 6 | Recommended strategy selected. | PASS |
| 7 | Security requirements documented. | PASS |
| 8 | Restore verification requirements documented. | PASS |
| 9 | Required ownership roles identified. | PASS |
| 10 | Strategy approval template prepared. | PASS |
| 11 | No backup or database mutation occurred. | PASS |
| 12 | Migration remains unexecuted. | PASS |
| 13 | Production UI remains inactive. | PASS |

## Verdict

`PHASE 4E-P1A-3 PARTIALLY READY - TECHNICAL OR SECURITY DETAILS UNRESOLVED`

## Recommended Next Step

`Phase 4E-P1A-2 - Authorized Production Logical Backup Creation and Verification`

## P1A-3B Status Note

P1A-3B recorded the logical backup ownership and approval draft for the selected encrypted backup path.

- approval status: `PENDING HUMAN SIGN-OFF`
- backup creator: `James`
- backup verifier: `Karlo`
- restore operator: `Karlo`
- business approval owner: `James`
- secure backup custodian: `James`
- encryption method: `7-Zip AES-256`
- secure storage category: `restricted encrypted off-repo archive under operator-controlled storage`
- restore-test target: `separate non-production PostgreSQL sandbox VM`
- next step after sign-off: `Phase 4E-P1A-2 - Authorized Production Logical Backup Creation and Verification`

## P1A-3C Status Note

P1A-3C recorded the final human sign-off review for the controlled encrypted logical backup path.

- approval status: `PARTIALLY APPROVED`
- remaining gaps: retention maximum / review date unresolved, backup window not yet finalized, sandbox owner not explicitly confirmed
- migration remains unexecuted
- production Evidence Lite UI remains inactive
- next step: `Human Decision — Complete Logical Backup Approval Record`
