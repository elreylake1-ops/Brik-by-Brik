# Option 2 / Task 3B: Authentication Foundation and Local QA Preparation

Branch `feat/video-assessment-integration`, base HEAD `b668aff`. Uncommitted, unpushed, undeployed.
No Production, Preview or Supabase connection was made. No migration was applied. No container was created.
Read-only commands run: `git`, file reads, `docker --version`, `docker info`, `docker inspect` (container absent), and the
tooling's own `check` command. No secret was read, printed or requested.

## 1. Verification of the Task 3A findings

All confirmed against the code, nothing contradicted:

- `resolveTrustedInternalOperatorIdentity` was a stub returning `unauthenticated` (`lib/operator-command/trusted-internal-operator-identity.ts`). It is now wired to a real boundary and still returns `unauthenticated` with no configuration. The two pre-existing tests for it pass unchanged.
- `requireSavedDealReadAccess` still has no callers outside Task 2's routes and page. All 8 pre-existing API route files remain unguarded. I changed none of them.
- `package.json` has no auth library (`next`, `pg`, `react`, `react-dom`). No middleware or proxy exists.
- `/` still calls the unguarded APIs from the browser (8 call sites in `app/page.tsx`).

New findings this task:
- **Defect in my own guard, found by its own test and fixed:** the "same host, port and database as an application database URL" rejection threw inside a `try` whose `catch` swallowed it, so the check never fired. It is the rule that stops the destructive tests being pointed at the app's real database. Fixed (`scripts/qa/local-qa-target.mjs`), and covered by a test for each of the five database variables.
- **Pre-existing hygiene issue, not changed:** `app/phase-3-dev-review/page.tsx` imports six files from `__tests__/fixtures/` into application code, so test fixtures ship with the app bundle.
- **Response contract fact for the remediation plan:** `governance_state` sent by the browser is the engine verdict (`GO`, `CONDITIONAL`, `NO-GO`, `ANALYSIS ONLY`), not the operator enum, and `capital_protection_state` is `SAFE`/`CAUTION`/`HIGH_RISK`/`NO_DEAL`/`UNKNOWN` (`app/page.tsx:366-372`). Any server allowlist must accept those real vocabularies.
- `traceId` in error bodies is read by `InvestorSummaryRoutePanel`; `diagnostic` is read by no client. Removing `diagnostic` from 500 bodies is compatible.

## 2. Identity implementation and trust assumptions

### What exists now

`lib/auth/` (new), behind the unchanged `requireSavedDealReadAccess` guard:

| File | Role |
|---|---|
| `jwt.ts` | Strict JWT verifier on `node:crypto`. ES256 and RS256 only. No dependency. |
| `jwks.ts` | Key provider for the configured JWKS URL: https-only, 3 s timeout, 64 KB cap, `redirect: "error"`, 10 min cache, unknown-`kid` refetch rate-limited to 1/min, fail closed after 3× TTL of failed refreshes. |
| `operator-auth.ts` | `IdentityProvider` (authentication) and `MembershipStore` (authorization) interfaces, the Bearer-JWT adapter, the env allowlist store, config reader, and `resolveOperatorIdentity`. |

Flow per request: `Authorization: Bearer <jwt>` → verify signature, issuer, audience, expiry → take only the verified `sub` → check the membership store → `authenticated` principal `{kind: "internal_operator", subject}`. Everything else is `unauthenticated` or `unauthorized`.

### Trust rules enforced

- The signature is verified **before** any claim is read. Test: a token with a wrong signer and a wrong issuer reports `bad_signature`, not an issuer error.
- Rejected: missing, malformed, oversize, `alg:none`, HS256 (the key-confusion attack, because it would need the project's shared signing secret in this app), any algorithm other than ES256/RS256, missing or unknown `kid`, wrong key for the `kid`, `crit` headers, private JWKs, JWK `alg`/`use`/`kty`/`crv` mismatches, RSA below 2048 bits.
- Keys come only from our configured JWKS. `jwk`, `jku` and `x5u` in a token header are never followed (test).
- Issuer and audience must match configuration exactly. `exp` is required (30 s leeway). `nbf` is honoured.
- `anon` and `service_role` tokens are rejected explicitly (they also have no `sub`).
- Client-supplied `x-user-id`, `x-role`, `x-internal-operator`, cookies and query parameters are never read (test).
- Configuration is all-or-nothing. A missing variable, a non-https issuer, a JWKS URL on another origin than the issuer, an empty allowlist, or any invalid allowlist entry makes the whole thing `null`, which is `unauthenticated` for every request, even when a valid token is presented (test).
- There is **no mode, flag or environment variable that selects a test or static identity.** The test adapter lives in `__tests__/fixtures/auth-fixtures.ts` and is injected through `__setOperatorAuthDepsForTests`, which throws unless `NODE_ENV === "test"`. Tests assert that no file under `app/`, `lib/`, `components/` or `types/` imports the adapter or the seam, and that the auth modules contain no tokens, keys or default identities.

### Can Supabase Auth be the identity provider? Yes, with these conditions

- **It authenticates but cannot authorize.** The Supabase project ("Brik by Brik Engine") is shared by several products. Any person with an account anywhere in it holds a validly signed token with the same issuer and `aud: authenticated`. The audience check therefore gives **no isolation**. The membership store is what isolates this application, and a test proves a valid token from a non-member gets `unauthorized`.
- **The project must sign with an asymmetric key.** Supabase projects use either the legacy shared HS256 secret or newer asymmetric signing keys (ES256/RS256) published at `<project>/auth/v1/.well-known/jwks.json`. Which one this project uses is **UNVERIFIED** from the repository. If it is still HS256-only, this verifier will (correctly) reject every token, and the owner must rotate to asymmetric signing keys, or choose a different provider. I did not add HS256 support, because it needs the shared secret in this app.
- **Sign-up policy matters.** If self-service sign-up is open on the shared project, strangers can obtain valid tokens. That is acceptable only because of the membership check, and the owner should still close sign-up for this audience if possible.
- **Revocation.** A removed member is blocked on the next request (membership is checked every time). Banning a user in Supabase does not invalidate an already issued token until it expires (default one hour), so membership removal is the immediate control.
- **Token delivery is Bearer header only.** There is no cookie and no login flow yet. Because Bearer tokens are not sent automatically by browsers, they are not CSRF-prone. The same-origin check added in 3A is in place for when a cookie is introduced.

### Required configuration (names only; values are owner-supplied, none are secrets except the allowlist's privacy)

`OPERATOR_AUTH_MODE=supabase-jwt`, `OPERATOR_JWT_ISSUER` (https, e.g. `https://<ref>.supabase.co/auth/v1`), `OPERATOR_JWT_AUDIENCE` (`authenticated`), `OPERATOR_JWKS_URL` (same origin as issuer), `OPERATOR_ALLOWED_SUBJECTS` (comma-separated Supabase user IDs). Nothing is read at import time and nothing is required to build.

## 3. Proposed membership model

**Now (implemented): an owner-managed allowlist of Supabase user IDs in `OPERATOR_ALLOWED_SUBJECTS`.** Exact string match, no wildcards, fail closed on a malformed list. It needs no schema change and suits the first QA environment. Weaknesses: changes need a redeploy or env edit, no audit trail, no per-person disable.

**Next (proposal only, not created):** a database-backed store behind the same `MembershipStore` interface.

```sql
-- PROPOSED, not a migration file and not applied.
CREATE TABLE brik_by_brik_engine.operator_members (
  subject      TEXT PRIMARY KEY,               -- verified Supabase user id (sub); never client-supplied
  status       TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
  role         TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('operator')),
  added_by     TEXT NOT NULL,                  -- subject of the member who added them
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_by  TEXT NULL,
  disabled_at  TIMESTAMPTZ NULL
);
```

Rules:
1. Membership is the **only** application authorization. A valid token is never sufficient.
2. A member is `ACTIVE` with no `disabled_at`. Disabling is a row update; deletion is not used, so history remains.
3. Members are added only by an existing member or the owner through an out-of-band procedure. There is no self-service enrolment, no "first user becomes admin", no default member.
4. One role (`operator`) for now. All operators can act on all deals. Per-deal ownership is decision D4 and would add a `saved_deal_members(deal_id, subject)` table, not change this one.
5. Lookup per request, with an optional in-process cache of at most 60 s so removal takes effect within a minute.
6. Bootstrap: the first rows are inserted by the owner with direct database access in the QA/Production runbook, never by application code.

## 4. Existing-route remediation plan (design only; no existing route modified)

The browser calculator at `/` calls these APIs with no credentials. That one fact decides what can ship before a login flow.

### Stage 0: platform control, no code (decision D3)
If Production holds, or will hold, real data: enable Vercel Deployment Protection or an IP allowlist now. This changes access for James and Karlo, so it is an owner decision, and the plan tier is unverified.

### Stage 1: safe to ship together, before any login, no change for legitimate use of `/`
All are additive validation on requests the current UI already satisfies:
1. `POST /api/saved-deals`: reject unknown keys and oversize bodies; cap `engine_result_json` and `risk_summary_json` (propose 256 KB); force `pipeline_state` to `UNDER_ANALYSIS` on create (the UI always sends it); accept `governance_state` only from the verdict set (`GO`, `CONDITIONAL`, `NO-GO`, `ANALYSIS ONLY`) plus the operator enum, `capital_protection_state` only from `SAFE`/`CAUTION`/`HIGH_RISK`/`NO_DEAL`/`UNKNOWN`, and `classification` only from the `DealClassification` values and verdict set. Derive the sets from the existing types, do not retype them.
2. All six routes returning `diagnostic` in 500 bodies: drop it, keep `traceId`.
3. Same-origin (Origin/Host) check on every existing POST and PATCH, as added to the viewing routes. The UI is same-origin, scripts without an Origin header pass.
4. Server-side length and type caps on offers, tasks and evidence bodies.

**Limit of Stage 1, stated plainly:** it removes malformed and out-of-vocabulary forgery but **not** a forged yet plausible combination (for example `GO` + `SAFE` with a made-up `engine_result_json`), because the server still trusts the client's engine output. Only Stage 4 closes that class.

### Stage 2: additive and dark, no behaviour change
Ship the identity boundary (done in this task), the chosen login mechanism (D1), and a client `apiFetch` that attaches `Authorization` when a token exists and does nothing otherwise. Add an enforcement switch `OPERATOR_AUTH_ENFORCE=off|writes|all`, defaulting to `off`. Deployable independently because nothing is enforced.

### Stage 3: coordinated login release (must ship as one unit)
Prerequisites, all in place before the switch is flipped:
1. Operator-auth environment configured in the target environment, and membership seeded with named people (at least two, so one person cannot lock everyone out).
2. Login UI for `/`, token handling decided (in-memory/session storage with Bearer header, or an HttpOnly cookie, which would also need the resolver extended and keeps the Origin check essential).
3. A single wrapper applying `requireSavedDealReadAccess` to every API route and to the server-rendered pages `/saved-deals/[id]/review` and `/summary`.
4. Tested against `/` end to end (save a deal, offers, tasks, pipeline, evidence, shield panel).

Rollout: deploy with `off`; verify login works; flip to `writes` (all POST/PATCH: saved-deals create, pipeline, offers, tasks, evidence create/patch) and watch; then `all` (reads and pages). Rollback is setting the switch back, with no data change.

Cannot ship earlier than Stage 3: anything that rejects anonymous requests (including "guard writes only"), because `/` would break.

### Stage 4: closes the forgery class (breaking contract change, versioned)
Change `POST /api/saved-deals` to accept the deal **inputs** and let the server run `analyzeDealWithRefurb` and derive classification, governance state and capital-protection state itself, instead of accepting results. Also: restrict who may set evidence `reviewed`/`VERIFIED`, add per-deal ownership if D4 requires it, and an audit table for pipeline and evidence changes. This needs a coordinated client and server change and should not be rushed.

## 5. Local QA readiness and isolation evidence

### Tooling availability
- Docker client 29.8.0, daemon reachable. No host `psql`, `postgres` or `pg_ctl`. Everything therefore runs through a container, which also keeps it away from anything on the host.

### Target identity, for approval

| Item | Value |
|---|---|
| Container name | `brik-viewing-qa-pg` (label `brik.qa=viewing-local`) |
| Image | `postgres:16-alpine` (pin by digest before relying on it) |
| Published address | `127.0.0.1:54339` only (loopback bind). Originally 54329; changed in Task 3C because an unrelated project's database holds 54329. |
| Database / user | `brik_viewing_qa_local` / `brik_qa` |
| Storage | `--tmpfs` 256 MB: all data vanishes when the container stops |
| Credentials | Random password generated into `.qa-local/pg.env` (gitignored, mode 0600). Never printed, never in the repo. |
| Network egress to Supabase | Not configured: nothing in the tooling references any hosted endpoint |

### Why it cannot reach the Supabase Production or Preview projects
1. The container is created by one script and bound to loopback, so it is not reachable from other machines.
2. `scripts/qa/local-qa-target.mjs` defines the only acceptable target and is used by **both** the script and the Postgres tests. It rejects: any non-loopback host, any port except 54339, any database except `brik_viewing_qa_local`, any user except `brik_qa`, **any URL query parameter** (which can override the host), anything that looks hosted (`supabase`, `pooler`, `.co`, `.com`, `.io`), and any URL equal to, or with the same host, port and database as, `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL` or `SUPABASE_DB_URL`. 22 tests cover it.
3. The script never reads those variables except to compare them, and strips them from every child process environment (`scrubbedEnv`).
4. A mistakenly set `VIEWING_QA_DATABASE_URL` does not silently skip or run: it produces a failing test that names the violated rule without echoing the URL.
5. `node scripts/qa/local-postgres.mjs check` (read-only, run now) confirms: Docker reachable, container not created, none of the five database variables is set in this shell, and the five-case isolation self-test passes.
6. Structural tests assert the port bind is loopback-only, the data is on tmpfs, deletion is refused unless the container carries our label, the script never prints the password or a full URL, and the rollback it runs is exactly the migration's documented DROP list (7 tables + 1 function).

### Commands (none run; this is the approval request)
```
node scripts/qa/local-postgres.mjs up         # create + start (pulls the image once; free)
node scripts/qa/local-postgres.mjs migrate    # saved_deals prerequisite + viewing migration, one transaction each
node scripts/qa/local-postgres.mjs test       # Postgres repository contract + database-enforced rules
node scripts/qa/local-postgres.mjs rollback   # the migration's own DROP list, single transaction
node scripts/qa/local-postgres.mjs reset      # down + up + migrate: proves a clean re-apply
node scripts/qa/local-postgres.mjs down       # remove container and all data
```
(`npm run qa:pg -- <command>` is an alias.) `migrate --all` applies every committed migration in filename order, to check the whole chain on a bare Postgres; whether the older migrations run cleanly outside Supabase is **UNVERIFIED**.

### Recovery procedure
The database is disposable by design. Recovery is `down`, then `up`, then `migrate` (`reset`). Rollback of the viewing migration alone is `rollback`. There is nothing to back up. No project data is ever copied in: the tests create and delete their own `qa-contract-*` rows.

### Stopped before
No container was created and no migration was applied. **Approval needed to run `up`, `migrate` and `test`.**

## 6. Migration review: append-only triggers and cascade rules

- **Direct UPDATE/DELETE** on assets, evidence, proposals, reviews and feedback: rejected by row triggers at trigger depth 1.
- **Cascade deletes** (deleting a saved deal or assessment): the child delete runs inside the referential-integrity trigger, so the guard sees depth > 1 and allows it. Reasoning matches Postgres semantics, but it is **unverified on a live database**, and it is one of the database-enforced tests (`lets a parent deal delete cascade through append-only tables`).
- **TRUNCATE gap, found and fixed this task:** row-level triggers do not fire on `TRUNCATE`, so history could be wiped that way. Statement-level `BEFORE TRUNCATE` triggers now guard all five tables, with a static test and a Postgres test.
- **Remaining, by design:** a role that owns the tables (or any superuser) can `DISABLE TRIGGER` or set `session_replication_role = replica`. A direct `DELETE` of an assessment or deal erases its history through the cascade (decision D5). Neither is preventable in SQL. They are controlled by who holds those privileges.
- **Integrity:** composite foreign keys keep every child row in the same assessment as its parent (3A). `proposals.evidence_ids` membership and timestamp-within-duration remain API-validated.
- **Transactions:** apply with `--single-transaction -v ON_ERROR_STOP=1` (the script does).

## 7. Stuck-run recovery

Problem (3A, M2): `startRun` and `completeRun` were separate calls, so a crash between them left a run `RUNNING` forever and its idempotency key returned `409 ANALYSIS_IN_PROGRESS` indefinitely.

Implemented, in both repositories (Postgres and the in-memory double) and the service:
- **Lease:** a `RUNNING` run untouched for `RUN_LEASE_SECONDS` (300) is abandoned. `startRun` reclaims it with one atomic `UPDATE`, setting `attempt_count + 1`. Concurrent claimants serialize on the row lock and the loser re-checks against the fresh `updated_at`, so exactly one wins.
- **Bound:** `MAX_RUN_ATTEMPTS` (3). A `FAILED` or stale run is reopened only while attempts remain. A stale run out of attempts is parked `FAILED / MAX_ATTEMPTS_EXCEEDED` so it stops blocking, and a new idempotency key (a deliberate human re-analysis) is then required.
- **Fencing:** `completeRun` takes the `attempt` number and only succeeds if the run is still `RUNNING` at that attempt; otherwise it throws `RunLeaseLostError` and writes nothing (the status update runs first and the proposal inserts are in the same transaction). A zombie worker that finishes late cannot complete or duplicate a reclaimed run. The service returns `lease_lost`, and the route answers `409 ANALYSIS_SUPERSEDED`.
- **No heartbeat:** the mock analysis is instant. A real provider must refresh `updated_at` while working or use a longer lease. Recorded in the interface comments.
- **Tests (no external services, shared by both implementations):** live lease is not reclaimed; abandoned run reclaimed and zombie fenced out; two concurrent claimants yield one winner; attempt bound stops retries; exhausted stale run is parked; and, at service and API level, a still-live run returns 409, an expired run recovers with one set of proposals, and a stalled attempt that finishes after reclaim yields `lease_lost` with exactly three proposals total.

## 8. Remaining decisions and blockers

- **D1 (blocking real login):** confirm Supabase Auth as provider; confirm the project signs with an asymmetric key (else rotate); decide sign-up policy; decide token handling (Bearer in memory vs HttpOnly cookie).
- **D8 (new):** who are the first operators, and who maintains membership? Allowlist now, `operator_members` table later?
- **D2 (now concrete):** approve running `up`, `migrate`, `test` on the local container described in section 5.
- **D3, D4, D5, D6, D7** are unchanged from 3A. D7 (stop client-supplied governance state now) is Stage 1 above.
- **Not started and blocked on owners:** the login UI, enforcement of existing routes, Stage 4.

## 9. Next safe step toward a working end-to-end Preview

1. On approval, run `up` → `migrate` → `test` locally. This is the first real execution of the Postgres repository, triggers, cascades and lease SQL, and it needs no project access. Fix whatever it finds.
2. In parallel, with the owner: confirm the Supabase signing-key type and sign-up policy (D1), and create a **separate** Supabase project or branch for Preview (D2). Nothing else can honestly be called a Preview.
3. Then Stage 2 (additive login plumbing and the dark enforcement switch), and apply the migration to the new Preview database only.
