# Phase 3C-0 Merged Output Fixtures

## Purpose

Define expected merged-output fixtures before merge implementation.

This step is planning and contract-shape control only.

## Future Merge Function Boundary

Planned future function (not implemented in this step):

```ts
mergeOrchestrationWithEvidenceHints(
  orchestration: Phase3OrchestrationOutput,
  evidenceHints: EvidenceOrchestrationHints
): Phase3MergedOrchestrationOutput
```

Out of scope in this step:

- no merge function implementation
- no runtime wiring
- no orchestrator wiring
- no calculator wiring

## Input Fixture Pairs

Conceptual fixture pairings used for expected merged outputs:

- `phase3-orchestration/no-deal-capital-protection.json`
  + `phase3-evidence-orchestration-hints/weak-comparable-evidence-hints.json`
  -> `phase3-merged-orchestration/no-deal-with-weak-comparable-hints-merged.json`
- `phase3-orchestration/review-required-evidence-gap.json`
  + `phase3-evidence-orchestration-hints/conflicting-legal-evidence-hints.json`
  -> `phase3-merged-orchestration/review-required-with-legal-conflict-hints-merged.json`
- `phase3-orchestration/accepted-limitations-awareness.json`
  + `phase3-evidence-orchestration-hints/accepted-operator-note-hints.json`
  -> `phase3-merged-orchestration/clean-proceed-with-accepted-operator-note-merged.json`
- `phase3-orchestration/intake-missing-deterministic.json`
  + `phase3-evidence-orchestration-hints/missing-lender-evidence-hints.json`
  -> `phase3-merged-orchestration/intake-with-missing-lender-hints-merged.json`

## Expected Merged Output Fixtures

Added fixtures under `__tests__/fixtures/phase3-merged-orchestration/`:

- `no-deal-with-weak-comparable-hints-merged.json`
- `review-required-with-legal-conflict-hints-merged.json`
- `clean-proceed-with-accepted-operator-note-merged.json`
- `intake-with-missing-lender-hints-merged.json`

## Priority Expectations

- `capital_protection` remains highest priority whenever deterministic route is blocked/no-deal.
- evidence-derived routes may appear as secondary routes.
- evidence tasks are advisory additions only.
- deterministic workflow/global state is preserved.

## Duplicate Handling Expectations

- deterministic stable task IDs remain present and unchanged.
- evidence hint tasks append as distinct `source: "evidence_hint"` tasks.
- duplicate deterministic/evidence intent should be deduplicated in future implementation.
- duplicate warning patterns should be deduplicated in future implementation.

## Escalation Conflict Expectations

- escalation precedence follows planning order in `PHASE_3C_0_ORCHESTRATION_MERGE_LAYER_PLAN.md`.
- legal conflict evidence can surface `legal_review` as primary or secondary depending on deterministic context.
- evidence routes (`evidence_gap`, `manual_review`, `lender_review`, `valuation_review`) may coexist as secondary routes.

## Guardrails

- merged output is advisory only
- merged output does not alter deterministic classification/global deal state
- evidence tasks do not override capital protection
- no runtime wiring exists
- no AI/scraping/integration/persistence behavior exists
