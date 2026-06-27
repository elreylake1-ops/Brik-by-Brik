# Phase 4F-3A-2A Canonical Investor Shield Loading Plan

## Purpose

Document the canonical Investor Shield source layer and current loading flow needed by the future Phase 4F Investor Summary loader.

This phase is inspection-only. No loader, repository, API, UI, or database query is added.

## Repository Baseline

- Branch: `main`
- `HEAD`: `b140842743877dcdb2f73825a1e48c974a899ef2`
- `origin/main`: `b140842743877dcdb2f73825a1e48c974a899ef2`
- `origin`: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- Dirty state before work: only the pre-existing unstaged `.gitignore` modification

## Files Inspected

- `docs/phase4/PHASE_4F_0C_CANONICAL_INVESTOR_SUMMARY_FIELD_MAPPING.md`
- `docs/phase4/PHASE_4F_1A_CANONICAL_INVESTOR_SUMMARY_TYPE_CONTRACTS.md`
- `docs/phase4/PHASE_4F_2A_PURE_CANONICAL_INVESTOR_SUMMARY_MAPPER.md`
- `docs/phase4/PHASE_4F_2B_3A_PURE_SELECTOR_TO_MAPPER_COMPOSITION.md`
- `docs/phase4/PHASE_4F_2B_3B_2_COMPOSITION_EDGE_CASE_CLOSURE.md`
- `docs/phase4/PHASE_4F_3A_1_SAVED_DEAL_AND_ENGINE_RESULT_EXTRACTION_PLAN.md`
- `types/investor-summary.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `types/investor-shield.ts`
- `types/investor-shield-enforcement.ts`
- `types/investor-shield-ui.ts`
- `lib/investor-shield/evaluate-investor-shield.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/investor-shield/load-investor-shield-ui-model.ts`
- `lib/investor-shield/map-investor-shield-ui-view-model.ts`
- `lib/investor-shield/investor-shield-ui-adapter.ts`
- `lib/investor-shield/fetch-investor-shield-ui-model.ts`
- `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
- `lib/investor-shield/investor-shield-repository.ts`
- `lib/investor-shield/default-gates.ts`
- `__tests__/investor-shield-read-model.test.ts`
- `__tests__/investor-shield-ui-adapter.test.ts`
- `__tests__/investor-shield-ui-route.test.ts`

## Current Phase 4F Shield Input Requirements

The current composition helper expects:

```text
InvestorSummaryCompositionInput
```

with these Shield-related values:

- `investorShield.overallStatus`
- `investorShield.missingEvidenceCount`
- `investorShield.blockedGates`
- `investorShield.fallbackRecommendedActionTitle`

The composition helper still delegates the actual task and offer selection to the existing selectors, then passes the prepared Shield input to the mapper.

## Canonical Shield Contracts

| Canonical concept | Current canonical source | Exact property/path | Notes for Phase 4F |
| --- | --- | --- | --- |
| Overall Shield status | Enforcement result | `InvestorShieldEnforcementResult.overallStatus` | Canonical values are `CLEAR`, `CAUTION`, `BLOCKED`. No unavailable/loading/error state exists in the canonical type. |
| Missing-evidence gate keys | Enforcement result | `InvestorShieldEnforcementResult.missingEvidenceGateKeys` | This is the canonical count source for the Phase 4F mapper via `missingEvidenceGateKeys.length`. |
| Blocking gate keys | Enforcement result | `InvestorShieldEnforcementResult.blockingGateKeys` | Preserved in evaluator order. |
| Gate titles/labels | Default gate registry, then UI gate summaries | `INVESTOR_SHIELD_DEFAULT_GATES[].label`, surfaced as `InvestorShieldGateUiSummary.label` | The registry is the canonical label source. The UI model only carries it forward. |
| Blocker reasons | Enforcement result + UI summary derivation | `InvestorShieldTaskRecommendation.reason`; derived UI field `InvestorShieldGateUiSummary.shortExplanation` | For a future loader, prefer the evaluator's reason text rather than a display-only wrapper. |
| Required/advisory classification | Default gate registry, then UI gate summaries | `INVESTOR_SHIELD_DEFAULT_GATES[].required`, surfaced as `InvestorShieldGateUiSummary.requiredLabel` and `advisoryOnly` | Required/advisory is canonical in the gate registry, not in the display layer. |
| Waiver state | Check rows + manual override rows, surfaced by UI adapter | `InvestorShieldCheck.status === "WAIVED"` and `ManualOverride.reason`, surfaced as `InvestorShieldGateUiSummary.waiverReason` | Waiver state is canonical in the Shield records and evaluation flow; the UI adapter only exposes it. |
| Shield recommendation title | Enforcement result task recommendation | `InvestorShieldEnforcementResult.taskRecommendations[0].title` | Recommendations are emitted in default-gate order. A single fallback title should use the first canonical recommendation title if one is needed. |
| Gate ordering | Default gate registry, then evaluator loop order | `INVESTOR_SHIELD_DEFAULT_GATES` order | The evaluator preserves this order when building blocking, missing-evidence, and recommendation arrays. |

## Current Shield Loading Pipeline

| Step | File path | Exported function | Input type | Output type | DB access | Evaluation | Display-only transformation | Phase 4F reuse classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `lib/operator-command/saved-deals-repository.ts` | `getSavedDealById(id)` | `string` | `SavedDealRecord | null` | Yes | No | No | `REUSE AS INPUT SOURCE` |
| 2 | `lib/investor-shield/investor-shield-repository.ts` | `listInvestorShieldChecksByDealId`, `listEvidenceItemsByDealId`, `listRiskFlagsByDealId`, `listManualOverridesByDealId` | `dealId: string` | `readonly Shield rows[]` | Yes | No | No | `REUSE AS INPUT SOURCE` |
| 3 | `lib/investor-shield/investor-shield-read-model.ts` | `loadInvestorShieldEvaluationInput(dealId, options)` | `dealId`, optional deterministic status / time | `InvestorShieldEvaluationInput` | Yes | No | No | `REUSE DIRECTLY` |
| 4 | `lib/investor-shield/evaluate-investor-shield.ts` | `evaluateInvestorShield(input)` | `InvestorShieldEvaluationInput` | `InvestorShieldEnforcementResult` | No | Yes | No | `REUSE DIRECTLY` |
| 5 | `lib/investor-shield/load-investor-shield-ui-model.ts` | `loadInvestorShieldUiModelForDeal(dealId, options)` | `dealId`, optional deterministic status / time | `InvestorShieldUiModel` | Yes | Yes | Partial | `REUSE PARTIALLY` |
| 6 | `lib/investor-shield/investor-shield-ui-adapter.ts` | `buildInvestorShieldUiModel(input)` | read-model + enforcement result | `InvestorShieldUiModel` | No | No | Yes | `REUSE PARTIALLY` |
| 7 | `lib/investor-shield/map-investor-shield-ui-view-model.ts` | `mapInvestorShieldUiViewModel(input)` | UI model + deal context | `InvestorShieldUiViewModel` | No | No | Yes | `DO NOT USE` |
| 8 | `lib/investor-shield/fetch-investor-shield-ui-model.ts` | `fetchInvestorShieldUiModel(dealId)` | `string` | network result | No | No | Yes | `DO NOT USE` |
| 9 | `app/api/saved-deals/[id]/investor-shield-ui/route.ts` | `GET(...)` | route params | safe JSON response | Yes | Indirectly | Yes | `DO NOT USE` |

Current route behavior:

- the saved-deal UI route loads the saved deal row first
- then it calls `loadInvestorShieldUiModelForDeal`
- that helper loads the Shield read model and evaluates it on each request
- the UI fetcher then consumes the route response

## Authoritative Source-Layer Decision

Chosen canonical source layer for Phase 4F:

`InvestorShieldEnforcementResult`

Why:

- it is the most canonical non-display Shield output currently produced by the codebase
- it directly owns `overallStatus`, `blockingGateKeys`, `missingEvidenceGateKeys`, `manualOverrideRequired`, and `taskRecommendations`
- it is produced by the single existing evaluator, `evaluateInvestorShield(...)`
- it avoids depending on UI formatting for canonical Shield state
- it avoids creating a second evaluator

What still comes from the gate registry:

- gate labels
- required/advisory classification
- canonical gate ordering

What should not be treated as authoritative:

- `InvestorShieldUiModel` and `InvestorShieldUiViewModel` are display-oriented layers
- `mapInvestorShieldUiViewModel(...)` is not a source of canonical Shield semantics

## Evaluation Reuse Decision

Evaluation is required during loading.

Current canonical behavior:

```text
loadInvestorShieldEvaluationInput(dealId)
-> evaluateInvestorShield(input)
```

The existing `loadInvestorShieldUiModelForDeal(...)` helper already follows that pattern, but it adds UI-specific mapping afterwards.

Phase 4F should reuse the canonical evaluator path and not introduce a second evaluator.

## Persistence Sources

| Source | Repository/Loader | Deal link | Required for which output | Missing-source behavior |
| --- | --- | --- | --- | --- |
| `saved_deals` | `lib/operator-command/saved-deals-repository.ts:getSavedDealById` | `id` | Deal existence, and `governance_state` if deterministic status is passed into Shield evaluation | Missing deal should remain a repository-level 404 case. |
| `investor_shield_checks` | `listInvestorShieldChecksByDealId` | `deal_id` | Overall status, blocking/missing-evidence gate keys, recommendation generation | Missing rows currently become an empty input to the evaluator, not an unavailable Shield state. |
| `evidence_items` | `listEvidenceItemsByDealId` | `deal_id` | Overall status, missing-evidence logic, advisory warnings, gate sufficiency | Missing rows currently become an empty input to the evaluator. |
| `risk_flags` | `listRiskFlagsByDealId` | `deal_id` | Fatal-risk and caution escalation | Missing rows currently become an empty input to the evaluator. |
| `manual_overrides` | `listManualOverridesByDealId` | `deal_id` | Waiver handling and manual-override-required behavior | Missing rows currently become an empty input to the evaluator. |
| default gate registry | `lib/investor-shield/default-gates.ts` | code registry | Gate order, labels, required/advisory classification, default severities, evidence types | Missing registry data is a code defect, not a runtime state. |

Not required for the current canonical Shield result path:

- builder proposal rows
- builder contract check rows

Those tables exist in the repository but are not part of the current `loadInvestorShieldEvaluationInput(...)` contract.

## Overall-Status Loading

Canonical type:

- `InvestorShieldEnforcementResult.overallStatus`

Allowed values:

- `CLEAR`
- `CAUTION`
- `BLOCKED`

Unavailable/loading/error:

- not represented in the canonical type
- missing Shield data should not be coerced into a "safe" status
- the UI adapter only translates `undefined` into a blocked display state, which is a presentation fallback, not canonical Shield semantics

Current behavior:

- the evaluator returns a valid overall status from the loaded rows
- the current loader reconstructs Shield state on each request
- there is no persisted enforcement-result row to read back

## Missing-Evidence Count Loading

Locked source:

```text
missingEvidenceGateKeys.length
```

Canonical property:

- `InvestorShieldEnforcementResult.missingEvidenceGateKeys`

Behavior:

- keys are deduplicated by the evaluator
- ordering follows `INVESTOR_SHIELD_DEFAULT_GATES`
- missing-evidence keys include the gates the evaluator classifies as missing or insufficient evidence
- waived gates are excluded from `missingEvidenceGateKeys` unless some other canonical condition separately adds them
- required and caution gates can both appear if the evaluator classifies them as missing evidence
- the count is not derived from raw Evidence Lite notes or raw evidence-row counts

## Blocked-Gate Loading

Locked source:

```text
blockingGateKeys
```

Canonical property:

- `InvestorShieldEnforcementResult.blockingGateKeys`

Behavior:

- keys are deduplicated by the evaluator
- ordering follows `INVESTOR_SHIELD_DEFAULT_GATES`
- advisory gates are not promoted to hard blockers unless the evaluator explicitly does so through canonical rules
- waived gates do not become blocked-gate entries just because a task or evidence note exists
- blocked tasks must not create blocked Shield gates

For the future Phase 4F blocked-gate summary contract:

- gate key should come from the canonical blocking key list
- label should come from the gate registry
- blocker reason should come from the canonical task recommendation or evaluator-derived gate explanation
- required/advisory classification should come from the gate registry

## Shield Recommendation Fallback

Canonical recommendation source:

- `InvestorShieldEnforcementResult.taskRecommendations`

Preferred single-title fallback rule for Phase 4F:

- use the first canonical recommendation title if a single Shield fallback title is required
- do not concatenate titles
- do not use task titles from outside the canonical recommendation list

Current canonical order:

- evaluator emits task recommendations while iterating `INVESTOR_SHIELD_DEFAULT_GATES`
- therefore the first recommendation is the earliest canonical blocker/review recommendation

Current UI adapter behavior:

- it preserves all task recommendations as UI task recommendation items
- it does not redefine the canonical recommendation order

## Proposed Phase 4F Shield Loading Boundary

Proposed future responsibility:

```text
deal ID
-> existing canonical Shield loader/read model
-> InvestorShieldEnforcementResult
-> narrow Phase 4F Shield input
```

Recommended flow:

- reuse the existing Shield repository loaders
- reuse `loadInvestorShieldEvaluationInput(...)`
- reuse the one canonical evaluator, `evaluateInvestorShield(...)`
- map the enforcement result plus gate registry into the narrow Phase 4F Shield input

Do not:

- create a second evaluator
- use the UI view model as the canonical source
- infer blockers from tasks
- infer safety from Evidence Lite
- mutate Shield rows

## Missing Deal Versus Missing Shield Data

Saved deal not found:

- repository-level missing record
- should remain the canonical safe 404 case

Saved deal exists but no Shield persistence rows exist:

- current canonical code does not special-case this as "unavailable"
- the read model simply returns empty arrays
- the evaluator then produces a canonical result from that empty input
- Phase 4F should not invent a new unavailable status for this case unless a later contract change proves it is required

Partial Shield persistence rows:

- current canonical loader still evaluates whatever rows exist
- missing supporting rows do not stop the evaluator from returning a result

Database/query failure:

- repository/route error boundary
- not equivalent to a valid Shield state

## Error and Observability Ownership

- database failures: repository layer and route diagnostics
- missing deal: repository layer, then HTTP 404
- missing Shield persistence: canonical read-model/evaluator path, not a special UI state
- canonical evaluation failures: Shield evaluation layer
- safe external error response: API route
- internal diagnostics: route and repository boundaries
- unavailable summary presentation: UI layer only

## Existing Functions to Reuse

`REUSE DIRECTLY`

- `loadInvestorShieldEvaluationInput(...)`
- `evaluateInvestorShield(...)`

`REUSE AS INPUT SOURCE`

- `getSavedDealById(...)`
- `listInvestorShieldChecksByDealId(...)`
- `listEvidenceItemsByDealId(...)`
- `listRiskFlagsByDealId(...)`
- `listManualOverridesByDealId(...)`

`REUSE PARTIALLY`

- `loadInvestorShieldUiModelForDeal(...)`
- `buildInvestorShieldUiModel(...)`

`DO NOT USE`

- `mapInvestorShieldUiViewModel(...)`
- `fetchInvestorShieldUiModel(...)`
- `app/api/saved-deals/[id]/investor-shield-ui/route.ts`

## Functions or Layers Not to Use

- `mapInvestorShieldUiViewModel(...)` for canonical Shield loading
- the route response as a source of canonical Shield semantics
- the UI fetcher as a source of canonical Shield state
- Evidence Lite notes or counts as a substitute for canonical Shield data
- a second evaluator

## Future Test Matrix

1. Complete canonical Shield result.
2. Overall status preserved.
3. Missing-evidence count equals canonical key count.
4. Valid zero count preserved.
5. Blocking gate order preserved.
6. Gate keys map to canonical titles and reasons.
7. Advisory gates are not promoted to hard blockers.
8. Waived gates follow canonical behavior.
9. Shield fallback recommendation selected canonically.
10. Persisted next action remains outside this adapter's responsibility.
11. Missing Shield rows handled according to current canonical behavior.
12. Partial persistence rows handled safely.
13. Database failure is not converted to a safe Shield status.
14. Inputs and canonical result not mutated.
15. No Evidence Lite record-count logic introduced.
16. No duplicate evaluator introduced.

## Risks and Unresolved Items

- The current saved-deal UI route does not pass `deterministicDealStatus` into `loadInvestorShieldUiModelForDeal(...)`; that path is display-oriented and should not be treated as the definitive canonical source for deterministic rejection dominance.
- The canonical evaluator is proven, but a future Phase 4F loader still needs a narrow adapter to convert enforcement output plus gate registry into the exact Investor Summary Shield input shape.
- The current code does not represent "unavailable" in the canonical Shield result type; that remains a higher-level loader decision if a missing-row case must be surfaced differently later.

## Explicit Non-Implementation

Confirm:

- no runtime code changed
- no types created
- no adapter created
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
- no second Shield evaluator
- no gate behavior changed
- no governance change

## Verdict

`PHASE 4F-3A-2A COMPLETE - READY FOR PHASE 4F-3A-2B`

## Recommended Next Step

`Phase 4F-3A-2B - Task and Offer Loading Plan`
