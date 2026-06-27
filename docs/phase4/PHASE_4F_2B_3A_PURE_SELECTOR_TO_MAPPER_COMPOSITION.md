# Phase 4F-2B-3A Pure Selector-to-Mapper Composition

## Purpose
Create a pure orchestration boundary that wires prepared canonical inputs through the active-task selector, the latest-offer selector, and the existing Investor Summary mapper.

This phase adds no repository aggregation, no JSON parsing, no API, and no UI.

## Files Created or Changed

- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `__tests__/investor-summary-composition.test.ts`
- `docs/phase4/PHASE_4F_2B_3A_PURE_SELECTOR_TO_MAPPER_COMPOSITION.md`

## Existing Helpers Reused

- active-task selector: `selectActiveInvestorSummaryTasks(...)`
- latest-offer selector: `selectLatestInvestorSummaryOffer(...)`
- Investor Summary mapper: `mapInvestorSummaryViewModel(...)`

## Composition Input Boundary

The helper accepts:

- already-prepared saved-deal summary values
- already-extracted GDV values
- already-extracted True MAO values
- canonical Investor Shield summary values
- persisted next action
- Shield fallback recommendation title
- `readonly DealTaskRecord[]`
- `readonly DealOfferRecord[]`

The helper does not accept:

- database clients
- repository functions
- raw saved-deal database rows that still require JSON parsing
- raw Investor Shield evidence/check rows
- environment variables
- request or response objects

## Composition Flow

`task rows -> active-task selector`

`offer rows -> latest-offer selector`

`prepared values + selector outputs -> mapper`

## Task Delegation

Task filtering is delegated entirely to `selectActiveInvestorSummaryTasks(...)`.

- no task-status logic is duplicated
- no completed/cancelled filtering is reimplemented here
- no task sorting is reimplemented here
- no task deduplication is reimplemented here

## Offer Delegation

Offer selection is delegated entirely to `selectLatestInvestorSummaryOffer(...)`.

- no timestamp comparison is duplicated here
- no sorting is reimplemented here
- no highest-amount policy is reimplemented here
- no status filtering is reimplemented here

## Mapper Delegation

Final view-model construction is delegated entirely to `mapInvestorSummaryViewModel(...)`.

- no monetary mapping is duplicated here
- no GDV mapping is duplicated here
- no True MAO mapping is duplicated here
- no Investor Shield mapping is duplicated here
- no blocked-gate copying is duplicated here
- no missing-evidence mapping is duplicated here
- no recommended-action precedence is duplicated here

## Purity and Immutability

- no I/O
- no environment access
- no database access
- no mutation of task records
- no mutation of offer records
- no mutation of prepared canonical input objects
- deterministic for identical inputs

## Tests Added

- complete prepared input produces the expected complete Investor Summary view model
- active-task selector output is reflected in the final view model
- complete and cancelled tasks are absent from the final active-task collection
- task input order is preserved after terminal tasks are removed
- first supplied offer becomes the final latest offer
- highest offer is not selected when it is not first
- empty task input produces an empty active-task collection
- empty offer input produces `latestOffer: null`
- persisted next action still takes precedence over Shield fallback
- Shield fallback still applies when persisted next action is absent
- explicit unavailable action still applies when both actions are absent
- input task array and records are not mutated
- input offer array and records are not mutated
- other prepared input objects are not mutated

## Deferred to Phase 4F-2B-3B

- malformed or partial prepared-input edge cases
- unusual numeric boundaries
- broader missing-state combinations
- selector/mapper regression matrix
- repository aggregation
- engine-result parsing
- API
- UI
- production integration

## Explicit Non-Implementation

- no database access
- no repository
- no engine JSON parsing
- no Shield evaluation
- no task persistence
- no offer persistence
- no API route
- no UI
- no page integration
- no migration
- no SQL
- no production change
- no deterministic recalculation
- no selector-rule change
- no mapper-rule change

## Acceptance Conditions

1. Pure composition helper created. Pass.
2. Existing active-task selector reused. Pass.
3. Existing latest-offer selector reused. Pass.
4. Existing mapper reused. Pass.
5. No selector logic duplicated. Pass.
6. No mapper logic duplicated. Pass.
7. No database or repository dependency. Pass.
8. No engine JSON parsing. Pass.
9. Correct active tasks reach final view model. Pass.
10. Correct latest offer reaches final view model. Pass.
11. Recommended-action precedence remains unchanged. Pass.
12. Empty tasks and offers map safely. Pass.
13. Inputs are not mutated. Pass.
14. Focused composition tests pass. Pending validation.
15. Full build/lint/test suite passes. Pending validation.

## Verdict

`PHASE 4F-2B-3A COMPLETE — READY FOR PHASE 4F-2B-3B`

## Recommended Next Step

`Phase 4F-2B-3B — Mapper and Composition Edge-Case Closure`
