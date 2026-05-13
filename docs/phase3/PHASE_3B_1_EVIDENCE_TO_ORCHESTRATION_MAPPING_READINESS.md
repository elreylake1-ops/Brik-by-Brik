# Phase 3B-1 Evidence to Orchestration Mapping Readiness

## Purpose

This document is an audit and planning step for future evidence-to-orchestration mapping only.

This step does not implement runtime behavior.

Boundaries:

- no runtime wiring
- no evidence ingestion
- no orchestrator integration yet
- no AI
- no scraping
- no persistence
- no UI behavior changes
- no deterministic decision changes

## Current Inputs Available

Current contracts and helper inputs available in the repo:

- `Phase3EvidenceBundle`
- `Phase3EvidenceItem`
- `validatePhase3EvidenceBundle()`
- `Phase3EvidenceBundleValidationResult`
- `Phase3OrchestrationInput`
- `Phase3OrchestrationOutput`
- `Phase3Task`
- `GovernanceEscalationRoute`

## Proposed Future Mapping Flow

Future conceptual flow (planning only, not implemented):

`Phase3EvidenceBundle`  
→ `validatePhase3EvidenceBundle()`  
→ validation warnings / `reviewRequired` / evidence statuses  
→ future evidence-to-orchestration adapter  
→ advisory `Phase3Task` suggestions  
→ advisory `GovernanceEscalationRoute` suggestions  
→ `buildPhase3Orchestration()` or future orchestration merge layer

This flow is not implemented in runtime paths.

## Evidence Status to Task Mapping Proposal

| Evidence condition | Future task category | Future task trigger | Future task priority | Notes |
| --- | --- | --- | --- | --- |
| missing comparable evidence | evidence | evidence_gap | high | Request comparable support before confidence is presented as clean. |
| weak comparable evidence | evidence / manual_review | weak_evidence | high or medium | Route for valuation-focused review depending severity. |
| conflicting legal/survey evidence | governance / manual_review | conflicting_evidence | high | Escalate for legal contradiction review. |
| missing lender/refinance evidence | evidence | missing_evidence | medium or high | Surface refinance uncertainty for manual lender review. |
| accepted operator note | limitations_awareness / evidence | operator_note | low | Awareness-only task; no deterministic decision effect. |
| `future_ai_extracted` source | manual_review | reserved_source_review | medium | Reserved label requires explicit manual confirmation. |
| `future_integration` source | manual_review | reserved_source_review | medium | Reserved label requires explicit manual confirmation. |

## Evidence Category to Escalation Route Proposal

| Evidence category | Potential escalation route | Notes |
| --- | --- | --- |
| `comparable_evidence` | `valuation_review` | Comparable quality affects valuation confidence and evidence integrity. |
| `legal_survey_evidence` | `legal_review` | Contradictory or missing legal/survey support should remain review-visible. |
| `lender_refinance_evidence` | `lender_review` | Refinance support gaps should not appear as settled finance confidence. |
| `refurb_evidence` | `refurb_review` | Scope/cost uncertainty should route to refurb review workflow. |
| `listing_evidence` | `evidence_gap` or `manual_review` | Listing context can be incomplete and needs manual challenge path. |
| `market_evidence` | `valuation_review` or `manual_review` | Market evidence quality should route into valuation/manual review. |
| `operator_note` | `manual_review` only if weak/conflicting/missing | Notes can inform review but should not auto-escalate when clean. |
| `system_generated_evidence` | `manual_review` if weak/conflicting | Generated items require visible human challenge when weak/conflicting. |

## Guardrails

- evidence mapping must remain advisory
- evidence tasks must not change deterministic final classification
- evidence escalation suggestions must not override governance
- weak/conflicting evidence must not look clean
- reserved future AI/integration labels require manual confirmation
- accepted evidence does not imply deal approval
- missing evidence should remain visible and not be hidden in investor summaries

## Integration Risks

- task merge conflicts may create duplicate orchestration tasks
- escalation priority can conflict with `capital_protection` route precedence
- text-based evidence labels can drift over time
- accepted evidence can be misread as deterministic approval
- reserved future AI source labels can be over-trusted operationally
- persistence assumptions can be introduced before contract boundaries are stable

## Recommended Adapter Boundary

Recommended future pure adapter boundary:

`mapEvidenceBundleToOrchestrationHints(bundle: Phase3EvidenceBundle): Phase3EvidenceOrchestrationHints`

Planning-only proposed output:

- `tasks: readonly Phase3Task[]`
- `escalationRoutes: readonly GovernanceEscalationRoute[]`
- `warnings: readonly string[]`
- `reviewRequired: boolean`
- `advisoryOnly: true`

Adapter requirements:

- pure function
- deterministic behavior
- fixture-tested
- no runtime wiring yet

## What Not To Build Yet

- no adapter implementation in this step
- no runtime wiring
- no UI output
- no evidence ingestion
- no AI/scraping/integrations
- no persistence
- no governance override logic

## Recommended Next Step

Recommended next implementation step:

**Phase 3B-1 Step 2 - Create Evidence-to-Orchestration Hint Types Only**

Step 2 should add type definitions and tests only, with no adapter implementation yet.

## Step 2 - Evidence-to-Orchestration Hint Types

Phase 3B-1 Step 2 adds hint contracts only for future evidence-to-orchestration mapping.

Summary:

- hint trigger and severity contracts are added in `types/phase3-evidence.ts`
- evidence orchestration hint contracts are added for advisory suggestion payloads
- hints remain advisory-only and non-decisioning
- no adapter implementation and no runtime wiring are added in this step

## Step 4 — Pure Adapter Implemented

Phase 3B-1 Step 4 adds the pure evidence-to-orchestration adapter only.

Summary:

- adapter added at `lib/engine/phase3-evidence-orchestration-adapter.ts`
- `mapEvidenceBundleToOrchestrationHints(bundle: Phase3EvidenceBundle): EvidenceOrchestrationHints` exported
- pure function: no side effects, no external calls, no mutation of input, no timestamps, no random values
- output order is stable and deterministic
- exact fixture comparisons pass for all 4 evidence bundle fixtures
- adapter does not create `Phase3Task` objects
- adapter does not change deterministic governance, classifications, or engine formulas
- no runtime wiring added
- no governance override behavior added
- adapter tests added at `__tests__/phase3-evidence-orchestration-adapter.test.ts`

## Step 4 Status

Step 4 is complete.

Delivered:

- `lib/engine/phase3-evidence-orchestration-adapter.ts`
- `__tests__/phase3-evidence-orchestration-adapter.test.ts`
- updated hint fixtures: summary text and item warning text updated to match adapter output; structural/semantic fields unchanged
- `docs/phase3/PHASE_3B_1_EVIDENCE_ORCHESTRATION_ADAPTER.md`

Fixture text changes (advisory text only, structural fields unchanged):

- `weak-comparable-evidence-hints.json`: summary simplified; item warning "manual_operator_entry only" → "manual_operator_entry" (verbatim passthrough)
- `conflicting-legal-evidence-hints.json`: summary simplified
- `missing-lender-evidence-hints.json`: summary simplified; item warning "manual_lender_review required" → "manual_lender_review" (verbatim passthrough); bundle warning order changed to risk phrases first

Not built in this step:

- no runtime wiring to calculator, Phase 2 review routes, or Phase 3 orchestrator
- no governance override logic
- no AI, scraping, or integrations
- no persistence expansion

Test result: 303 tests passing.

## Step 3 — Adapter Planning and Hint Fixtures

Phase 3B-1 Step 3 adds expected output fixtures and adapter planning documentation only.

Summary:

- expected hint output fixtures added under `__tests__/fixtures/phase3-evidence-orchestration-hints/`
- adapter target signature clarified: `mapEvidenceBundleToOrchestrationHints(bundle: Phase3EvidenceBundle): EvidenceOrchestrationHints`
- fixture contract-shape tests added in `__tests__/phase3-evidence-orchestration-hint-fixtures.test.ts`
- hints remain advisory only in all fixtures
- no adapter implementation added
- no runtime wiring added

## Step 3 Status

Step 3 is complete.

Delivered:

- `__tests__/fixtures/phase3-evidence-orchestration-hints/weak-comparable-evidence-hints.json`
- `__tests__/fixtures/phase3-evidence-orchestration-hints/conflicting-legal-evidence-hints.json`
- `__tests__/fixtures/phase3-evidence-orchestration-hints/accepted-operator-note-hints.json`
- `__tests__/fixtures/phase3-evidence-orchestration-hints/missing-lender-evidence-hints.json`
- `docs/phase3/PHASE_3B_1_EVIDENCE_ORCHESTRATION_HINT_FIXTURES.md`
- `__tests__/phase3-evidence-orchestration-hint-fixtures.test.ts`

Not built in this step:

- no adapter implementation
- no runtime mapping function
- no evidence ingestion or routing
- no governance decisioning
- no AI, scraping, or integrations
- no persistence expansion

## Step 2 Status

Step 2 is complete.

Delivered:

- `EvidenceOrchestrationHintTrigger` union added to `types/phase3-evidence.ts`
- `EvidenceOrchestrationHintSeverity` union added to `types/phase3-evidence.ts`
- `EvidenceOrchestrationHint` contract added to `types/phase3-evidence.ts`
- `EvidenceOrchestrationHints` bundle contract added to `types/phase3-evidence.ts`
- imports of `Phase3TaskCategory`, `Phase3TaskPriority`, and `GovernanceEscalationRoute` use `import type` to avoid circular runtime imports
- guardrail comments confirm hints do not create Phase3Task objects, do not change deterministic governance, do not approve evidence as truth, and are not wired into runtime behavior
- test file added: `__tests__/phase3-evidence-orchestration-hints.test.ts`
- tests cover: valid missing evidence hint, valid weak comparable evidence hint, valid conflicting legal evidence hint, valid reserved source review hint, valid accepted evidence awareness hint, EvidenceOrchestrationHints bundle shape, `advisoryOnly: true` enforcement, no deterministic approval, escalation routes as suggestions only

Not built in this step:

- no adapter implementation
- no runtime wiring
- no evidence ingestion
- no governance decisioning
- no AI, scraping, or integrations
- no persistence expansion

Test result: 252 tests passing.

---

Phase 3B-1 closure report created; evidence-to-orchestration hint layer is ready for review before the next controlled phase.
