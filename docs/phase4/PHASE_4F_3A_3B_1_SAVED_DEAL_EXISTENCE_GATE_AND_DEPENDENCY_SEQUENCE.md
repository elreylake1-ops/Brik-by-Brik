# Phase 4F-3A-3B-1 Saved-Deal Existence Gate and Dependency Sequence Plan

## Purpose

Define the exact high-level loading sequence for the future Investor Summary repository, with saved-deal existence established before any dependent Investor Shield, task, or offer loading begins.

This phase is inspection and documentation only. No repository, extractor, adapter, SQL, API, UI, or test code is added.

## Repository Baseline

- Branch: `main`
- `HEAD`: `a02971c0c718671e0e99e4ebd73b2deec226209d`
- `origin/main`: `a02971c0c718671e0e99e4ebd73b2deec226209d`
- `origin`: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing unstaged `.gitignore` modification

## Files Inspected

- `docs/phase4/PHASE_4F_3A_1_SAVED_DEAL_AND_ENGINE_RESULT_EXTRACTION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2A_CANONICAL_INVESTOR_SHIELD_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_1_CANONICAL_DEAL_TASK_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_2_CANONICAL_DEAL_OFFER_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_3A_INVESTOR_SUMMARY_REPOSITORY_AGGREGATION_CONTRACT.md`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `app/api/saved-deals/[id]/route.ts`
- `__tests__/saved-deals-repository.test.ts`
- `__tests__/saved-deals-api-detail-route.test.ts`

## Existing Saved-Deal Detail Function

Exact repository function:

- `getSavedDealById`

File path:

- `lib/operator-command/saved-deals-repository.ts`

Input type:

- `string`

Success output:

- `Promise<SavedDealRecord | null>`

Missing-deal output:

- `null`

Database-error behavior:

- the shared `query(...)` adapter throws and the error propagates to the caller

Shared adapter usage:

- uses `query<SavedDealRecord>(...)` from `lib/db/postgres.ts`

Archived-deal behavior:

- archived deals are included if they match the requested id
- the function does not filter on `archived_at`

Mutations:

- none

Classification:

`REUSE DIRECTLY`

The saved-deal detail route already uses the same function directly and maps `null` to 404.

## Saved-Deal Existence-First Rule

The future aggregation sequence must begin:

```text
deal ID
-> load canonical saved deal
-> if missing, stop immediately
```

Why dependent loading must not begin before this check:

- dependent reads are only meaningful for an existing deal
- Shield, task, and offer loading should not run for a missing deal
- engine-value extraction requires the loaded saved-deal record
- no partial summary should be produced from an unverified deal id
- the later route should preserve a canonical not-found signal instead of converting a missing deal into an empty summary

Required behavior when the deal is missing:

- no Investor Shield loading
- no task loading
- no offer loading
- no engine-result extraction
- no composition
- no partial summary
- return the canonical repository not-found signal for later route mapping

## Dependency Prerequisite Matrix

| Step | Input Required | Existing/Future Function | Output | May Run Before Saved Deal Exists |
| ---- | -------------- | ------------------------ | ------ | -------------------------------: |
| 1 | `dealId: string` | `getSavedDealById(dealId)` | `Promise<SavedDealRecord | null>` | No |
| 2 | loaded `SavedDealRecord` | future pure extraction helper | prepared saved-deal, GDV, and True MAO values | No |
| 3 | verified `dealId` | `loadInvestorShieldEvaluationInput(dealId)` | `Promise<InvestorShieldEvaluationInput>` | No |
| 4 | verified `dealId` | `listTasksForDeal(dealId)` | `Promise<DealTaskRecord[]>` | No |
| 5 | verified `dealId` | `listOffersForDeal(dealId)` | `Promise<DealOfferRecord[]>` | No |
| 6 | prepared saved-deal values, prepared canonical Shield input, task records, offer records | `composeInvestorSummaryViewModel(...)` | `InvestorSummaryViewModel` | No |

All dependent steps must remain `No` in the final column.

## Extraction Placement

Saved-deal extraction is pure and receives the already-loaded canonical saved-deal record.

Boundary:

```text
canonical saved-deal record
-> future pure extraction helper
-> prepared saved-deal, GDV, and True MAO values
```

Placement decision:

- extraction should occur immediately after saved-deal loading and existence confirmation
- it should happen before dependent Shield, task, and offer reads

Why this is the simplest boundary:

- purity is preserved because the extractor only transforms the loaded saved-deal record
- error clarity is preserved because deal-not-found is separated from malformed or missing engine-value paths
- the extractor does not need to wait for unrelated dependent reads

Extraction must not:

- query the database
- determine whether the deal exists
- load Shield data
- load tasks
- load offers
- recalculate values
- throw for safely nullable monetary fields

## Investor Shield Prerequisites

Exact existing loader/read-model boundary to reuse:

- `loadInvestorShieldEvaluationInput(dealId, options)` in `lib/investor-shield/investor-shield-read-model.ts`

Required input:

- `dealId: string`
- optional deterministic status/time options when needed

The loaded saved-deal record is not required by the Shield read-model function itself.

What happens when Shield persistence is legitimately empty:

- the read-model loader still returns canonical input with empty row sets
- `evaluateInvestorShield(...)` then produces the canonical Shield result for those empty inputs

What constitutes a Shield loading failure:

- repository/query failure when reading any Shield source rows
- any other failure that prevents `loadInvestorShieldEvaluationInput(...)` from producing canonical input

Rules:

- Shield loading begins only after deal existence is proven
- no second evaluator
- no status inference from tasks or Evidence Lite
- a Shield infrastructure failure cannot become an empty or safe Shield result

## Task Prerequisites

Conceptual flow:

```text
verified deal ID
-> listTasksForDeal(dealId)
-> existing active-task selector
```

Confirmed behavior:

- task loading begins only after saved-deal existence is proven
- no-task is a valid empty state
- task-query failure remains an infrastructure failure
- active filtering remains selector-owned
- no task title becomes a recommended action
- blocked tasks do not create blocked gates

## Offer Prerequisites

Conceptual flow:

```text
verified deal ID
-> listOffersForDeal(dealId)
-> existing latest-offer selector
```

Confirmed behavior:

- offer loading begins only after saved-deal existence is proven
- no-offer is a valid empty state
- offer-query failure remains an infrastructure failure
- repository ordering remains authoritative
- selector chooses the first supplied record
- no offer rationale becomes a recommended action
- no offer amount becomes a monetary fallback

## Composition Prerequisite Checklist

Before calling:

```text
composeInvestorSummaryViewModel(...)
```

the future aggregator must possess:

- extracted saved-deal values
- extracted GDV values
- extracted True MAO values
- prepared canonical Shield input
- canonical task records
- canonical offer records

Valid nullable or empty inputs:

- extracted monetary values may contain `null`
- Shield input may legitimately represent the empty canonical Shield state
- task records may be an empty array
- offer records may be an empty array

Conditions that must stop composition entirely:

- saved deal missing
- saved-deal query failure
- Shield loading failure
- task query failure
- offer query failure
- another dependency failure classified as infrastructure failure

No partial-success policy is defined here.

## Stop-Condition Matrix

| Condition | Stop Aggregation | Compose Summary | Valid Empty/Nullable State | Future Owner |
| --------- | ---------------: | --------------: | -------------------------: | ------------ |
| saved deal missing | Yes | No | No | Aggregator/repository |
| saved-deal query failure | Yes | No | No | Saved-deal repository/aggregator |
| missing engine-result monetary path | No | Yes | Yes | Pure extractor |
| malformed engine monetary value | No | Yes | Yes | Pure extractor |
| valid empty Shield state | No | Yes | Yes | Shield loading boundary |
| Shield loading failure | Yes | No | No | Shield loader/aggregator |
| no tasks | No | Yes | Yes | Task repository + selector |
| task-query failure | Yes | No | No | Task repository/aggregator |
| no offers | No | Yes | Yes | Offer repository + selector |
| offer-query failure | Yes | No | No | Offer repository/aggregator |

Valid missing data must not be conflated with dependency failure.

## Logical Dependency Sequence

```text
1. Receive deal ID
2. Load canonical saved deal
3. Stop if saved deal is missing
4. Extract saved-deal and engine values through a pure helper
5. Load canonical Shield dependency
6. Load canonical tasks
7. Load canonical offers
8. Pass prepared values and records to the existing composition helper
9. Return InvestorSummaryViewModel
```

This is a logical dependency sequence only.

Steps 5-7 are not constrained here to be sequential.

## Unnecessary Dependency Calls Rejected

Reject:

- loading tasks before proving the deal exists
- loading offers before proving the deal exists
- loading Shield rows before proving the deal exists
- composing before all required dependencies succeed
- retrying one dependency silently inside the aggregator
- returning a partial summary after an infrastructure failure
- using empty arrays as substitutes for failed task or offer queries
- using an unavailable Shield status as a substitute for a Shield query failure

## Future Mocked-Test Expectations

Planned future tests should prove:

1. Saved-deal repository is called first.
2. Missing deal stops all remaining dependency calls.
3. Saved-deal query failure stops all remaining dependency calls.
4. Successful deal load permits extraction and dependency loading.
5. Pure extraction receives the loaded saved-deal record.
6. Valid missing monetary values do not stop aggregation.
7. No-task remains a valid empty state.
8. No-offer remains a valid empty state.
9. Valid empty Shield behavior follows the canonical Shield plan.
10. Shield failure stops composition.
11. Task-query failure stops composition.
12. Offer-query failure stops composition.
13. Composition runs exactly once after all dependencies succeed.
14. No mutation function is called.
15. No live database is required in unit tests.

The mocking mechanism is deferred to Phase 4F-3A-3C.

## Deferred to Phase 4F-3A-3B-2

Explicitly deferred:

- sequential versus concurrent loading
- transaction usage
- snapshot consistency
- same-connection requirements
- failure timing under parallel execution
- performance considerations

## Explicit Non-Implementation

This document does not:

- change runtime code
- create types
- create a repository
- create an extractor
- create an adapter
- create tests
- call any repository function
- access any database
- write SQL
- add an API route
- add UI
- modify page integration
- modify migrations
- change environment settings
- call a production route
- recalculate deterministic outputs
- change governance behavior

## Verdict

`PHASE 4F-3A-3B-1 COMPLETE - READY FOR PHASE 4F-3A-3B-2`

## Recommended Next Step

`Phase 4F-3A-3B-2 - Post-Gate Concurrency and Read Consistency Plan`
