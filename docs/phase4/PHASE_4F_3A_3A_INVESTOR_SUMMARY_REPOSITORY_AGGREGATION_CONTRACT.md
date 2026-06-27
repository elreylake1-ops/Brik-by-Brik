# Phase 4F-3A-3A Investor Summary Repository Aggregation Contract

## Purpose

Define the contract and responsibility boundary for a future Investor Summary repository aggregator.

This phase is inspection, architecture definition, and documentation only. No repository, extractor, adapter, SQL, API, UI, or test code is added.

## Repository Baseline

- Branch: `main`
- `HEAD`: `68724547451dc44cc1c4e30ff76775fcdf248917`
- `origin/main`: `68724547451dc44cc1c4e30ff76775fcdf248917`
- `origin`: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing unstaged `.gitignore` modification

## Files Inspected

- `docs/phase4/PHASE_4F_0C_CANONICAL_INVESTOR_SUMMARY_FIELD_MAPPING.md`
- `docs/phase4/PHASE_4F_1A_CANONICAL_INVESTOR_SUMMARY_TYPE_CONTRACTS.md`
- `docs/phase4/PHASE_4F_2A_PURE_CANONICAL_INVESTOR_SUMMARY_MAPPER.md`
- `docs/phase4/PHASE_4F_2B_3A_PURE_SELECTOR_TO_MAPPER_COMPOSITION.md`
- `docs/phase4/PHASE_4F_2B_3B_2_COMPOSITION_EDGE_CASE_CLOSURE.md`
- `docs/phase4/PHASE_4F_3A_1_SAVED_DEAL_AND_ENGINE_RESULT_EXTRACTION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2A_CANONICAL_INVESTOR_SHIELD_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_1_CANONICAL_DEAL_TASK_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_2_CANONICAL_DEAL_OFFER_LOADING_PLAN.md`
- `types/investor-summary.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/select-active-investor-summary-tasks.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/db/postgres.ts`
- `app/page.tsx`
- `app/api/saved-deals/[id]/offers/route.ts`
- `__tests__/saved-deals-repository.test.ts`
- `__tests__/investor-shield-read-model.test.ts`
- `__tests__/deal-tasks-repository.test.ts`
- `__tests__/deal-offers-repository.test.ts`
- `__tests__/investor-summary-composition.test.ts`
- `__tests__/investor-summary-latest-offer-selector.test.ts`
- `__tests__/phase4a-migration-consistency.test.ts`

## Existing Downstream Contract

The current Phase 4F composition helper already defines the aggregation boundary the future repository must satisfy.

`composeInvestorSummaryViewModel(input)` accepts:

- `savedDeal: InvestorSummaryMapperSavedDealInput`
- `canonicalValues: InvestorSummaryMapperCanonicalValuesInput`
- `investorShield: InvestorSummaryMapperShieldInput`
- `taskRecords: readonly DealTaskRecord[]`
- `offerRecords: readonly DealOfferRecord[]`

It returns `InvestorSummaryViewModel`.

The downstream mapper contract is fixed:

- `savedDeal` provides deal identity, address, purchase price, classification, capital protection state, and persisted next action
- `canonicalValues` provides GDV range and True MAO breakdown
- `investorShield` provides Shield status, missing evidence count, blocked gates, and fallback recommended-action title
- `taskRecords` are already canonical persisted task rows
- `offerRecords` are already canonical persisted offer rows

The mapper then delegates:

- `taskRecords` -> `selectActiveInvestorSummaryTasks(...)`
- `offerRecords` -> `selectLatestInvestorSummaryOffer(...)`
- prepared values plus selector outputs -> `mapInvestorSummaryViewModel(...)`

## Existing Read Dependencies

| Dependency | Existing Function | Input | Output | I/O | Ordering or Evaluation Responsibility |
| ---------- | ----------------- | ----- | ------ | --: | ------------------------------------- |
| Saved deal detail repository | `getSavedDealById` in `lib/operator-command/saved-deals-repository.ts` | `string` | `Promise<SavedDealRecord \| null>` | Yes | Repository-level existence lookup; no summary parsing |
| Investor Shield read model | `loadInvestorShieldEvaluationInput` in `lib/investor-shield/investor-shield-read-model.ts` | `dealId: string`, optional deterministic status/time | `Promise<InvestorShieldEvaluationInput>` | Yes | Loads canonical Shield source rows; evaluation is performed by `evaluateInvestorShield(...)` in the Shield boundary |
| Task repository | `listTasksForDeal` in `lib/operator-command/deal-tasks-repository.ts` | `dealId: string` | `Promise<DealTaskRecord[]>` | Yes | Repository owns `created_at DESC` ordering |
| Offer repository | `listOffersForDeal` in `lib/operator-command/deal-offers-repository.ts` | `dealId: string` | `Promise<DealOfferRecord[]>` | Yes | Repository owns `created_at DESC` ordering |

## Public Repository Responsibility

The future repository should have one narrow responsibility:

```text
deal ID
-> coordinate existing canonical read dependencies
-> prepare canonical Phase 4F inputs
-> return InvestorSummaryViewModel
```

The preferred boundary is the final read-only view model, not a separate intermediate aggregation result.

Why:

- the current mapper already defines the final shape
- downstream consumers should receive one canonical read result
- keeping the public boundary at the final view model avoids splitting responsibility across another service layer
- the repository can still use internal helpers for extraction and Shield/task/offer coordination

## Proposed Public Function

Recommended future public function:

```text
getInvestorSummaryForDeal(dealId)
```

Proposed file path:

```text
lib/investor-summary/investor-summary-repository.ts
```

Contract:

- input type: `string`
- success return type: `Promise<InvestorSummaryViewModel>`
- missing-deal behavior: canonical not-found signal, not a summary
- infrastructure-error behavior: propagate or classify as failure, never convert into a safe summary
- read-only: yes
- mutations: none

Notes:

- `get...` aligns with existing repository naming patterns like `getSavedDealById`
- the function name is still a recommendation, not an implementation requirement

## Dependency Responsibility Boundaries

### Saved deal

Responsible for:

- confirming deal existence
- returning the canonical persisted saved-deal record

Not responsible for:

- parsing Phase 4F summary fields
- loading Shield, tasks, or offers

### Saved-deal extraction helper

Future pure helper responsible for:

- copying saved-deal scalars
- safely extracting canonical GDV values
- safely extracting canonical True MAO values

Not responsible for:

- database access
- Shield loading
- task loading
- offer loading

### Investor Shield loading boundary

Responsible for:

- producing canonical Shield status
- missing-evidence count
- blocked-gate summaries
- Shield fallback recommendation title

Must reuse the existing canonical Shield evaluator/read model.

### Task repository and selector

Responsible for:

- loading canonical task rows
- selecting active tasks through the existing selector

### Offer repository and selector

Responsible for:

- loading repository-ordered offers
- selecting the first offer through the existing selector

### Composition helper

Responsible for:

- combining prepared inputs
- delegating final mapping

These responsibilities must remain separate.

## Aggregation Input and Output

### Input

- `dealId: string`

### Required dependency results

- canonical saved-deal record
- prepared saved-deal values
- prepared GDV values
- prepared True MAO values
- prepared canonical Shield input
- canonical task records
- canonical offer records

### Output

Preferred output:

- `InvestorSummaryViewModel`

Field groups passed into `composeInvestorSummaryViewModel(...)` remain exactly the current composition contract:

- `savedDeal`
- `canonicalValues`
- `investorShield`
- `taskRecords`
- `offerRecords`

No additional fields should be introduced unless the composition contract changes in a later phase.

## Read-Only Guarantees

The future aggregator must not:

- update saved deals
- move pipeline state
- create tasks
- update tasks
- create offers
- update offers
- approve evidence
- waive gates
- create evidence records
- execute migrations
- recalculate deterministic engine outputs
- persist a regenerated summary
- write cache rows
- alter timestamps

Read-only behavior is preserved by:

- reusing existing read-only repository functions and selectors
- keeping extraction pure
- keeping composition pure
- exposing only a summary-returning read API
- avoiding any mutation-capable dependency in the public contract

## Missing-State Boundaries

### Saved deal not found

- aggregator terminates with a canonical not-found result
- no valid summary is returned

### Missing or malformed engine values

- saved deal exists
- monetary summary fields degrade safely to `null`
- no not-found result

### Valid no-task state

- active tasks become an empty collection

### Valid no-offer state

- latest offer becomes `null`

### Valid empty or initial Shield state

Use the decision already documented in the Shield loading plan.

### Database or dependency error

- must not be converted into valid empty data
- must remain distinguishable from legitimate missing states

## Consistency Requirement Classification

Classification:

`UNRESOLVED - DETAILED QUERY PLAN REQUIRED`

Minimum correctness requirement:

- saved-deal existence must be established first
- after that, the aggregator must not blur query failure into empty data
- task, offer, and Shield reads must remain canonical and read-only
- the final result must correspond to one saved deal and one aggregation decision

What remains intentionally undecided in this phase:

- whether the aggregator requires a single transaction
- whether sequential reads are sufficient
- whether some reads can run in parallel after deal existence is known
- whether the summary is a point-in-time snapshot or a best-effort read view

Those decisions belong to Phase 4F-3A-3B.

## Type Recommendations

| Future Type | Existing Type Reused? | New Type Needed? | Proposed Location | Visibility |
| ----------- | --------------------- | ---------------- | ----------------- | ---------- |
| Saved-deal extraction result | No exact existing type | Yes | `lib/investor-summary/investor-summary-repository.ts` or `lib/investor-summary/extract-saved-deal-values.ts` | Internal |
| Prepared Shield summary input | No exact existing type | No, reuse `InvestorSummaryMapperShieldInput` shape conceptually | Existing mapper/input boundary | Internal |
| Repository dependency interface for mocking | No | Yes | `lib/investor-summary/investor-summary-repository.ts` or adjacent internal module | Internal |
| Repository result or not-found discriminator | No exact existing type | Yes | Same repository module | Internal |

Reuse guidance:

- do not duplicate `InvestorSummaryViewModel`
- do not duplicate mapper input types
- do not duplicate task or offer record types
- do not duplicate Investor Shield canonical types

## Dependency Injection and Testability

Recommended pattern:

- explicit dependency object for the future repository internals
- default production dependencies point to the existing repositories/loaders
- tests inject mocked dependencies without touching a live database

Why:

- it avoids a second `pg.Pool`
- it keeps the public function read-only
- it makes repository orchestration testable without relying on module-global mocks
- it still fits the current codebase, which already uses dependency substitution in tests

Module mocks remain usable as a fallback for repository tests, but the recommended design is an explicit dependency object.

## Error Ownership

| Condition | Owning Layer | Future External Result |
| --------- | ------------ | ---------------------- |
| Saved deal missing | Aggregator/repository | Not-found signal |
| Saved-deal query failure | Existing repository/aggregator | Infrastructure failure |
| Malformed engine JSON values | Pure extractor | Nullable fields or diagnostics |
| Shield loading failure | Shield loader/aggregator | Infrastructure or canonical loader failure |
| Task query failure | Task repository/aggregator | Infrastructure failure |
| Offer query failure | Offer repository/aggregator | Infrastructure failure |
| Safe HTTP response | Future API route | Deferred |
| Display of unavailable values | Future UI | Deferred |

The aggregator must not absorb dependency failures into empty or safe summary states.

## Conceptual Aggregation Flow

```text
deal ID
-> load canonical saved deal
-> stop if not found
-> extract saved-deal + engine values
-> obtain canonical Shield input
-> obtain task records
-> obtain offer records
-> compose Investor Summary view model
-> return read-only result
```

This phase deliberately does not decide sequential versus parallel execution in detail.

## Prohibited Architecture

Reject the following:

- direct SQL in the future route
- one giant SQL join across all Phase 4F dependencies
- a second `pg.Pool`
- loading data from React components
- duplicating existing saved-deal, task, or offer queries
- duplicating Investor Shield evaluation
- parsing engine JSON inside the route or component
- recomputing True MAO or GDV
- deriving Shield state from Evidence Lite
- deriving blocked gates from tasks
- deriving recommended action from offer rationale or task title
- swallowing dependency failures as empty states
- returning partial success without an explicit contract

## Later Implementation Acceptance Conditions

The future repository implementation must eventually prove:

1. One public read-only aggregation function exists.
2. Saved-deal existence is established first.
3. Existing saved-deal repository is reused.
4. Existing Shield loading path is reused.
5. Existing task repository is reused.
6. Existing offer repository is reused.
7. Shared database adapter is reused.
8. No duplicate SQL is introduced where an existing repository suffices.
9. Pure saved-engine extraction is separated from I/O.
10. Existing task and offer selectors are reused.
11. Existing composition helper is reused.
12. Missing deal remains distinct from nullable summary values.
13. Query failures remain distinct from valid empty states.
14. No mutation path exists.
15. No deterministic or governance logic is duplicated.

## Risks and Unresolved Items

- Query sequence and concurrency strategy are intentionally unresolved until Phase 4F-3A-3B.
- Saved-deal existence must be established first, but the exact loading choreography is still open.
- The current repository contracts trust typed rows; runtime normalization for malformed data remains a future concern only.
- The final API shape is reserved for later route work and should not be inferred here.

## Explicit Non-Implementation

This document does not:

- change runtime code
- create types
- create a repository
- create an extractor
- create an adapter
- create tests
- access any database
- write SQL
- add an API route
- add UI
- modify page integration
- modify migrations
- change environment settings
- redeploy anything
- call a production route
- recalculate deterministic outputs
- duplicate Shield behavior
- change governance behavior

## Verdict

`PHASE 4F-3A-3A COMPLETE - READY FOR PHASE 4F-3A-3B`

## Recommended Next Step

`Phase 4F-3A-3B - Dependency Loading and Query Sequence Plan`
