# Phase 4F-3A-3B-2 Post-Gate Concurrency and Read Consistency Plan

## Purpose

Define how the future Investor Summary repository should load canonical Investor Shield, task, and offer dependencies after saved-deal existence has been proven.

This phase is inspection and documentation only. No repository, extractor, adapter, SQL, API, UI, or test code is added.

## Repository Baseline

- Branch: `main`
- `HEAD`: `32708dfa5390ece449be11a4442f3546d950e6e1`
- `origin/main`: `32708dfa5390ece449be11a4442f3546d950e6e1`
- `origin`: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing unstaged `.gitignore` modification

## Files Inspected

- `docs/phase4/PHASE_4F_3A_1_SAVED_DEAL_AND_ENGINE_RESULT_EXTRACTION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2A_CANONICAL_INVESTOR_SHIELD_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_1_CANONICAL_DEAL_TASK_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_2_CANONICAL_DEAL_OFFER_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_3A_INVESTOR_SUMMARY_REPOSITORY_AGGREGATION_CONTRACT.md`
- `docs/phase4/PHASE_4F_3A_3B_1_SAVED_DEAL_EXISTENCE_GATE_AND_DEPENDENCY_SEQUENCE.md`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/db/postgres.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `__tests__/saved-deals-repository.test.ts`
- `__tests__/saved-deals-api-detail-route.test.ts`
- `__tests__/deal-tasks-repository.test.ts`
- `__tests__/deal-offers-repository.test.ts`
- `__tests__/investor-shield-read-model.test.ts`

## Existence Gate Preserved

Locked sequence:

```text
deal ID
-> load canonical saved deal
-> stop if missing or failed
-> only then begin dependent loading
```

No Shield, task, or offer query may begin before the saved-deal existence check succeeds.

This phase only decides what happens after that gate.

## Post-Gate Dependency Independence Matrix

| Dependency | Required Input | Depends on Another Post-Gate Result | Read Only | Valid Empty State | Failure Stops Composition |
| ---------- | -------------- | ----------------------------------: | --------: | ----------------: | ------------------------: |
| Canonical Investor Shield loading | `dealId: string` | No | Yes | Yes, an empty canonical Shield persistence set still yields a canonical Shield result | Yes |
| Canonical task loading | `dealId: string` | No | Yes | Yes | Yes |
| Canonical offer loading | `dealId: string` | No | Yes | Yes | Yes |

Each dependency is independent after the saved-deal gate. None needs the output of another post-gate dependency.

## Selected Loading Model

`CONCURRENT AFTER EXISTENCE GATE`

## Loading Model Rationale

The post-gate reads are independent:

- Shield loading uses only the verified deal id and Shield persistence rows
- task loading uses only the verified deal id and task persistence rows
- offer loading uses only the verified deal id and offer persistence rows

No post-gate dependency requires another post-gate dependency's output.

Why concurrent loading is the intended model:

- it matches the actual repository boundaries
- it avoids unnecessary cumulative latency for independent reads
- it preserves a clear existence-first gate
- it keeps failure ownership explicit because each dependency still has its own repository boundary
- it does not require a transaction to establish a point-in-time snapshot for the first implementation

Why not sequential:

- sequential loading would serialize three independent reads without any correctness gain for this read-only summary
- no repository contract says Shield must be loaded before tasks or offers
- no repository contract says tasks must be loaded before offers

Why not hybrid:

- hybrid is unnecessary because no post-gate dependency depends on another post-gate result

## Dependency Failure Semantics

The future aggregator must never compose a partial summary after an infrastructure failure.

Required behavior:

- Shield loader rejection: stops aggregation; does not become empty or safe Shield data
- task repository rejection: stops aggregation; does not become no tasks
- offer repository rejection: stops aggregation; does not become no offers
- more than one dependency rejecting: stops aggregation; no partial result is produced
- extraction failure before dependent loading: stops aggregation before any post-gate reads are treated as complete
- composition helper failure after successful reads: stops aggregation; no summary is returned

Valid empty results remain valid:

- empty Shield persistence set still yields the canonical empty Shield state
- no tasks is a valid empty state
- no offers is a valid empty state

The aggregator must not silently retry dependencies and must not mutate state while handling failures.

## Promise Aggregation Decision

Selected pattern:

`Promise.all`

Why:

- it fits the independent post-gate dependencies
- it rejects when any required dependency rejects
- it preserves the no-partial-summary rule
- it keeps the simplest ownership model for mocked tests
- it avoids carrying multiple settlement objects when the only acceptable success state is full success

Why not `Promise.allSettled`:

- it would expose per-dependency results, but the aggregator must not use that to produce a partial summary
- it adds extra settlement handling without improving the canonical success path
- it is only useful if we want to classify all concurrent failures separately in the future, which is not required for the first implementation

Conceptual future use:

```text
begin post-gate Shield, task, and offer reads together
-> wait for all required reads to succeed
-> compose once
-> return the read-only result
```

If any post-gate dependency rejects, the aggregate read fails.

## Read-Consistency Assessment

The Investor Summary is:

- a live operational read model
- not a financial ledger snapshot
- not a mutation workflow
- not a legally immutable record

First-implementation consistency level:

`NORMAL READ-COMMITTED REPOSITORY READS`

Why this is proportionate:

- the summary is read-only
- the current repository contracts already use ordinary pooled queries
- no current contract requires one exact cross-table snapshot for the first repository implementation
- minor drift between reads is acceptable because the aggregator must not invent or recalculate values
- the summary should reflect canonical persisted data, but not at the cost of overengineering snapshot control before a runtime need is proven

Potential drift:

- saved-deal data, Shield rows, tasks, or offers may change between reads
- concurrent updates may cause the final summary to reflect slightly different database moments

That drift must not:

- change the canonical meaning of missing versus failed states
- create fallback values
- recalculate deterministic outputs
- reinterpret Shield, task, or offer semantics

## Transaction Decision

First implementation:

`avoid a transaction`

Why ordinary read consistency is acceptable:

- the repository is read-only
- the post-gate reads are independent
- the summary is an operational view, not an immutable audit artifact
- using a transaction would require broader repository changes or connection injection without a proven correctness need

Minor drift that may occur:

- dependent reads may observe slightly different moments of the database
- a task or offer could change after the saved-deal gate succeeds

Why that drift must not cause recalculation or invented values:

- each dependency still returns canonical persisted rows or canonical failure
- no summary field may be synthesized from failed reads
- no fallback data may be introduced to hide drift

When stronger snapshot semantics would become necessary:

- signed investor-pack archival
- audit-grade immutable snapshots
- offer submission based on one exact version
- regulatory or legal record generation
- persisted summary versions

## Shared Adapter and Connection Ownership

Confirmed principles:

- the future aggregator must reuse existing repositories
- no second `pg.Pool`
- no raw SQL in the aggregator
- no connection ownership should leak into the composition helper
- no database client should be passed into pure extraction or composition functions

Current repository signatures support the selected consistency model as-is:

`SUPPORTED AS-IS`

Reason:

- each repository already exposes a simple `Promise<rows>` read function keyed by `dealId`
- `Promise.all` can call those functions after the existence gate without signature changes
- no transaction-scoped client is required for the first implementation

## Post-Gate Execution Sequence

```text
1. Receive deal ID
2. Load canonical saved deal
3. Stop if missing or failed
4. Purely extract saved-deal and engine-result values
5. Begin Shield, task, and offer reads together
6. Confirm every required read succeeded
7. Pass prepared values and canonical records to composition
8. Return InvestorSummaryViewModel
```

This sequence preserves the existence gate and uses concurrent post-gate reads.

## Consistency and Failure Matrix

| Scenario | Valid Result | Stop Aggregation | Compose Summary | Notes |
| -------- | -----------: | ---------------: | --------------: | ----- |
| saved deal missing | No | Yes | No | canonical not-found signal only |
| saved-deal query failure | No | Yes | No | infrastructure failure |
| extraction returns nullable monetary values | Yes | No | Yes | valid nullable state |
| Shield valid empty state | Yes | No | Yes | canonical empty Shield result still valid |
| Shield failure | No | Yes | No | must not become safe/unavailable Shield data |
| no tasks | Yes | No | Yes | valid empty collection |
| task-query failure | No | Yes | No | must not become empty tasks |
| no offers | Yes | No | Yes | valid empty collection |
| offer-query failure | No | Yes | No | must not become empty offers |
| one dependency fails during concurrent loading | No | Yes | No | no partial composition |
| multiple dependencies fail during concurrent loading | No | Yes | No | no partial composition |
| all dependencies succeed | Yes | No | Yes | single successful composition |
| composition helper throws unexpectedly | No | Yes | No | aggregate fails after successful reads |
| records change between dependency reads | Yes | No | Yes | live read model may drift; no invented values |

## Cancellation Expectations

Cancellation:

`NOT REQUIRED`

Why:

- ordinary JavaScript promise concurrency does not automatically cancel in-flight database work
- the first implementation does not require query cancellation to preserve correctness
- already-started read-only queries completing is acceptable if no mutation occurs
- cancellation can be revisited later if runtime measurements or resource pressure justify it

## Future Mocked-Test Expectations

Planned future tests should prove:

1. Saved-deal lookup completes before dependent reads start.
2. Missing deal starts no dependent reads.
3. Saved-deal query failure starts no dependent reads.
4. The selected concurrent model is followed after the existence gate.
5. Extraction receives the already-loaded saved-deal record.
6. Valid nullable monetary fields do not stop dependency loading.
7. Empty Shield behavior follows the canonical Shield contract.
8. No tasks is valid.
9. No offers is valid.
10. Shield failure prevents composition.
11. Task failure prevents composition.
12. Offer failure prevents composition.
13. Multiple dependency failures do not produce partial composition.
14. Composition runs exactly once after all dependencies succeed.
15. No mutation repository function is called.
16. No new pool is constructed.
17. No live database is required.
18. Repeated fixture input produces structurally identical output.
19. Concurrent execution does not alter canonical repository ordering.
20. The summary contains no invented fallback data after dependency failure.

## Unnecessary Complexity Rejected

Reject unless actual evidence requires them:

- serializable transactions for the initial read-only summary
- database locks
- advisory locks
- retry loops inside the aggregator
- event sourcing
- summary persistence
- cache invalidation systems
- distributed transactions
- cross-service orchestration
- cancellation infrastructure
- repository rewrites solely to share one connection
- partial-success summaries
- fallback data after infrastructure failure

## Deferred to Phase 4F-3A-3C

Explicitly defer:

- repository implementation
- exact function signature
- mocking framework and module structure
- concrete error classes or result unions
- route HTTP mapping
- runtime performance measurement
- production database proof

## Explicit Non-Implementation

This document does not:

- change runtime code
- change types
- create a repository
- create an extractor
- create an adapter
- create tests
- call any repository function
- access any database
- write SQL
- add transaction code
- add an API route
- add UI
- modify page integration
- modify migrations
- change environment settings
- call a production route
- recalculate deterministic outputs
- change Investor Shield behavior
- change `.gitignore`

## Verdict

`PHASE 4F-3A-3B-2 COMPLETE - READY FOR PHASE 4F-3A-3C`

## Recommended Next Step

`Phase 4F-3A-3C - Investor Summary Repository Function and Mocked-Test Design`
