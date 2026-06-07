## Purpose
This document captures minimal sanitized trace evidence for the spawned Next HTTP route safe 500 issue.

## Runtime Environment
- Local target/port: built production server on `http://127.0.0.1:3010`
- Branch: `main`
- Latest commit: `e1c2290`
- Production build/start command: `npm run build` then `npm run start -- --port 3010 --hostname 127.0.0.1`
- Env reporting method: masked/presence-only
- DATABASE_URL presence confirmation only: present
- Host category: `pooler`

## Trace Method
- Temporary local-only trace was used first and then removed before the final validation pass
- Sanitized stage labels used:
  - `ROUTE_ENTERED`
  - `PARAMS_RECEIVED`
  - `REPOSITORY_CALL_STARTED`
  - `REPOSITORY_CALL_SUCCEEDED`
  - `REPOSITORY_CALL_FAILED`
  - `LOADER_CALL_STARTED`
  - `LOADER_CALL_SUCCEEDED`
  - `LOADER_CALL_FAILED`
  - `ERROR_NAME_ONLY`
  - `ERROR_MESSAGE_CATEGORY_ONLY`
- No secrets or row data were logged

## Reproduction Result
- Root page status: HTTP `200`
- Saved-deal read HTTP route status/result shape: HTTP `200` with `{"success":true,"deal":{...}}`
- Investor Shield UI HTTP route status/result shape: HTTP `200` with `{"success":true,"model":{...}}`
- Direct route handler baseline: in-process `tsx` route handler calls returned HTTP `200` with valid JSON
- No mutation occurred

## Trace Findings
- Saved-deal route before local env escape: last successful sanitized stage was `REPOSITORY_CALL_STARTED`; first failing sanitized stage was `REPOSITORY_CALL_FAILED`
- Saved-deal route error category: `password authentication failed for user "postgres"`
- Investor Shield route before local env escape: last successful sanitized stage was `LOADER_CALL_STARTED`; first failing sanitized stage was `LOADER_CALL_FAILED`
- Investor Shield route error category: `password authentication failed for user "postgres"`
- After local env escape, the saved-deal route reached `REPOSITORY_CALL_SUCCEEDED` and the Investor Shield route reached `LOADER_CALL_SUCCEEDED`

## Database Count Safety Check
- `saved_deals` count before/after: `1` / `1`
- `investor_shield_checks` count before/after: `0` / `0`
- Counts did not change

## Diagnosis
The failure was caused by Next dotenv parsing of the local `DATABASE_URL` value in `.env.local`, where the password contained an unescaped `$` and was being interpreted during the spawned Next runtime load. Escaping the dollar in the local-only environment file resolved the spawned HTTP 500 path without changing business logic, schema, or route behavior.

## Fix Applied
- Local-only `.env.local` escape applied to `DATABASE_URL` so the `$` in the password is preserved for Next runtime loading
- Temporary trace removed from tracked source files before the final validation pass
- No committed source files were changed for the fix itself

## Safety Confirmation
- no secrets printed
- no env files committed
- no migrations run
- no inserts/updates/deletes
- no task creation
- no pipeline mutation
- no evidence upload
- no Vercel/Supabase setting changed
- no formulas/classifications/governance changed

## Result
FIXED AND VERIFIED

## Recommended Next Step
Phase 4A-R8 â€” Vercel Link / Repo Branch Verification Only.

