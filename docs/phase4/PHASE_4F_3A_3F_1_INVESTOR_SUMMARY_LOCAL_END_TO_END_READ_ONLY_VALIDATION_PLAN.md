# Phase 4F-3A-3F-1 Investor Summary Local End-to-End Read-Only Validation Plan Only

## Purpose

Document the complete read-only Investor Summary path and the smallest future validation model for proving the route-to-panel flow locally without any database, production, or browser automation dependency.

## Repository Baseline

- Branch: `main`
- `HEAD`: `50aa03eb8c126c2900eea4c375888dcc5a4010be`
- `origin/main`: `50aa03eb8c126c2900eea4c375888dcc5a4010be`
- Origin remote: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing `.gitignore` modification

## Read Path

Conceptual path using the current implementation:

```text
saved-deal ID
→ GET route: app/api/saved-deals/[id]/investor-summary/route.ts GET
→ Investor Summary repository: getInvestorSummaryForDeal
→ saved-deal existence gate: getSavedDealById
→ saved-deal/engine extraction: extractSavedDealValues
→ Shield, task, and offer loading: loadAndEvaluateInvestorShield, listTasksForDeal, listOffersForDeal
→ existing selectors/adapters: buildInvestorShieldInput, composeInvestorSummaryViewModel
→ view-model composition: composeInvestorSummaryViewModel
→ HTTP response envelope: NextResponse.json({ success: true, investorSummary })
→ fetch helper: fetchInvestorSummary
→ route panel: InvestorSummaryRoutePanel
→ pure presentation panel: InvestorSummaryPanel
```

## Existing Validation Infrastructure

| Validation Tool | Present | Current Usage | Suitable for Phase 3F-2 |
| --------------- | ------: | ------------- | ----------------------: |
| Vitest unit tests | Yes | Repository, selector, mapper, and helper coverage | Yes |
| Vitest component tests | Yes | Static render checks for pure panels | Yes |
| Vitest route tests | Yes | Read-only route status and safe error mapping | Yes |
| Fetch-helper tests | Yes | Mocked route contract checks | Yes |
| Integration tests | Yes | jsdom route-panel tests with mocked `fetch` | Yes |
| Local Next.js runtime | Yes | Existing app runs through `next dev` / `next build` | Limited |
| Playwright | No | No browser automation framework is configured | No |
| Route interception | Yes | `vi.mock`, stubbed `fetch`, and controlled promises | Yes |
| Manual fixture walkthrough | Yes, informally | Existing local panel rendering can be inspected without new tooling | Optional |

## Selected Future Validation Model

Selected model:

`EXISTING AUTOMATED TESTS PLUS TARGETED INTEGRATION TEST`

Why this is sufficient:

- the repository already has isolated tests for the repository, route, fetch helper, route panel, and pure panel
- a targeted integration test can prove the read-only flow from approved GET route URL construction through to `InvestorSummaryPanel`
- the existing jsdom and mocked `fetch` setup already proves the interaction boundary without a live database

Why heavier options are unnecessary:

- Playwright is not required because the current surface is a read-only detail panel already covered by deterministic DOM tests
- a local Next.js runtime is not required for the proof itself because the route and panel boundaries are already isolated and testable
- a mock server is unnecessary because the current `fetch` and `vi.mock` patterns already provide deterministic response control

Reused infrastructure:

- `vitest`
- `jsdom`
- `renderToStaticMarkup`
- `createRoot` + `act`
- stubbed `fetch`
- `vi.mock`
- existing investor summary fixtures

## Database Independence

Phase 4F-3F-2 should not require:

- `DATABASE_URL`
- PostgreSQL
- Supabase
- Vercel
- production records
- migrations
- network access

Response control will be handled by:

- mocked `fetch` for the route-panel boundary
- mocked repository dependencies inside route tests
- controlled promises for dependency ordering
- existing fixture-driven summary inputs

## Validation Scenarios

### Complete summary

Prove:

- approved host surface renders
- correct deal ID is used
- loading state is visible before completion
- summary reaches the pure panel unchanged
- financial values, Shield status, actions, tasks, offer, and warnings display

### Deterministic blocked summary

Prove:

- blocked or rejected state remains prominent
- capital-protection warning remains visible
- advisory information does not soften deterministic risk
- no recalculation occurs

### Nullable and unavailable summary

Prove:

- unavailable money does not become zero
- canonical zero remains zero
- no offer fallback is used
- unavailable sections remain explicit

### Empty collections

Prove:

- no actions remains a valid empty state
- no tasks remains a valid empty state
- no offer remains a valid empty state
- no content is fabricated

### Invalid ID

Prove:

- safe invalid-deal state
- no summary panel
- no database access

### Missing deal

Prove:

- safe not-found state
- no empty summary
- distinct from infrastructure failure

### Infrastructure failure

Prove:

- safe error state
- no partial summary
- no raw SQL, database identifier, environment value, or stack trace
- trace ID only when safely supplied

### Malformed success response

Prove:

- safe failure state
- no partial summary
- no inferred fields

### Responsive and accessible presentation

Prove:

- desktop and narrow layouts remain readable
- critical content is not hidden
- status meaning is textual
- warnings are not color-only

### Read-only safety

Prove:

- no POST, PATCH, PUT, or DELETE
- no saved-deal mutation
- no task mutation
- no offer mutation
- no Shield mutation
- no evidence mutation
- no persistence

## Layer Assertion Matrix

| Layer | Input | Expected Output | Failure Signal | Mutation Permitted |
| ----- | ----- | --------------- | -------------- | -----------------: |
| GET route | Saved-deal id | Safe JSON envelope with `success` and `investorSummary` or read-only error | `400`, `404`, or `500` with safe payload | No |
| Repository | Saved-deal id | `InvestorSummaryViewModel` or `null` | `null` for missing deal, rejection for infrastructure failure | No |
| Extraction helper | Saved deal row | Canonical money and deal fields | Null canonical values when source data is absent or malformed | No |
| Shield adapter | Enforcement result | Read-model shield input for the composer | Safe mapped gate / status values only | No |
| Task selector | Raw task rows | Ordered active tasks only | Empty active-task array when nothing qualifies | No |
| Offer selector | Raw offer rows | Latest canonical offer or `null` | `null` when no valid offer exists | No |
| Composer | Saved deal + canonical values + shield + tasks + offers | `InvestorSummaryViewModel` | No partial view model | No |
| Fetch helper | Deal id | Parsed success or safe failure result | Invalid-id, 404, 500, malformed response | No |
| Route panel | Selected saved-deal id | Loading, error, or rendered summary UI | Safe prompt / not-found / error state | No |
| Pure panel | `InvestorSummaryViewModel` | Read-only presentation | No mutation, no fetch, no inferred fields | No |

## Existing Proof Versus Future Proof

| Required Assertion | Existing Test/File | Already Proven | Requires 3F-2 |
| ------------------ | ------------------ | -------------: | ------------: |
| saved-deal existence-first behavior | `__tests__/investor-summary-repository.test.ts` | Yes | No |
| post-gate dependency loading | `__tests__/investor-summary-repository.test.ts` | Yes | No |
| no partial composition | `__tests__/investor-summary-repository.test.ts` | Yes | No |
| route status mapping | `__tests__/investor-summary-route.test.ts` | Yes | No |
| safe route errors | `__tests__/investor-summary-route.test.ts` | Yes | No |
| fetch response mapping | `__tests__/fetch-investor-summary.test.ts` | Yes | No |
| loading state | `__tests__/investor-summary-route-panel.test.tsx` | Yes | No |
| route-panel rendering | `__tests__/investor-summary-route-panel.test.tsx` | Yes | No |
| nullable values versus zero | `__tests__/investor-summary-panel.test.tsx` | Yes | No |
| deterministic warning prominence | `__tests__/investor-summary-panel.test.tsx` | Yes | No |
| empty states | `__tests__/investor-summary-panel.test.tsx` | Yes | No |
| no mutation | `__tests__/investor-summary-route.test.ts`, `__tests__/investor-summary-route-panel.test.tsx`, `__tests__/investor-summary-panel.test.tsx` | Yes | No |
| no sensitive diagnostic leakage | `__tests__/investor-summary-route.test.ts` | Yes | No |
| responsive presentation | Current panel and route-panel DOM structure | Partially | Yes |

## Sensitive-Data Checks

Planned assertions must confirm public UI and public errors do not contain:

- `DATABASE_URL`
- PostgreSQL connection strings
- SQL statements
- raw database hostnames
- Supabase project references
- passwords
- environment values
- stack traces
- local Windows file paths
- repository implementation details

Sensitive checks should use deliberately fake strings only.

## Fixture Ownership

Reuse existing summary fixtures from:

- `__tests__/fixtures/investor-summary-fixtures.ts`

Coverage already present:

- complete summary
- blocked/high-risk summary
- nullable/unavailable summary
- empty collections
- warning-heavy summary

Only narrow HTTP response fixtures are needed for future route-panel proof:

- `200`
- `400`
- `404`
- `500`
- malformed `200`

Do not duplicate the summary fixtures.

## Planned Files

| Future File | Purpose | New or Existing | Why Required |
| ----------- | ------- | --------------- | ------------ |
| `__tests__/investor-summary-route-panel.test.tsx` | Existing route-panel coverage | Existing | Already proves loading, success, not-found, and safe failure states |
| `__tests__/fetch-investor-summary.test.ts` | Existing helper coverage | Existing | Already proves GET-only routing and safe failures |
| `docs/phase4/PHASE_4F_3A_3F_1_INVESTOR_SUMMARY_LOCAL_END_TO_END_READ_ONLY_VALIDATION_PLAN.md` | Local validation plan | New | Required for the inspection-only phase closure |

## Optional Manual Walkthrough

Optional only if a local run is desirable later:

- open the app locally
- select a saved deal
- confirm the route-backed Investor Summary appears beneath the detail surface
- confirm loading then success
- confirm blocked-state visibility on a fixture-driven summary
- confirm the narrow layout remains readable

This walkthrough must still use mocked or fixture-controlled behavior and must not require:

- Supabase
- Vercel
- production
- database records
- migrations

## Acceptance Criteria for Phase 4F-3F-2

Phase 4F-3F-2 should not be accepted unless:

1. The complete route-to-panel path is covered.
2. No live database is required.
3. No production endpoint is called.
4. Successful data reaches the pure panel unchanged.
5. Loading behavior is proven.
6. `400`, `404`, `500`, and malformed-response behavior are proven.
7. Nullable values remain distinct from zero.
8. Deterministic risk remains prominent.
9. Empty collections remain valid.
10. Sensitive diagnostics are not exposed.
11. No mutation behavior exists.
12. Existing fixtures are reused.
13. No new testing framework is introduced.
14. Build, lint, and all tests pass.
15. `.gitignore` remains untouched.

## Local Versus Production Proof

### Phase 4F-3A-3F-2

Will perform:

- fixture-driven local read-only validation
- mocked HTTP behavior
- no production access

### Separate Production Supabase Verification

Will occur only after redeployment is ready and will verify:

- root route returns `200`
- `/api/saved-deals` returns `200`
- missing-deal read routes return safe application-level `404`
- optional existing-deal GET routes work
- no production mutation occurs

## Explicit Non-Implementation Confirmations

Confirmed not part of Phase 4F-3A-3F-1:

- no tests were created
- no runtime code was modified
- no browser automation was run
- no database, Vercel, or Supabase access was used
- no `.gitignore` change was staged or committed
- no Phase 4F-3A-3F-2 work was started

## Result

PHASE 4F-3A-3F-1 COMPLETE — READY FOR PHASE 4F-3A-3F-2
