# Phase 4F-R2B-1 Investor Review Server Data-Loading and Page-Model Boundary

## Purpose

Implement the narrow server-side data-loading and orchestration boundary for the future dynamic Investor Review page, without implementing the page, route files, or any rendering.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `1c83120e20c2951ac841cad6f194a17208927fd2` |
| `origin/main` | `1c83120e20c2951ac841cad6f194a17208927fd2` |
| Latest commit | `feat: add investor review presentation layer` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this phase | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `docs/phase4/PHASE_4F_BROWSER_RENDERED_INVESTOR_SUMMARY_AND_EVIDENCE_PACK_REVIEW_SURFACE_PLAN.md`
- `docs/phase4/PHASE_4F_R2A_INVESTOR_REVIEW_PRESENTATION_MAPPER_AND_DOCUMENT.md`
- `lib/investor-review/investor-review-view-model.ts`
- `lib/investor-review/map-pdf-evidence-pack-to-investor-review.ts`
- `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts`
- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `__tests__/load-pdf-evidence-pack.test.ts`
- `__tests__/investor-review-mapper.test.ts`

## Files Added or Changed

- `lib/investor-review/load-investor-review-page-model.ts`
- `__tests__/load-investor-review-page-model.test.ts`
- `docs/phase4/PHASE_4F_R2B_1_INVESTOR_REVIEW_SERVER_DATA_LOADING_BOUNDARY.md`

## Loader Function

```ts
export async function loadInvestorReviewPageModel(
  dealId: string
): Promise<LoadInvestorReviewPageModelResult>
```

Located at `lib/investor-review/load-investor-review-page-model.ts`.

## Result Contract

```ts
export type LoadInvestorReviewPageModelResult =
  | { status: "ready"; viewModel: InvestorReviewViewModel }
  | { status: "not_found" }
  | { status: "unavailable" }
```

`ready` carries only the completed R2A `InvestorReviewViewModel`. `not_found` and `unavailable` carry no raw saved-deal data, no pack data, and no internal error detail.

## Deal-ID Normalization

The incoming `dealId` is trimmed. A blank or whitespace-only id returns `not_found` immediately and calls no dependency (no `getSavedDealById`, no `loadPdfEvidencePackForDeal`, no mapper). No UUID-format validation was added, matching the existing saved-deal loader convention (`loadPdfEvidencePackForDeal`'s own `normalizeDealId`).

## Saved-Deal Existence Gate

`getSavedDealById(normalizedDealId)` is called first.

- missing deal (`null`) → `not_found`, no further calls
- lookup throws → `unavailable`, no further calls, original error not exposed

## Generation Timestamp Ownership

Exactly one `new Date().toISOString()` timestamp is generated per load, immediately before calling `loadPdfEvidencePackForDeal(...)`. No clock abstraction was introduced. No second timestamp is generated anywhere else in the loader or passed to the mapper (the mapper takes none).

## Confidentiality Label Ownership

The fixed label `INTERNAL USE ONLY` is hardcoded in the loader and passed to `loadPdfEvidencePackForDeal(...)`. It is not accepted as a caller input.

## Canonical PDF Evidence Pack Loading

`loadPdfEvidencePackForDeal(...)` is called only after the saved-deal existence gate passes, with the normalized deal id, the single generated timestamp, and the fixed confidentiality label.

- `null` pack → `not_found`, mapper not called
- pack loader throws → `unavailable`, mapper not called, original error not exposed

## Presentation Mapper Invocation

`mapPdfEvidencePackToInvestorReview({ pack, savedDeal })` is called exactly once, only when both the canonical saved deal and canonical pack exist, passing the exact objects returned by the two upstream calls. Its result is returned unmodified inside the `ready` state. A mapper throw is caught and converted to `unavailable` with no partial model returned. This loader is a safe page boundary; it does not replace or duplicate the mapper's own unit tests.

## Exact Loading Sequence

```text
1. Receive deal ID
2. Normalize deal ID
3. Return not_found for blank/unusable ID
4. Load canonical saved deal
5. Return not_found when the saved deal is absent
6. Generate one ISO timestamp
7. Load canonical PDF Evidence Pack
8. Return not_found when the pack returns null
9. Map pack + saved deal through the completed R2A mapper
10. Return ready with InvestorReviewViewModel
```

Infrastructure or unexpected failures at any dependency step return `unavailable`.

## Not-Found Semantics

`not_found` is returned for: blank/unusable id, missing saved deal, and a `null` pack result. No fabricated or partial report is ever returned in these cases.

## Unavailable Semantics

`unavailable` is returned for: saved-deal lookup failure, pack-loader failure, and mapper failure. No SQL, stack trace, exception message, or environment detail is included in the result in any case.

## No-Partial-Result Rule

The result is always exactly one of the three discriminated states. No state carries a partially populated view model.

## Canonical Authority Boundary

The loader calls only `getSavedDealById(...)`, `loadPdfEvidencePackForDeal(...)`, and `mapPdfEvidencePackToInvestorReview(...)`. It does not call the Shield loader/evaluator, task repository, offer repository, Evidence Lite repository, database adapter, SQL, mutation repositories, pipeline functions, PDF composer, or Investor Summary composer directly — all of that remains inside `loadPdfEvidencePackForDeal(...)`.

## Focused Mocked-Test Coverage

`__tests__/load-investor-review-page-model.test.ts` mocks `getSavedDealById`, `loadPdfEvidencePackForDeal`, and `mapPdfEvidencePackToInvestorReview` via `vi.hoisted` + `vi.mock`, using fake system time for a deterministic timestamp. No live database, Supabase, Vercel, or network access is used.

Result: 1 file, 12 tests passed.

## Existing Proof Reused

Financial calculations, True MAO, Investor Summary mapping, Shield evaluation, required/advisory presentation rules, Evidence Lite field presentation, document component rendering, and PDF Evidence Pack aggregation internals are not retested here — they remain covered by `__tests__/load-pdf-evidence-pack.test.ts` and `__tests__/investor-review-mapper.test.ts`.

## Deferred to Phase 4F-R2B-2

- dynamic page (`app/saved-deals/[id]/review/page.tsx`)
- `loading.tsx`
- `not-found.tsx`
- safe unavailable-state component
- `notFound()` integration
- route-segment rendering
- page integration tests
- responsive page-shell validation
- deployment
- browser proof

## Explicit Non-Implementation

Confirmed not added in this phase:

- page
- loading route
- not-found route
- error route
- API endpoint
- component change
- mapper change
- pack-loader change
- saved-deal repository change
- database access in tests
- raw SQL
- new pool
- mutation
- PDF generation
- PDF dependency
- print or download control
- storage
- sharing
- authentication
- authorization
- middleware
- production access
- deployment
- formula, True MAO, classification, governance, capital-protection, or Shield-authority change
- AI, OCR, upload, scraping, CRM, automation, or roles

## Result

`PHASE 4F-R2B-1 SERVER DATA-LOADING BOUNDARY COMPLETE — READY FOR DYNAMIC PAGE INTEGRATION`

## Recommended Next Step

`Phase 4F-R2B-2 — Implement the dynamic review page, loading state, not-found state, safe unavailable state, and focused page integration tests.`
