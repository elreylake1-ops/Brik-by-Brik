# Phase 4F-R2B-2 Dynamic Investor Review Page and Safe Route States

## Purpose

Implement the dynamic server-rendered Investor Review page at `/saved-deals/[id]/review` and its route-segment states (loading, not-found, safe unavailable), using only the completed R2A presentation layer and R2B-1 server data-loading boundary.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `3250089c9c5b61f77708a6dacdf4ef059dd44f52` |
| `origin/main` | `3250089c9c5b61f77708a6dacdf4ef059dd44f52` |
| Latest commit | `feat: add investor review server loader` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this phase | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `docs/phase4/PHASE_4F_BROWSER_RENDERED_INVESTOR_SUMMARY_AND_EVIDENCE_PACK_REVIEW_SURFACE_PLAN.md`
- `docs/phase4/PHASE_4F_R2A_INVESTOR_REVIEW_PRESENTATION_MAPPER_AND_DOCUMENT.md`
- `docs/phase4/PHASE_4F_R2B_1_INVESTOR_REVIEW_SERVER_DATA_LOADING_BOUNDARY.md`
- `lib/investor-review/load-investor-review-page-model.ts`
- `lib/investor-review/investor-review-view-model.ts`
- `components/investor-review/InvestorReviewDocument.tsx`
- `app/layout.tsx`
- `app/api/saved-deals/[id]/investor-summary/route.ts` (route-param convention: `Promise<{ id?: string }>`)
- `__tests__/investor-review-document.test.tsx` (`renderToStaticMarkup` server-component test convention)
- existing `app/` directory listing (no prior `loading.tsx`, `not-found.tsx`, or dynamic page under `app/`)

## Files Added or Changed

- `app/saved-deals/[id]/review/page.tsx`
- `app/saved-deals/[id]/review/loading.tsx`
- `app/saved-deals/[id]/review/not-found.tsx`
- `components/investor-review/InvestorReviewUnavailable.tsx`
- `__tests__/investor-review-page.test.tsx`
- `docs/phase4/PHASE_4F_R2B_2_DYNAMIC_INVESTOR_REVIEW_PAGE_AND_SAFE_STATES.md`

No lower-layer file was modified.

## Selected Page Path

`/saved-deals/[id]/review`, implemented at `app/saved-deals/[id]/review/page.tsx`.

## Dynamic Server Page

```ts
export default async function InvestorReviewPage({ params }: RouteContext)
```

Remains an async server component. No `"use client"`, no hooks, no browser APIs, no client fetch.

## Route Parameter Handling

`params` is typed as `Promise<{ id?: string }> | { id?: string }`, matching the existing `app/api/saved-deals/[id]/investor-summary/route.ts` convention for this Next.js 16.2.4 install. The page `await`s `params` and passes `resolvedParams?.id ?? ""` straight to the loader with no separate normalization — normalization is the loader's responsibility (R2B-1).

## Server Loader Invocation

`loadInvestorReviewPageModel(dealId)` is called exactly once per render. The page performs no direct repository, pack-loader, or mapper call.

## Ready-State Rendering

`{ status: "ready", viewModel }` renders `<InvestorReviewDocument viewModel={viewModel} />` unchanged, with no wrapping chrome, no mutation controls, no print/PDF/download/share/refresh controls.

## Not-Found-State Behavior

`{ status: "not_found" }` calls `notFound()` from `next/navigation` before any rendering. No document, no unavailable state, and no fabricated deal is rendered.

## Not-Found Document

`app/saved-deals/[id]/review/not-found.tsx` renders:

- Heading: `Investor review not found`
- Body: `The requested saved deal could not be found, so an investor review could not be prepared.`
- Safety note: `No report has been generated.`

No internal ID, SQL, stack trace, or environment detail is present. No link was added — no established repository convention for a safe back-link exists yet, so none was invented.

## Unavailable-State Behavior

`{ status: "unavailable" }` renders `<InvestorReviewUnavailable />` (`components/investor-review/InvestorReviewUnavailable.tsx`):

- Heading: `Investor review temporarily unavailable`
- Body: `The investor review could not be prepared from the current saved-deal data. No report has been generated.`
- Follow-up: `Try again after the underlying data service is available.`

No raw exception, stack trace, SQL, connection detail, environment variable, Supabase/Vercel reference, or partial document is rendered. `notFound()` is not called for this state, and no automatic retry or polling is introduced.

## Loading-State Behavior

`app/saved-deals/[id]/review/loading.tsx` renders a static skeleton (`role="status"`, `aria-busy="true"`, `aria-live="polite"`) with an `sr-only` "Preparing investor review…" label and seven neutral skeleton blocks corresponding to header, overview, investment summary, decision status, gates, evidence, and footer. No fabricated financial values, statuses, or empty-state copy are rendered. No animation dependency, client state, or controls.

## Current-State Rendering and Cache Policy

`export const dynamic = "force-dynamic"` is set on the page so the current server-backed review is never treated as a static build artifact, matching the existing dynamic API routes in this repository (`ƒ` in the build output). No ISR, no `revalidate` interval, and no generic cache framework were added.

## Read-Only Boundary

The page, loading state, not-found document, and unavailable component contain no `"use client"`, no client hooks, no browser APIs, no internal fetch, no form, and no button. No POST/PUT/PATCH/DELETE occurs anywhere in this boundary. No PDF bytes, snapshot, or persisted report are created.

## Safe Error and Privacy Boundary

The unavailable and not-found states were verified (via focused tests) to contain no SQL keywords, no `postgres`/`supabase`/`vercel` references, no stack-trace text, and no `DATABASE_URL`-style values.

## Focused Page Integration Tests

`__tests__/investor-review-page.test.tsx` mocks `loadInvestorReviewPageModel` and `next/navigation`'s `notFound`, and renders the real `InvestorReviewDocument`, `InvestorReviewUnavailable`, loading, and not-found components via `renderToStaticMarkup`, calling the async page function directly with a mocked `params` promise. No live database, Supabase, Vercel, or network access is used.

Result: 1 file, 8 tests passed.

Covered: route id passed to the loader exactly once; ready state renders the document with canonical True MAO, required/advisory sections, and the Evidence Lite notice; absence of mutation/print/PDF/download controls; `not_found` calls `notFound()` and renders nothing else; `unavailable` renders the safe heading without calling `notFound()` and without leaking internal detail; loading state renders safe busy semantics with no fabricated data; not-found document renders safe copy; the page source contains no `"use client"`, no state/effect hooks, and no internal fetch.

## Existing Lower-Layer Proof Reused

Server-loader normalization, timestamp generation, and existence-sequencing internals remain covered by `__tests__/load-investor-review-page-model.test.ts`. PDF Evidence Pack aggregation, mapper field logic, Shield evaluation, Evidence Lite projection, and financial/True MAO calculations remain covered by `__tests__/load-pdf-evidence-pack.test.ts`, `__tests__/investor-review-mapper.test.ts`, and their respective lower-layer suites. Section-order and full document-content detail remain covered by `__tests__/investor-review-document.test.tsx`. None of this was retested here.

## Deferred to Phase 4F-R2C

- final responsive polish
- visual regression review
- browser-runtime inspection
- production deployment
- Vercel proof
- controlled deal proof
- desktop screenshots
- mobile screenshots
- refresh/fresh-context proof
- visual approval
- binary PDF work

## Explicit Non-Implementation

Confirmed not added in this phase:

- API route
- root-page change
- navigation expansion
- direct repository call in the page
- database access in tests
- SQL
- new pool
- mutation
- PDF generation
- PDF dependency
- print or download control
- storage
- sharing
- signed URLs
- authentication
- authorization
- middleware
- production access
- deployment
- live browser proof
- formula, True MAO, classification, governance, capital-protection, or Shield-authority change
- AI, OCR, upload, scraping, CRM, automation, or roles

## Result

`PHASE 4F-R2B-2 DYNAMIC INVESTOR REVIEW PAGE COMPLETE — READY FOR RESPONSIVE HARDENING AND LOCAL BROWSER REVIEW`

## Recommended Next Step

`Phase 4F-R2C — Perform local browser review, responsive hardening, accessibility verification, and implementation closure before deployment.`
