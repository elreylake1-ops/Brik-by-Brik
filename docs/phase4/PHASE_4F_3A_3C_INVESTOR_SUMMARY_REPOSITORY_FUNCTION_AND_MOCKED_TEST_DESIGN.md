# Phase 4F-3A-3C Investor Summary Repository Function and Mocked-Test Design

## Purpose

Design the future Investor Summary repository function and its mocked-test boundary without implementing any runtime code or tests.

This phase is inspection, interface design, and documentation only. No repository function, mocks, tests, SQL, API, or UI code is added.

## Repository Baseline

- Branch: `main`
- `HEAD`: `534bac914b1aae04b1ff185762d7fe96b24c0606`
- `origin/main`: `534bac914b1aae04b1ff185762d7fe96b24c0606`
- `origin`: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing unstaged `.gitignore` modification

## Files Inspected

- `docs/phase4/PHASE_4F_3A_1_SAVED_DEAL_AND_ENGINE_RESULT_EXTRACTION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2A_CANONICAL_INVESTOR_SHIELD_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_1_CANONICAL_DEAL_TASK_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_2_CANONICAL_DEAL_OFFER_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_3A_INVESTOR_SUMMARY_REPOSITORY_AGGREGATION_CONTRACT.md`
- `docs/phase4/PHASE_4F_3A_3B_1_SAVED_DEAL_EXISTENCE_GATE_AND_DEPENDENCY_SEQUENCE.md`
- `docs/phase4/PHASE_4F_3A_3B_2_POST_GATE_CONCURRENCY_AND_READ_CONSISTENCY.md`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/select-active-investor-summary-tasks.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/db/postgres.ts`
- `app/api/saved-deals/[id]/route.ts`
- `__tests__/saved-deals-repository.test.ts`
- `__tests__/saved-deals-api-detail-route.test.ts`
- `__tests__/deal-tasks-repository.test.ts`
- `__tests__/deal-offers-repository.test.ts`
- `__tests__/investor-shield-read-model.test.ts`
- `__tests__/investor-summary-composition.test.ts`
- `__tests__/investor-summary-latest-offer-selector.test.ts`

## Future Repository Responsibility

The future Investor Summary repository must only orchestrate existing read boundaries and pure helpers.

Target responsibility:

```text
deal ID
-> load canonical saved deal
-> stop if missing or failed
-> extract saved-deal and engine-result values
-> load Shield, tasks, and offers using the approved post-gate model
-> ensure every required dependency succeeded
-> call existing composition helper
-> return InvestorSummaryViewModel
```

It must not:

- calculate financial values
- recalculate True MAO
- infer Shield status
- derive blocked gates from tasks
- derive recommended actions from task titles
- use offer values as financial fallbacks
- mutate saved deals
- create tasks
- create offers
- update pipeline state
- satisfy or waive gates
- execute raw SQL
- own a database pool

## Selected File Location

Selected future path:

```text
lib/investor-summary/investor-summary-repository.ts
```

Why:

- it matches the existing `lib/investor-summary` naming family
- it keeps the orchestration close to the existing composer and selectors
- it avoids inventing a new top-level service layer

## Selected Function Name

Selected future function name:

```text
getInvestorSummaryForDeal
```

Why:

- it aligns with the existing repository convention used by `getSavedDealById`
- it reads as a canonical lookup-style repository function
- it does not imply mutation, persistence, caching, or recalculation

## Input Contract

Input shape:

- `dealId: string`

Trimming expectations:

- the future repository should defensively trim the incoming id once at the boundary before any canonical read
- the public API should still treat blank or whitespace-only ids as invalid input

Blank-ID behavior:

- blank or whitespace-only ids should return the canonical missing-deal signal without loading dependent data

Malformed-ID ownership:

- route validation owns external HTTP malformed-id rejection
- repository validation owns defensive direct-call blank-id handling

No branded deal-id type should be introduced unless an existing project type already requires it. None does today.

## Success Output Contract

Successful output type:

- `InvestorSummaryViewModel`

Import path:

- `@/types/investor-summary`

Exact type name:

- `InvestorSummaryViewModel`

The repository returns the existing composed read model and does not expose:

- raw SQL rows unnecessarily
- database clients
- internal dependency response wrappers
- unvalidated engine-result JSON
- repository implementation details

## Missing-Deal Contract

Planned missing-deal signal:

- `null`

Why:

- it matches the existing saved-deal detail repository convention
- it is clearly distinct from an infrastructure failure
- it prevents dependent Shield, task, and offer reads from starting
- it lets the future route preserve canonical 404 mapping without inventing a new repository error type

Missing-deal behavior:

- the repository stops immediately
- no extraction runs
- no Shield loading runs
- no task loading runs
- no offer loading runs
- no composition runs
- no partial summary is returned

Distinguishability from infrastructure failure:

- `null` means the saved deal did not exist
- thrown errors mean a repository, loader, or composition failure

## Infrastructure Failure Contract

Failure propagation plan:

- saved-deal repository failure: propagate original error
- Investor Shield loader failure: propagate original error
- task repository failure: propagate original error
- offer repository failure: propagate original error
- composition helper failure: propagate original error

Chosen approach:

- propagate original errors without wrapping them in a new repository error type

Why:

- it is the simplest approach aligned with current repository conventions
- it keeps failure ownership obvious in mocked tests
- it avoids introducing a second error taxonomy before route mapping exists
- it prevents dependency failures from becoming valid empty data

Rules:

- no dependency failure becomes valid empty data
- no partial summary is returned
- no silent retry
- no fallback values
- no raw SQL or secret leakage
- failure ownership remains identifiable in tests
- route-level status mapping remains deferred

## Dependency Injection and Mocking Decision

Selected design direction:

`MODULE MOCKING`

Why:

- current tests in the repository already use `vi.mock(...)` heavily
- it avoids changing the public production signature solely for tests
- it prevents live database access without introducing a dependency object before it is necessary
- it keeps the future repository API simple

How the tests will isolate dependencies:

- mock `@/lib/operator-command/saved-deals-repository`
- mock `@/lib/investor-shield/investor-shield-read-model`
- mock `@/lib/operator-command/deal-tasks-repository`
- mock `@/lib/operator-command/deal-offers-repository`
- mock any future saved-deal extraction helper module
- mock `@/lib/investor-summary/compose-investor-summary-view-model`

How to prevent a new pool or live database access:

- the future repository test imports the orchestrator module after all dependency modules have been mocked
- the repository under test never imports `pg` directly
- `lib/db/postgres.ts` remains owned by the canonical repository modules only

Observation strategy:

- use mock call counts and resolved/rejected values to prove call order and failure ownership
- use module mocks to confirm the repository calls the right dependencies exactly once

## Future Implementation Pseudocode

```text
normalize deal ID

savedDeal = await getSavedDealById(normalizedDealId)

if savedDeal is null:
  return null

extractedValues = extractInvestorSummarySavedDealValues(savedDeal)

shieldPromise = loadAndEvaluateInvestorShield(normalizedDealId)
tasksPromise = listTasksForDeal(normalizedDealId)
offersPromise = listOffersForDeal(normalizedDealId)

[shieldResult, canonicalTasks, canonicalOffers] = await Promise.all([
  shieldPromise,
  tasksPromise,
  offersPromise,
])

preparedShield = narrowShieldResultToInvestorSummaryInput(shieldResult)

return composeInvestorSummaryViewModel({
  savedDeal: extractedValues.savedDeal,
  canonicalValues: extractedValues.canonicalValues,
  investorShield: preparedShield,
  taskRecords: canonicalTasks,
  offerRecords: canonicalOffers,
})
```

Notes:

- `extractInvestorSummarySavedDealValues(...)` is a future pure helper
- `narrowShieldResultToInvestorSummaryInput(...)` is a future pure narrowing step inside the orchestrator boundary
- `composeInvestorSummaryViewModel(...)` remains the existing pure composition helper
- active-task selection and latest-offer selection remain inside the composer

## Selector Ownership

Selector ownership is fixed as follows:

- active-task selector: inside the existing composition helper
- latest-offer selector: inside the existing composition helper
- Shield narrowing from canonical enforcement result to summary input: inside the future repository orchestrator as a pure step
- saved-deal extraction helper: before post-gate reads, inside the future repository orchestration flow

The repository must not reimplement:

- active-task filtering
- latest-offer selection
- Shield status derivation
- recommended-action generation

## Planned Import Boundaries

| Dependency | Planned Import | Purpose | Runtime or Pure | Existing or Future |
| ---------- | -------------- | ------- | --------------- | ------------------ |
| saved-deal loader | `@/lib/operator-command/saved-deals-repository` | confirm deal existence | Runtime | Existing |
| saved-deal extraction helper | `@/lib/investor-summary/extract-saved-deal-values` | pure saved-deal and engine extraction | Pure | Future |
| Shield loader/adapter | `@/lib/investor-shield/investor-shield-read-model` | canonical Shield loading and evaluation | Runtime | Existing |
| task repository | `@/lib/operator-command/deal-tasks-repository` | load canonical task rows | Runtime | Existing |
| active-task selector | `none directly; owned by composeInvestorSummaryViewModel` | selector remains in composer | Pure | Existing |
| offer repository | `@/lib/operator-command/deal-offers-repository` | load canonical offer rows | Runtime | Existing |
| latest-offer selector | `none directly; owned by composeInvestorSummaryViewModel` | selector remains in composer | Pure | Existing |
| composition helper | `@/lib/investor-summary/compose-investor-summary-view-model` | final view-model assembly | Pure | Existing |
| InvestorSummaryViewModel type | `@/types/investor-summary` | return type | Pure type | Existing |

Confirmations:

- no direct import of `pg` is needed
- no raw SQL helper is needed
- `lib/db/postgres.ts` should only remain owned by canonical repositories
- the composer remains pure

## Future Test File Location

Selected future test path:

```text
__tests__/investor-summary-repository.test.ts
```

Why:

- it matches the existing repository test placement convention
- it keeps the future orchestrator tests close to the other root-level repository and route tests

## Future Mocked-Test Structure

### Saved-deal gate

- calls saved-deal loader first
- missing deal stops all dependency calls
- saved-deal query failure stops all dependency calls
- blank or invalid ID follows selected repository behavior

### Successful aggregation

- extraction receives the loaded saved-deal record
- Shield loader receives the verified deal ID
- task repository receives the verified deal ID
- offer repository receives the verified deal ID
- approved loading model is followed
- composition runs exactly once
- returned result equals composer output

### Valid nullable and empty states

- nullable monetary values remain nullable
- valid empty Shield state remains valid
- no tasks remains valid
- no offers remains valid
- no fallback data is invented

### Infrastructure failures

- Shield failure prevents composition
- task failure prevents composition
- offer failure prevents composition
- simultaneous dependency failure prevents composition
- composition helper failure propagates safely
- failed reads are not replaced by empty arrays or unavailable statuses

### Safety

- no mutation repository function is called
- no task creation
- no offer mutation
- no saved-deal update
- no pipeline movement
- no gate satisfaction or waiver
- no raw SQL
- no new `pg.Pool`
- no migration execution
- no live database
- no production route
- no environment dependency in mocked tests

## Mocking and Ordering Assertions

Future tests should prove:

- saved-deal existence completes before dependent reads start
- the selected post-gate loading model is respected
- extraction occurs at the approved placement
- composition waits for all required dependencies
- composition runs only once
- repository ordering for offers is not rewritten
- task selector receives canonical repository records
- no dependency failure results in partial composition

Assertion strategy:

- prefer controlled mock promises and explicit call order assertions
- avoid timer-based strategies
- avoid arbitrary delays

## Implementation Acceptance Criteria

The later implementation phase should not be accepted unless:

1. The exact selected repository function exists.
2. It reuses canonical repositories and selectors.
3. Saved-deal existence is proven first.
4. Missing deals stop all dependent reads.
5. The approved post-gate loading model is followed.
6. No dependency failure produces partial composition.
7. Valid empty states remain valid.
8. The existing composer is called exactly once after successful loading.
9. No deterministic values are recalculated.
10. No raw SQL or new pool is introduced.
11. Tests use mocks only.
12. Full build, lint, and test suite pass.
13. `.gitignore` remains untouched.
14. No production or live database access occurs.

## Deferred to Phase 4F-3A-3D-1

Explicitly defer:

- repository implementation
- extraction-helper implementation
- Shield adapter implementation if still future
- test implementation
- concrete mocks
- runtime error classes
- API route
- HTTP status mapping
- UI
- production proof
- performance measurement

## Explicit Non-Implementation

This document does not:

- change runtime code
- change types
- create a repository
- create an extractor
- create a Shield adapter
- create tests
- create mocks
- call any repository function
- access any database
- write SQL
- create a new pool
- add transaction code
- add an API route
- add UI
- modify page integration
- modify migrations
- change environment settings
- call a production route
- recalculate deterministic outputs
- change Investor Shield behavior
- touch `.gitignore`

## Verdict

`PHASE 4F-3A-3C COMPLETE - READY FOR PHASE 4F-3A-3D-1`

## Recommended Next Step

`Phase 4F-3A-3D-1 - Investor Summary Repository Function and Mocked Tests`
