# Phase 3C-0 Orchestration Merge Layer Plan

## Purpose

This document is a planning-only step for a future advisory merge layer.

This step does not implement the merge layer.

Boundaries:

- no implementation
- no runtime wiring
- no UI changes
- no governance override changes
- no deterministic decision changes
- no AI, scraping, or live integrations
- no persistence expansion
- no evidence hints allowed to change deterministic outputs

## Current Inputs Available

Two advisory output contracts are now available.

### Phase3OrchestrationOutput

Produced by `buildPhase3Orchestration()` from a deterministic snapshot.

Fields:

- `workflowState` — current workflow routing state
- `globalDealState` — overall deal state derived from deterministic outputs
- `governanceEscalationRoute` — primary governance escalation route
- `escalation` — full escalation summary with route, severity, reason, source, requiresManualReview
- `tasks` — generated deterministic-driven tasks with category, trigger, source, priority, status, route, blocksProgression
- `metadata` — accepted limitations, workflow flags, evidence gaps from deterministic output

`capital_protection` route is generated when deterministic output is `NO_DEAL` or `BLOCKED`. This is the highest-priority signal and must not be overridden.

### EvidenceOrchestrationHints

Produced by `mapEvidenceBundleToOrchestrationHints()` from an evidence bundle.

Fields:

- `tasks` — advisory hint items (type `EvidenceOrchestrationHint`, not `Phase3Task`)
- `escalationRoutes` — suggested escalation routes from evidence signals
- `warnings` — advisory bundle-level warning strings
- `reviewRequired` — true when evidence conditions require review
- `advisoryOnly: true` — always

Evidence hints carry no deterministic authority. They describe evidence quality signals only.

## Proposed Future Merge Flow

Current tested path (Phase 3A-1, Phase 3B-1):

```
Phase2AnalysisOutput
→ mapPhase2OutputToPhase3Snapshot()
→ Phase3DeterministicSnapshot
→ buildPhase3Orchestration()
→ Phase3OrchestrationOutput

Phase3EvidenceBundle
→ validatePhase3EvidenceBundle()
→ mapEvidenceBundleToOrchestrationHints()
→ EvidenceOrchestrationHints
```

Proposed future merge (planning only, not implemented):

```
Phase3OrchestrationOutput + EvidenceOrchestrationHints
→ mergeOrchestrationWithEvidenceHints()
→ Phase3MergedOrchestrationOutput
```

This flow is not implemented. The merge function does not exist yet.

## Merge Priorities

Future merge implementation must follow this priority order:

1. `capital_protection` / `no_deal` / `blocked` deterministic output is highest priority — evidence hints must not remove or soften these signals
2. Existing governance escalation routes from `Phase3OrchestrationOutput` rank above evidence hint suggestions
3. Evidence hints may add advisory tasks and warnings only — they must not reduce existing task priority or severity
4. Evidence hints may not remove or downgrade deterministic tasks
5. Accepted limitations remain awareness-only — they must not change deal classification
6. Reserved source labels (`future_ai_extracted`, `future_integration`) require manual review and must never become authoritative in merged output

## Duplicate Handling Proposal

Future merge implementation should avoid duplicate tasks using these rules:

- deterministic tasks from `Phase3OrchestrationOutput` have stable IDs (`deterministic-analysis`, `governance-review`, `evidence-review`, `manual-review-routing`, `capital-protection-stop`, `accepted-limitations-awareness`) — these must not be duplicated
- evidence hint IDs are derived from stable evidence `stableCode` values — these must not collide with deterministic task IDs
- merge by trigger, category, and source combination — do not append a hint that repeats an existing deterministic task signal
- preserve deterministic tasks when any conflict exists
- append evidence hints only when they add new information not already present in deterministic output
- do not produce duplicate warnings for the same evidence item and trigger combination
- if the same escalation route appears in both `Phase3OrchestrationOutput` and `EvidenceOrchestrationHints`, deduplicate to a single route entry in merged output

## Escalation Conflict Proposal

Future merge must handle escalation route conflicts with this resolution order:

1. `capital_protection` — always highest; no other route overrides it
2. `structural_risk` — above evidence-based routes
3. `legal_review` — does not override `capital_protection` or `structural_risk`
4. `lender_review` — does not override `capital_protection` or `structural_risk`
5. `valuation_review` — does not override `capital_protection`, `structural_risk`, or `legal_review`
6. `evidence_gap` / `manual_review` — secondary coexisting routes; can appear alongside higher-priority routes
7. `none` — only when all deterministic and evidence signals are clean

Final deterministic deal classification (`finalClassification`, `globalDealState`) must remain unchanged by escalation route selection.

## Proposed Future Contract

Planning-level type names for a later types-only step:

- `Phase3MergedOrchestrationOutput` — merged advisory result combining deterministic and evidence signals
- `Phase3MergedTask` — unified task representation supporting both deterministic and evidence-hint sources
- `Phase3MergeWarning` — structured warning with source attribution (deterministic vs evidence)
- `Phase3MergeSource` — source label distinguishing `deterministic_snapshot`, `evidence_hint`, `accepted_limitations`, `orchestrator_guardrail`
- `Phase3MergeResultMetadata` — merge provenance: which deterministic output, which evidence bundle, merge warnings count, reviewRequired from both inputs

These are planning-level names only. They should be created in a later types-only step with no merge implementation.

## Guardrails

- merge layer remains advisory
- no deterministic output changes
- no formula changes
- no governance override behavior
- no hidden confidence blending between evidence quality and deterministic confidence
- no AI authority over merged output
- no persistence assumptions about merged output — it is a pure in-memory advisory result
- no UI rendering until backend outputs are stable, tested, and exact fixture-locked
- reviewer challenge paths must remain available for every merged task and escalation route
- `advisoryOnly: true` must be enforced on all merged output fields

## Integration Risks

- duplicate tasks confusing operators when both deterministic evidence-review and evidence-hint tasks surface simultaneously
- evidence hints making a `no_deal` outcome appear negotiable if hint severity is shown prominently alongside deterministic block
- escalation route downgrade risk when merge logic selects evidence-hint route over existing governance escalation route
- accepted evidence awareness hints being mistaken for deal approval by downstream consumers
- future AI/integration hints being over-trusted once `reserved_source_review` guardrails are relaxed in future phases
- UI prematurely showing merged output as a final decision rather than as an advisory orchestration layer
- merge metadata accumulating state that becomes an accidental persistence model if serialized

## Recommended Next Step

Recommended next implementation step:

**Phase 3C-0 Step 2 — Merge Layer Type Contracts Only**

Step 2 should create type definitions and tests only, with no merge implementation yet.

Step 2 scope:

- `Phase3MergedOrchestrationOutput` type
- `Phase3MergedTask` type
- `Phase3MergeWarning` type
- `Phase3MergeSource` union
- `Phase3MergeResultMetadata` type
- guardrail comments confirming advisory-only behavior
- type-level tests confirming contract shape and `advisoryOnly: true`

No merge function, no runtime wiring, and no UI changes should be added in Step 2.

## Step 2 -- Merge Layer Type Contracts

Status: complete.

- merge source, warning, task, metadata, and merged output contracts added
- advisory-only guardrail comments added
- no merge implementation added
- no runtime wiring added

## Step 3 -- Merged Output Fixture Planning

Status: complete.

- expected merged output fixtures added
- merge target shape clarified
- capital protection priority represented in fixture expectations
- no merge implementation added
- no runtime wiring added

## Step 4 -- Pure Merge Function Implemented

Status: complete.

- merge module added: `lib/engine/phase3-orchestration-merge.ts`
- pure deterministic merge behavior implemented with no side effects
- exact locked fixture comparisons added for merge outputs
- capital protection priority enforced over evidence routes
- no runtime wiring added
- no governance override behavior added

Phase 3C-0 closure report created; advisory merge layer is ready for review before any runtime surface planning.
