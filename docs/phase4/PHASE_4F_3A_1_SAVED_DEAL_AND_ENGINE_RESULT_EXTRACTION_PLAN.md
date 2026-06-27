# Phase 4F-3A-1 Saved-Deal and Engine-Result Extraction Plan

## Purpose

Document the exact repository and runtime contract for a future pure extraction layer that will convert one canonical saved-deal record plus persisted `engine_result_json` into the already-prepared saved-deal, GDV, and True MAO inputs required by the existing Phase 4F composition helper.

This phase is inspection-only. No extractor, repository, API, UI, or test implementation is added.

## Repository Baseline

- Branch: `main`
- `HEAD`: `458fc77d9dbd7bc89aaa5c9a54601ba1f73682a8`
- `origin/main`: `458fc77d9dbd7bc89aaa5c9a54601ba1f73682a8`
- `origin`: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing unstaged `.gitignore` modification

## Files Inspected

- `docs/phase4/PHASE_4F_0C_CANONICAL_INVESTOR_SUMMARY_FIELD_MAPPING.md`
- `docs/phase4/PHASE_4F_1A_CANONICAL_INVESTOR_SUMMARY_TYPE_CONTRACTS.md`
- `docs/phase4/PHASE_4F_2A_PURE_CANONICAL_INVESTOR_SUMMARY_MAPPER.md`
- `docs/phase4/PHASE_4F_2B_3A_PURE_SELECTOR_TO_MAPPER_COMPOSITION.md`
- `docs/phase4/PHASE_4F_2B_3B_1_MAPPER_EDGE_CASE_CLOSURE.md`
- `docs/phase4/PHASE_4F_2B_3B_2_COMPOSITION_EDGE_CASE_CLOSURE.md`
- `types/investor-summary.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `db/migrations/20260522_phase4a_saved_deals_table.sql`
- `app/api/saved-deals/route.ts`
- `app/api/saved-deals/[id]/route.ts`
- `app/api/saved-deals/[id]/pipeline/route.ts`
- `app/page.tsx`
- `lib/engine/analyze-deal-with-refurb.ts`
- `lib/engine/due-diligence-engine.ts`
- `lib/engine/intelligence/investor-summary-engine.ts`
- `types/deal.ts`
- `types/due-diligence.ts`
- `types/operator-command.ts`
- `lib/db/postgres.ts`
- `lib/validators/validate-phase2-output.ts`
- `lib/validators/validate-phase2-fixture.ts`
- `__tests__/saved-deals-repository.test.ts`
- `__tests__/saved-deals-api-route.test.ts`
- `__tests__/saved-deals-api-detail-route.test.ts`
- `__tests__/saved-deals-pipeline-route.test.ts`
- `__tests__/due-diligence-engine.test.ts`
- `__tests__/analyze-deal-with-refurb.test.ts`
- `__tests__/phase4a-migration-consistency.test.ts`

## Current Composition Input Requirements

`composeInvestorSummaryViewModel(input)` currently expects:

- `savedDeal`
  - prepared saved-deal identity and persisted scalar values
- `canonicalValues`
  - prepared GDV range
  - prepared True MAO breakdown
- `investorShield`
  - canonical Shield status
  - missing-evidence count
  - blocked gates
  - fallback recommended-action title
- `taskRecords`
  - canonical task records
- `offerRecords`
  - canonical offer records

It returns `InvestorSummaryViewModel`.

The composition helper delegates:

- `taskRecords` -> `selectActiveInvestorSummaryTasks(...)`
- `offerRecords` -> `selectLatestInvestorSummaryOffer(...)`
- prepared values plus selector outputs -> `mapInvestorSummaryViewModel(...)`

## Canonical Saved-Deal Record

`lib/operator-command/saved-deals-repository.ts` defines the repository shape as `SavedDealRecord`.

| Database Field | Repository Type | Nullable | Phase 4 Use | Extraction Rule |
| --- | --- | ---: | --- | --- |
| `id` | `string` | No | Saved-deal identity | Copy as-is; do not convert to UUID. |
| `address` | `string` | No | `savedDeal.address` | Copy as-is. |
| `listing_url` | `string \| null` | Yes | Not used by Phase 4 composition | Copy as-is when present. |
| `purchase_price` | `number \| null` | Yes | `savedDeal.purchasePrice` | Copy as-is; preserve `null`; do not use offer amount as a fallback. |
| `gdv_realistic` | `number \| null` | Yes | Legacy saved-deal scalar; not the Phase 4 GDV input | Copy as-is when present. |
| `refurb_cost` | `number \| null` | Yes | Not used by Phase 4 composition | Copy as-is when present. |
| `classification` | `string` | No | `savedDeal.classification` | Copy as canonical value; do not recompute. |
| `governance_state` | `string` | No | Repository / UI metadata only for Phase 4 | Copy as-is. |
| `capital_protection_state` | `string` | No | `savedDeal.capitalProtectionState` | Copy as canonical value; do not infer from classification. |
| `pipeline_state` | `string` | No | Repository / UI metadata only for Phase 4 | Copy as-is. |
| `engine_result_json` | `Record<string, unknown>` | No | Source for GDV and True MAO extraction | Must be inspected safely; direct copy is not sufficient. |
| `risk_summary_json` | `Record<string, unknown>` | No | Not used by Phase 4 composition | Copy as-is when stored; no Phase 4 extraction. |
| `next_action` | `string \| null` | Yes | `savedDeal.persistedNextAction` | Copy raw or `null`; leave trimming to the existing mapper boundary. |
| `created_at` | `string` | No | Repository / audit metadata only | Copy as-is. |
| `updated_at` | `string` | No | Repository / audit metadata only | Copy as-is. |
| `archived_at` | `string \| null` | Yes | Repository / audit metadata only | Copy as-is. |

Direct-copy safety:

- safe for canonical scalar fields
- not safe for nested engine-result monetary paths
- normalization is required only for nested numeric path extraction, not for canonical saved-deal scalars

## Persisted Engine-Result Shape

The persisted `saved_deals.engine_result_json` value is the object returned by `analyzeDealWithRefurb(...)`.

Current runtime shape proven by save-flow code and repository tests:

- `deal`
  - `DealResult`
  - includes `trueMao`
- `refurbSource`
  - `"manual"` or `"generated"`
- `refurb?`
  - generated refurb-cost details when a scope was used
- `timeline?`
  - generated refurb timeline when a scope was used
- `dueDiligence?`
  - `DueDiligenceResult` from `calculateDueDiligence(...)`
- `warnings`
  - string array
- `overridesApplied`
  - applied override list
- `assumptionsReport`
  - string array
- `verdict`
  - `DealVerdict`
- `confidence`
  - `DealConfidence`

## Proven GDV Paths

Preferred extractor path:

- `engine_result_json.dueDiligence.gdvRange.downside`
- `engine_result_json.dueDiligence.gdvRange.realistic`
- `engine_result_json.dueDiligence.gdvRange.strong`

Classification:

- `PROVEN`

Evidence:

- `lib/engine/due-diligence-engine.ts` returns `gdvRange`
- `__tests__/due-diligence-engine.test.ts` proves the final JSON shape includes `gdvRange`
- `app/page.tsx` persists the full `analyzeDealWithRefurb(...)` result unchanged into `engine_result_json`

## Proven True MAO Paths

Preferred extractor path:

- `engine_result_json.deal.trueMao.fifteenPercent`
- `engine_result_json.deal.trueMao.twentyPercent`
- `engine_result_json.deal.trueMao.twentyFivePercent`

Classification:

- `PROVEN`

Evidence:

- `types/deal.ts` defines `DealResult.trueMao`
- `lib/engine/analyze-deal-with-refurb.ts` returns `deal` unchanged inside the persisted engine result
- `__tests__/analyze-deal-with-refurb.test.ts` proves `result.deal.trueMao.*`

Alternate true-MAO shape:

- `engine_result_json.dueDiligence.trueMAO.at15Percent`
- `engine_result_json.dueDiligence.trueMAO.at20Percent`
- `engine_result_json.dueDiligence.trueMAO.at25Percent`

Classification:

- `LEGACY OR ALTERNATE SHAPE`

Evidence:

- `lib/engine/due-diligence-engine.ts` returns `trueMAO`
- `__tests__/due-diligence-engine.test.ts` proves the alternate top-level due-diligence shape

Phase 4 extractor guidance:

- prefer `deal.trueMao`
- do not rely on `dueDiligence.trueMAO` unless a later backward-compatibility audit proves it is required

## Runtime JSON Representation

Current repository behavior indicates `engine_result_json` is handled as an already-parsed JavaScript object.

Evidence:

- `lib/operator-command/saved-deals-repository.ts` types the field as `Record<string, unknown>`
- `createSavedDeal(...)` passes the object directly into a `::jsonb` parameter
- `getSavedDealById(...)` and `listSavedDeals(...)` read the column back through the generic pg query path without any custom JSON parser
- `lib/db/postgres.ts` does not override `pg` JSON/JSONB parsing
- `app/page.tsx` treats `selectedSavedDeal.engine_result_json` as an object and reads `Object.keys(...)`

Classification:

- `PROVEN`

## Existing Parsing and Validation Helpers

| File | Helper | Input -> Output | Mutation | Reuse Classification | Notes |
| --- | --- | --- | --- | --- | --- |
| `lib/validators/validate-phase2-output.ts` | `validatePhase2Output(output: unknown): Phase2OutputValidationResult` | `unknown` -> `{ valid, errors }` | No | `DO NOT USE` | Validates `Phase2AnalysisOutput`, not the saved engine result shape used by Phase 4. |
| `lib/validators/validate-phase2-fixture.ts` | `validatePhase2Fixture(fixture: unknown): Phase2FixtureValidationResult` | `unknown` -> `{ valid, errors }` | No | `DO NOT USE` | Fixture validator only; wrong domain and wrong output shape. |
| `app/api/saved-deals/route.ts` | `isObject(value: unknown): value is Record<string, unknown>` | Narrow plain object | No | `REUSE PARTIALLY` | Route-local guard, not exported, useful only as a generic object check pattern. |
| `app/api/saved-deals/[id]/evidence/route.ts` | `isPlainObject(value: unknown): value is Record<string, unknown>` | Narrow plain object | No | `DO NOT USE` | Route-local helper for evidence payloads, not a saved-engine extractor. |
| `lib/investor-shield/fetch-investor-shield-ui-model.ts` | `isRecord(value: unknown): value is Record<string, unknown>` | Narrow record | No | `DO NOT USE` | UI fetcher helper for a different response contract. |

Conclusion:

- no reusable saved-engine deserializer exists today
- no helper both narrows unknown JSON and matches the saved engine-result contract
- future extraction should be a dedicated pure helper, not a reuse of the phase-2 validators

## Proposed Pure Extraction Boundary

Preferred future responsibility:

`canonical SavedDealRecord -> prepared saved-deal values -> prepared GDV values -> prepared True MAO values`

Future helper responsibilities:

- copy canonical saved-deal scalar fields
- safely inspect `engine_result_json`
- return `null` for missing or structurally invalid monetary paths
- preserve canonical classification and capital protection values
- preserve raw persisted next-action text or `null` for the existing mapper boundary

Future helper non-responsibilities:

- calculate GDV
- calculate True MAO
- infer missing range endpoints
- use purchase price as a fallback
- use offer amounts as a fallback
- recompute classification
- recompute capital protection
- evaluate Investor Shield
- load tasks or offers
- access the database
- mutate the saved-deal record

## Strict Versus Tolerant Extraction Rules

General rule:

- accept only values already represented as finite canonical numbers on the proven path
- preserve `0`
- preserve other finite numeric values already present on the canonical path
- do not coerce numeric strings
- do not search alternate paths unless backward-compatibility evidence proves it is required
- do not throw for safely recoverable missing summary values
- do not silently convert malformed data into a positive or safe result

Field-by-field guidance for nested monetary extraction:

- absent parent object -> `null`
- `null` -> `null`
- numeric `0` -> preserve `0`
- valid positive number -> preserve the number
- negative number -> preserve the number if it is already a finite numeric value on the canonical path
- numeric string -> `null`
- non-numeric string -> `null`
- `NaN` -> `null`
- `Infinity` / `-Infinity` -> `null`
- legacy or alternate path not proven for Phase 4 -> `null`

No current case requires a hard failure rather than degrading to `null` for nested monetary extraction.

## Saved-Deal Not Found Versus Missing Engine Data

Saved deal not found:

- repository-level missing-record condition
- should continue to map to the canonical safe `404` behavior

Saved deal exists but engine result is missing or malformed:

- should not be represented as “deal not found”
- Phase 4 should return a summary with nullable monetary fields
- UI-safe unavailable values are already a supported contract shape

## Scalar Field Rules

- `address` -> copy canonical persisted address
- `purchase_price` -> copy persisted numeric value; preserve `null`; do not use offer amount
- `classification` -> copy persisted canonical value; do not recompute
- `capital_protection_state` -> copy persisted canonical value; do not infer from classification
- `next_action` -> copy persisted text or `null`; leave whitespace trimming to the existing mapper
- `id` -> preserve text-compatible ID; do not convert to UUID

## Proposed Extraction Result Shape

The future extractor should align exactly with the current composition-helper input.

Required groups:

- `savedDeal`
  - `dealId`
  - `address`
  - `purchasePrice`
  - `classification`
  - `capitalProtectionState`
  - `persistedNextAction`
- `canonicalValues`
  - `gdvRange`
  - `trueMao`
- `investorShield`
  - not produced by this future extractor
- `taskRecords`
  - not produced by this future extractor
- `offerRecords`
  - not produced by this future extractor

Required type shape for the extraction result:

- yes, a dedicated extraction-result type will be needed for the next implementation phase
- proposed location: alongside the future pure extractor in `lib/investor-summary/`, so the extraction contract stays close to the composition boundary it feeds

## Error and Observability Ownership

- saved-deal-not-found error: repository loader, then API route maps to `404`
- database connection/query error: repository loader and route diagnostic boundary
- malformed engine-result diagnostics: pure extractor or its caller, without mutating data
- safe external API response: API route
- internal logging: repository/route boundary only
- nullable summary field behavior: pure extractor and composition boundary

## Future Test Matrix

1. Complete canonical saved deal.
2. Complete canonical engine result.
3. All expected GDV paths extracted.
4. All expected True MAO paths extracted.
5. Partial GDV data.
6. Partial True MAO data.
7. Missing engine result.
8. Malformed parent objects.
9. Numeric zero preserved.
10. Numeric strings not coerced unless canonically supported.
11. Non-numeric values become unavailable or fail safely.
12. No fallback from purchase price.
13. No fallback from offers.
14. Saved-deal scalar values copied unchanged.
15. Input record not mutated.

## Risks and Unresolved Items

- No standalone saved-deal fixture file with persisted `engine_result_json` was found; proof comes from repository tests and the save-flow serialization in `app/page.tsx`.
- The alternate `engine_result_json.dueDiligence.trueMAO` shape is real but should remain unused unless later compatibility evidence proves it is required.
- `pg` JSONB parsing is not overridden anywhere in the repository, so the current object-shaped read path is the only proven behavior.
- No blocking extraction contract gap remains for Phase 4; the remaining work is implementation in a later phase.

## Explicit Non-Implementation

Confirm:

- no runtime code changed
- no types created
- no extractor created
- no tests created
- no repository changed
- no database access
- no SQL
- no API route
- no UI
- no page integration
- no migration
- no environment change
- no redeploy
- no production route called
- no deterministic recalculation
- no governance change

## Verdict

`PHASE 4F-3A-1 COMPLETE — READY FOR PHASE 4F-3A-2`

## Recommended Next Step

`Phase 4F-3A-2 — Investor Shield, Task, and Offer Loading Plan`
