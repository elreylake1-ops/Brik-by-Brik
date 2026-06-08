## Purpose
Add safe temporary diagnostics for production saved-deals 500s, then repro read-only routes in production.

## Changes Applied
- `lib/http/safe-route-error.ts`
  - added safe error normalizer
  - returns `errorName`, `errorCode`, clamped `errorMessage`, `routeName`, `traceId`, `timestamp`
  - redacts connection strings and secret-like tokens
- `app/api/saved-deals/route.ts`
  - logs safe diagnostics on GET failure
  - returns safe 500 JSON metadata
- `app/api/saved-deals/[id]/route.ts`
  - logs safe diagnostics on GET failure
  - returns safe 500 JSON metadata
- `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
  - checks parent saved deal first
  - returns 404 when saved deal missing
  - logs safe diagnostics on GET failure
  - returns safe 500 JSON metadata
- `__tests__/saved-deals-api-route.test.ts`
  - added safe 500 metadata coverage
- `__tests__/saved-deals-api-detail-route.test.ts`
  - added safe 500 metadata coverage
- `__tests__/investor-shield-ui-route.test.ts`
  - added missing-deal 404 coverage
  - added safe 500 metadata coverage

## Safety Controls
- no secrets in response
- no stack traces in response
- no `DATABASE_URL` printed
- no DB mutation
- no schema change
- no Vercel/Supabase settings changed

## Production Repro Results

### `GET https://lakeviewsproperty.vercel.app/api/saved-deals`
- Status: `500`
- Body: `{"success":false,"error":"SAVED_DEALS_READ_FAILED","traceId":"1cff1c6b-05ce-4c23-b6a7-4ac52ba26884",...}`
- Safe diagnostic:
  - `errorName`: `error`
  - `errorCode`: `28P01`
  - `errorMessage`: `[redacted] authentication failed for user "postgres"`
  - `routeName`: `saved-deals.list`
- Missing proof ID 404: not applicable for list route
- Log trace match: none, `vercel logs --since 10m` returned no relevant lines

### `GET https://lakeviewsproperty.vercel.app/api/saved-deals/768e352c-1784-40b4-8169-a31716dee0e9`
- Status: `500`
- Body: `{"success":false,"error":"SAVED_DEAL_READ_FAILED","traceId":"0762ea62-763b-42df-a31a-54b54e26c713",...}`
- Safe diagnostic:
  - `errorName`: `error`
  - `errorCode`: `28P01`
  - `errorMessage`: `[redacted] authentication failed for user "postgres"`
  - `routeName`: `saved-deals.detail`
- Missing proof ID 404: not reached because upstream DB auth failed first
- Log trace match: none

### `GET https://lakeviewsproperty.vercel.app/api/saved-deals/768e352c-1784-40b4-8169-a31716dee0e9/investor-shield-ui`
- Status: `500`
- Body: `{"success":false,"error":"INVESTOR_SHIELD_UI_READ_FAILED","traceId":"0be44a4f-97b1-441a-b4e4-0bd6a3c97a17",...}`
- Safe diagnostic:
  - `errorName`: `error`
  - `errorCode`: `28P01`
  - `errorMessage`: `[redacted] authentication failed for user "postgres"`
  - `routeName`: `saved-deals.investor-shield-ui`
- Missing proof ID 404: not reached because upstream DB auth failed first
- Log trace match: none

## Root Cause Finding
CONFIRMED: env/connection issue

Reason:
- production 500s now expose SQLSTATE `28P01`
- error message says authentication failed for user `postgres`
- safe route instrumentation shows failure happens before not-found handling can complete

## Recommended Next Step
Phase 4A-R10E - fix production DB auth / connection source, then rerun safe read-only runtime retest

## Validation
- build result: passed
- lint result: passed
- test result: passed
- deployment status: `Ready`
- commit hash: `45b490e`
- push result: pushed to `origin/main`
- final git status: clean after commit

## Final Report
- Files inspected:
  - `AGENTS.md`
  - `LEAN-CTX.md`
  - `package.json`
  - `lib/db/postgres.ts`
  - `lib/operator-command/saved-deals-repository.ts`
  - `app/api/saved-deals/route.ts`
  - `app/api/saved-deals/[id]/route.ts`
  - `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
  - `__tests__/saved-deals-api-route.test.ts`
  - `__tests__/saved-deals-api-detail-route.test.ts`
  - `__tests__/investor-shield-ui-route.test.ts`
- Files changed:
  - `lib/http/safe-route-error.ts`
  - `app/api/saved-deals/route.ts`
  - `app/api/saved-deals/[id]/route.ts`
  - `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
  - `__tests__/saved-deals-api-route.test.ts`
  - `__tests__/saved-deals-api-detail-route.test.ts`
  - `__tests__/investor-shield-ui-route.test.ts`
  - `docs/phase4/PHASE_4A_R10D_SAFE_RUNTIME_ERROR_INSTRUMENTATION_REPRO.md`
- Diagnostics added:
  - safe route error normalizer
  - trace IDs
  - route names
  - clamped sanitized error messages
  - safe 500 JSON payloads
- Tests added/updated:
  - safe 500 metadata for list route
  - safe 500 metadata for detail route
  - missing saved deal 404 for Investor Shield UI
  - safe 500 metadata for Investor Shield UI
  - secret-like string redaction coverage
- Production repro results:
  - list route: 500, `SAVED_DEALS_READ_FAILED`, `28P01`
  - detail route: 500, `SAVED_DEAL_READ_FAILED`, `28P01`
  - investor shield route: 500, `INVESTOR_SHIELD_UI_READ_FAILED`, `28P01`
- Root cause finding: `CONFIRMED: env/connection issue`
- Recommended next step: `Phase 4A-R10E`
- Safety confirmation:
  - no mutation performed
  - no migrations run
  - no schema changes
  - no secrets printed
  - no Vercel/Supabase settings changed
- Build result: passed
- Lint result: passed
- Test result: passed
- Commit hash: `45b490e`
- Push result: succeeded
- Final git status: clean
