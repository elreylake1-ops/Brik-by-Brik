## Purpose
Document the production saved-deals runtime failure after the Vercel environment-variable name correction was verified and the production deployment was confirmed ready.

## Root Cause
Supported classification: `DATABASE_TABLE_MISSING`.

Evidence points to a missing `brik_by_brik_engine.saved_deals` relation in production:
- Vercel runtime logs for `GET /api/saved-deals`, `GET /api/saved-deals/__missing__-database-url-check`, and `GET /api/saved-deals/__missing__-database-url-check/investor-shield-ui` all returned Postgres error code `42P01`.
- The logged error message was `relation "brik_by_brik_engine.saved_deals" does not exist`.
- The saved-deals routes query `brik_by_brik_engine.saved_deals` directly through `lib/operator-command/saved-deals-repository.ts`.
- The repository migrations define `CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;` and `CREATE TABLE IF NOT EXISTS brik_by_brik_engine.saved_deals (...)`, so the runtime error is not explained by the current code contract.

A direct local probe could not be completed from the shell:
- `./.env.local` authentication failed with `password authentication failed for user "postgres"`.
- `vercel env pull` produced a local production env snapshot, but the sensitive `DATABASE_URL` value was not exposed for a local connection probe.

## Changes Applied
- No runtime code changed.
- No migrations executed.
- No production settings changed.
- No production data mutated.
- No env values printed.
- Read-only Vercel logs were inspected.
- Read-only route rechecks were performed after log collection.

## Evidence
- `GET /` returned `200`.
- `GET /api/saved-deals` returned `500`.
- `GET /api/saved-deals/__missing__-database-url-check` returned `500`.
- `GET /api/saved-deals/__missing__-database-url-check/investor-shield-ui` returned `500`.
- Runtime logs showed the same relation-missing failure on all three read routes.
- `lib/db/postgres.ts` still uses a single `Pool` driven by `DATABASE_URL`, so the runtime failure is downstream of the route handler and repository call path, not a separate routing branch.

## Safety Confirmation
- Guardrails and deterministic engine logic were not changed.
- Active source and docs were only inspected, not rewritten.
- No code, schema, API, UI, deployment, or migration mutation occurred.
- No secrets were exposed.
- `.gitignore` was untouched.

## Validation Result
- `npm run build`: passed
- `npm run lint`: passed
- `npm test`: passed
- Test totals: `93` test files, `931` tests passed

## Result
`DATABASE_TABLE_MISSING`
