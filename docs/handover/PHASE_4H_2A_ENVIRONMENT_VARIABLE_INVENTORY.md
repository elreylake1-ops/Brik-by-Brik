# Phase 4H-2A Environment Variable Inventory

## Purpose

This document records environment-variable names and usage without exposing credentials or any secret value.

## Inventory

| Variable | Current Runtime Requirement | Used By | Local | Preview | Production | Secret | Notes |
| -------- | --------------------------- | ------- | ----- | ------- | ---------- | ------ | ----- |
| `DATABASE_URL` | Required | `lib/db/postgres.ts` | Verified in existing repository evidence as present in local `.env.local`; value not shown | Unverified in current repository evidence | Verified present in Production in Phase 4E P0A evidence; value not shown | Yes | Required for every runtime path that touches the shared Postgres adapter. The adapter throws if it is missing. |
| `NEXT_PUBLIC_SUPABASE_URL` | Not currently required | None in active source code | Not verified | Not verified | Not verified and not required by current runtime code | Yes if used | Mentioned in prior inventory docs as a considered service variable, but no current runtime callsite uses it. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Not currently required | None in active source code | Not verified | Not verified | Not verified and not required by current runtime code | Yes if used | Considered for completeness only; not referenced by the active source code. |
| `SUPABASE_SERVICE_ROLE_KEY` | Not currently required | None in active source code | Not verified | Not verified | Not verified and not required by current runtime code | Yes if used | Considered for completeness only; no current runtime callsite uses Supabase directly. |
| `VERCEL_URL` | Not currently required | None in active source code | Not verified | Not verified | Verified as a Vercel system env in the production deployment payload | No | Platform-provided variable; useful for deployment metadata, not required by current runtime code. |
| `VERCEL_PROJECT_ID` | Not currently required | None in active source code | Not verified | Not verified | Verified as a Vercel system env in the production deployment payload | No | Platform-provided variable; useful for deployment metadata, not required by current runtime code. |

## Required Runtime Variables

The only active runtime variable proven by current source code is `DATABASE_URL`.

Current runtime behavior:

- `lib/db/postgres.ts` reads `process.env.DATABASE_URL`.
- If `DATABASE_URL` is missing, the adapter throws `DATABASE_URL is required for Postgres adapter usage.`
- Every repository call that goes through `lib/db/postgres.ts` depends on that adapter boundary.

## Variables Considered but Not Currently Required

The following variables were inspected and are not required by the current active runtime code:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VERCEL_URL`
- `VERCEL_PROJECT_ID`

Current source inspection found no active source-code callsite using these variables.

## Environment Boundaries

### Local Development

- `DATABASE_URL` is required whenever local code or tests exercise the shared Postgres adapter.
- The repository already contains evidence that `DATABASE_URL` exists in the local `.env.local` file, but the value is not documented here.
- No other environment variable is currently required by active runtime code.

### Vercel Preview

- `DATABASE_URL` would be required for any preview deployment path that exercises the Postgres adapter.
- The repository does not currently prove preview-variable presence.
- The considered Supabase and Vercel metadata variables are not required by active runtime code.

### Vercel Production

- `DATABASE_URL` is required by the active runtime code.
- Phase 4E P0A evidence verifies that `DATABASE_URL` is present in Production after correction.
- `VERCEL_URL` and `VERCEL_PROJECT_ID` were observed in the deployment payload as system variables, but they are not runtime requirements.

### Test Execution

- The repository test suite currently runs with `npm test` and passed in this session.
- No separate test-only environment variable requirement is documented in the repository.
- If a test path exercises the real Postgres adapter, it inherits the `DATABASE_URL` requirement.

## Secret Handling

- Environment values must never be committed.
- Environment values must not appear in logs or screenshots.
- `.env.local` remains local and is not a production secret store.
- Vercel secrets must be configured through protected environment settings.
- Database credentials must be rotated if exposed.

## Validation and Failure Behaviour

When `DATABASE_URL` is missing:

- `lib/db/postgres.ts` throws before creating the shared `pg.Pool`.
- database-backed routes fail safely through the repository and route error boundaries.
- the code does not fall back to a second database source.

No other environment-variable failure behavior is currently documented by active source code.

## Existing Verification Evidence

The repository already contains production environment verification documents that distinguish different environment states:

- `docs/phase4/PHASE_4E_P0_PRODUCTION_ENVIRONMENT_AND_DEPLOYMENT_VERIFICATION.md` records the initial production environment inventory and the missing `DATABASE_URL` blocker.
- `docs/phase4/PHASE_4E_P0A_PRODUCTION_DATABASE_URL_CORRECTION_AND_REDEPLOYMENT.md` records the corrected production environment state and reproof of the read routes.
- `docs/phase4/PHASE_4E_P1A_PRODUCTION_BACKUP_AND_RECOVERY_READINESS_VERIFICATION.md` records backup and recovery limitations that are separate from environment presence.

Evidence classes used in this inventory:

- verified presence: `DATABASE_URL` in local evidence and in Production after correction; `VERCEL_URL` and `VERCEL_PROJECT_ID` in the deployment payload
- documented requirement: `DATABASE_URL` as the adapter boundary requirement
- unverified configuration: all other listed environment variables in preview/local/production

## Known Limitations

- Production variable values were not inspected.
- Permissions to view or change production variables remain separately unverified.
- Environment ownership belongs to 4H-2C.
- Deployment procedures belong to 4H-2B.

## Explicit Non-Implementation

This step does not:

- view or print any environment value
- change any environment file
- change any Vercel setting
- change any Supabase setting
- change any runtime code
- access production
- update README
- create a release tag
- begin Phase 5 work

## Result

`PHASE 4H-2A ENVIRONMENT VARIABLE INVENTORY COMPLETE ? READY FOR PHASE 4H-2B DEPLOYMENT AND RECOVERY DOCUMENTATION`
