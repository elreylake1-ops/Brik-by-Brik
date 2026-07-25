# Phase 5A-4C PR 4C-1A - Preview DATABASE_URL Audit

## Purpose

Confirm why preview deployment `https://brik-by-brik-engine-91zqsrdsi-brikbybrik-engine.vercel.app` could not read saved-deal data and define smallest safe correction without changing code, environment values, database data, or deployment state.

## Repository Baseline

```text
Branch: phase5a-4c-investor-review-professional-gateway
HEAD: a27e7d66835541e39632e5c33b1fecfe33fabfed
origin/phase5a-4c-investor-review-professional-gateway: a27e7d66835541e39632e5c33b1fecfe33fabfed
Latest commit: a27e7d6 docs: record desktop gateway visual qa
Working tree: clean before documentation changes
```

## Preview Deployment Inspected

```text
Preview URL: https://brik-by-brik-engine-91zqsrdsi-brikbybrik-engine.vercel.app
Deployment ID: dpl_At4LEGShhDQWFVvzkLDQwgYhZA7V
Project name: brik-by-brik-engine
Scope: brikbybrik-engine
Environment target: preview
Status: READY
Created: 2026-07-25 08:29:53 +00:00
Deployed commit: 9d9753faeac830288d8c1dcc424c40624faa7def (from the recorded PR #4C-1 deployment baseline; current inspect JSON did not expose commit metadata)
Observed failing route: GET /api/saved-deals
Observed safe error: SAVED_DEALS_READ_FAILED
Observed safe diagnostic: DATABASE_URL is required for Postgres adapter usage.
```

## Runtime Variable Required

`lib/db/postgres.ts` reads exactly:

```text
process.env.DATABASE_URL
```

No runtime fallback variable is supported in the shared Postgres adapter.

Variables searched by name only:

- `DATABASE_URL`
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `SUPABASE`
- `VERCEL_ENV`

## Vercel Project Link

```text
Local .vercel/project.json projectName: brik-by-brik-engine
Local projectId: prj_AbokvX7ZPyaX9zw3i7U579Q2bzNb
Local orgId: team_iIqoB5QTKVCU0i9LtSuY6keD
Live project: brikbybrik-engine/brik-by-brik-engine
Live owner: Brikbybrik Engine
Node version: 24.x
Build command: npm run build or next build
```

The preview deployment inspected resolves under the same `brikbybrik-engine` scope. This is not a wrong-project-linkage failure.

## Environment Presence Matrix

| Variable | Production | Preview | Development |
| -------- | ---------: | ------: | ----------: |
| `DATABASE_URL` | Present | Missing | Missing |

Supporting Vercel audit facts:

- `vercel env list production --scope brikbybrik-engine` returned one user-managed env entry: `DATABASE_URL`, target `Production`, created `28d ago`.
- `vercel env list preview --scope brikbybrik-engine` returned `No Environment Variables found`.
- `vercel env list development --scope brikbybrik-engine` returned `No Environment Variables found`.

## Root Cause

`A. Variable missing from Preview`

Exact cause:

- linked Vercel project is correct;
- `DATABASE_URL` exists for `Production`;
- `DATABASE_URL` does not exist for `Preview`;
- current preview deployment therefore starts runtime paths that call `lib/db/postgres.ts` without `process.env.DATABASE_URL`.

This is direct variable-target absence, not a code bug, not a database-data issue, and not a wrong-project problem.

## Smallest Safe Correction

Add existing approved `DATABASE_URL` value to Vercel `Preview` environment for linked project `brik-by-brik-engine`, then redeploy current feature-branch commit.

Correction boundary:

- reuse approved existing connection string;
- do not rotate credentials;
- do not create a new database;
- do not alter `Production`;
- do not print value;
- do not commit env file;
- do not modify application code.

## Redeployment Requirement

`Required`

Reason:

- inspected preview deployment `dpl_At4LEGShhDQWFVvzkLDQwgYhZA7V` was created on `2026-07-25 08:29:53 +00:00`;
- at audit time, Preview still had no `DATABASE_URL` entry;
- current deployment therefore cannot inherit a variable that is not present in Preview;
- after Preview variable is added, a fresh preview deployment is required so runtime receives it.

## Post-Correction Verification Plan

After PR #4C-1B:

1. Confirm new preview deployment reaches `READY`.
2. Confirm deployed commit matches current feature-branch `HEAD`.
3. Confirm `GET /api/saved-deals` returns `200`.
4. Confirm response exposes no secret.
5. Confirm real `/saved-deals/[id]/review` route renders.
6. Confirm no database mutation occurs.
7. Rerun desktop visual QA separately.

## Security Confirmation

Confirmed:

- no secret value printed;
- no environment value modified;
- no application code changed;
- no database accessed directly or mutated;
- no production setting changed;
- no redeployment performed.

## Result

`PR #4C-1A COMPLETE — PREVIEW DATABASE_URL ROOT CAUSE IDENTIFIED`

## Recommended Next Step

`PR #4C-1B — Restore DATABASE_URL for the Vercel Preview environment and redeploy the current feature branch.`
