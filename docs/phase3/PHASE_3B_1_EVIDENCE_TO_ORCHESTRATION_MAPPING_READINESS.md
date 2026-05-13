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
