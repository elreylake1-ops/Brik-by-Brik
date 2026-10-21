# Task 5B: Local sign-in rehearsal results and security-only release plan

Local development and isolated QA only. Nothing here was pushed, merged, deployed or applied to any remote system. No release branch exists yet and nothing was cherry-picked.

# Part A: Local rehearsal

## What ran
- `scripts/qa/idp-simulator.mjs`: a test-only identity provider (HTTPS on 127.0.0.1, throw-away certificate, ES256 JWKS, password grant). Random identities, passwords and API key per run; only the public certificate touches disk, in a temporary folder deleted on close.
- `__tests__/postgres/e2e-auth-flow.pg.test.ts`: starts the **production build** (`next start`) as a separate process on a random loopback port, connected to the disposable Brik QA database (`127.0.0.1:54339`) and the simulator, then drives everything over real HTTP. 15 scenarios, all passing.
- The application child trusts the simulator's certificate through `NODE_EXTRA_CA_CERTS` in that one process only. TLS verification is never disabled (`NODE_TLS_REJECT_UNAUTHORIZED` / `rejectUnauthorized` appear nowhere; a test asserts application code never references them).

## Isolation: why the simulator cannot be active in Production or Preview
1. It refuses to start if `VERCEL` or `VERCEL_ENV` is set, or unless the QA confirmation variable is present.
2. It binds 127.0.0.1 only; its issuer is `https://localhost:<port>`, unreachable from any hosted environment.
3. The application refuses a loopback issuer whenever `VERCEL`/`VERCEL_ENV` is set (`readOperatorAuthDeps`), for `localhost`, `127.x`, `[::1]` and `0.0.0.0` (unit-tested).
4. It lives in `scripts/qa/`; a test asserts no file under `app/`, `lib/` or `components/` references it.
5. The application has no mode that accepts a static or test identity (existing, tested).

## Observed results (production build, real HTTP)
| # | Check | Result |
|---|---|---|
| 1 | Anonymous Saved Deals API (GET and POST, 5 endpoints) | 401 `AUTHENTICATION_REQUIRED`; nothing written |
| 1 | Anonymous `/saved-deals/x/viewing` | 307 to `/sign-in?next=%2Fsaved-deals%2Fx%2Fviewing` |
| 1 | Anonymous `/review`, `/summary` | 200 loading shell containing only `NEXT_REDIRECT;replace;/sign-in?...` (no deal text) |
| 2 | `/` calculator, `/sign-in` | 200; form has email and password fields only |
| 3 | The 4 fixture pages, signed in or not | 404 |
| 4 | Wrong password, unknown user, valid-but-not-operator, expired token, bad signature, wrong audience | each 401 `SIGN_IN_FAILED`, identical body, no cookie, zero session rows |
| 5 | Cross-site or origin-less sign-in | 403 |
| 6 | Operator sign-in | 200 `{"success":true}`; cookie `__Host-brik_session=<redacted>; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800; Secure`, no Domain; DB holds one row with a 64-hex hash, never the id |
| 7 | List, save, read deal, offers, tasks as operator | 200 / 201 / 200 |
| 8 | 7 forged governance/financial fields; 3 invalid number sets | all 400; row count unchanged |
| 9 | Viewing page, create/list/detail/export assessment through the same session; foreign deal id | 200 / 201 / 200; foreign deal 404; anonymous page 307 |
| 10 | Cookie-authenticated POST with foreign, `null` or missing Origin; cross-site sign-out | 403 `CROSS_ORIGIN_REJECTED`; nothing written; a foreign-origin GET is allowed |
| 11 | Tampered, unknown, short, empty cookie; absolute-expired, idle-expired, revoked sessions; a valid session row for a non-operator; forged bearer with valid cookie; forged `x-user-id`/`x-role` | 401 each; non-operator session 404 (membership checked per request) |
| 12 | Sign-out | 200; old cookie then 401; `revoked_at` set |
| 13 | 5 failed sign-ins then the right password from the same client | 429, no cookie; a different client unaffected |
| 14 | `SAVED_DEALS_AUTH_ENFORCEMENT=development-open` set on the production server | ignored (all anonymous requests 401) |
| 15 | 86 captured responses scanned for 26 secrets (access tokens, refresh tokens, API key, passwords) and 6 session ids | none exposed; the cookie is an opaque id, not a JWT |

Limits: requests were made with an HTTP client that sets headers the way the sign-in page does, not with a graphical browser, so cookie storage and the form's click path in a real browser are not exercised. A real-browser pass against the Preview is part of its acceptance evidence.

## Developer-page hardening
`lib/dev-only-page.ts` is called first by `/phase-2-review`, `/phase-2-live-review`, `/phase-3-dev-review` and `/phase-5a-professional-gateway-proof`. They render only under `next dev` and unit tests; any production build or hosted environment answers 404. No environment variable re-enables them. Tests: the allowed/denied matrix, production plus attempted override variables, and a scan requiring every `app/phase-*` page to call the guard before rendering. The running production build returned 404 for all four.

## Validation
| Check | Result |
|---|---|
| `npm test` | 1877 passed, 56 skipped (151 files; the skips are the PostgreSQL suites) |
| Real PostgreSQL (`local-postgres.mjs test`) | 55 passed (40 earlier + 15 end-to-end) |
| ESLint | clean |
| `next build` | clean |
| `tsc --noEmit` | 80 errors, identical to the baseline; all in older unrelated test files; none in new code |
| Migrations | `migrate --all` applied all 9 migrations in order on the QA database |

---

# Part B: Security-only release plan (plan and inventory only)

## Finding that shapes the plan
`main` (= `origin/main`, `6d0981b`) is **not** the base of this branch's recent history. The branch is `main` plus about 25 Phase 5A/5B commits (investor deal summary page, deal formulation, professional readiness, blocked-PR packages) plus the Option 2 commits. The Phase 5 commits are frozen "pending database recovery" and must not travel with a security fix. Therefore the security branch must be built from `main` with **path-based copies, not by cherry-picking commits** (the commits mix security changes with viewing-assessment and Phase 5 work).

### Exposure surface on `main` (what the fix must cover)
Routes: `/api/saved-deals`, `[id]`, `evidence`, `evidence/[evidenceId]`, `investor-shield-ui`, `investor-summary`, `offers`, `pipeline`, `tasks` (9 files, 14 handlers). Pages: `/saved-deals/[id]/review`; fixture pages (4); calculator `/` (public by design). `main` has no summary page, no viewing page, no viewing API.

## Feasibility test (done, non-destructive)
The security changes were extracted as a patch (`b668aff..HEAD` limited to the security paths below) and checked with `git apply --cached --check` against a throw-away index of `main`. Result: **clean for every file except `app/phase-3-dev-review/page.tsx`**, where Phase 5 edits the same import block; there the two-line change (import + `developmentOnlyPage()` call) is applied by hand. No branch, worktree or working-tree change was made.

## File inventory

### A. Copy as new files (absent on `main`)
```
lib/auth/jwt.ts
lib/auth/jwks.ts
lib/auth/operator-auth.ts
lib/auth/session.ts
lib/auth/sign-in.ts
lib/auth/pg-session-store.ts
lib/auth/password-exchange.ts
lib/auth/require-operator-page.ts
lib/dev-only-page.ts
lib/operator-command/guard-saved-deal-api.ts
lib/operator-command/derive-saved-deal-record.ts
app/api/auth/session/route.ts
app/sign-in/page.tsx
components/auth/AuthStatus.tsx
components/auth/SignInForm.tsx
db/migrations/20261021_task5a_operator_sessions.sql
```
### B. Apply as modifications to `main`'s version
```
lib/operator-command/trusted-internal-operator-identity.ts   (stub -> delegates to lib/auth)
lib/operator-command/require-saved-deal-read-access.ts       (cookie CSRF, cross_origin result)
app/api/saved-deals/route.ts                                  (guard + server-derived governance)
app/api/saved-deals/[id]/route.ts
app/api/saved-deals/[id]/evidence/route.ts
app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts
app/api/saved-deals/[id]/investor-shield-ui/route.ts
app/api/saved-deals/[id]/investor-summary/route.ts
app/api/saved-deals/[id]/offers/route.ts
app/api/saved-deals/[id]/pipeline/route.ts
app/api/saved-deals/[id]/tasks/route.ts
app/saved-deals/[id]/review/page.tsx                          (requireOperatorPage)
app/page.tsx                                                  (send inputs only; AuthStatus; sign-in message)
app/phase-2-review/page.tsx
app/phase-2-live-review/page.tsx
app/phase-3-dev-review/page.tsx                               (manual two-line edit)
app/phase-5a-professional-gateway-proof/page.tsx
```
### C. Tests and fixtures to bring (all exist as listed unless marked TRIM)
```
__tests__/operator-auth.test.ts
__tests__/operator-session.test.ts
__tests__/dev-only-pages.test.ts
__tests__/saved-deals-authorization.test.ts       TRIM: delete the 8 viewing imports/rows and the viewing page case (keep 15 handlers, review/summary-less page cases)
__tests__/fixtures/auth-fixtures.ts
__tests__/fixtures/in-memory-session-store.ts
__tests__/fixtures/operator-session.ts
__tests__/deal-offers-api-route.test.ts            (modified: run as test operator)
__tests__/deal-tasks-api-route.test.ts
__tests__/evidence-lite-api-route.test.ts
__tests__/evidence-lite-item-api-route.test.ts
__tests__/investor-shield-ui-route.test.ts
__tests__/investor-summary-route.test.ts
__tests__/saved-deals-api-detail-route.test.ts
__tests__/saved-deals-api-route.test.ts            (rewritten POST contract)
__tests__/saved-deals-pipeline-route.test.ts
__tests__/investor-review-page.test.tsx            (modified: next/headers mock + test operator)
__tests__/require-saved-deal-read-access.test.ts   (already on main; re-run, expected unchanged)
__tests__/postgres/qa-gate.ts
__tests__/postgres/operator-sessions.pg.test.ts
__tests__/postgres/e2e-auth-flow.pg.test.ts        TRIM: remove scenario 9 (viewing workflow) and the viewing page checks
__tests__/local-qa-target.test.ts
scripts/qa/local-qa-target.mjs
scripts/qa/idp-simulator.mjs
scripts/qa/local-postgres.mjs                      TRIM: PREREQ/ROLLBACK lists drop the viewing migration; rollback expects 1 documented DROP
.gitignore                                         (+ `.qa-local/`)
package.json                                       (+ `"qa:pg"` script ONLY)
```
Do **not** bring `@anthropic-ai/sdk` or the `package-lock.json` changes. After editing `package.json`, regenerate nothing: no dependency changes are needed (the auth code uses `node:crypto` and `pg`, already in `main`).

### D. Explicitly excluded
```
All of lib/viewing-assessment/**, types/viewing-assessment.ts, components/viewing-assessment/**
app/api/saved-deals/[id]/viewing-assessments/**, app/saved-deals/[id]/viewing/**, app/viewing-capture-check/**
db/migrations/20261020_task2_viewing_assessment_tables.sql
lib/viewing-assessment/checklist-v1.ts and any third-party checklist wording (verified: it appears in that one file only)
scripts/qa/capture-check*.mjs, __tests__/capture-check-gate.test.ts
docs/option2/* (keep on the feature branch; the release gets its own short note)
All Phase 5A/5B work (summary page, deal formulation, professional gateway/readiness, docs/phase5/*)
```
The security branch must pass a content scan before any push: no `VIEWING_`, `checklist-v1`, `anthropic`, or third-party checklist titles.

## Migration dependencies
1. Only `20261021_task5a_operator_sessions.sql` is new. It depends on nothing but the schema `brik_by_brik_engine` (created `IF NOT EXISTS` in the file). It does not touch `saved_deals`, offers, tasks, evidence or Investor Shield tables.
2. Order on any target database: existing Phase 4 migrations (already present in any database that runs `main`) then the sessions migration. Applied with `psql --single-transaction -v ON_ERROR_STOP=1`.
3. Applying it **before** deploying the code is safe (a new unused table). Deploying the code first is also safe (sign-in fails closed with 503/401 until the table exists), but pointless.
4. Rollback of the table is optional and safe at any time: `DROP TABLE IF EXISTS brik_by_brik_engine.operator_sessions;` makes every session invalid, so everyone signs in again once it is recreated.

## Behaviour changes versus `main` (compatibility risks)
| Risk | Effect | Mitigation |
|---|---|---|
| Saved Deals API/pages now require sign-in | The existing UI's Saved Deals panel shows "Sign in as an operator" until an identity provider is configured and an operator enrolled. The calculator still works. | Intended. Enrol the first operator before promotion. |
| `POST /api/saved-deals` contract change | Requests carrying governance/financial result fields (`governance_state`, `engine_result_json`, ...) now get 400; callers must send `deal_inputs` (+ optional `scope`). The repository's own UI is updated. | Search for any other client (scripts, smoke tests) before release; none found in application code. |
| Deals saved earlier carry browser-supplied governance | Existing rows may contain values the browser chose. | Owner decision: audit/re-derive existing rows after release (read-only query first). Out of scope here. |
| Missing or invalid auth environment variables | Every API returns 401 including for operators (fail closed), never open. | Verify variables on Preview before promotion; acceptance step 1 to 3. |
| Fixture pages gone in production builds | `/phase-*` return 404 | Intended; still available in `next dev`. |
| `loading.tsx` on `/review` | Anonymous visitors get a 200 loading shell then a client redirect, not a 307; no deal data in the body (verified). | Acceptable; true 307 would need removing `loading.tsx`. |
| Plain-http local runs | Cookie lacks `__Host-`/`Secure` (browsers will not store Secure cookies over http). | Local only; hosted environments are https. |

## Rollout prerequisites (owner)
Identity provider and its non-secret configuration (D-IdP), first operators (D-Enrol), an isolated Preview database or approval to use an existing one (D-Preview-DB), and Vercel protection actions below. Environment variable names are listed in `AUTH_AND_PREVIEW_READINESS.md`; values are set by the owner in the Vercel scope for each environment, never in the repository.

## Temporary Vercel Production protection: required
**Yes, from now until the guarded build is promoted and verified.** `main` as deployed serves unauthenticated handlers on both documented Production hosts (`brik-by-brik-engine-chi.vercel.app` and `brik-by-brik-engine.vercel.app`); the only reason no deal data is readable today is that the Production database credentials are failing. Protection must cover every Production hostname, not just one, and stay on through every step below, including during any rollback. The owner must confirm which Vercel protection modes the plan offers; the requirement is the outcome: an unauthenticated caller cannot reach `/api/saved-deals/**` on any Production hostname. Trade-off: the public calculator is also behind Vercel login during that window.

## Rollout sequence
1. **Owner:** enable Production protection on all Production hostnames. Do not restore Production database credentials yet.
2. Create `security/saved-deals-auth` from `main` (after approval); copy sets A, B, C with the trims above; hand-edit `phase-3-dev-review`; run the content scan.
3. On the branch: `npm test`, `npm run lint`, `npm run build`, `npx tsc --noEmit` (must not exceed `main`'s error count), and the PostgreSQL suite on the disposable QA database (session store plus the trimmed end-to-end rehearsal).
4. **Owner:** provision the identity provider and an isolated Preview database; set Preview variables; apply the sessions migration to that Preview database only.
5. Open a PR; deploy to Preview; run the Preview acceptance list (below). Protection stays on.
6. **Owner:** set Production variables and apply the sessions migration to the Production database (only now, and only after the Production database is itself recovered and snapshotted). Promote the same commit.
7. Re-run the acceptance list against Production (authenticated and unauthenticated). Only after it passes, relax protection if desired, then restore Production database credentials if that has not happened yet.

## Preview verification requirements (acceptance evidence)
1. Unauthenticated `GET`/`POST` to each of the 9 route files returns 401; `/saved-deals/<id>/review` shows no deal data to anonymous visitors.
2. An account that is not in `OPERATOR_ALLOWED_SUBJECTS` gets the generic sign-in failure and no session row.
3. An enrolled operator signs in with a real browser, sees the Saved Deals panel, saves a deal (server-derived governance), opens the review page, signs out; the old cookie then returns 401.
4. Response headers: `__Host-` cookie with `Secure; HttpOnly; SameSite=Lax`; no token in any response body.
5. A cross-origin write with a valid cookie returns 403.
6. A forged `governance_state` on save returns 400; the four fixture pages return 404.
7. Test suite results on the deployed commit; the owner's confirmation that Preview holds no Production data or credentials.
8. Existing behaviour unchanged: calculator results, Investor Shield outputs and pipeline guard decisions match `main` for the same inputs (the existing suites for these pass unmodified apart from the test-operator header).

## Rollback without disabling authentication
- Application: redeploy the **previous guarded build**. Never redeploy current `main` (it has no authentication) unless protection is on for the whole duration. For the first guarded release there is no guarded predecessor, so the rollback is: keep protection on, and either fix forward or clear `OPERATOR_ALLOWED_SUBJECTS` (empty or invalid means nobody is an operator; the API then answers 401/404 to everyone) and redeploy the same build.
- `SAVED_DEALS_AUTH_ENFORCEMENT` has no effect outside local `next dev`; no rollback step uses it.
- Data: the sessions table can be dropped or kept; dropping it makes all sessions invalid (safe). No other table changes.
- Any step that would remove the guard without protection already on is out of bounds for the runbook.

## Owner decisions still required
1. **D-IdP:** identity provider and sign-in method (the built adapter is a password grant; magic link or OAuth needs another adapter).
2. **D-Enrol:** enrollment policy and the first operators' subject ids.
3. **D-Preview-DB:** which database Preview uses and approval for any cost; note that the existing Phase 5 Preview database state must not be assumed writable.
4. **D-Protect:** enable Vercel protection on all Production hostnames now, and confirm which modes the plan supports.
5. **D-Branch:** approve creating `security/saved-deals-auth` from `main` by path copy (not by merging this branch).
6. **D-Rows:** whether existing saved deals with browser-supplied governance should be audited or re-derived.
7. **D-Ownership:** keep "every operator sees every deal" or add per-deal ownership.
8. **D-Hosts:** which of the two Production hostnames is canonical (both are in the docs), so both are covered.
9. **D-Wording:** third-party checklist reuse rights (blocks pushing the feature branch; unrelated to this security release).

## Remaining blockers to the November 6 end-to-end Preview
- Production/Preview identity provider and database decisions (items 1 to 3 above): no code can substitute for them.
- The feature branch cannot be pushed until the checklist wording rights are confirmed (item 9) or the wording is replaced; the Preview of the full video workflow depends on that, the security release does not.
- Real AI video analysis has never run (adapter disabled); it needs the budget guard approved for live use and a recorded-fixture evaluation pass first.
- A real-browser and real-Android pass of sign-in, review UI and capture check has not been done.
