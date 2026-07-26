# Phase 5B-2B Investor Deal Summary Implementation

## Purpose

Implement a read-only browser-rendered Investor and Deal Summary at `/saved-deals/[id]/summary` by reusing the frozen canonical Investor Review page-model loader and adding only a presentation mapper, summary document, route states, focused tests, and completion documentation.

## Repository Baseline

- repository: `Brik-by-Brik`
- remote: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- implementation branch source: `phase5b-1d-deal-formulation-investor-review`
- verified frozen source HEAD: `1e2c2abf4d2aa1b44b8f6cd48ed8f554c418b70d`
- implementation branch: `phase5b-2b-investor-deal-summary`
- architecture commit cherry-picked for traceability: `0f3403d35030edc1479f1a3c8fc468a53bda309c`

## Architecture Dependency

Implementation follows `docs/phase5/PHASE_5B_2A_BROWSER_INVESTOR_DEAL_SUMMARY_ARCHITECTURE.md` and reuses the selected canonical source `loadInvestorReviewPageModel(dealId)` with one pure presentation mapper.

## Source-Branch Strategy

The frozen Phase 5B integration branch remained unchanged. A new implementation branch was created from the frozen branch, and only the docs-only Phase 5B-2A architecture commit was cherry-picked because the architecture document was not present on the frozen implementation line and was required for local implementation traceability.

## Files Inspected

- `lib/investor-review/load-investor-review-page-model.ts`
- `lib/investor-review/investor-review-view-model.ts`
- `components/investor-review/InvestorReviewDocument.tsx`
- `components/investor-review/DealFormulationSection.tsx`
- `components/investor-review/ProfessionalEvidenceGatewaySection.tsx`
- `components/investor-review/InvestorReviewUnavailable.tsx`
- `app/saved-deals/[id]/review/page.tsx`
- `app/saved-deals/[id]/review/loading.tsx`
- `app/saved-deals/[id]/review/not-found.tsx`
- `types/deal-formulation.ts`
- `types/professional-evidence-gateway.ts`
- `types/investor-summary.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/formatters.ts`
- existing Investor Review, Deal Formulation, readiness, and page tests
- `docs/phase5/PHASE_5B_2A_BROWSER_INVESTOR_DEAL_SUMMARY_ARCHITECTURE.md`

## Files Added or Changed

- `app/saved-deals/[id]/summary/page.tsx`
- `app/saved-deals/[id]/summary/loading.tsx`
- `app/saved-deals/[id]/summary/not-found.tsx`
- `components/investor-summary/InvestorDealSummaryDocument.tsx`
- `components/investor-summary/InvestorDealSummaryUnavailable.tsx`
- `lib/investor-summary/map-investor-review-to-deal-summary.ts`
- `types/investor-deal-summary.ts`
- `__tests__/fixtures/investor-deal-summary-fixtures.ts`
- `__tests__/investor-deal-summary-mapper.test.ts`
- `__tests__/investor-deal-summary-document.test.tsx`
- `__tests__/investor-deal-summary-page.test.tsx`
- `docs/phase5/PHASE_5B_2B_INVESTOR_DEAL_SUMMARY_IMPLEMENTATION.md`

## Selected Route

Route implemented:

`/saved-deals/[id]/summary`

## Server Rendering Boundary

The summary route is a dynamic server-rendered page. It resolves `params.id`, calls `loadInvestorReviewPageModel(id)` once, uses `notFound()` for `not_found`, renders a safe unavailable boundary for `unavailable`, then maps the ready canonical view model into a summary presentation model before rendering the document.

## Canonical Loader Reuse

No new aggregation service was created. The implementation reuses `loadInvestorReviewPageModel(dealId)` exactly once per request and does not perform a second evidence read, direct repository import, raw engine parsing, or database adapter import from the summary page.

## Presentation Mapper

`mapInvestorReviewToDealSummary(...)` is synchronous, deterministic, and presentation-only. It copies canonical values, formats display tokens, groups required and advisory Shield sections, reuses one supplied timestamp for header and footer, and centralizes locked unsupported-value notices without calculating ROI, acquisition costs, True MAO selection, or offer ladders.

## Exact Section Order

Rendered order is:

1. Header
2. Executive decision snapshot
3. Core financial position
4. True MAO
5. Offer position
6. Unsupported values
7. Investor Shield
8. Professional readiness
9. Evidence Lite
10. Risks, blockers, and missing evidence
11. Recommended next action
12. Footer

## Executive Decision Snapshot

The snapshot renders distinct canonical fields for verdict, persisted classification, governance, capital protection, pipeline, Investor Shield progression, and professional readiness. Adverse or blocked states use blocked styling, manual review remains non-positive, and unavailable values remain neutral.

## Financial Presentation

The summary shows canonical purchase price, realistic/downside/strong GDV, refurbishment cost, stamp duty, legal costs, sale costs, finance cost, total investment, projected profit, and profit margin using existing formatters. Missing optional monetary values render `Not available` and are not converted to zero.

## True MAO Presentation

All three canonical True MAO bands render with equal visual weight and the locked notice:

`No single investor-facing True MAO band has been selected in the current canonical model.`

No selected band, preferred MAO, or offer interpretation is generated.

## Offer-Position Presentation

The summary shows latest recorded offer amount and latest offer status. Unsupported opening/target/final/walk-away values remain unavailable, and the locked note `No canonical monetary offer ladder currently exists.` is always rendered. When no latest offer exists, the exact empty state `No offers are currently recorded for this deal.` is shown.

## Unsupported Values

The summary renders a neutral unsupported-values section for:

- acquisition-cost aggregate -> `Not available`
- ROI -> `Not available`

Both use locked reasons and are not calculated.

## Investor Shield Presentation

The summary reuses canonical Investor Shield outputs already present in the Investor Review ready model. It shows overall status, progression, `canProgress`, blocking-gate count, caution-gate count, missing-evidence count, required hard gates, and advisory gates while keeping required and advisory items visibly separate. The authority notice `Investor Shield progression authority remains separate from Deal Formulation financial presentation.` is rendered verbatim.

## Professional Readiness Presentation

The summary reuses `professionalEvidenceGateway.readinessPresentation` for display label, supporting summary, and severity mapping. It always renders the locked authority notice:

`Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.`

No readiness recalculation or override path was added.

## Evidence Lite Presentation

The summary reuses canonical Evidence Lite rows already carried by the Investor Review model. It renders evidence type, linked gate, status, reviewed state, note, optional reviewer note, and relevant timestamp when present. It always renders:

`Evidence Lite records are informational and do not constitute professional confirmation.`

When empty, it renders:

`No Evidence Lite records are currently attached to this deal.`

No second evidence read was added.

## Risks and Recommended Next Action

The risks section renders only canonical warnings, blockers, missing-evidence items, and unavailable-field notices, omitting empty containers. The recommended next action section renders only the canonical recommended next action already present in Deal Formulation and falls back to `Not available` when absent.

## Confidentiality and Non-Reliance Copy

The summary renders:

- `INTERNAL INVESTOR DECISION SUPPORT`
- `Confidential controlled review material for investor decision support.`
- `This summary is read-only investor decision support. It is not a valuation, legal advice, lending advice, or a substitute for professional due diligence.`
- footer notices preserving Investor Shield authority, missing-evidence caution, unsupported-value caution, and current-state notice

## Loading, Not-Found, and Unavailable States

`loading.tsx` renders a document-style skeleton with safe busy semantics and no fabricated data. `not-found.tsx` renders the safe wording `The requested saved-deal summary could not be found.` `InvestorDealSummaryUnavailable` renders a safe dependency-unavailable state without SQL, stack, credential, environment, or service detail.

## Responsive and Accessibility Behavior

The summary uses semantic headings, server-rendered document sections, high-contrast neutral styling, single-column mobile-safe wrapping, break-safe long IDs/notes, and no horizontal-overflow controls, animation, gradients, print buttons, download buttons, share controls, or PDF actions.

## Focused Test Coverage

Focused tests added:

- `__tests__/investor-deal-summary-mapper.test.ts`
- `__tests__/investor-deal-summary-document.test.tsx`
- `__tests__/investor-deal-summary-page.test.tsx`

These cover canonical copying, unsupported-value preservation, True MAO presentation, offer position, Shield separation, readiness boundary, Evidence Lite rendering, safe route states, and server-only page constraints.

## Existing Proof Reused

Existing Investor Review loader, document, page, Deal Formulation section, professional readiness, Investor Shield, and Evidence Lite tests were reused as regression coverage. No navigation change or behavior change was added to the existing Investor Review route.

## Live Acceptance Status

- no Supabase access was performed
- no deployment was performed
- live saved-deal verification remains blocked
- human desktop and mobile visual QA remain mandatory before merge
- automated screenshots are insufficient

## PDF Deferral

Confirmed:

- no PDF route
- no PDF library
- no binary PDF
- no print button
- no download button
- no storage
- no sharing
- no signed URL

## Explicit Non-Implementation

Confirmed no:

- formula change
- True MAO selection
- ROI calculation
- acquisition-cost calculation
- offer-ladder generation
- offer creation
- task creation
- pipeline movement
- Investor Shield mutation
- readiness mutation
- Evidence Lite mutation
- new JSON API
- database write
- migration
- production access
- deployment
- authentication or sharing expansion
- AI, OCR, scraping, upload, CRM, or automation

## Result

`PHASE 5B-2B INVESTOR AND DEAL SUMMARY COMPLETE — LIVE VISUAL ACCEPTANCE BLOCKED`

## Recommended Next Step

`Phase 5B-2C — Freeze the Investor and Deal Summary integration branch and prepare a blocked PR package pending Supabase restoration and human desktop/mobile visual QA.`
