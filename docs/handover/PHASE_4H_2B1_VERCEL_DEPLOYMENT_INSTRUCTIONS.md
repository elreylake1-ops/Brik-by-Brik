# Phase 4H-2B1 Vercel Deployment Instructions

## Current Deployment Boundary

- Framework: Next.js 16 App Router
- Git repository: `Brik-by-Brik.git`
- Production branch: `main`
- Vercel project name: `brik-by-brik-engine`
- Production URL: `https://brik-by-brik-engine-chi.vercel.app`
- Required runtime variable names only: `DATABASE_URL`

The application is a Next.js deployment that uses the shared Postgres adapter in `lib/db/postgres.ts`. The deployment boundary therefore depends on the repository branch, the build output, and the presence of `DATABASE_URL` in the target environment.

## Standard Deployment Procedure

1. Confirm the repository is clean except for the known pre-existing `.gitignore` change.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Run `npm test`.
5. Commit only the intended files.
6. Push to the approved branch: `main`.
7. Verify the resulting deployment in Vercel is `Ready`.
8. Verify the production alias resolves to the expected URL.
9. Run safe read-only smoke checks.

Repository evidence shows the production deployment is verified after source changes land on `main`, but this document does not prove that every deployment is fully automatic. The safe workflow is to treat the push as the source of truth and verify the resulting Vercel deployment state.

## Safe Production Smoke Checks

Use read-only requests only:

- `GET /`
- `GET /api/saved-deals`
- `GET /api/saved-deals/{controlled-id}`
- `GET /api/saved-deals/{controlled-id}/investor-shield-ui`
- `GET /saved-deals/{controlled-id}/review`

The controlled deal id should be an existing read-only test identifier already established in repository evidence. Do not use a write request in smoke validation.

## Failed Deployment Procedure

If a deployment does not become `Ready`:

- inspect Vercel build logs
- confirm environment-variable presence by name only
- confirm project linkage
- confirm branch and commit
- do not modify production data while diagnosing
- stop if the deployment source or project identity is uncertain

## Rollback Boundary

The currently supported rollback concept is the ordinary Vercel redeploy/rollback flow to a previously deployed version. This document does not perform a rollback.

The final approved Phase 4 tag will be created only after James formally signs off.

## Ownership Limitation

Deployment ownership and permission verification belong to 4H-2C.

Do not claim who can deploy, promote, or rollback unless that ability is explicitly proven in repository evidence.

## Explicit Non-Implementation

This step does not:

- perform a deployment
- change any Vercel setting
- change any environment variable
- make any production request other than already documented read-only evidence
- make any database change
- update README
- create a release tag
- begin Phase 5 work

## Result

`PHASE 4H-2B1 VERCEL DEPLOYMENT DOCUMENTATION COMPLETE ? READY FOR PHASE 4H-2B2 DATABASE BACKUP AND RECOVERY DOCUMENTATION`
