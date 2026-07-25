# Phase 5B-1B Deal Formulation Composer Completion

## Purpose

Implement a pure Deal Formulation composer that maps only prepared canonical values into a read-only view model.

## Repository Baseline

- branch: `phase5b-1b-deal-formulation-composer`
- base `main` / `origin/main`: `6d0981b4de7097b36e3995ff1733784a0c0fdaa5`
- repository: `Brik-by-Brik`
- origin: `https://github.com/elreylake1-ops/Brik-by-Brik.git`

## Phase 5B-1A Audit Dependency

- audit branch: `phase5b-1a-deal-formulation-source-audit`
- audit commit: `32125ff83bf98621e3a5d30918fb86cf1f89139e`
- authoritative audit document:
  - `docs/phase5/PHASE_5B_1A_DEAL_FORMULATION_CANONICAL_SOURCE_AUDIT.md`
- implementation branch did not cherry-pick the docs-only audit commit
- implementation followed audit constraints:
  - no ROI calculation
  - no acquisition-cost aggregate derivation
  - no offer-ladder invention
  - no singular selected True MAO

## Files Inspected

- `types/investor-summary.ts`
- `types/operator-command.ts`
- `types/deal.ts`
- `types/due-diligence.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `components/investor-summary/InvestorSummaryPanel.tsx`
- `__tests__/investor-summary-composition.test.ts`
- `__tests__/investor-summary-repository.test.ts`
- audit document from commit `32125ff83bf98621e3a5d30918fb86cf1f89139e`

## Files Added or Changed

- `types/deal-formulation.ts`
- `lib/deal-formulation/compose-deal-formulation-view-model.ts`
- `__tests__/deal-formulation-composer.test.ts`
- `docs/phase5/PHASE_5B_1B_DEAL_FORMULATION_COMPOSER_COMPLETION.md`

## Composer Input Contract

`ComposeDealFormulationInput` accepts prepared canonical values only:

- `savedDeal`
  - `dealId`
  - `address`
  - `refurbishmentCost`
  - `classification`
  - `capitalProtectionState`
- `engineValues`
  - `stampDuty`
  - `legalCosts`
  - `saleCosts`
  - `financeCost`
  - `totalInvestment`
  - `projectedProfit`
  - `profitMargin`
  - canonical `trueMao` bands
  - `verdictStatus`
  - `strategyRecommendation`
- `investorSummary`
  - `purchasePrice`
  - canonical `gdvRange`
  - canonical `recommendedNextAction`
- `latestOffer`
  - already-selected canonical latest-offer value or `null`
- `canonicalWarnings`
  - canonical upstream warning strings only

The composer input does not include repository functions, database clients, environment variables, HTTP requests, or mutable services.

## Composer Output Contract

`DealFormulationViewModel` returns:

- `identity`
- `financialSummary`
- `trueMao`
- `offerPosition`
- `decision`
- `warnings`

Monetary outputs use `DealFormulationMonetaryValue` with:

- `amount`
- `availability`
- `unavailableReason`

## Canonical Financial Mapping

- purchase price -> canonical Investor Summary prepared value
- GDV realistic / downside / strong -> canonical Investor Summary prepared values
- refurbishment cost -> canonical saved-deal prepared value
- stamp duty / legal costs / sale costs -> canonical prepared engine values
- finance cost -> canonical prepared engine value
- total investment -> canonical prepared engine value
- projected profit -> canonical prepared engine value
- profit margin -> canonical prepared engine value

No financial formula is executed inside the composer.

## True MAO Treatment

- all three canonical bands are exposed
  - `fifteenPercent`
  - `twentyPercent`
  - `twentyFivePercent`
- no singular selected amount
- no preferred band
- no new selection logic
- source label: `Canonical deterministic True MAO bands`

## Acquisition-Cost Treatment

- `acquisitionCosts.amount` remains `null`
- `acquisitionCosts.availability` is `UNAVAILABLE`
- reason: `No canonical acquisition-cost aggregate exists.`

This implementation follows the audited rule and does not derive a presentation-level sum.

## ROI Treatment

- `roi` remains `null`
- unavailable notice:
  - `ROI is not available from the current canonical engine output.`

No ROI calculation is performed.

## Offer-Position Treatment

- composer exposes only canonical latest persisted offer data:
  - latest recorded offer amount
  - latest offer status
- unavailable and intentionally `null`:
  - opening offer
  - target offer
  - final offer
  - walk-away amount
  - walk-away threshold
- fixed reasons are returned for those unsupported fields

The composer does not turn True MAO into an offer ladder and does not infer latest offer as final offer.

## Classification and Verdict Separation

- verdict maps from prepared canonical `verdictStatus`
- classification maps from prepared canonical persisted `classification`
- no verdict fallback fills missing classification
- no Investor Shield progression state is substituted for classification

## Recommended Next-Action Source

- source is the canonical upstream value already prepared through Investor Summary precedence
- composer copies that prepared value only
- no new recommendation logic runs
- no fallback to task titles, readiness labels, Evidence Lite notes, or offer rationale

## Missing and Unavailable Value Behavior

- nullable canonical values remain `null`
- missing money does not become zero
- unsupported fields are marked unavailable with explicit reasons
- unavailable-field notices are collected deterministically
- repeated unavailable notices are deduplicated in stable order

## Warning Behavior

- `canonicalWarnings` preserves only supplied canonical warning strings
- `unavailableFields` contains composer-created unavailable notices only
- no new risk flags, AI warnings, or business warnings are invented

## Determinism and Immutability

- composer is synchronous and pure
- no database access
- no API access
- no environment access
- no clock access
- no randomness
- repeated calls return deeply equal output
- input objects are not mutated

## Focused Test Coverage

Focused composer test file covers:

- identity mapping
- unchanged canonical financial mapping
- unchanged True MAO bands
- no singular selected True MAO
- ROI unavailable
- acquisition-cost rule
- no zero fallback for missing components
- canonical latest-offer reuse
- no-offer null state
- unsupported offer-ladder fields
- verdict / classification separation
- null preservation
- stable warnings
- determinism
- immutability
- no repository / database / env dependency

## Authority Boundary

Confirmed:

- deterministic engine remains authoritative
- True MAO is not recalculated
- Investor Shield may block progression but does not rewrite financial outputs
- professional readiness remains advisory
- Evidence Lite remains informational
- persisted offers do not alter True MAO

## Explicit Non-Implementation

Confirmed no:

- UI
- Investor Review wiring
- database access
- repository implementation
- API route
- database write
- migration
- offer creation
- task creation
- pipeline movement
- formula change
- MAO selection
- ROI calculation
- offer-ladder calculation
- Investor Shield evaluation
- readiness change
- Evidence Lite change
- production access
- deployment
- AI, OCR, scraping, upload, PDF, CRM, or automation

## Result

`PHASE 5B-1B DEAL FORMULATION COMPOSER COMPLETE — PURE CANONICAL MAPPING VERIFIED`

## Recommended Next Step

`Phase 5B-1C — Integrate the pure Deal Formulation composer into a canonical saved-deal read model without adding UI.`
