# Phase 5B-1C Deal Formulation Read Model Integration

## Purpose

Integrate one canonical Deal Formulation read-model loader that gates on saved-deal existence, reuses canonical Investor Summary authority, extracts canonical engine values without recalculation, and calls the pure composer once.

## Repository Baseline

- repository: `Brik-by-Brik`
- origin: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- integration branch: `phase5b-1c-deal-formulation-read-model`
- base `main` / `origin/main`: `6d0981b4de7097b36e3995ff1733784a0c0fdaa5`

## Source Branch Strategy

- branch created from current `main`
- Phase 5B-1B composer integrated by cherry-picking source commit `6871ee2da663029e880b090d5cb97e346fe633c0`
- source branch `phase5b-1b-deal-formulation-composer` was not modified
- Phase 5B-1A docs-only audit branch was not cherry-picked

## Files Inspected

- `types/deal-formulation.ts`
- `lib/deal-formulation/compose-deal-formulation-view-model.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/investor-summary/investor-summary-repository.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts`
- `lib/investor-review/load-investor-review-page-model.ts`
- `__tests__/investor-summary-repository.test.ts`
- `__tests__/load-pdf-evidence-pack.test.ts`
- `__tests__/load-investor-review-page-model.test.ts`
- `docs/phase5/PHASE_5B_1A_DEAL_FORMULATION_CANONICAL_SOURCE_AUDIT.md`
- `docs/phase5/PHASE_5B_1B_DEAL_FORMULATION_COMPOSER_COMPLETION.md`

## Files Added or Changed

- `lib/deal-formulation/load-deal-formulation-view-model.ts`
- `lib/deal-formulation/extract-deal-formulation-canonical-input.ts`
- `__tests__/load-deal-formulation-view-model.test.ts`
- `docs/phase5/PHASE_5B_1C_DEAL_FORMULATION_READ_MODEL_INTEGRATION.md`

## Loader Signature

`loadDealFormulationViewModel(dealId: string): Promise<DealFormulationViewModel | null>`

## Deal-ID Normalization

- trims surrounding whitespace
- blank trimmed ID returns `null`
- blank ID starts no repository or Investor Summary call
- normalized ID is reused for saved-deal read and Investor Summary load

## Saved-Deal Existence Gate

Canonical sequence is:

`dealId -> getSavedDealById -> null stop -> else continue`

When saved deal is missing:

- returns `null`
- does not call Investor Summary loader
- does not extract canonical input
- does not call Deal Formulation composer

## Canonical Dependency Flow

`normalized deal id -> getSavedDealById -> getInvestorSummaryForDeal -> extractDealFormulationCanonicalInput -> composeDealFormulationViewModel`

Composer is called exactly once after required canonical dependencies are present.

## Investor Summary Reuse

- loader reuses `getInvestorSummaryForDeal(...)` as canonical Investor Summary authority
- latest offer reused from `investorSummary.latestOffer`
- recommended next action reused from `investorSummary.recommendedNextAction.actionText`
- GDV range reused from canonical normalized Investor Summary values
- True MAO bands reused from canonical normalized Investor Summary values

This keeps latest-offer selection, Shield orchestration, task selection, and next-action precedence inside existing Investor Summary path.

## Engine-Result Extraction

Pure helper `extractDealFormulationCanonicalInput(...)` reads only:

- existing `SavedDealRecord`
- canonical `engine_result_json`
- canonical `InvestorSummaryViewModel`

Extracted engine-owned fields:

- stamp duty
- legal costs
- sale costs
- finance cost
- total investment
- projected profit
- profit margin
- verdict status
- strategy recommendation

Safe-nullable malformed or missing nested values return `null`.

## Source Precedence

- deal identity: saved-deal record
- purchase price: saved-deal record
- refurbishment cost: saved-deal record
- persisted classification: saved-deal record
- capital-protection state: saved-deal record
- GDV range: canonical Investor Summary normalized fields
- True MAO bands: canonical Investor Summary normalized fields proven to originate from saved engine payload
- finance / total investment / projected profit / profit margin / verdict / strategy: canonical `engine_result_json`
- latest offer: canonical Investor Summary selected latest offer
- recommended next action: canonical Investor Summary recommended next action
- canonical warnings: empty list because no approved upstream warning path currently exists on canonical Investor Summary loader

## Latest-Offer Authority

- loader does not call offer repository directly
- loader does not call `selectLatestInvestorSummaryOffer(...)`
- existing Investor Summary loading path remains authoritative for latest-offer selection
- no-offer remains valid `null`

## Composer Invocation

- `composeDealFormulationViewModel(...)` invoked exactly once per successful load
- no post-processing of financial values after compose
- no selected True MAO added
- no ROI generation
- no offer-ladder generation
- no warning injection after compose

## Missing-Deal Semantics

- blank deal ID -> `null`
- missing saved deal -> `null`
- no partial view model returned

## Optional Missing-Value Semantics

- missing or malformed safe-nullable canonical values remain `null`
- composition continues when optional financial fields are absent
- missing money does not become zero
- no-offer remains `null`

## Dependency-Failure Semantics

- saved-deal query failure propagates
- canonical Investor Summary loader failure propagates
- no partial Deal Formulation view model returned after dependency failure

## Read-Only Boundary

Implementation remains read-only:

- no create/update/delete saved-deal call
- no offer create/update call
- no task mutation
- no pipeline mutation
- no Investor Shield override
- no waiver call
- no migration utility
- no environment mutation
- no PDF generation
- no AI or OCR
- no new database pool

## Focused Mocked-Test Coverage

Focused loader tests cover:

- blank ID behavior
- normalization before reads
- saved-deal existence gate
- saved-deal failure propagation
- canonical Investor Summary reuse
- canonical engine extraction
- purchase-price and refurbishment-cost saved-deal precedence
- finance / total investment / profit / margin extraction
- True MAO reuse
- no selected True MAO
- ROI unavailable passthrough
- offer-ladder unavailable passthrough
- missing and malformed optional values
- classification versus verdict separation
- recommended next-action authority
- exact single composer invocation
- dependency failure no-partial behavior
- read-only source boundary
- input immutability
- stable repeated results

## Existing Proof Reused

Loader tests intentionally do not duplicate:

- deterministic formula tests
- composer field-mapping tests
- Investor Summary selector tests
- Investor Shield evaluator tests

## Explicit Non-Implementation

Confirmed no:

- UI
- Investor Review wiring
- API route
- database write
- migration
- new database query beyond existing canonical loaders
- second evidence read
- offer creation
- task creation
- pipeline movement
- formula change
- True MAO change
- selected MAO
- ROI calculation
- offer-ladder generation
- Investor Shield change
- readiness change
- Evidence Lite change
- production access
- deployment
- AI, OCR, scraping, upload, PDF, CRM, or automation

## Result

`PHASE 5B-1C DEAL FORMULATION READ MODEL COMPLETE — CANONICAL LOADING VERIFIED`

## Recommended Next Step

`Phase 5B-1D — Integrate the canonical Deal Formulation read model into the saved-deal Investor Review presentation on a new integration branch, without changing formulas or Investor Shield authority.`
