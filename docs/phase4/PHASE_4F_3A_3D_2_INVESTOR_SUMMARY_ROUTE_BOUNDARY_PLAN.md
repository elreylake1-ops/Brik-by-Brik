# Phase 4F-3A-3D-2 Investor Summary Route Boundary Plan

## Purpose

Document the future Investor Summary GET route boundary without implementing the route, route tests, or any runtime changes.

## Repository Baseline

- Branch: `main`
- `HEAD`: `1466411dcd34b6f8e39cba2bb5949072137c27f0`
- `origin/main`: `1466411dcd34b6f8e39cba2bb5949072137c27f0`
- Origin remote: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing `.gitignore` modification

## Files Inspected

- `lib/investor-summary/investor-summary-repository.ts`
- `__tests__/investor-summary-repository.test.ts`
- `docs/phase4/PHASE_4F_3A_3D_1_INVESTOR_SUMMARY_REPOSITORY_AND_MOCKED_TESTS.md`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/select-active-investor-summary-tasks.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `types/investor-summary.ts`
- `types/investor-shield-enforcement.ts`
- `app/api/saved-deals/route.ts`
- `app/api/saved-deals/[id]/route.ts`
- `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
- `app/api/saved-deals/[id]/evidence/route.ts`
- `lib/http/safe-route-error.ts`
- `__tests__/saved-deals-api-route.test.ts`
- `__tests__/saved-deals-api-detail-route.test.ts`
- `__tests__/investor-shield-ui-route.test.ts`
- `__tests__/evidence-lite-api-route.test.ts`
- `__tests__/evidence-lite-item-api-route.test.ts`

## Existing Investor Summary Repository Contract

- Exported function: `getInvestorSummaryForDeal(dealId: string)`
- Input contract: a single `string` deal ID
- Blank-ID behavior: the repository trims the input and returns `null` for blank or whitespace-only values before any dependency read
- Success output: `Promise<InvestorSummaryViewModel>`
- Missing-deal behavior: returns `null`
- Infrastructure-failure behavior: propagates the original dependency error without wrapping
- Dependency failure wrapping: none
- Normalization behavior: the repository trims the deal ID at the boundary and uses the trimmed value for reads

## Selected Future Route Path

`app/api/saved-deals/[id]/investor-summary/route.ts`

The future endpoint represents:

`GET /api/saved-deals/:id/investor-summary`

## Supported HTTP Method

- `GET` only

Explicitly excluded:

- `POST`
- `PATCH`
- `PUT`
- `DELETE`

## GET Request Sequence

Future request flow:

`receive route deal ID`
→ `resolve and normalize route parameter`
→ `reject invalid or blank ID safely`
→ `call the Investor Summary repository function once`
→ `map missing deal to 404`
→ `map success to 200`
→ `map infrastructure failure to 500`

The route must not call saved-deal, Shield, task, or offer repositories directly, run selectors, call the composition helper directly, recalculate financial values, create fallback summaries, or mutate data.

## Route Identity Ownership

- `[id]` is the sole deal identity
- no request body is expected
- no body deal ID may be accepted
- no query-string deal ID may override `[id]`
- no header may override `[id]`
- route ID should be trimmed according to the existing GET route convention
- blank or invalid IDs must not reach the repository

## Success Response Contract

- HTTP status: `200`
- Proposed envelope: `{ "success": true, "investorSummary": InvestorSummaryViewModel }`
- Contained object: the existing `InvestorSummaryViewModel`
- No raw saved-deal row
- No raw Shield rows
- No raw task rows
- No raw offer rows
- No repository metadata
- No database information

## Invalid-ID Contract

- Blank route ID: `400`
- Whitespace-only route ID: `400`
- Malformed ID: only relevant if a project-wide format is enforced; none is currently required here
- Safe body: `success: false` with a stable safe error string
- Repository call: none
- Stack trace: none
- Internal diagnostics: not exposed publicly

## Missing-Deal Contract

- Repository missing-deal signal: `null`
- Route mapping: `404`
- Safe body: stable safe error code or message consistent with current nested saved-deal routes
- No empty Investor Summary
- No partial Investor Summary
- No dependency details

Candidate safe code if aligned with project naming:

`INVESTOR_SUMMARY_NOT_FOUND`

## Infrastructure-Failure Contract

Failure sources:

- saved-deal loading
- extraction
- Investor Shield loading
- task loading
- offer loading
- composition

Planned route mapping:

- HTTP status: `500`
- Safe error code: candidate `INVESTOR_SUMMARY_READ_FAILED` if consistent with project conventions
- Trace ID: include if supported by the existing safe-route diagnostic policy
- Server-side logging: `console.error` with safe diagnostic context
- No partial response

The public response must not expose SQL, raw Postgres errors, database hostnames, Supabase project references, credentials, environment variables, stack traces, local file paths, or internal repository implementation details.

## Safe Diagnostic Contract

Current routes use `createSafeRouteErrorDiagnostic(...)` and log the diagnostic server-side with `console.error(...)`.

Observed public behavior:

- `400` and `404` responses are simple safe error envelopes
- `500` responses include `error`, `traceId`, and `diagnostic`
- `diagnostic` includes `errorName`, `errorCode`, `errorMessage`, `routeName`, `traceId`, and `timestamp`

Plan for the future Investor Summary route:

- follow the existing safe diagnostic helper policy
- do not expose raw database exceptions
- do not treat raw Postgres `42P01` text as an approved public convention
- keep any public diagnostic limited to the established safe fields only

## Route and Repository Responsibility Matrix

| Concern                            | Route | Investor Summary Repository |
| ---------------------------------- | ----: | --------------------------: |
| Route parameter parsing            |   Yes |                          No |
| HTTP status mapping                |   Yes |                          No |
| Response envelope                  |   Yes |                          No |
| Trace-ID handling                  |   Yes |                          No |
| Saved-deal existence orchestration |    No |                         Yes |
| Saved-deal extraction              |    No |                         Yes |
| Shield loading                     |    No |                         Yes |
| Task loading                       |    No |                         Yes |
| Offer loading                      |    No |                         Yes |
| Selector execution                 |    No |                         Yes |
| Composition                        |    No |                         Yes |
| Financial recalculation            |    No |                          No |
| Mutation                           |    No |                          No |

## Side-Effect Prohibition

The future GET route must not:

- update saved deals
- create or update tasks
- create or update offers
- move pipeline state
- satisfy Investor Shield gates
- waive Investor Shield gates
- create or update evidence
- persist Investor Summary
- execute migrations
- call AI
- call OCR
- call scraping
- call external integrations
- generate PDFs
- trigger automation

## Future Route-Test Location

`__tests__/investor-summary-route.test.ts`

## Future Mocked-Test Strategy

- Mock the Investor Summary repository function only
- Mock trace or logging helpers only where required
- Build route context using the `[id]` param shape already used by existing nested saved-deal route tests
- Do not mock underlying Shield, task, offer, or saved-deal repositories in the route test file
- Do not use `DATABASE_URL`, PostgreSQL, Supabase, network access, live routes, or migrations

## Future Test Coverage

### Success

- valid ID returns `200`
- repository is called once
- repository receives the normalized route ID
- response uses the approved envelope
- returned Investor Summary is unchanged
- underlying canonical repositories are not imported or called directly by the route

### Invalid ID

- blank ID returns `400`
- whitespace-only ID returns `400`
- invalid ID does not call the repository
- safe error body is returned

### Missing deal

- repository missing-deal signal maps to `404`
- no empty summary is returned
- stable safe error code is returned

### Infrastructure failure

- repository failure maps to `500`
- failure does not become `404`
- no raw error message is exposed
- no SQL is exposed
- no database connection string is exposed
- no Supabase project reference is exposed
- no environment data is exposed
- no stack trace is exposed
- trace-ID behavior follows existing conventions

### Method and side-effect safety

- route exports only `GET`
- no mutation repositories are imported or called
- no raw SQL
- no new pool
- no migration execution
- no database access in tests
- no production route calls
- no AI, scraping, upload, OCR, PDF, or automation behavior

## Implementation Acceptance Criteria

The later route implementation must not be accepted unless:

1. The approved GET route exists.
2. It calls only the Investor Summary repository boundary.
3. Success returns `200`.
4. Invalid IDs return `400`.
5. Missing deals return `404`.
6. Infrastructure failures return `500`.
7. Error responses are safe.
8. The approved response envelope is used.
9. No partial or fallback summary is returned.
10. Raw dependency records are not exposed.
11. No mutation behavior exists.
12. Route tests use mocked repository behavior only.
13. Build, lint, and full tests pass.
14. No live database or production route is accessed.
15. `.gitignore` remains untouched.

## Production Block

- Vercel currently points to a PostgreSQL database where the required relation was not found
- the intended Supabase project contains `brik_by_brik_engine.saved_deals`
- James must align Production `DATABASE_URL`
- no migration should be executed
- no production Investor Summary route proof is authorized
- route planning does not depend on production availability

## Deferred to Phase 4F-3A-3D-3

Explicitly deferred:

- route implementation
- route tests
- exact stable error constants if they do not already exist
- authentication
- authorization
- UI
- page integration
- production deployment
- production route proof
- persistence
- caching
- performance testing

## Explicit Non-Implementation

Confirmed:

- no runtime code changed
- no route created
- no tests created
- no repository changed
- no types changed
- no database access
- no SQL
- no new pool
- no migration
- no environment changes
- no production route called
- no UI
- no page integration
- no deterministic recalculation
- no Investor Shield behavior change
- `.gitignore` untouched

## Verdict

PHASE 4F-3A-3D-2 COMPLETE — READY FOR PHASE 4F-3A-3D-3

## Recommended Next Step

`Phase 4F-3A-3D-3 — Investor Summary GET Route and Mocked Route Tests`
