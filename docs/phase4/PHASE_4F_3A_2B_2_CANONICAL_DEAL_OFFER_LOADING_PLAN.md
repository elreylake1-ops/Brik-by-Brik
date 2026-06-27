# Phase 4F-3A-2B-2 Canonical Deal Offer Loading Plan

## Purpose

Document the canonical deal-offer source layer and loading boundary needed by the future Phase 4F Investor Summary repository.

This phase is inspection-only. No offer loader, repository aggregation, API route, UI integration, database query, or test change is added.

## Repository Baseline

- Branch: `main`
- `HEAD`: `d16621779eab01bb229c06fd963082bdad067d37`
- `origin/main`: `d16621779eab01bb229c06fd963082bdad067d37`
- `origin`: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing unstaged `.gitignore` modification

## Files Inspected

- `docs/phase4/PHASE_4F_0C_CANONICAL_INVESTOR_SUMMARY_FIELD_MAPPING.md`
- `docs/phase4/PHASE_4F_1A_CANONICAL_INVESTOR_SUMMARY_TYPE_CONTRACTS.md`
- `docs/phase4/PHASE_4F_2B_2_PURE_LATEST_OFFER_SELECTOR.md`
- `docs/phase4/PHASE_4F_2B_3A_PURE_SELECTOR_TO_MAPPER_COMPOSITION.md`
- `docs/phase4/PHASE_4F_2B_3B_2_COMPOSITION_EDGE_CASE_CLOSURE.md`
- `docs/phase4/PHASE_4F_3A_1_SAVED_DEAL_AND_ENGINE_RESULT_EXTRACTION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2A_CANONICAL_INVESTOR_SHIELD_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_1_CANONICAL_DEAL_TASK_LOADING_PLAN.md`
- `types/investor-summary.ts`
- `types/operator-command.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/db/postgres.ts`
- `app/api/saved-deals/[id]/offers/route.ts`
- `app/page.tsx`
- `db/migrations/20260522_phase4a_deal_offers_table.sql`
- `db/migrations/20260521_phase4a_minimal_schema.sql`
- `__tests__/deal-offers-repository.test.ts`
- `__tests__/deal-offers-api-route.test.ts`
- `__tests__/investor-summary-latest-offer-selector.test.ts`
- `__tests__/investor-summary-composition.test.ts`
- `__tests__/operator-command-fixtures.test.ts`
- `__tests__/phase4a-migration-consistency.test.ts`
- `__tests__/fixtures/operator-command/operator-command-fixtures.ts`

## Current Phase 4F Offer Input Requirements

The current investor-summary composition helper expects offer data in this shape:

```text
readonly DealOfferRecord[]
```

The selector contract is already explicit:

- repository rows are loaded first
- `selectLatestInvestorSummaryOffer(...)` receives canonical persisted offer rows
- the selector returns either the first supplied record mapped into the summary contract or `null`
- composition then passes that selected value into the mapper

For Phase 4F, the canonical offer-loading boundary should stop at the repository row set and preserve the existing selector as the only latest-offer selector.

## Canonical Offer Persistence

The canonical persisted offer record is the `deal_offers` row in `brik_by_brik_engine.deal_offers`.

### Field Matrix

| Field | Database Type | TypeScript Type | Nullable | Phase 4F Use | Direct Mapping Safe |
| ----- | ------------- | --------------- | -------: | ------------ | ------------------: |
| `id` | `UUID` | `string` | No | Offer identity passed through to the summary contract as `offerId` | Yes |
| `deal_id` | `TEXT` | `string` | No | Deal linkage for repository filtering only | Yes |
| `offer_amount` | `NUMERIC` | `number` | No | Mapped directly to `InvestorSummaryLatestOfferSummary.amount` | Yes, by current repository contract |
| `offer_type` | `TEXT` | `string` | No | Mapped directly to `offerType` | Yes |
| `offer_status` | `TEXT` | `string` | No | Mapped directly to `offerStatus` | Yes |
| `offer_rationale` | `TEXT` | `string \| null` | Yes | Mapped directly to `rationale` | Yes |
| `seller_response` | `TEXT` | `string \| null` | Yes | Mapped directly to `sellerResponse` | Yes |
| `created_at` | `TIMESTAMPTZ` | `string` | No | Mapped directly to `createdAt` and preserved for display ordering context | Yes |

Current schema defaults:

- `offer_type` defaults to `INITIAL`
- `offer_status` defaults to `DRAFT`

The current repository contract treats these values as trusted persisted rows and does not add a separate runtime parser.

## Existing Offer Repository

Canonical repository function:

- `lib/operator-command/deal-offers-repository.ts:listOffersForDeal(dealId)`

Observed behavior:

- returns `Promise<DealOfferRecord[]>`
- queries `brik_by_brik_engine.deal_offers`
- filters by `deal_id = $1`
- orders by `created_at DESC`
- does not exclude any status values
- does not dedupe rows
- does not mutate the input deal id
- does not mutate returned rows
- uses the shared `query(...)` adapter from `lib/db/postgres.ts`

Other write-side helpers in the same repository exist, but they are not the canonical loading source for this phase:

- `createOffer(...)`
- `updateOfferStatus(...)`
- `updateSellerResponse(...)`

## Database and Schema Assumptions

The task-loading plan relies on the existing migration contract:

- `deal_offers.id` is a UUID primary key with `DEFAULT gen_random_uuid()`
- `deal_offers.deal_id` references `saved_deals(id)` with `ON DELETE CASCADE`
- `offer_amount` is `NUMERIC NOT NULL`
- `offer_type` is plain `TEXT NOT NULL DEFAULT 'INITIAL'`
- `offer_status` is plain `TEXT NOT NULL DEFAULT 'DRAFT'`
- `offer_rationale` is nullable `TEXT`
- `seller_response` is nullable `TEXT`
- `created_at` is `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- no offer-specific indexes are declared in the migration
- no uniqueness constraint prevents multiple offer rows for the same deal
- no status check constraint is declared in the migration

Implications for loading:

- the repository must be treated as the authoritative persisted offer list
- status filtering is a selector concern, not a SQL concern
- duplicate rows remain valid persisted data unless a future schema change says otherwise
- identical `created_at` ties are not given a documented secondary ordering rule

## Repository Ordering Contract

Current repository ordering:

```text
created_at DESC
```

That order is canonical for the persisted row set and should be preserved by the loading plan.

Implications:

- newer persisted rows appear before older ones
- the selector trusts the supplied order
- composition trusts the selector output
- the UI can safely show `offers[0]` as the latest loaded record because the route already returns repository-ordered rows

If two rows share the same `created_at` value, the current contract does not define a stable secondary ordering. That remains an unresolved determinism risk rather than an invented tie-break rule.

## Latest-Offer Responsibility Boundary

Canonical latest-offer selector:

- `lib/investor-summary/select-latest-investor-summary-offer.ts`

Selector behavior:

- accepts `readonly DealOfferRecord[]`
- returns the first supplied record mapped to `InvestorSummaryLatestOfferSummary`
- returns `null` when the collection is empty
- preserves nullable fields
- preserves zero amount
- performs no sorting
- performs no status filtering
- mutates no input

Responsibility split:

- repository: fetch persisted rows and preserve chronological ordering
- selector: pick the first supplied row and map it
- composition helper: delegate to the selector and pass the selected latest offer into the mapper
- mapper: consume the already-selected latest offer

The Phase 4F loading plan should not move latest-offer selection into the repository or into a new aggregation layer when the repository already guarantees order.

## Offer Creation and Update Context

The offer API route already uses the repository directly:

- GET calls `listOffersForDeal(dealId)`
- POST calls `createOffer(dealId, input)`

Observed creation behavior:

- default `offer_type` is `INITIAL`
- default `offer_status` is `DRAFT`
- `offer_rationale` defaults to `null`
- `seller_response` defaults to `null`
- `offer_amount` is required and must be a finite number
- `createOffer(...)` inserts a new row

Observed update behavior:

- `updateOfferStatus(...)` updates `offer_status` in place
- `updateSellerResponse(...)` updates `seller_response` in place

Offer lifecycle implication:

- multiple offer records per deal are expected
- the latest summary offer is the first record returned by the canonical repository ordering
- the summary must not reinterpret “latest” as “highest amount”, “accepted”, or “most recently responded”

## Duplicate Behavior

Duplicates are allowed in the persisted table and the selector preserves them.

Canonical loading rule:

- do not dedupe in the repository read path
- do not dedupe in the latest-offer selector
- do not dedupe before summary composition

Reason:

- the persisted row set is the source of truth
- dedupe would silently discard valid historical rows
- existing code already treats duplicate prevention as a write-side concern only

## Missing Deal Versus No Offers

These are different states and should stay different.

- Missing deal: future Investor Summary repository should handle this as a deal-not-found case and preserve canonical 404 behavior
- Existing deal with zero offers: valid empty collection, selector returns `null`

The offer repository itself only answers whether rows exist for the deal id it receives.

## Malformed or Legacy Offer Records

The current repository trusts the database row contract and returns typed rows without runtime validation.

Loading implication:

- offer loading should not invent a second row parser
- malformed rows should not be silently converted into a fake no-offer state
- numeric strings must not be introduced by the summary layer
- amount formatting belongs to UI, not loading
- economic or negotiation validation does not belong in the summary loader

Specific malformed-data handling is not currently enforced by runtime parsing in the repository:

- unknown offer type passes through as a string
- unknown offer status passes through as a string
- missing amount is schema-invalid at the database level
- missing timestamp is schema-invalid at the database level
- invalid timestamp handling is not normalized by the repository

## Proposed Offer-Loading Boundary

Proposed future boundary for investor-summary offer loading:

```text
deal id
-> listOffersForDeal(dealId)
-> selectLatestInvestorSummaryOffer(offerRecords)
-> InvestorSummaryLatestOfferSummary | null
```

Why this boundary is canonical:

- repository owns persisted deal-offer retrieval and chronological ordering
- selector owns first-record selection and mapping
- composition owns summary assembly

What should not happen inside this boundary:

- no offer creation
- no status mutation
- no seller-response mutation
- no duplicate suppression
- no terminal-status reinterpretation
- no timestamp comparison in the selector
- no amount-based ranking
- no status-based ranking
- no response-based ranking
- no UI formatting

## Error and Observability Ownership

Canonical error split:

- saved-deal-not-found handling: future Investor Summary repository
- offer-query failure: offer repository or future coordinator should surface it as an infrastructure error
- malformed offer-row diagnostics: repository boundary or future coordinator only, not a new parser in the summary layer
- chronological ordering: offer repository
- latest-offer selection: existing selector
- safe API error mapping: API route
- no-offer presentation: UI

The current API route already follows the repository-safe pattern by returning a normal `offers` array on success and a safe failure message when the repository call throws.

## Functions and Types to Reuse

| Function or Type | Path | Proposed Use | Classification | Notes |
| ---------------- | ---- | ------------ | -------------- | ----- |
| `listOffersForDeal` | `lib/operator-command/deal-offers-repository.ts` | Read canonical offer rows for a saved deal | `REUSE DIRECTLY` | Canonical repository read path; preserves `created_at DESC` ordering |
| `DealOfferRecord` | `lib/operator-command/deal-offers-repository.ts` | Canonical row contract for persisted offers | `REUSE DIRECTLY` | Exact selector input type |
| `OfferType` | `types/operator-command.ts` | Canonical offer-type union for mapped summary output | `REUSE DIRECTLY` | Used by the selector mapping contract |
| `offer_status` field type in `DealOfferRecord` | `lib/operator-command/deal-offers-repository.ts` | Canonical persisted offer-status field | `REUSE DIRECTLY` | Currently modeled as `string`, not a closed union |
| `selectLatestInvestorSummaryOffer` | `lib/investor-summary/select-latest-investor-summary-offer.ts` | Select and map the first repository-ordered offer | `REUSE DIRECTLY` | No sorting, no filtering, no mutation |
| `InvestorSummaryLatestOfferSummary` | `types/investor-summary.ts` | Output contract for the selected latest offer | `REUSE DIRECTLY` | Consumed by the existing mapper |
| route GET behavior | `app/api/saved-deals/[id]/offers/route.ts` | Safe wrapper around the canonical repository read | `REUSE PARTIALLY` | Route is presentation/API glue, not the loading source |
| route POST behavior | `app/api/saved-deals/[id]/offers/route.ts` | Write-side offer creation only | `DO NOT USE` | Not a loading primitive |
| `createOffer` | `lib/operator-command/deal-offers-repository.ts` | Write-side row insertion | `DO NOT USE` | Not part of read aggregation |
| `updateOfferStatus` | `lib/operator-command/deal-offers-repository.ts` | Write-side status change | `DO NOT USE` | Not part of read aggregation |
| `updateSellerResponse` | `lib/operator-command/deal-offers-repository.ts` | Write-side seller-response change | `DO NOT USE` | Not part of read aggregation |

## Functions and Approaches Not to Use

Do not use these as the canonical loading source:

- direct SQL in a future summary route
- a second `pg.Pool`
- offer queries from a React component
- write-side offer helpers for read aggregation
- selector-side sorting
- highest-amount selection
- status-based selection
- seller-response-based selection
- rationale-derived recommendations
- swallowing query errors as empty collections
- synthesizing an empty offer object
- using offer amount as purchase price, GDV, or True MAO fallback

Do not add these behaviors to the loading path:

- dedupe by deal, title, or response text
- timestamp comparison in the selector
- mutation of loaded rows
- derived economic rules from offer amount
- response-status inference from seller response text

## Future Test Matrix

The current codebase already covers the core repository and route behavior, so the future loading plan should keep the same semantics under test.

Recommended future checks:

1. Existing repository called with requested deal ID.
2. Canonical offer records passed unchanged to selector.
3. No-offer result becomes `null`.
4. One record maps correctly.
5. Multiple records select the first repository-ordered record.
6. Highest amount does not control selection.
7. Status does not control selection.
8. Seller response does not control selection.
9. Repository order is preserved.
10. Nullable rationale preserved.
11. Nullable seller response preserved.
12. Zero amount preserved.
13. Duplicate records are not deduplicated.
14. Query error is propagated or safely classified, not converted to empty.
15. Saved-deal-not-found remains distinct from no offers.
16. Inputs and records are not mutated.
17. No duplicated SQL or pool.
18. No recommended-action derivation from offers.
19. No monetary fallback from offer amount.

## Risks and Unresolved Items

- The repository does not validate row shape at runtime.
- Duplicate rows remain legal in storage.
- `offer_status` is currently modeled as plain `string`, so there is no closed canonical union for status selection.
- No explicit runtime numeric parser was found for `NUMERIC` values, so the repository contract is trusted rather than coerced.
- Identical `created_at` ties do not have a documented secondary ordering rule.
- The current loading flow depends on caller discipline to keep repository read logic separate from selector logic.

These are known constraints, not blockers for documenting the canonical loading path.

## Explicit Non-Implementation

This document does not:

- add a loader
- change the offer repository
- change the API route
- change the latest-offer selector
- change the investor-summary mapper
- add or modify tests
- change database schema
- add UI code
- change `app/page.tsx`
- create or update offers
- change offer statuses
- introduce a new sorting layer
- execute SQL
- access or mutate production
- modify packages
- change environment files
- redeploy anything
- call a production route
- change the latest-offer rule
- change deterministic or governance behavior

## Verdict

`PHASE 4F-3A-2B-2 COMPLETE - READY FOR PHASE 4F-3A-3`

## Recommended Next Step

`Phase 4F-3A-3 - Investor Summary Repository Aggregation Contract and Query Plan`
