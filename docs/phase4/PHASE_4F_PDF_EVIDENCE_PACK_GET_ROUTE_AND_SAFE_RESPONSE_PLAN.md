# PDF Evidence Pack GET Route and Safe Response Plan

## Purpose

Define the read-only GET route boundary for the already-composed PDF Evidence Pack JSON response.

This is inspection and route-contract planning only. No route is implemented in this phase.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `d8e97e28ca883cd3dbe3c493aedd0f8ed1e1c5c5` |
| `origin/main` | `d8e97e28ca883cd3dbe3c493aedd0f8ed1e1c5c5` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this plan | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts`
- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`
- `lib/pdf-evidence-pack/compose-pdf-evidence-pack.ts`
- `__tests__/load-pdf-evidence-pack.test.ts`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_AGGREGATION_REPOSITORY_AND_MOCKED_TESTS.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_SOURCE_LOADING_AND_AGGREGATION_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_CANONICAL_TYPE_CONTRACT_PLAN.md`
- `app/api/saved-deals/[id]/route.ts`
- `app/api/saved-deals/[id]/investor-summary/route.ts`
- `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
- `app/api/saved-deals/[id]/evidence/route.ts`
- `app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts`
- `app/api/saved-deals/[id]/offers/route.ts`
- `app/api/saved-deals/[id]/tasks/route.ts`
- `app/api/saved-deals/route.ts`
- `app/phase-2-live-review/page.tsx`
- `__tests__/saved-deals-api-detail-route.test.ts`
- `__tests__/saved-deals-api-route.test.ts`
- `__tests__/investor-summary-route.test.ts`
- `__tests__/investor-shield-ui-route.test.ts`
- `__tests__/evidence-lite-api-route.test.ts`
- `__tests__/evidence-lite-item-api-route.test.ts`
- `lib/http/safe-route-error.ts`

## Existing Aggregation Boundary

The committed read-only aggregation loader is authoritative for the future route.

It already does the following:

- gates on `getSavedDealById(dealId)` first
- returns `null` for blank or missing deal ids
- loads Shield, tasks, offers, and Evidence Lite concurrently after the saved-deal gate
- composes the canonical Investor Summary view model
- projects Evidence Lite rows through the pure pack projection helper
- assembles the final `PdfEvidencePack` through the pure composer
- carries the fixed disclaimer set inside the loader boundary

The pack contract remains:

- `meta`
- `identity`
- `investorSummary`
- `investorShield`
- `evidenceIndex`
- `disclaimers`

## Selected Route Path

Selected path:

`app/api/saved-deals/[id]/pdf-evidence-pack/route.ts`

Why this path:

- it stays nested under one saved deal
- it uses the existing `[id]` route-parameter convention
- it matches the repository's subresource style
- it names the structured pack directly
- it does not imply that binary PDF output already exists

## Supported HTTP Methods

Supported method:

`GET`

Rejected methods:

- `POST`
- `PUT`
- `PATCH`
- `DELETE`

The route is read-only current-state view data only.

## Route Identity Ownership

The saved-deal id comes only from the route parameter.

Planned behavior:

- await `context.params` using the current Next.js route-handler pattern
- trim surrounding whitespace from `params.id`
- treat missing, blank, or unusable ids as invalid
- pass only the normalized id to `loadPdfEvidencePackForDeal(...)`
- do not accept body identity
- do not accept query-string identity
- do not accept alternate saved-deal ids
- do not accept any user-supplied identity override

No request body is needed for `GET`.

## Generation Timestamp Ownership

The future route should own `generatedAt`.

Planned behavior:

- generate exactly one ISO timestamp per request
- capture it in the route handler, not in the composer
- pass the same timestamp into `loadPdfEvidencePackForDeal(...)`
- avoid generating timestamps inside pure helpers

Recommended test strategy:

- use Vitest fake timers
- freeze system time with `vi.setSystemTime(...)`
- assert the loader receives one deterministic ISO string
- do not introduce a general clock framework

## Confidentiality Label Ownership

The future route should own one fixed application label.

Approved label:

`INTERNAL USE ONLY`

Planned behavior:

- pass the label as a route constant
- do not accept it from query parameters
- do not accept it from request headers
- do not accept it from the request body
- do not accept it from user preferences

## Success Response Contract

Selected success envelope:

```json
{
  "success": true,
  "pack": {}
}
```

Planned status:

`200`

Planned content type:

`application/json; charset=utf-8`

Planned behavior:

- call `loadPdfEvidencePackForDeal(...)` once
- return the complete canonical pack unchanged
- preserve nullable and empty states
- do not recalculate any values
- do not remove mandatory disclaimers
- do not enrich evidence references
- do not add route metadata beyond the envelope

The named envelope matches the repository convention used by the other GET routes.

## Missing-Deal Response Contract

The loader returns `null` when the saved deal does not exist.

Planned behavior:

- map `null` to a safe application-level `404`
- do not return an empty pack
- do not return a partial pack
- do not expose database details
- do not expose stack traces

Planned public code:

`PDF_EVIDENCE_PACK_NOT_FOUND`

Planned body:

```json
{
  "success": false,
  "error": "PDF_EVIDENCE_PACK_NOT_FOUND"
}
```

## Invalid-ID Response Contract

Planned behavior:

- treat missing, blank, or whitespace-only ids as invalid
- return `400`
- do not call the loader
- do not call repositories directly

Planned public code:

`PDF_EVIDENCE_PACK_INVALID_ID`

Planned body:

```json
{
  "success": false,
  "error": "PDF_EVIDENCE_PACK_INVALID_ID"
}
```

## Dependency-Failure Response Contract

If `loadPdfEvidencePackForDeal(...)` throws, the route should fail safely.

Planned behavior:

- return `500`
- do not return a partial pack
- do not retry inside the route
- do not convert dependency failure into `404`
- do not expose the original exception

Planned public code:

`PDF_EVIDENCE_PACK_READ_FAILED`

Planned error envelope:

```json
{
  "success": false,
  "error": "PDF_EVIDENCE_PACK_READ_FAILED",
  "traceId": "...",
  "diagnostic": {}
}
```

Planned diagnostic source:

`createSafeRouteErrorDiagnostic("saved-deals.pdf-evidence-pack", error)`

## Safe Error Codes

| Condition | HTTP status | Public code | Notes |
| --- | --- | --- | --- |
| Invalid or blank route id | `400` | `PDF_EVIDENCE_PACK_INVALID_ID` | Route parameter only |
| Missing saved deal | `404` | `PDF_EVIDENCE_PACK_NOT_FOUND` | Loader returned `null` |
| Loader or downstream failure | `500` | `PDF_EVIDENCE_PACK_READ_FAILED` | Safe diagnostic only |

## Current-State Cache Policy

Selected policy:

- `export const dynamic = "force-dynamic"`
- `Cache-Control: no-store`

Why:

- this endpoint represents current live state, not a persisted snapshot
- browser and proxy caching must not serve a stale pack
- revalidation is inappropriate for the approved current-state read
- the repo already uses `dynamic = "force-dynamic"` for live read-only surfaces

The response should not rely on implicit caching behavior.

## Existing Access-Control Boundary

Finding:

- no explicit auth or authorization middleware was found in the current saved-deal API routes
- the existing routes are direct API handlers with repository gating only
- no public share-token pattern exists in the repo for this surface

Planned boundary:

- the future route should not create a public share token
- the future route should not expand the scope into an external-sharing system
- authorization remains a production-readiness concern

This is the unresolved blocker for external-readiness.

## Privacy Boundary

The future route may return only the existing `PdfEvidencePack` inside the named success envelope.

It must not add:

- owner names
- investor names
- phone numbers
- email addresses
- authentication identifiers
- database IDs not already part of the canonical pack contract
- internal notes
- SQL errors
- trace IDs on 400/404 responses
- repository names
- environment names
- storage bucket names
- private object paths
- raw signed URLs
- file bytes
- OCR output
- AI summaries

The route must not append unsafe metadata to the pack.

## Deterministic Authority Boundary

The route must not:

- calculate True MAO
- calculate financial values
- evaluate Investor Shield
- infer gate status
- select tasks
- select offers
- project Evidence Lite rows
- compose the pack
- alter warnings
- alter disclaimers
- generate narrative
- use AI

Its only business operation is:

`loadPdfEvidencePackForDeal(...)`

and mapping the result to a safe HTTP response.

## Focused Mocked Route-Test Plan

Expected future test file:

`__tests__/pdf-evidence-pack-route.test.ts`

Required scenarios:

1. Successful loader result returns `200`.
2. Response uses the selected named envelope.
3. Normalized route id is passed to the loader.
4. One deterministic ISO `generatedAt` value is passed.
5. Fixed confidentiality label is passed.
6. `null` loader result returns safe `404`.
7. Invalid route id follows the selected safe behavior.
8. Loader rejection returns safe `500`.
9. Internal error text is not exposed.
10. No partial pack is returned after failure.
11. Route calls the loader exactly once.
12. Route does not call repositories directly.
13. Route does not import database adapters or raw SQL.
14. Route exposes no write method.
15. Response contains no download URL, storage path, or PDF bytes.
16. Tests require no live database, Supabase, Vercel, or production environment.
17. Success responses include `Cache-Control: no-store`.

Do not duplicate:

- aggregation orchestration tests
- composer tests
- Evidence Lite projection tests
- Investor Summary calculations
- Shield evaluation tests

## Clock-Test Strategy

Recommended strategy:

- use `vi.useFakeTimers()`
- set a fixed request-time clock with `vi.setSystemTime(...)`
- read `generatedAt` from the route under the frozen clock
- avoid a separate date factory or clock framework

This keeps the route test deterministic without adding infrastructure.

## Minimal Future File Set

Planned minimum future files:

- `app/api/saved-deals/[id]/pdf-evidence-pack/route.ts`
- `__tests__/pdf-evidence-pack-route.test.ts`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_GET_ROUTE_AND_SAFE_RESPONSE_COMPLETION.md`

## Deferred Work

Explicitly deferred:

- browser-rendered pack page
- printable document layout
- A4 stylesheet
- PDF generation
- PDF download response
- file naming
- storage
- persistent snapshots
- attachment embedding
- signed references
- external sharing
- generation button
- production verification

## Explicit Non-Implementation

Confirmed not done in this phase:

- no route implemented
- no route test created
- no aggregation change
- no composer change
- no projection-helper change
- no contract change
- no database access
- no repository query added
- no renderer
- no UI
- no PDF dependency
- no binary PDF
- no storage
- no persistence
- no signed URLs
- no external sharing
- no production access
- no deployment
- no migration
- no environment change
- `.gitignore` untouched

## Verdict

PDF EVIDENCE PACK GET ROUTE PLAN BLOCKED — SAFE ACCESS BOUNDARY UNRESOLVED

## Recommended Next Step

Resolve the access-control boundary, then implement the read-only PDF Evidence Pack GET route and focused mocked route tests.
