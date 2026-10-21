# Minimum work: working operator login and a separate authenticated Preview

Status: analysis only. Nothing here is implemented, no Preview exists, and nothing has been deployed or connected to any remote database.

## What exists

- Fail-closed server-side verification (`lib/auth`): ES256/RS256 JWT, JWKS fetch, issuer/audience check, and an allowlist of permitted subjects. Authentication is not authorization because the Supabase project is shared, so the allowlist decides who is an operator.
- Env names: `OPERATOR_AUTH_MODE`, `OPERATOR_JWKS_URL`, `OPERATOR_JWT_ISSUER`, `OPERATOR_JWT_AUDIENCE`, `OPERATOR_ALLOWED_SUBJECTS`.
- All viewing-assessment routes require this; verified 401 without a valid token, including forged headers and `alg:none`.

## What is missing

1. **Login UI and session.** Nothing obtains or stores a token. Needed: a sign-in page, a session carried as an HttpOnly, Secure, SameSite cookie, and server code that reads the token from that cookie as well as from `Authorization`.
2. **Browser calls carry credentials.** `app/page.tsx` calls `fetch("/api/saved-deals...")` (about eight call sites) with no auth header. With same-origin cookies these need no change; with bearer headers each needs one.
3. **Pre-existing Saved Deals routes are unguarded** (documented in 3A/3B). They must use the same operator check before any authenticated Preview is shared; otherwise login protects only the new routes.
4. **Page-level gating.** Server pages (`/saved-deals/*`) need a redirect to sign-in when unauthenticated. Use route-level checks, not a global `proxy.ts`, which was deliberately avoided.
5. **Identity provider decision.** Which provider issues tokens (the shared Supabase Auth is possible but only with the allowlist), and who is on the allowlist.

## Separate Preview, safely

- A **new** database and, if used, a new auth project for Preview. Do not point Preview at Production Supabase, and do not assume the Phase 5B Preview is writable.
- Migrations applied by an explicit, reviewed step to that new database only.
- Env vars set only in the Preview scope; Production values never copied.
- Third-party checklist wording must stay out of any deployed build until reuse rights are confirmed (`VIEWING_CHECKLIST_WORDING_APPROVED` stays unset).
- AI stays disabled (`VIEWING_AI_ENABLED` unset) until the budget guard is approved for live use.

## Order of work

1. Decide provider and allowlist (decisions D1/D2/D8 in 3A/3B).
2. Guard the existing Saved Deals routes with the operator check.
3. Add cookie session plus sign-in/out page.
4. Add redirect gating on server pages.
5. Provision separate Preview database/auth and apply migrations.
6. Run the existing contract suite plus a browser login test against Preview.

## Blockers

Provider/allowlist decision, an approved separate Preview database (possible spend), and confirmation of Phase 5B Preview status. None can be resolved by code alone.

---

# Update after Task 5A (supersedes "What is missing" items 1 to 4)

Built locally and tested: cookie sessions, sign-in/sign-out endpoints and page, the operator guard on all 23 Saved Deals handlers and the three server-rendered deal pages, CSRF protection, server-derived governance on save. See `TASK_5A_OPERATOR_LOGIN_AND_AUTHORIZATION.md`. Still not done: connection to a real identity provider, and a Preview environment.

## Non-secret configuration for a Preview (names only; values are set by the owner in the Preview scope)
| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Isolated Preview database. Must not be Production or the shared project's Production schema. |
| `OPERATOR_AUTH_MODE` | `supabase-jwt` |
| `OPERATOR_JWT_ISSUER` | Issuer URL of the approved provider project (https) |
| `OPERATOR_JWT_AUDIENCE` | Expected audience (e.g. `authenticated`) |
| `OPERATOR_JWKS_URL` | Public key set, https on the issuer's own origin |
| `OPERATOR_PASSWORD_GRANT_URL` | Password-grant token endpoint, https on the issuer's origin |
| `OPERATOR_PASSWORD_GRANT_API_KEY` | Provider's public (anon) API key; a credential, so set it as a secret |
| `OPERATOR_ALLOWED_SUBJECTS` | Comma-separated provider subject ids that are operators |
| `VIEWING_*` | Left unset: AI disabled, third-party checklist wording not approved |

Must NOT be set: `SAVED_DEALS_AUTH_ENFORCEMENT` (ignored in hosted environments anyway), any service-role key, any Production URL.

## Operator enrollment policy (proposal for owner approval)
1. An operator is a person with an account in the approved provider project AND an entry in `OPERATOR_ALLOWED_SUBJECTS`. An account alone confers nothing (the Supabase project is shared).
2. Adding or removing an operator is an environment change by the owner, reviewed by a second person; the subject id is copied from the provider dashboard, never typed from a user's claim.
3. Removal takes effect on the removed operator's next request (membership is re-checked each time); also revoke their sessions in `operator_sessions` if immediate cut-off of an open session is wanted.
4. Quarterly review of the list; no shared accounts.
5. Replacing the env allowlist with a database table is a later step (store interface already exists).

## Migration order (Preview database only)
1. Verify the target is the Preview database (host/name) and take a snapshot.
2. `20260522_phase4a_saved_deals_table.sql` and the other `20260522_*` / `20260524_*` / `20260622_*` / `20260706_*` Phase 4 files, if the Preview database does not already have them.
3. `20261020_task2_viewing_assessment_tables.sql`
4. `20261021_task5a_operator_sessions.sql`
Each with `psql --single-transaction -v ON_ERROR_STOP=1`.

## Deployment sequence
1. Owner approves provider and Preview database (decisions below).
2. Create the Preview database and provider project; set the variables above in the Preview scope only.
3. Apply migrations (above), then deploy the branch to Preview.
4. Enrol the first operator; sign in; run the acceptance evidence below.
5. Only then share the Preview URL. Production is untouched at every step.

## Rollback
- Application: redeploy the previous Preview build (no data change involved).
- Sessions: `DROP TABLE IF EXISTS brik_by_brik_engine.operator_sessions;` (everyone signs in again).
- Viewing tables: the documented drop list in the viewing migration header.
- Emergency lock-out: clear `OPERATOR_ALLOWED_SUBJECTS` (invalid or empty means nobody is an operator) and redeploy.

## Acceptance evidence for Preview
1. Anonymous requests to every `/api/saved-deals/**` URL return 401; deal pages redirect to sign-in.
2. A provider account that is not on the allowlist cannot sign in (generic failure) and holds no session.
3. An enrolled operator signs in, lists/saves a deal, opens the viewing page and signs out; the old cookie then fails.
4. Response headers show `__Host-` cookie with `Secure; HttpOnly; SameSite=Lax`.
5. A cross-origin POST with a valid cookie returns 403.
6. A forged `governance_state` on save returns 400.
7. Full test suite and PostgreSQL suite green on the deployed commit.
8. No Production data or credentials in the Preview environment (owner confirmation).

## Decisions still required from the owner
- D-IdP: confirm the identity provider (Supabase Auth in a new, separate project, or another OIDC provider) and the sign-in method (password grant as built; magic link/OAuth would need a different adapter).
- D-Preview-DB: approve an isolated Preview database and any cost.
- D-Enrol: approve the enrollment policy and name the first operators.
- D-Ownership: confirm "every operator sees every deal" or require per-deal ownership (needs an owner column and a data decision).
- D-5B: confirm the Phase 5B Preview's status (not assumed writable).
- D-Wording: third-party checklist reuse rights (blocks any public release containing the wording).
