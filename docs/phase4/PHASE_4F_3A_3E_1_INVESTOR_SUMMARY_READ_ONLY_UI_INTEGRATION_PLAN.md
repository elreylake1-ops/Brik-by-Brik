# Phase 4F-3A-3E-1 Investor Summary Read-Only UI Integration Plan

## Purpose

Define the first read-only UI placement and contract for the already-composed Investor Summary model without implementing any UI, fetch logic, or page integration.

## Repository Baseline

- Branch: `main`
- `HEAD`: `9a13c6ecacf488a9c3e0f8241075cebd5e6f3a21`
- `origin/main`: `9a13c6ecacf488a9c3e0f8241075cebd5e6f3a21`
- Origin remote: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing `.gitignore` modification

## Files Inspected

- `types/investor-summary.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/select-active-investor-summary-tasks.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/investor-summary-repository.ts`
- `app/api/saved-deals/[id]/investor-summary/route.ts`
- `__tests__/investor-summary-repository.test.ts`
- `__tests__/investor-summary-route.test.ts`
- `docs/phase4/PHASE_4F_3A_3D_1_INVESTOR_SUMMARY_REPOSITORY_AND_MOCKED_TESTS.md`
- `docs/phase4/PHASE_4F_3A_3D_2_INVESTOR_SUMMARY_ROUTE_BOUNDARY_PLAN.md`
- `app/page.tsx`
- `components/SavedDealInvestorShieldPanel.tsx`
- `components/InvestorShieldPanel.tsx`
- `components/InvestorShieldGateSummaryPanel.tsx`
- `components/evidence-lite/EvidenceLitePanel.tsx`
- `components/EngineAnalysisPanel.tsx`
- `components/ResultsDisplay.tsx`
- `lib/investor-shield/fetch-investor-shield-ui-model.ts`
- `lib/formatters.ts`
- `__tests__/investor-summary-mapper.test.ts`
- `__tests__/investor-summary-composition.test.ts`
- `__tests__/investor-summary-route.test.ts`

## Existing Investor Summary View Model

`InvestorSummaryViewModel` shape:

| Top-level field | Shape | Value class |
| --- | --- | --- |
| `deal` | `{ dealId: string; address: string }` | required object |
| `purchasePrice` | `number \| null` | nullable monetary value |
| `gdvRange` | `{ downside: number \| null; realistic: number \| null; strong: number \| null }` | required object with nullable monetary values |
| `trueMao` | `{ fifteenPercent: number \| null; twentyPercent: number \| null; twentyFivePercent: number \| null }` | required object with nullable monetary values |
| `capitalProtectionState` | `CapitalProtectionStatus \| null` | nullable status enum |
| `classification` | `DealClassification \| null` | nullable status enum |
| `investorShield` | `{ overallStatus: InvestorShieldOverallStatus \| null; missingEvidenceCount: number \| null; blockedGates: readonly InvestorSummaryBlockedGate[] }` | required object with nullable status/count and array |
| `activeTasks` | `readonly InvestorSummaryTaskSummary[]` | required array, can be empty |
| `latestOffer` | `InvestorSummaryLatestOfferSummary \| null` | nullable object |
| `recommendedNextAction` | `{ source: InvestorSummaryRecommendedActionSource; actionText: string \| null }` | required object with enum plus nullable text |

Nested section details:

- `deal.dealId`: required string
- `deal.address`: required string
- `investorShield.blockedGates`: required readonly array, may be empty
- `InvestorSummaryBlockedGate.gateKey`: required
- `InvestorSummaryBlockedGate.label`: optional
- `InvestorSummaryBlockedGate.gateType`: optional, `"required"` or `"advisory"`
- `InvestorSummaryBlockedGate.blockerReason`: optional
- `InvestorSummaryTaskSummary`: all fields required except nullable date/reason fields already defined in the type
- `InvestorSummaryLatestOfferSummary`: all identity/value fields required except nullable rationale and seller response

## Existing UI Architecture

- The app is a single client-side workspace in `app/page.tsx`, not a multi-page saved-deal UI.
- Saved deals are listed and reopened from the same page.
- The selected saved deal detail is rendered in-place under the `Saved Deal Detail` section.
- Current detail subsections already include:
  - raw saved-deal metadata
  - `SavedDealInvestorShieldPanel`
  - `EvidenceLitePanel`
  - a stored-engine snapshot summary
  - an `Operator Command` block with tasks, offers, pipeline state, and financial snapshot
- Data loading is client-side and effect-driven, not server-component driven.
- Existing route-backed panels already load automatically when a deal is selected.

## Selected UI Placement

Recommended placement:

- `app/page.tsx`
- inside the existing `Saved Deal Detail` section
- directly after the raw saved-deal field grid
- before `SavedDealInvestorShieldPanel`

Why this is least disruptive:

- it keeps the new summary on the same read-only deal workspace already used for Shield, Evidence Lite, tasks, and offers
- it avoids introducing a separate saved-deal page
- it keeps navigation unchanged: the user still selects a saved deal from the list to reveal the detail surface
- it places the summary before the deeper operational panels while still keeping deterministic risk visible in the same viewport

How the user reaches it:

- select a saved deal from the saved-deals list on the main page
- the selected deal detail surface appears in place
- the Investor Summary section appears with that detail surface

Mounting behavior:

- it should appear automatically when a deal is selected
- the fetch should trigger when the selected saved-deal ID becomes available
- no explicit tab or button is required for the first read-only pass

## UI Purpose and Authority Boundary

The UI presents the already-composed Investor Summary read model only.

It must not:

- recalculate values
- reinterpret Investor Shield
- infer recommendations from raw tasks
- derive offers
- alter classification
- persist data
- expose internal database rows

The UI consumes:

`GET /api/saved-deals/[id]/investor-summary`

The UI does not import:

- saved-deal repositories
- Investor Shield loaders
- task repositories
- offer repositories
- extraction helpers
- selectors
- the composition helper
- database adapters

## Proposed Component Boundaries

Smallest future structure:

- `components/investor-summary/InvestorSummaryPanel.tsx`
- `components/investor-summary/InvestorSummaryRoutePanel.tsx`
- `lib/investor-summary/fetch-investor-summary.ts`

Why this split:

- `InvestorSummaryPanel` stays pure and receives `InvestorSummaryViewModel` only
- `InvestorSummaryRoutePanel` owns loading, 400/404/500 state, and fetch orchestration
- `fetch-investor-summary.ts` keeps route parsing and safe JSON handling reusable and testable

No finer-grained subcomponents are required for the first pass unless the panel becomes too dense after implementation.

## Server/Client and Fetch Ownership

Selected approach:

- client-side fetch
- initiated from the existing client workspace in `app/page.tsx` or a small client wrapper mounted there
- backed by a narrow local fetch helper

Why:

- `app/page.tsx` is already a client component and already owns route-backed loading for saved deals, offers, tasks, Shield, and Evidence Lite
- the new read model belongs to the same selected-deal lifecycle
- a client fetch preserves the current interactive pattern without introducing a server component boundary just for this panel

Ownership details:

- request initiator: client wrapper on selected deal change
- `"use client"`: required for the wrapper/page integration layer, not for the pure presentation component
- route URL construction: `/api/saved-deals/${encodeURIComponent(savedDealId.trim())}/investor-summary`
- deal ID source: the selected saved-deal detail record already loaded by `app/page.tsx`
- loading state: local non-blocking loading text or panel state
- retries: manual only if exposed later; automatic retries are prohibited

## Route Consumption Boundary

The future UI must use only the approved GET route.

- no direct repository imports in the UI layer
- no Shield/task/offer direct reads
- no selectors
- no composition helper access
- no database adapter access

This boundary keeps the presentation layer dependent on the HTTP contract only.

## UI State Model

### Initial loading

- show a clear non-blocking loading state
- do not fabricate summary values
- do not show stale content as current

### Success

- render the complete Investor Summary
- preserve canonical values and labels
- do not rewrite meaning

### Missing deal: 404

- show a clear deal-not-found state
- do not show an empty Investor Summary
- do not treat it as an infrastructure failure

### Invalid ID: 400

- show a safe invalid-deal state
- do not call dependent routes

### Infrastructure failure: 500

- show a safe retryable error
- expose trace ID only if the route returns it
- do not expose diagnostic internals
- do not display raw database messages

### Empty or unavailable sections

- distinguish valid empty arrays from failed loading
- distinguish unavailable values from zero
- do not hide warnings that carry decision weight

## Financial Display Rules

- use the existing currency and formatting helpers where possible
- show purchase price, GDV range, True MAO, and any other monetary values in the view model
- `null` or unavailable values must render as unavailable, not `£0`
- zero must remain a real zero when canonical
- do not recalculate totals
- do not derive profit or margin in the component
- do not use offer amounts as fallbacks
- do not display more precision than current UI conventions

Recommended convention:

- reuse the existing whole-pound detail-card style already used in `app/page.tsx`
- show `N/A` for unavailable monetary values
- preserve formatted zero as zero

## Investor Shield Display Rules

- show overall status, blocked gates, missing evidence count, and blocked/advisory summary
- do not infer gate status from tasks
- do not infer gate status from Evidence Lite
- do not imply that evidence upload satisfies a gate
- do not soften deterministic blocked or rejected states visually
- keep deterministic risk visually dominant

## Task and Action Display Rules

- use only the composed recommended action and active tasks from the view model
- do not convert task titles into new recommendations
- preserve existing task order
- distinguish:
  - recommended action
  - active tasks
  - blockers
  - informational items
- empty arrays must have deliberate empty states
- no task completion controls

## Offer Display Rules

- show only the canonical latest offer included in the view model
- preserve selector order
- show no-offer as a valid empty state
- do not calculate negotiation strategy
- do not expose internal reasoning beyond the view model
- no create/edit/counter controls

## Visual Hierarchy

Recommended read-only hierarchy:

1. Investor Summary heading and overall status
2. Key financial snapshot
3. Investor Shield and capital-protection state
4. Recommended actions
5. Active tasks/blockers
6. Latest offer
7. Warnings and unavailable data

Layout constraints:

- deterministic warnings and blocked states remain prominent
- advisory information must not visually override deterministic risk
- no dashboard expansion
- no decorative charts without canonical support
- responsive on desktop and mobile
- accessible headings and labels

## Accessibility Expectations

- semantic headings
- readable status text, not color-only meaning
- sufficient contrast using existing design tokens
- keyboard-accessible tab or button only if an interactive reveal is later added
- `aria-live` or equivalent only where current app patterns already use it for loading/errors
- no tooltip-only critical information
- no inaccessible dense table on mobile

## Future Test Strategy

### Component rendering

- renders canonical complete summary
- renders nullable monetary values as unavailable, not zero
- renders real zero correctly
- renders empty task and offer states
- renders Shield blocked state prominently
- renders warnings
- preserves composed action wording
- does not recalculate values

### Loading and errors

- loading state
- 400 invalid-ID state
- 404 missing-deal state
- safe 500 state
- trace ID presentation if available
- no raw diagnostic leakage

### Ownership safety

- component does not import repositories
- component does not import database adapter
- component does not import selectors or composer
- component does not mutate data
- no POST/PATCH/PUT/DELETE calls

### Accessibility

- semantic heading structure
- statuses have text labels
- critical information is not color-only
- empty states are understandable

## Phase 4F-3A-3E-2 Scope

Pure presentation phase:

- create the read-only Investor Summary component
- pass `InvestorSummaryViewModel` in as props
- add fixture-driven component tests
- do not fetch
- do not integrate into the page
- do not call the live route

Why this matters:

- isolates rendering from data loading
- keeps UI output deterministic and fixture-testable
- avoids mixing API error handling with presentation logic

## Phase 4F-3A-3E-3 Scope

Local UI route integration phase:

- add the wrapper or page wiring that fetches from the approved GET route
- handle loading, 400, 404, and 500 states
- add mocked fetch/integration tests
- do not use production proof

Why the split prevents mixing concerns:

- Phase 4F-3A-3E-2 validates rendering against a stable model
- Phase 4F-3A-3E-3 validates transport and state transitions separately
- data loading bugs and presentation bugs stay independently testable

## Planned Files Matrix

| Future Phase | File | Purpose | Runtime or Test |
| ------------ | ---- | ------- | --------------- |
| 4F-3A-3E-2 | `components/investor-summary/InvestorSummaryPanel.tsx` | Pure read-only presentation of `InvestorSummaryViewModel` | Runtime |
| 4F-3A-3E-2 | `__tests__/investor-summary-panel.test.tsx` | Fixture-driven rendering, null/zero/accessibility checks | Test |
| 4F-3A-3E-3 | `components/investor-summary/InvestorSummaryRoutePanel.tsx` | Client wrapper for loading, 400/404/500 states | Runtime |
| 4F-3A-3E-3 | `lib/investor-summary/fetch-investor-summary.ts` | Narrow local fetch helper for the approved GET route | Runtime |
| 4F-3A-3E-3 | `__tests__/investor-summary-route-panel.test.tsx` | Mocked fetch/integration coverage | Test |
| 4F-3A-3E-3 | `app/page.tsx` | Mount the wrapper inside the selected saved-deal detail surface | Runtime |

Existing fixture reuse:

- `__tests__/fixtures/investor-summary-fixtures.ts`

## Implementation Acceptance Criteria

Phase 4F-3A-3E UI integration must not be considered complete unless:

1. The UI consumes the existing GET route only.
2. The presentation component receives the existing `InvestorSummaryViewModel`.
3. No calculations are duplicated.
4. No Shield logic is duplicated.
5. No task or offer selection is duplicated.
6. Nullable values are not displayed as zero.
7. Empty states are distinguished from failures.
8. 400, 404, and 500 states are handled safely.
9. Deterministic risk remains visually dominant.
10. No mutation controls are added.
11. Component and integration tests use fixtures and mocks only.
12. No live database or production route is used.
13. Build, lint, and all tests pass.
14. `.gitignore` remains untouched.

## Production Block

- Production `DATABASE_URL` remains pending correction by James
- no production route or UI proof is authorized
- no migration should be executed
- UI planning is local and independent of production availability

## Deferred Work

Explicitly deferred:

- component implementation
- fixture implementation
- fetch implementation
- page integration
- route calls
- UI tests
- PDF/export
- editing and mutations
- authentication and authorization expansion
- caching
- persistence
- production deployment and proof

## Explicit Non-Implementation

Confirmed:

- no runtime code changed
- no component created
- no page changed
- no hook or fetch helper created
- no tests created
- no repository or route changed
- no database access
- no production route called
- no migration
- no environment change
- no deterministic recalculation
- no Investor Shield behavior change
- `.gitignore` untouched

## Verdict

PHASE 4F-3A-3E-1 COMPLETE — READY FOR PHASE 4F-3A-3E-2

## Recommended Next Step

`Phase 4F-3A-3E-2 — Pure Investor Summary Presentation Component and Fixture Tests`
