# Option 2 / Task 3A: Authentication, Authorization and QA Readiness Audit

Branch `feat/video-assessment-integration`, base HEAD `b668aff`. Work is uncommitted, unpushed, undeployed.
No database was connected to, no migration was run, no secret was read, printed or requested.
Sources: repository files and committed docs only. Anything not provable from those is marked **UNVERIFIED**.

## 1. Verdict

| Question | Answer |
|---|---|
| Does a real, trusted authentication mechanism exist anywhere in the app? | **No.** |
| Is an isolated, writable, non-Production QA database documented anywhere? | **No. QA is BLOCKED.** |
| Are the new viewing-assessment endpoints safe to expose today? | Yes. They fail closed (401 for everyone). |
| Are the pre-existing Saved Deal endpoints safe to expose? | **No. Unauthenticated read and write, and Production is reachable.** |

## 2. Authentication architecture (as found)

Evidence, all file-level:

- `package.json` dependencies are only `next`, `pg`, `react`, `react-dom`. No auth, session, JWT, or Supabase client library.
- No `middleware.ts` or `proxy.ts` at the root or in `src/`. `next.config.ts` has only `reactCompiler: true`, with no header or auth config.
- A grep of `app/`, `lib/`, `components/`, `types/` for cookie, jwt, session, bearer, authorization, supabase, next-auth, clerk, x-forwarded finds nothing that reads an identity. The only `headers()` call is the one I added in `app/saved-deals/[id]/viewing/page.tsx`.
- `lib/operator-command/trusted-internal-operator-identity.ts:17-21`: `resolveTrustedInternalOperatorIdentity` is a stub that ignores the request and returns `{ status: "unauthenticated" }`. It is documented as "fail closed until a verified server-side identity mechanism is integrated" (also `docs/phase4/PHASE_4F_MINIMAL_SERVER_IDENTITY_GUARD_AND_MOCKED_TESTS.md`).
- `lib/operator-command/require-saved-deal-read-access.ts`: a correct fail-closed wrapper. It ignores `dealId` (`void dealId`) and has **no callers** in `app/` other than the routes and page added in Task 2. Its only previous consumer was its own test.
- No env var names an identity source. The only runtime variable proven is `DATABASE_URL` (`docs/handover/PHASE_4H_2A_ENVIRONMENT_VARIABLE_INVENTORY.md`). `POSTGRES_URL` and `SUPABASE_DB_URL` are only checked for presence in `scripts/check-db-connectivity-safe.ts`. The Supabase anon and service-role variables are explicitly "not currently required".
- `saved_deals` has no owner or user column (`db/migrations/20260522_phase4a_saved_deals_table.sql`). There is no per-user data model, only a single "internal operator" concept in type names.
- Deployment-level protection is **UNVERIFIED**: `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_ACCESS_CONTROL_BOUNDARY_RESOLUTION.md:161` records "Verified platform deployment protection: Unverified". `docs/phase4/PHASE_4F_CORRECTED_PRODUCTION_DATABASE_READ_ROUTE_SMOKE_VERIFICATION.md` shows external requests to Production `GET /api/saved-deals` returning `200 {"success":true,"deals":[]}`, so the API was reachable without credentials at that time.

### Viable implementation path (proposal only; not implemented)

Nothing here invents an identity or a default user. It needs an owner decision (section 8, D1).

**Target (recommended): verify a Supabase Auth access token server-side.** The Supabase project already exists ("Brik by Brik Engine").
1. `resolveTrustedInternalOperatorIdentity(request)` reads `Authorization: Bearer <jwt>` (or an HttpOnly session cookie set by a login route).
2. Verify the signature against the project's public JWKS with `node:crypto`, or `jose` if a new dependency is approved. Check `iss`, `aud`, `exp` and `nbf`.
3. Map `sub` to a principal only if it appears in an owner-managed allowlist. Anything else returns `unauthorized`.
4. Missing or invalid configuration returns `unauthenticated` (fail closed), never a default.

Required environment (names only, values are owner-supplied secrets or public config):
- `OPERATOR_JWT_ISSUER`
- `OPERATOR_JWT_AUDIENCE`
- `OPERATOR_JWKS_URL` (public)
- `OPERATOR_ALLOWED_SUBJECTS` (comma-separated user IDs)

**Interim option for isolated QA only:** a per-operator bearer-token map, with env `OPERATOR_TOKEN_SHA256_MAP` as `subject:sha256hex` pairs. Compare in constant time. Each token maps to a named person, so `reviewerId` stays meaningful. It must not be enabled in Production.

**Affected files for the first slice:** `trusted-internal-operator-identity.ts` (implementation), a login or session route if cookies are used, and a `.env.example` (names only). `require-saved-deal-read-access.ts` and every Task 2 route need no change.

**Acceptance tests (mocked JWKS, no network):**
- Valid token and allowlisted subject yields `authenticated` and the subject becomes `reviewerId`.
- Expired, wrong-issuer, wrong-audience, `alg:none`, bad-signature, and non-allowlisted tokens are denied.
- Missing env yields `unauthenticated`.
- No code path produces a principal without a verified token.
- The existing 401/404 behaviour of the guard is unchanged.

## 3. Findings, ranked

### Critical
- **C1: No authentication on any pre-existing endpoint, and Production is reachable** (see section 2). Anyone with the Production URL can call every route below. Consequence depends on Production data. It was empty when last recorded, and the database is currently frozen "pending recovery".
- **C2: Unauthenticated writes can forge governance state.** `POST /api/saved-deals` (`app/api/saved-deals/route.ts`) accepts client-supplied `classification`, `governance_state`, `capital_protection_state`, `pipeline_state` and `engine_result_json`, validated only as non-empty strings or objects. A caller can create a deal that displays any governance or capital-protection state, backed by a fabricated engine result. `PATCH` evidence (`evidence/[evidenceId]/route.ts`) can set `status` and `reviewed`. `POST pipeline` changes pipeline state.

### High
- **H1: Unauthenticated reads of every deal and its derived analysis.** `GET /api/saved-deals?includeArchived=true` lists all deals with address, listing URL, prices and engine output. The same applies to `[id]`, `investor-summary`, `investor-shield-ui`, `offers`, `tasks`, `evidence`, and the pages `/saved-deals/[id]/review` and `/summary`.
- **H2: `/` fetches these APIs directly from the browser** (`app/page.tsx:259,381,433,460,503,569,621,670`). Guarding the APIs without a login flow breaks the main Saved Deals UI. This is the compatibility blocker that stops a quick fix.
- **H3: 500 responses from six existing routes include a `diagnostic` object** (error name, code, a sanitized first-line message, route name) in the body: `saved-deals/route.ts`, `[id]/route.ts`, `evidence/route.ts`, `evidence/[evidenceId]/route.ts`, `investor-shield-ui/route.ts`, `investor-summary/route.ts`. The message is redacted for URLs and credentials, but this is still information disclosure. The viewing routes return a trace ID only.
- **H4 (my Task 2 code, fixed in this task): no CSRF defence on the new POST routes.** It would have mattered the moment cookie-based identity was enabled. Fixed, see section 6.

### Medium
- **M1: Single role, no per-deal ownership.** Once identity exists, every allowlisted operator can read and review every deal. This follows from the schema and is not a code defect, but it is an owner decision (D4).
- **M2: A run can stay `RUNNING` forever (my code, NOT fixed).** `startRun` and `completeRun` are separate calls with no lease. A process crash between them leaves the run `RUNNING`, and the same idempotency key returns 409 `ANALYSIS_IN_PROGRESS` indefinitely. Fix in Task 3B: reclaim runs whose `updated_at` is older than a lease, with contract tests against both repositories.
- **M3: No per-assessment limits.** Nothing caps total assets or frames per assessment, or analysis runs per assessment, so storage and rows can grow without bound. The architecture draft gives 5 min and 250 MB per clip and 20 min in total, and only the per-clip limits are enforced.
- **M4: Append-only is bypassable by cascade, by design.** Deleting a saved deal, or an assessment row, cascades through the append-only tables (the trigger permits cascades). Anyone with DELETE privilege on those parents can erase review history. Whether audit history must survive deal deletion is an owner decision (D5).
- **M5: No RLS, GRANT or REVOKE** on the new tables, matching the existing schema (`PHASE 4B` explicitly deferred policy). The database role used by the app is **UNVERIFIED**, so I did not add RLS: enabling it could lock the app out.
- **M6: Idempotency keys are not payload-bound.** Replaying a key with a different body returns the first result silently. Low impact for assessment creation (key-only body) and mock runs.
- **M7: Operator subject is returned to clients** (`createdBy`, `reviewerId`). Acceptable for internal operators.

## 4. Route-by-route inventory

Every route below currently has **no authentication** unless marked. "Deal authz" means a per-deal authorization check, and none exists anywhere. "Deal exists" is a 404 check only.

| Method and endpoint | Data | Deal exists | Unauthorized exposure or modification | Recommended remediation |
|---|---|---|---|---|
| `GET /api/saved-deals` | read all deals (optional archived) | n/a | **Exposes every deal** | Guard (P1). Drop `diagnostic` from 500s. |
| `POST /api/saved-deals` | **write** deal | n/a | **Creates deals with arbitrary governance state and engine JSON (C2)** | Guard (P0). Server-derive governance and capital-protection state from the engine, never accept them from the client. |
| `GET /api/saved-deals/[id]` | read deal | yes | Exposes a deal | Guard (P1). |
| `POST /api/saved-deals/[id]/pipeline` | **write** pipeline state | yes | Moves any deal's pipeline; governed by `evaluateOperatorGuard`, but anonymous | Guard (P0). |
| `GET /api/saved-deals/[id]/offers` | read offers | no | Exposes offers | Guard (P1). |
| `POST /api/saved-deals/[id]/offers` | **write** offer | no (FK only) | Creates offers on any deal | Guard (P0). |
| `GET /api/saved-deals/[id]/tasks` | read tasks | no | Exposes tasks | Guard (P1). |
| `POST /api/saved-deals/[id]/tasks` | **write** task | no (FK only) | Creates tasks on any deal | Guard (P0). |
| `GET /api/saved-deals/[id]/evidence` | read evidence | yes | Exposes evidence notes | Guard (P1). |
| `POST /api/saved-deals/[id]/evidence` | **write** evidence | yes | Creates evidence, including command-style status fields | Guard (P0). |
| `PATCH /api/saved-deals/[id]/evidence/[evidenceId]` | **write** evidence | yes | Can set `status` and `reviewed` (forge verification) | Guard (P0). |
| `GET /api/saved-deals/[id]/investor-shield-ui` | read derived gate model | yes | Exposes Investor Shield analysis | Guard (P1). |
| `GET /api/saved-deals/[id]/investor-summary` | read derived summary | yes | Exposes investor summary | Guard (P1). |
| Pages `/saved-deals/[id]/review`, `/summary` | read, server-rendered | yes (`notFound`) | Exposes full investor review and summary | Guard (P1). |
| Pages `/`, `/phase-2-*`, `/phase-3-dev-review`, `/phase-5a-*` | client calculator and fixtures | n/a | `/` calls the APIs above. The `phase-*` pages showed no database access in the imports I inspected (one loads committed fixtures; the others import no data loader). | `/` follows API guarding. Gate or remove the dev pages before any public release. |
| `GET/POST .../viewing-assessments` and 5 sub-routes (Task 2) | read and write | yes | **Fail closed: 401 today.** CSRF origin check added. | None beyond the identity implementation. |

**Remediation order (proposal, not applied):**
- **P0:** all writes.
- **P1:** all reads and server-rendered pages.
- **Implementation pattern:** a single wrapper that calls `requireSavedDealReadAccess`. Only the shape of the deny response is shared. Make this change together with the login flow (H2), and verify `/` still works behind it. Do not guard routes first and discover the UI broke.
- **Interim, no code:** if Production holds, or will hold, real deal data, put the Vercel deployment behind Vercel Deployment Protection or an IP allowlist. This is a platform setting (status **UNVERIFIED**, plan tier unknown). The owner must decide, because it changes access for James and Karlo.

## 5. QA readiness (read-only): **BLOCKED**

| Item | Finding |
|---|---|
| Local config | No `.env*` files and no `.vercel/` directory exist in this checkout. The only record that a local `.env.local` once existed is in docs. Repository contains no database target metadata. |
| Supabase | One shared project, "Brik by Brik Engine" (`docs/phase5/...TRANSACTION_POOLER_CORRECTION...`). It is **shared across multiple projects**, isolated from them only by schema namespace `brik_by_brik_engine` (`docs/phase4/PHASE_4A_SHARED_SUPABASE_NAMESPACE_PLAN.md`). A schema is a namespace, not a separate database. |
| Vercel | Project under scope `brikbybrik-engine`. `DATABASE_URL` is set for **Production only**; Preview and Development had none (`docs/phase5/PHASE_5A_4C_PR_4C_1A_PREVIEW_DATABASE_URL_AUDIT.md`). Later Phase 5A docs describe replacing the Preview database URL and attempting a pooler-mode correction. Which database Preview points at, and whether it is the Production database, is **UNVERIFIED** from the repository. |
| Isolation from Production and Phase 5B Preview | **No isolated target documented.** The only known database is the production one. |
| Current state | Phase 5B is frozen "pending Supabase restoration" (`docs/phase5/PHASE_5B_2C_BRANCH_FREEZE.md`). Database availability is **UNVERIFIED**. |
| Migration ownership | **Unproven**: schema-management authority is listed as unverified in `docs/handover/PHASE_4H_2C3_CONSOLIDATED_OWNERSHIP_AND_ACCESS_MATRIX.md`. |
| Backup and recovery | Backup capability is documented; **actual restorable backup, restore authority and any tested restore are unverified** (same matrix; `PHASE_4H_2B2...`). |
| Needed access | A new Supabase project or branch (or a local disposable Postgres) owned by a named person; a database role that owns the `brik_by_brik_engine` schema; the ability to take and restore a snapshot; an owner approval for any cost. |
| Verifiable without touching a database | Migration syntax and structure (static test), repository behaviour (in-memory contract), route behaviour (mocked guard). All done. |

I did not run the optional "disposable local Postgres in Docker" route: although it touches no project database, it is still a database write and migration execution, which this task excludes. It is the cheapest unblock and needs your explicit go-ahead (D2).

## 6. Migration and integration-test readiness

Review of `db/migrations/20261020_task2_viewing_assessment_tables.sql` (unapplied):

- **Compatibility:** schema `brik_by_brik_engine`, parent `saved_deals(id TEXT)` match the existing migrations. No existing table is altered. It is not applied to anything.
- **Transaction safety:** the file has no `BEGIN/COMMIT`. Apply it with `psql --single-transaction -v ON_ERROR_STOP=1` (now in the file header) so a failure leaves nothing behind. All DDL is transactional in Postgres.
- **Hardening made in this task (migration is unapplied, so safe to edit):** composite foreign keys now force every child row (evidence to asset, proposal to run, review to proposal, feedback to proposal and review) to share the parent's `assessment_id`. Previously raw SQL could link rows across assessments, and so across deals. A static test guards this.
- **Cascade and triggers:** the append-only function rejects UPDATE and direct DELETE and permits DELETE at `pg_trigger_depth() > 1`, which is how a parent cascade reaches the child. This reasoning matches Postgres semantics but is **unverified on a live database**. The Postgres test suite covers it.
- **Idempotency:** unique keys on `(deal_id, idempotency_key)` and `(assessment_id, idempotency_key)`, plus `INSERT ... ON CONFLICT DO NOTHING` followed by a read. Correct under concurrency.
- **Concurrent reviews:** `recordReview` takes `SELECT ... FOR UPDATE` on the proposal row, compares `MAX(revision)` to `expectedRevision`, and the `(proposal_id, revision)` unique key backstops it. Two concurrent first reviews yield one `ok` and one `stale_revision`. Not run against Postgres yet.
- **Known gap (M2):** stuck `RUNNING` runs, section 3.
- **Not enforceable in SQL:** `proposals.evidence_ids` array membership and evidence-timestamp-within-duration remain API-validated.

**Integration-test readiness:** done and runnable offline:
- `__tests__/contracts/viewing-repository-contract.ts` is one behavioural contract (deal scoping, idempotency, duplicate clips, replay and reopen of runs, append-only revisions, preserved originals, feedback history).
- `__tests__/viewing-repository.in-memory.contract.test.ts` runs it against the in-memory double on every test run.
- `__tests__/postgres/viewing-repository.pg.contract.test.ts` runs the same contract against Postgres, plus database-enforced rules: direct UPDATE/DELETE rejected, cascade delete allowed, CHECK and composite-FK integrity, concurrent review and concurrent run start. It is **skipped** unless `VIEWING_QA_DATABASE_URL` is set, `VIEWING_QA_CONFIRM_ISOLATED=I_CONFIRM_THIS_IS_NOT_PRODUCTION` is set, and the URL differs from `DATABASE_URL`. It writes only `qa-contract-*` deals and deletes them. **It has never been executed.** Expect it may need small fixes on first run.

**Isolated QA procedure (for after D2 is decided):**
1. Create the target. Record project name, owner, region, and snapshot capability in a doc. Take a snapshot.
2. Apply the existing `db/migrations/*` in filename order, then this migration, with `psql --single-transaction -v ON_ERROR_STOP=1`.
3. Run the Postgres contract tests with the two `VIEWING_QA_*` variables set.
4. Roll back by running the `DROP` list at the top of the migration, in reverse order, or restore the snapshot. Because the migration only adds objects, rollback never touches `saved_deals`, Evidence Lite or Investor Shield data.
5. Re-apply from clean to prove the migration repeats.

## 7. Source and copyright boundaries

- **Third-party-derived text, all in one file:** `lib/viewing-assessment/checklist-v1.ts`. It holds 58 entries (group, title, prompt). C01-C45 derive from Martin Rapley / Refurbishment Mastery (2021), "Pre-Purchase Property Inspection Checklist". V01-V13 derive from an "earlier supplied buyer viewing checklist" and cash-only questions: **their provenance and licence are unidentified**, which is a gap to close.
- **Where that wording flows:**
  - `components/viewing-assessment/ViewingAssessmentPanel.tsx` imports the whole list and renders titles, so the full text (including prompts) ships in the client JavaScript bundle.
  - `validate-ai-proposals.ts` and `viewing-assessment-service.ts` use IDs and counts only.
  - Tests and the migration reference IDs only, not wording. The mock service's observation strings are original text.
- **Internal testing is fine:** unit, contract and QA tests on this branch, and the private QA environment. **Blocked until commercial reuse rights are confirmed:** any production merge, deployment, Preview shared outside the team, demo to third parties, or distribution of the bundle. The checklist and the panel must not ship with that text until rights are confirmed in writing, or the wording is replaced with original text keyed to the same IDs.
- **Cheap mitigation available later:** replace titles and prompts with owner-authored wording, or load them server-side only after rights are confirmed. I did not change this, to keep the checklist faithful for James's source review.

## 8. Owner decisions needed

- **D1: Identity provider.** Supabase Auth JWT (recommended), a per-operator token map for QA only, or platform-level protection. Who maintains the allowlist?
- **D2: QA target.** Create a separate Supabase project or branch, or approve a disposable local Postgres, to run the migration and Postgres tests. Who owns it, who can snapshot and restore, who pays?
- **D3: Production exposure.** Is Production holding real data now, and should it be put behind platform protection immediately (no code)? Who approves guarding the existing routes, given `/` will need a login flow?
- **D4: Per-deal ownership.** Is single-role access to all deals acceptable, or does `saved_deals` need an owner column (a schema change to an existing table)?
- **D5: Audit retention.** Must viewing-assessment history survive deleting a saved deal? If yes, drop the cascade and soft-delete instead.
- **D6: Checklist rights.** Obtain written reuse permission, identify the V01-V13 source, or replace the wording.
- **D7: Review of Production-facing C2.** Whether to stop client-supplied governance and capital-protection state in `POST /api/saved-deals` now, as a small separate fix, ahead of the full guard.

## 9. Next implementation task (Task 3B)

Implement the identity resolver (D1) behind the existing guard with the mocked-JWKS acceptance tests above, and add the stuck-run lease with contract tests on both repositories. In parallel, after D2, apply the migration to the isolated target and run the Postgres contract suite. That combination gives the first real end-to-end QA run of the viewing-assessment workflow without touching any existing route.
