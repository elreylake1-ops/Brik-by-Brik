# Phase 4E-P3A Production Data-Source Reconciliation

## Purpose

Record the read-only reconciliation between the repository-local database target and the live Vercel production surface before any Evidence Lite write is attempted.

## Controlling Client Status

`Phase 4E Evidence Lite — local mocked-integration complete, pending live Vercel / production Supabase verification.`

## Repository Baseline

| Item | Value |
| --- | --- |
| Repository | `C:\Users\user\Documents\Lake Views Property\deal-analyzer` |
| Branch | `main` |
| `HEAD` | `778e6513a09c9c4f2a4a583d4b1756c00f0f7194` |
| `origin/main` | `778e6513a09c9c4f2a4a583d4b1756c00f0f7194` |
| Latest commit | `docs: verify evidence lite production migration` |
| Dirty state before this document | only the pre-existing unstaged `.gitignore` modification |

## Stop-Before-Write Record

- No Evidence Lite `POST` occurred.
- No Evidence Lite `PATCH` occurred.
- No saved-deal creation occurred.
- No database mutation occurred.
- No migration ran.
- No environment value was changed.
- No Vercel relink occurred.
- No redeployment occurred.
- No UI activation occurred.
- No browser review page implementation occurred.
- No PDF generation occurred.
- No authentication expansion occurred.
- No AI, OCR, image/video review, upload, scraping, CRM expansion, automation, role-system, or formula/classification change occurred.
- The production `DATABASE_URL` could not be safely surfaced as a usable value from the Vercel CLI/API path in a clean environment, so the production database target remains unverified.

## Runtime Database Environment Ownership

- `lib/db/postgres.ts` uses `process.env.DATABASE_URL` and nothing else for runtime Postgres access.
- The saved-deal routes and Evidence Lite routes call the shared Postgres adapter through the repository layer.
- No second database adapter was found for the saved-deal / Evidence Lite path.
- The runtime data-source boundary is therefore a single Postgres pool keyed off `process.env.DATABASE_URL`.

## Vercel Project Identity

| Item | Value |
| --- | --- |
| Vercel project | `brik-by-brik-engine` |
| Vercel project id | `prj_AbokvX7ZPyaX9zw3i7U579Q2bzNb` |
| Vercel org/team id | `team_iIqoB5QTKVCU0i9LtSuY6keD` |
| Vercel scope/context | `brikbybrik-engine` |
| Production domain | `https://brik-by-brik-engine-chi.vercel.app` |

## Production Deployment Identity

| Item | Value |
| --- | --- |
| Current production deployment id | `dpl_y5P5GtHDfRxvekpKVGU2KTstXQNv` |
| Deployment aliases | `brik-by-brik-engine-chi.vercel.app`, `brik-by-brik-engine-brikbybrik-engine.vercel.app`, `brik-by-brik-engine-git-main-brikbybrik-engine.vercel.app` |
| Deployment state | `READY` |
| Deployment target | `production` |
| Deployment createdAt | `2026-06-29T02:56:30.4090000Z` |
| Deployment commit | `778e6513a09c9c4f2a4a583d4b1756c00f0f7194` |
| Deployment commit message | `docs: verify evidence lite production migration` |

## Production Environment Presence and Timing

| Check | Result |
| --- | --- |
| `DATABASE_URL` present in Production project env metadata | `PRESENT` |
| Production env metadata update time | `2026-06-27T16:47:32.9720000Z` |
| Production env secret retrievable through safe CLI/API path | `NO` |
| Deployment created after env metadata update | `YES` |

The production env metadata exposes `DATABASE_URL` as a sensitive Production variable, but the safe CLI/API paths did not yield a usable decrypted value in a clean environment.

## Secret-Handling Boundary

- No raw `DATABASE_URL` was printed.
- No password was printed.
- No service key or access token was printed.
- No full secret-bearing URL was printed.
- Only masked fingerprints and derived metadata are recorded below.

## Connection Fingerprints

| Surface | Fingerprint | Supabase Project Reference | Notes |
| --- | --- | --- | --- |
| Local `.env.local` direct DB | `9ec8e783194a` | `qxtgdkfzpovyrxgyjpwm` | Derived from the local connection string; direct query succeeded. |
| Vercel Production direct DB | `unavailable` | `unavailable` | Safe CLI/API comparison did not expose a usable decrypted `DATABASE_URL`. |
| Deployed Vercel API | `unavailable` | `inferred only` | The API surface is not a direct database source. |

Fingerprint match: `UNVERIFIED`

## Direct Database Comparison

### Target A: Repository `.env.local`

| Check | Result |
| --- | --- |
| Database name | `postgres` |
| Saved-deal count | `1` |
| Known authorized deal exists | `yes` |
| Evidence Lite table exists | `yes` |
| Evidence rows | `0` |

### Target B: Vercel Production

| Check | Result |
| --- | --- |
| Database name | `unavailable` |
| Saved-deal count | `unavailable` |
| Known authorized deal exists | `unavailable` |
| Evidence Lite table exists | `unavailable` |
| Evidence rows | `unavailable` |

Reason:

- The production env value could not be safely surfaced through the Vercel CLI/API path.
- A clean-directory `vercel env run -e production` invocation did not provide a usable `DATABASE_URL`.

## Deployed API Comparison

| Endpoint | Status | Safe classification |
| --- | --- | --- |
| `GET /` | `200` | healthy shell render |
| `GET /api/saved-deals` | `200` | empty collection |
| `GET /api/saved-deals/b619c646-7ee9-469d-bbb2-40d010b3f63e` | `404` | saved deal not found |
| `GET /api/saved-deals/b619c646-7ee9-469d-bbb2-40d010b3f63e/evidence` | `404` | saved deal not found |
| `GET /api/saved-deals/00000000-0000-0000-0000-000000000000` | `404` | expected missing-id response |

Observed during the fresh API pass:

- no unexpected `500`
- no unexpected `28P01`
- no unexpected `42P01`

## Target Comparison Matrix

| Surface | Fingerprint | Supabase Project | Saved Deals | Known Deal Exists | Evidence Table | Evidence Rows |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Local `.env.local` direct DB | `9ec8e783194a` | `qxtgdkfzpovyrxgyjpwm` | `1` | `yes` | `yes` | `0` |
| Vercel Production direct DB | `unavailable` | `unavailable` | `unavailable` | `unavailable` | `unavailable` | `unavailable` |
| Deployed Vercel API | `unavailable` | `inferred only` | `0` | `no` | `unavailable` | `unavailable` |

## Mismatch Classification

### Classification E - Safe environment comparison unavailable

Result:

`PRODUCTION DATA-SOURCE RECONCILIATION BLOCKED — DASHBOARD VERIFICATION REQUIRED`

Rationale:

- The local database is reachable and contains the authorized saved deal.
- The deployed API alias is healthy but returns an empty saved-deals collection and `404` for the authorized deal.
- The Production env metadata shows `DATABASE_URL` exists, but the safe CLI/API path did not expose a usable decrypted value, so the direct Production DB target could not be verified.

## Intended Versus Actual Supabase Projects

| Scope | Project reference |
| --- | --- |
| Intended production project from ownership records | `jagjbwxodnbgbhhojuzo` |
| Local `.env.local` derived candidate | `qxtgdkfzpovyrxgyjpwm` |
| Vercel Production project | `unavailable` |
| Behavior matching the deployed API | `unresolved` |

Authoritative production database:

`PENDING HUMAN DECISION`

## P2B Status Clarification

- P2B correctly verified the schema of the database reached through `.env.local`.
- That database contained one saved deal and an empty `deal_evidence` table.
- P2B did not prove that the deployed Vercel runtime used the same `DATABASE_URL`.
- The schema verification remains valid for the `.env.local` database.
- No rollback is required.
- No production Evidence Lite row was created.
- Phase 4E-P3 never started because the work stopped before the first write.

## Authoritative Production Target Decision

The currently verified evidence is insufficient to approve a production write.

## Smallest Safe Correction

`Obtain James/Karlo confirmation of the authoritative Supabase project reference.`

## Approved Browser Review Milestone

- The browser-rendered Investor Summary and Evidence Pack review document remains approved.
- It stays after live data-source alignment and Evidence Lite persistence/UI proof.
- Binary PDF generation remains deferred until visual approval.

## Phase 4E-P3 Status

`NOT STARTED — BLOCKED BEFORE FIRST WRITE`

## Explicit Non-Implementation

Confirmed no:

- Evidence Lite `POST`
- Evidence Lite `PATCH`
- saved-deal creation
- database mutation
- migration execution
- environment change
- Vercel relink
- redeployment
- UI activation
- browser review page implementation
- PDF generation
- authentication expansion
- AI
- OCR
- image/video review
- upload
- scraping
- CRM expansion
- automation
- role system
- formula change
- classification change

## Result

`PHASE 4E-P3A BLOCKED — SAFE VERCEL DATABASE TARGET VERIFICATION UNAVAILABLE`

## Recommended Next Step

`Obtain James/Karlo confirmation of the authoritative Supabase project reference.`
