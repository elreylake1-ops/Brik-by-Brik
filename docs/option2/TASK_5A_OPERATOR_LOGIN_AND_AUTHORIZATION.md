# Task 5A: Operator login, sessions and Saved Deal authorization

Scope: local development and isolated QA only. Nothing here touches Production, a remote database, Phase 5B, Vercel or the shared Supabase project. No real identity provider has been contacted.

## What was built

### Session boundary (`lib/auth/`)
| Piece | File | Behaviour |
|---|---|---|
| Session core | `session.ts` | Cookie holds only a random 256-bit id. Server stores `SHA-256(id)`, the verified subject and times. `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`; over HTTPS (or `x-forwarded-proto: https`) the cookie is `__Host-brik_session` with `Secure`. Absolute life 8 h, idle timeout 1 h (constants at the top of the file). |
| Store | `pg-session-store.ts`, migration `20261021_task5a_operator_sessions.sql` | One new table `brik_by_brik_engine.operator_sessions`. Only the hash is stored. Sign-out sets `revoked_at`. Application clock used throughout. |
| Identity provider seam | `operator-auth.ts` (`CredentialExchange`) + `password-exchange.ts` | Provider is an adapter. The Supabase-style password grant adapter verifies the returned JWT with the existing JWKS verifier, keeps only the `sub`, and discards all tokens. It exists only when `OPERATOR_PASSWORD_GRANT_URL` and `OPERATOR_PASSWORD_GRANT_API_KEY` are set and the URL is https on the issuer's origin. |
| Membership | unchanged allowlist | Authentication is not authorization. Membership is re-checked on every request, so removing an operator ends access on their next request. |
| Sign-in / sign-out | `sign-in.ts`, `app/api/auth/session/route.ts` | POST signs in, DELETE signs out, GET returns `{authenticated: boolean}` only. Failures are indistinguishable (wrong password, unknown account, non-operator, provider down). New session id on every sign-in; any presented session is revoked first (no fixation). 5 failures per 15 min per IP+email, then 429. |
| CSRF | `session.ts`, `require-saved-deal-read-access.ts` | A cookie-authenticated change (anything but GET/HEAD/OPTIONS) must carry an `Origin` that matches `Host`; missing, `null` or foreign origin is refused with 403 before any work. Bearer-token requests are not ambient and are exempt. Sign-in and sign-out check Origin too (login/logout CSRF). |
| Credential precedence | `resolveOperatorIdentity` | An `Authorization` header is authoritative. A bad bearer is not rescued by a valid cookie. |

The browser never sees a provider token, signing key, role or operator id. It sends only email + password to the sign-in endpoint over the page's own origin, and receives an opaque HttpOnly cookie.

### UI
- `/sign-in` (form, validated same-site `next` path, no open redirect).
- `AuthStatus` control (Sign in / Sign out) in the Saved Deals panel of the existing page; "Sign in as an operator" message when the API answers `AUTHENTICATION_REQUIRED`.
- The calculator on `/` stays public: it is pure client-side arithmetic with no stored data.

## Protected surface

All 18 route files under `app/api/saved-deals/**` (23 handlers) authenticate first, before reading ids or touching the database:

- Collection list/create, deal detail
- Evidence list/create/update
- Investor Shield UI, investor summary
- Offers, tasks, pipeline movement
- Viewing assessments: list, create, detail, frame upload, analysis runs, feedback history, review decisions, outcomes, evaluation export, frame images

Server-rendered pages `/saved-deals/[id]/review`, `/summary`, `/viewing` call `requireOperatorPage` before loading data: anonymous visitors are redirected to `/sign-in?next=...`, signed-in non-operators get 404.

A test (`saved-deals-authorization.test.ts`) fails if any route file under `app/api/saved-deals` lacks a guard call, and a mutation check (removing one guard) was confirmed to fail it.

Not guarded, deliberately: the fixture-driven developer review pages (`/phase-2-review`, `/phase-2-live-review`, `/phase-3-dev-review`, `/phase-5a-professional-gateway-proof`). They render bundled fixtures and read no saved-deal data. Recommended: block them in production builds (next task).

Known behaviour: `review` and `summary` have an existing `loading.tsx`, so Next streams a 200 loading shell and then issues the redirect in the stream (verified: the body holds only the loading skeleton and `NEXT_REDIRECT ... /sign-in?next=...`, no deal data). `/viewing` returns a true 307.

### Per-deal authorization
`saved_deals` has no owner column. The current rule is therefore: every active operator may use every saved deal. A deal id in a URL is never accepted as proof of access (all routes authenticate before looking the id up), and assessments are bound to their deal by composite foreign keys, so pairing a deal id with another deal's assessment id returns no data. A per-deal ownership rule is an owner decision (see decisions below); `requireSavedDealReadAccess` is the single place to add it.

### Local development without a provider
`SAVED_DEALS_AUTH_ENFORCEMENT=development-open` skips the guard for the original routes and pages, and only when `NODE_ENV=development` with no `VERCEL`, `VERCEL_ENV` or `CI` set. It is ignored in tests, production builds and hosted environments (verified against a production build with the flag set: every route still returned 401). A test asserts it is referenced from exactly one module. It is off by default.

## Governance-input remediation

Problem: `POST /api/saved-deals` accepted `classification`, `governance_state`, `capital_protection_state`, `pipeline_state`, financial figures and the whole `engine_result_json` from the browser. A forged `governance_state` would have been stored and then trusted by the pipeline guard.

Fix (`lib/operator-command/derive-saved-deal-record.ts`):
- The browser sends only `deal_inputs` (seven validated, bounded, finite non-negative numbers) and an optional `scope` (strictly validated enums/integers).
- The server runs the existing `analyzeDealWithRefurb` (the same function the calculator uses; not a second engine) and derives classification, governance state, capital protection, refurb cost, risk summary, pipeline state (`UNDER_ANALYSIS`) and the stored result.
- Any browser-supplied derived field (listed in `DERIVED_FIELDS`) is rejected with 400 rather than trusted or silently overwritten. `id` and timestamps from the browser are ignored.
- `app/page.tsx` now sends inputs only.
- AI output never feeds this path. The viewing-assessment workflow remains separate and cannot set governance.

Remaining, outside this task: stored `engine_result_json` is only as current as the engine version at save time; later reads trust the database (not the browser). Pipeline, offers and tasks already derive governance from the stored row, not the request.

## Tests added or changed
- `operator-session.test.ts` (48): cookie flags, hash-only storage, fixation, generic failures, login CSRF, throttle, absolute/idle expiry, sign-out/revocation, membership removal, store outage, bearer precedence, forged headers, CSRF matrix, open-redirect paths, provider adapter (mocked network), no hard-coded credentials.
- `saved-deals-authorization.test.ts` (142): every handler anonymous / forged / invalid token / non-member / operator; cookie CSRF per mutating route; revoked session; per-deal; dev-only flag; the three pages.
- `postgres/operator-sessions.pg.test.ts` (5) against the disposable local PostgreSQL.
- Existing nine legacy route suites and two page suites now run as a test operator through the real guard (helper `fixtures/operator-session.ts`, test-only). The saved-deals POST suite was rewritten for the new contract, including forgery cases.
- `operator-auth.test.ts`: expectation gains `credential: "bearer"`; the static-credential scan no longer flags the bare word "password" (now a legitimate parameter name) and still flags assigned string literals.

## Local QA commands
```
node scripts/qa/local-postgres.mjs rollback   # now also drops operator_sessions (11 documented drops)
node scripts/qa/local-postgres.mjs migrate    # adds 20261021_task5a_operator_sessions.sql
node scripts/qa/local-postgres.mjs test       # all __tests__/postgres/*
```
