# Phase 4F-2A Pure Canonical Investor Summary Mapper

## Purpose
Create a deterministic, read-only mapper that turns already-prepared canonical Investor Summary inputs into the Phase 4F view model.

This phase adds no repository access, no JSON parsing, no selector logic, no UI, and no production integration.

## Files Created or Changed

- `lib/investor-summary/map-investor-summary-view-model.ts`
- `__tests__/investor-summary-mapper.test.ts`
- `docs/phase4/PHASE_4F_2A_PURE_CANONICAL_INVESTOR_SUMMARY_MAPPER.md`

## Mapper Input Boundary

The mapper accepts only already-prepared canonical data:

- saved-deal identity and persisted values
- canonical GDV range values
- canonical True MAO values
- canonical Investor Shield summary values
- already-selected active task summaries
- already-selected latest offer or `null`

The mapper input does not include repository access, raw engine JSON, task selection rules, or offer ordering rules.

## Mapper Output

The mapper returns `InvestorSummaryViewModel` exactly as defined in `types/investor-summary.ts`.

Returned sections:

- `deal`
- `purchasePrice`
- `gdvRange`
- `trueMao`
- `capitalProtectionState`
- `classification`
- `investorShield`
- `activeTasks`
- `latestOffer`
- `recommendedNextAction`

## Monetary Mapping

- `purchasePrice` is copied as-is.
- `gdvRange.downside`, `gdvRange.realistic`, and `gdvRange.strong` are copied independently.
- `trueMao.fifteenPercent`, `trueMao.twentyPercent`, and `trueMao.twentyFivePercent` are copied independently.
- Missing monetary values remain `null`.
- No recalculation, fallback, reordering, or inferred range logic is performed.

## Investor Shield Mapping

- The canonical `overallStatus` is preserved.
- The canonical `missingEvidenceCount` is preserved.
- Already-resolved `blockedGates` are copied through.
- Empty blocked-gate arrays remain empty arrays.
- No Shield reevaluation runs here.
- No advisory-to-blocker conversion happens here.

## Task and Offer Boundaries

- `activeTasks` are already selected before the mapper runs.
- `latestOffer` is already selected before the mapper runs.
- The mapper does not filter tasks.
- The mapper does not sort tasks.
- The mapper does not deduplicate tasks.
- The mapper does not select the latest offer.
- The mapper does not compare offer timestamps.

## Recommended Action Precedence

1. Use the persisted next action when it is non-empty after trimming.
2. Otherwise use the canonical Shield fallback title when it is non-empty after trimming.
3. Otherwise return the explicit unavailable action state.

Normalization is limited to surrounding whitespace trimming.

## Existing Investor Summary Engine Decision

- Decision: `REUSE PARTIALLY`
- File: `lib/engine/intelligence/investor-summary-engine.ts`
- Result: not reused as the authoritative mapper.

Reason:

- it is a phase-2 summary helper, not a Phase 4F read-model mapper
- it does not expose the new Phase 4F contract directly
- it consumes a different input shape and performs summary-generation behavior that is outside this phase

## Purity and Immutability

- The mapper performs no I/O.
- The mapper performs no database access.
- The mapper performs no network access.
- The mapper performs no environment access.
- The mapper mutates none of its inputs.
- The mapper returns fresh output objects and arrays for the mapped sections.

## Tests Added

- complete canonical input maps to the complete fixture
- nullable monetary values stay `null`
- persisted next action wins over Shield fallback
- Shield fallback is used when persisted action is absent
- explicit unavailable action is used when both are absent
- empty blocked gates remain empty
- empty active tasks remain empty
- latest offer remains `null` when absent
- inputs are not mutated

## Deferred to Phase 4F-2B

- malformed persisted JSON handling
- active-task filtering rules
- offer-selection ordering
- duplicate task handling
- unusual Shield states
- broader boundary tests

## Explicit Non-Implementation

- no repository
- no database access
- no JSON parsing
- no task selector
- no offer selector
- no API route
- no UI
- no page integration
- no migration
- no production change
- no deterministic recalculation
- no Shield reevaluation

## Acceptance Conditions

1. Pure mapper created. Pass.
2. Canonical Phase 4F view model returned. Pass.
3. No I/O or database dependency. Pass.
4. No engine JSON parsing. Pass.
5. Monetary nulls preserved. Pass.
6. No True MAO or GDV calculation. Pass.
7. Canonical Shield status preserved. Pass.
8. Blocked gates not recalculated. Pass.
9. Tasks accepted as already selected. Pass.
10. Latest offer accepted as already selected. Pass.
11. Recommended-action precedence implemented exactly. Pass.
12. Inputs not mutated. Pass.
13. Narrow mapper tests pass. Pass.
14. Full build/lint/test suite passes. Pass.

## Verdict

`PHASE 4F-2A COMPLETE — READY FOR PHASE 4F-2B`

## Recommended Next Step

`Phase 4F-2B — Investor Summary Selectors and Mapper Edge-Case Tests`
