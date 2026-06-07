## Purpose
This document diagnoses the parity gap between direct route handler success and spawned Next HTTP route safe 500 responses.

## Runtime Contexts Compared
- Direct route handler method: in-process `tsx` invocation of the exported route handlers
- Spawned Next HTTP method: `next start` on `http://127.0.0.1:3007`
- Local target/port: `http://127.0.0.1:3007`
- Branch: `main`
- Latest commit: `8863426`
- Env reporting method: masked/presence-only

## Reproduction Result
- Root page status: HTTP `200`
- Saved-deal read HTTP route status/result shape: HTTP `500` with `{"success":false,"error":"Unable to load saved deal at this time."}`
- Investor Shield UI HTTP route status/result shape: HTTP `500` with `{"success":false,"error":"Investor Shield status could not be loaded. Pipeline rules remain unchanged."}`
- Direct route handler result summary: both route handlers returned HTTP `200` with valid JSON when called in-process, using the same saved-deal id and local DATABASE_URL
- No mutation occurred

## Runtime Parity Findings
- Env presence comparison: `DATABASE_URL` was present in the parent shell and explicitly present in the spawned child env wrapper
- Built route/runtime observations: the built route artifacts exist, but the HTTP path still returns safe `500` while the direct in-process handler path succeeds
- Route config/static/dynamic observations: `next.config.ts` contains no route-level dynamic/runtime override; no static/dynamic route config evidence was found to explain the mismatch
- Sanitized server error category: safe top-level route 500 wrappers only; no secret-bearing message was exposed

## Database Count Safety Check
- `saved_deals` count before/after: `1` / `1`
- `investor_shield_checks` count before/after: `0` / `0`
- Counts did not change

## Diagnosis
The most likely remaining cause is a spawned Next runtime parity issue rather than repository, schema, or investor-shield business logic. Direct in-process calls to the repository, loader, and route handlers succeed, but the HTTP path under `next start` still returns safe 500 responses even with DATABASE_URL propagation confirmed.

## Fix Applied
None.

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
DIAGNOSED ONLY

## Recommended Next Step
Phase 4A-R7D â€” Safe Runtime Success Recheck with Minimal Next Runtime Trace Capture.

