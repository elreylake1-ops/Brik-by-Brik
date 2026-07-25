# Phase 5B-1D Deal Formulation Investor Review Presentation

## Purpose

Integrate canonical Deal Formulation presentation into real saved-deal Investor Review without changing formulas, Investor Shield authority, readiness authority, or Evidence Lite separation.

## Repository Baseline

- repository: `Brik-by-Brik`
- origin: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- frozen source branch base: `phase5a-5b-professional-readiness-investor-review`
- frozen source branch HEAD: `5ade84138727a489390a6eab958e3f399af95f0f`
- integration branch: `phase5b-1d-deal-formulation-investor-review`

## Integration Branch Strategy

- new branch created from frozen Phase 5A Investor Review branch
- cherry-picked only Phase 5B-1C implementation commits:
  - `8682b890738b873995148da14f84be2347230549`
  - `187e71be8d19a946188fd374b2299022fb1737f1`
- source branches remained unchanged:
  - `phase5a-5b-professional-readiness-investor-review`
  - `phase5b-1c-deal-formulation-read-model`
  - `phase5b-1b-deal-formulation-composer`

## Files Inspected

- `lib/deal-formulation/load-deal-formulation-view-model.ts`
- `lib/deal-formulation/extract-deal-formulation-canonical-input.ts`
- `lib/deal-formulation/compose-deal-formulation-view-model.ts`
- `types/deal-formulation.ts`
- `lib/investor-review/load-investor-review-page-model.ts`
- `lib/investor-review/investor-review-view-model.ts`
- `lib/investor-review/map-pdf-evidence-pack-to-investor-review.ts`
- `app/saved-deals/[id]/review/page.tsx`
- `components/investor-review/InvestorReviewDocument.tsx`
- `components/investor-review/ProfessionalEvidenceGatewaySection.tsx`
- existing Investor Review tests
- Phase 5B-1B and Phase 5B-1C completion docs

## Files Added or Changed

- `components/investor-review/DealFormulationSection.tsx`
- `lib/investor-review/load-investor-review-page-model.ts`
- `lib/investor-review/investor-review-view-model.ts`
- `components/investor-review/InvestorReviewDocument.tsx`
- `__tests__/load-investor-review-page-model.test.ts`
- `__tests__/investor-review-document.test.tsx`
- `__tests__/investor-review-page.test.tsx`
- `__tests__/deal-formulation-section.test.tsx`
- `docs/phase5/PHASE_5B_1D_DEAL_FORMULATION_INVESTOR_REVIEW_PRESENTATION.md`

## Canonical Data Flow

`saved-deals/[id]/review page -> loadInvestorReviewPageModel(dealId) -> loadPdfEvidencePackForDeal(dealId) -> loadDealFormulationViewModel(dealId) -> attach canonical dealFormulation -> InvestorReviewDocument -> DealFormulationSection`

Deal Formulation stays loader-owned. No React recalculation or raw engine JSON parsing was added to presentation.

## Investor Review Placement

Deal Formulation section placed:

`Property and deal overview -> Investment summary -> Deal Formulation -> Decision and capital-protection status -> Required hard gates -> Advisory and caution gates -> Professional Evidence Gateway -> Evidence Lite records`

Placement keeps financial review near existing summary while leaving Investor Shield and professional/advisory sections visibly separate.

## Financial Summary Presentation

Presented canonical:

- Purchase price
- Realistic GDV
- Downside GDV
- Strong GDV
- Refurbishment cost
- Stamp duty
- Legal costs
- Sale costs
- Finance cost
- Total investment
- Projected profit
- Profit margin

Currency and percent values reuse existing formatters. Missing optional values render `Not available`, never zero.

## True MAO Presentation

- all three canonical bands render with equal weight:
  - 25% profit target
  - 20% profit target
  - 15% profit target
- no selected band
- no default 20% emphasis
- section note states no single investor-facing True MAO band is currently selected

## Acquisition-Cost Presentation

- renders `Not available`
- supporting text:
  `No canonical acquisition-cost aggregate currently exists.`
- no UI sum added

## ROI Presentation

- renders `Not available`
- supporting text:
  `ROI is not available from the current canonical engine output.`
- no ROI calculation added

## Offer-Position Presentation

Presented when available:

- latest recorded offer amount
- latest offer status

Unsupported fields stay `Not available`:

- opening offer
- target offer
- final offer
- walk-away amount
- walk-away threshold

Section note states:

`No canonical monetary offer ladder currently exists.`

No-offer empty state remains:

`No offers are currently recorded for this deal.`

## Decision Presentation

Presented canonical:

- verdict
- persisted classification
- capital protection
- strategy recommendation
- recommended next action

Verdict and classification remain visibly separate. Missing values render `Not available`.

## Warning and Unavailable-State Presentation

- canonical warnings render only when present
- unavailable-field notices render in separate neutral container
- unavailable values remain visually neutral, not treated as hard-failure by themselves
- blocked verdict and negative profit use adverse styling

## Investor Shield Authority Boundary

Investor Shield section remains present and unchanged in authority. Deal Formulation does not satisfy, waive, approve, or override Investor Shield requirements. Page-model failure still uses existing safe unavailable boundary.

## Professional Readiness Boundary

Professional readiness remains separate, read-only, and advisory within Professional Evidence Gateway. Deal Formulation does not use readiness values as financial, strategy, or classification input.

## Evidence Lite Separation

Evidence Lite records remain separate from Deal Formulation and Professional Evidence Gateway. No second evidence read added. Evidence Lite still renders with explicit non-authority notice.

## Empty and Partial States

- missing deal: existing page not-found behavior unchanged
- Deal Formulation dependency failure: existing safe unavailable page result
- optional missing canonical values: section renders with `Not available`
- no latest offer: explicit empty-offers message
- no canonical warnings: no empty warnings container

## Responsive and Accessibility Behavior

- section uses existing rounded-card layout and semantic headings
- long labels, values, and reasons use wrapping classes
- mobile-safe grid collapses to smaller column counts
- no horizontal-overflow control was introduced because wrapping classes handle long content inside current layout
- section remains read-only with no interactive mutation controls

## Focused Test Coverage

Focused tests prove:

- page-model attaches canonical Deal Formulation
- normalized ID passed to Deal Formulation loader
- missing-deal short circuit prevents Deal Formulation load
- section renders in Investor Review
- canonical money values render
- True MAO bands render equally
- no selected band appears
- acquisition costs and ROI remain unavailable
- latest offer and no-offer states render correctly
- unsupported offer ladder stays unavailable
- verdict/classification separation remains visible
- authority note renders exactly
- Investor Shield section remains present
- professional readiness remains advisory
- Evidence Lite separation remains present
- read-only rendering remains intact
- mobile-safe wrapping classes remain present
- existing Investor Review tests continue to pass

## Human Visual-QA Requirement

Human QA must still verify:

- desktop layout
- mobile layout
- section placement
- visible amounts
- negative and adverse styling
- equal True MAO band treatment
- unavailable values
- offer empty state
- Investor Shield authority
- professional readiness authority
- Evidence Lite separation
- wrapping and overflow
- refresh behavior
- fresh browser behavior

Automated screenshots alone are insufficient.

## Live Acceptance Status

- no Supabase access was performed
- no deployment was performed
- live saved-deal acceptance remains blocked
- desktop and mobile human visual QA remain mandatory before merge

## Explicit Non-Implementation

Confirmed no:

- formula change
- True MAO change
- MAO band selection
- ROI calculation
- acquisition-cost calculation
- offer-ladder calculation
- offer creation
- task creation
- pipeline movement
- Investor Shield mutation
- readiness mutation
- Evidence Lite mutation
- API route
- database write
- migration
- production access
- deployment
- PDF
- AI, OCR, scraping, upload, CRM, or automation

## Result

`PHASE 5B-1D DEAL FORMULATION PRESENTATION COMPLETE — LIVE VISUAL ACCEPTANCE BLOCKED`

## Recommended Next Step

`Phase 5B-1E — Freeze the Deal Formulation Investor Review integration branch and prepare a blocked PR package pending Supabase restoration and human desktop/mobile visual QA.`
