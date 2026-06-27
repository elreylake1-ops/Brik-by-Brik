# Phase 4F-2B-2 Pure Latest Offer Selector

## Purpose
Create a pure selector that converts canonical persisted deal-offer rows into the already-selected latest-offer summary used by the Phase 4F Investor Summary mapper.

This phase adds no repository aggregation, no API route, no UI, and no mapper orchestration.

## Files Created or Changed

- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `__tests__/investor-summary-latest-offer-selector.test.ts`
- `docs/phase4/PHASE_4F_2B_2_PURE_LATEST_OFFER_SELECTOR.md`

## Canonical Offer Sources Inspected

- `types/investor-summary.ts`
- `types/operator-command.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `app/api/saved-deals/[id]/offers/route.ts`
- `db/migrations/20260522_phase4a_deal_offers_table.sql`
- `app/page.tsx`
- `__tests__/deal-offers-repository.test.ts`
- `__tests__/deal-offers-api-route.test.ts`
- `__tests__/operator-command-fixtures.test.ts`
- `__tests__/phase4a-migration-consistency.test.ts`

## Canonical Offer Fields

- offer ID: `id`
- deal ID: `deal_id`
- offer amount: `offer_amount`
- offer type: `offer_type`
- offer status: `offer_status`
- offer rationale: `offer_rationale`
- seller response: `seller_response`
- created timestamp: `created_at`

## Repository Ordering Contract

- repository table: `brik_by_brik_engine.deal_offers`
- relationship field: `deal_id`
- ordering used by the repository: `created_at DESC`
- selector trusts the input order and does not reorder records

Evidence:

- `lib/operator-command/deal-offers-repository.ts` uses `ORDER BY created_at DESC`
- `app/page.tsx` uses `offers[0]` as the latest offer

## Selector Input

- `readonly DealOfferRecord[]`
- canonical persisted offer rows only
- already ordered by the repository
- no database access

## Selector Output

- `InvestorSummaryLatestOfferSummary | null`
- `null` when no offers are supplied

## Selection Rule

`Select the first supplied offer; return null when none exists.`

## Field Mapping

- `id` -> `offerId`
- `offer_amount` -> `amount`
- `offer_type` -> `offerType`
- `offer_status` -> `offerStatus`
- `offer_rationale` -> `rationale`
- `seller_response` -> `sellerResponse`
- `created_at` -> `createdAt`

Rules:

- preserve canonical field values
- preserve nullable fields
- do not add deal ID to the summary contract
- do not synthesize labels or derived fields

## Null and Empty-State Behavior

- empty input returns `null`
- no synthetic empty object is returned
- nullable rationale remains `null`
- nullable seller response remains `null`
- zero offer amount is preserved because the route and schema accept any finite numeric amount

## Ordering Behavior

- no sorting is performed
- no timestamp comparison is performed
- no attempt is made to repair malformed input order
- the first supplied record is selected exactly as received

## Duplicate Behavior

- duplicates are preserved upstream
- the selector does not deduplicate
- the first record wins when duplicates are present

## Purity and Immutability

- no I/O
- no database access
- no environment access
- no mutation of the input array
- no mutation of the source offer records
- deterministic output for the same input

## Tests Added

- empty input returns `null`
- one offer maps to the contract
- first supplied record is selected
- highest amount is not chosen
- status is not used for selection
- timestamps are not compared or reordered
- nullable rationale remains `null`
- nullable seller response remains `null`
- input array is not mutated
- input offer records are not mutated
- duplicate offers select the first record
- zero amount is preserved

## Mapper Integration Boundary

The mapper remains unchanged and continues to accept:

- one already-selected latest-offer summary, or
- `null`

Future flow:

`persisted offer rows ordered by created_at DESC` -> `latest-offer selector` -> `mapInvestorSummaryViewModel`

## Deferred Work

- repository aggregation
- selector orchestration
- engine-result parsing
- broader mapper edge cases
- API
- UI
- production integration

## Explicit Non-Implementation

- no database access
- no repository aggregation
- no sorting
- no timestamp comparison
- no highest-amount selection
- no status filtering
- no API route
- no UI
- no page integration
- no offer persistence
- no migration
- no SQL
- no production change
- no deterministic-engine change
- no Investor Shield reevaluation

## Acceptance Conditions

1. Canonical offer fields inspected. Pass.
2. Repository ordering verified as `created_at DESC`. Pass.
3. Pure selector created. Pass.
4. Empty input returns `null`. Pass.
5. First supplied offer is selected. Pass.
6. No sorting occurs. Pass.
7. No timestamp comparison occurs. Pass.
8. No highest-amount policy added. Pass.
9. No status-based selection added. Pass.
10. Existing Investor Summary offer contract reused. Pass.
11. Nullable fields preserved. Pass.
12. Inputs not mutated. Pass.
13. Focused selector tests pass. Pass.
14. Full build/lint/test suite passes. Pass.

## Verdict

`PHASE 4F-2B-2 COMPLETE — READY FOR PHASE 4F-2B-3`

## Recommended Next Step

`Phase 4F-2B-3 — Selector Integration and Mapper Edge-Case Closure`
