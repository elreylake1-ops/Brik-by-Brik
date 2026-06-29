# Phase 4F-R2A Investor Review Presentation Mapper and Document

## Purpose

Implement the pure presentation layer for the future browser-rendered Investor Summary and Evidence Pack review page without implementing the page, route, loader orchestration, database access, or PDF behavior.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `fa98c595e8e621ef0148a62c696749f2c225938e` |
| `origin/main` | `fa98c595e8e621ef0148a62c696749f2c225938e` |
| Latest commit | `docs: plan browser evidence pack review surface` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this phase | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `docs/phase4/PHASE_4F_BROWSER_RENDERED_INVESTOR_SUMMARY_AND_EVIDENCE_PACK_REVIEW_SURFACE_PLAN.md`
- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`
- `lib/pdf-evidence-pack/compose-pdf-evidence-pack.ts`
- `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts`
- `__tests__/fixtures/pdf-evidence-pack-fixtures.ts`
- `__tests__/fixtures/investor-summary-fixtures.ts`
- `types/investor-summary.ts`
- `types/investor-shield.ts`
- `types/investor-shield-ui.ts`
- `types/investor-shield-enforcement.ts`
- `lib/investor-shield/default-gates.ts`
- `lib/investor-shield/map-investor-shield-ui-view-model.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `components/investor-summary/InvestorSummaryPanel.tsx`
- `components/SavedDealInvestorShieldPanel.tsx`
- `components/evidence-lite/EvidenceLitePanel.tsx`
- `lib/formatters.ts`
- existing component-test conventions using `renderToStaticMarkup`

## Files Added or Changed

- `lib/investor-review/investor-review-view-model.ts`
- `lib/investor-review/map-pdf-evidence-pack-to-investor-review.ts`
- `components/investor-review/InvestorReviewDocument.tsx`
- `__tests__/investor-review-mapper.test.ts`
- `__tests__/investor-review-document.test.tsx`
- `docs/phase4/PHASE_4F_R2A_INVESTOR_REVIEW_PRESENTATION_MAPPER_AND_DOCUMENT.md`

## Canonical Inputs

The mapper accepts only committed canonical inputs:

- `pack: PdfEvidencePack`
- `savedDeal: SavedDealRecord`

The saved-deal input is used only for locked header fields not currently surfaced as named `PdfEvidencePack` fields:

- `governance_state`
- `pipeline_state`

No duplicate saved-deal contract was added.

## Presentation View Model

One narrow presentation contract was added in:

- `lib/investor-review/investor-review-view-model.ts`

It contains only display-layer fields for:

- header
- property and deal overview
- investment summary
- decision and capital-protection summary
- required gate rows
- advisory/caution items
- Evidence Lite rows and locked informational notice
- blocker summaries and follow-up requirements
- task rows
- latest offer summary
- recommended next action
- footer and disclaimers

It also contains presentation-only constants for:

- `Not available`
- empty Evidence Lite text
- empty task text
- empty offer text
- empty advisory text
- fixed Evidence Lite separation wording

No second Investor Summary, Shield, Evidence Lite, route-response, or database model was created.

## Pure Mapper Boundary

The pure mapper is:

- `mapPdfEvidencePackToInvestorReview(input: MapPdfEvidencePackToInvestorReviewInput): InvestorReviewViewModel`

It performs only:

- display formatting
- locked unavailable-state formatting
- section assembly
- required-gate grouping from canonical default gates plus canonical Shield arrays
- advisory/caution grouping from canonical caution keys and advisory warnings
- Evidence Lite row projection from the canonical pack evidence index

It does not:

- access repositories
- access the database
- call `loadPdfEvidencePackForDeal(...)`
- call `getSavedDealById(...)`
- evaluate Investor Shield
- recalculate financial values
- recalculate True MAO
- change classification, governance, capital protection, or recommended next action
- generate timestamps
- mutate its inputs

## Required Versus Advisory Gate Mapping

Required hard gates remain the primary gate list.

Implementation details:

- required rows are driven by `INVESTOR_SHIELD_DEFAULT_GATES`
- blocking, caution, and missing-evidence display states are derived only from canonical Shield arrays already present in `PdfEvidencePack.investorShield`
- advisory/caution items come only from:
  - canonical `cautionGateKeys`
  - canonical `advisoryOnlyEvidenceWarnings`

No gate is reclassified as advisory just because it is non-blocking in a fixture.

No required and advisory rows are merged together.

States that must never receive success semantics remain non-success:

- `BLOCKED`
- `FAILED`
- `MISSING`
- `REQUIRED`
- `NOT_STARTED`

## Evidence Lite Separation

The locked notice is always rendered:

`Evidence Lite is informational and does not by itself satisfy, waive, approve, or override Investor Shield requirements.`

The presentation layer maps only approved read-only fields from the canonical pack evidence index:

- evidence id
- title
- evidence type
- linked gate label
- review status
- conservative reviewed/not-reviewed display state
- note when present
- reviewer note omitted when unavailable
- relevant timestamp

Evidence Lite presence does not modify gate authority, blocker status, waiver state, or approval state.

## Empty and Unavailable States

Locked exact copy is preserved:

- `No Evidence Lite records are currently attached to this deal.`
- `No active tasks are currently recorded for this deal.`
- `No offers are currently recorded for this deal.`
- `Not available`

Unavailable numeric values are not converted to zero.

## Document Section Order

The component renders the locked semantic order:

1. Header
2. Property and deal overview
3. Investment summary
4. Decision and capital-protection status
5. Required hard gates
6. Advisory and caution gates
7. Evidence Lite notes
8. Missing evidence and blockers
9. Tasks and offers
10. Recommended next action
11. Footer

## Confidentiality and Non-Reliance Copy

The component renders the approved wording from R1 and the canonical pack:

- `Brik by Brik Investor Review`
- `INTERNAL USE ONLY`
- `Confidential controlled review material for investor decision support.`
- `This review is read-only investor decision support. It is not a valuation, legal advice, lending advice, or a substitute for professional due diligence.`
- `Investor Shield status remains authoritative within this application.`
- `Missing evidence must not be interpreted as completed verification.`

Canonical pack disclaimers remain visible in the footer.

## Read-Only Component Boundary

The document component is:

- `components/investor-review/InvestorReviewDocument.tsx`

Behavioral boundary:

- read-only
- server-component compatible
- no `use client`
- no hooks
- no browser APIs
- no fetch
- no repository calls
- no mutation controls
- no action buttons
- no approve, waive, upload, move, edit, or delete controls
- no print, PDF, or download controls

## Responsive and Accessibility Behavior

The component uses the existing project styling approach with:

- semantic headings
- `<main>` and `<section>` structure
- definition-list style summary cards
- list-based gate, Evidence Lite, blocker, task, offer, and disclaimer rendering
- high-contrast blocked/caution/informational/protected styling
- break-safe classes for long IDs and notes
- responsive grids without horizontal overflow requirements

## Focused Mapper Tests

`__tests__/investor-review-mapper.test.ts` verifies:

- header mapping
- governance and pipeline sourced from `SavedDealRecord`
- canonical True MAO pass-through
- required/advisory separation
- non-success `MISSING` semantics
- informational Evidence Lite mapping
- reviewer-note omission when unavailable
- locked empty-state text
- unavailable-state mapping to `Not available`
- recommended-next-action pass-through
- generated timestamp pass-through
- mapper input immutability

Focused mapper result:

- 1 file
- 5 tests passed

## Focused Document Tests

`__tests__/investor-review-document.test.tsx` verifies:

- report title rendering
- confidentiality rendering
- overview and investment summary rendering
- governance, capital protection, and pipeline rendering
- Shield status and progression rendering
- required/advisory section separation
- Evidence Lite notice rendering
- non-success `MISSING` semantics
- `Not reviewed` rendering
- empty task/offer/evidence states
- locked section order
- absence of mutation, print, PDF, and download controls
- safe wrapping classes
- no client-only runtime dependency

Focused document result:

- 1 file
- 6 tests passed

## Existing Business Logic Reused

This phase reuses existing canonical business logic and contracts only:

- `PdfEvidencePack`
- `SavedDealRecord`
- `INVESTOR_SHIELD_DEFAULT_GATES`
- committed Investor Summary values
- committed Investor Shield enforcement arrays
- committed pack disclaimers
- existing formatters

No new business logic authority was introduced.

## Deferred to Phase 4F-R2B

Explicitly deferred:

- dynamic page
- direct canonical loading
- deal-ID normalization at page level
- missing-deal `notFound()`
- loading skeleton
- dependency error state
- page integration tests
- deployment
- browser proof

## Explicit Non-Implementation

Confirmed not added:

- page
- route
- API endpoint
- repository call
- database access
- SQL
- new pool
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
- Evidence Lite mutation
- Shield mutation
- task or offer mutation
- formula, True MAO, classification, governance, or capital-protection change
- AI
- OCR
- upload
- scraping
- CRM
- automation
- roles

## Result

`PHASE 4F-R2A INVESTOR REVIEW PRESENTATION LAYER COMPLETE — READY FOR SERVER PAGE INTEGRATION`

## Recommended Next Step

`Phase 4F-R2B — Implement the dynamic server-rendered review page, loading state, not-found state, safe dependency-error state, and focused page integration tests.`
