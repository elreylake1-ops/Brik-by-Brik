# Phase 3B-1 Evidence Orchestration Hint Fixtures

## Purpose

This document records the expected output fixtures for the future evidence-to-orchestration adapter.

These fixtures are planning-level expected outputs only.

No adapter has been implemented. No runtime wiring exists.

## Future Adapter Boundary

The future adapter will have this signature:

```
mapEvidenceBundleToOrchestrationHints(bundle: Phase3EvidenceBundle): EvidenceOrchestrationHints
```

It must be:

- a pure function
- deterministic
- fixture-tested
- not wired to runtime behavior in Phase 3B-1

## Input Evidence Fixtures

Input fixtures are in `__tests__/fixtures/phase3-evidence/`:

| Fixture | Category | Status | reviewRequired |
| --- | --- | --- | --- |
| `weak-comparable-evidence.json` | `comparable_evidence` | `weak` | true |
| `conflicting-legal-evidence.json` | `legal_survey_evidence` | `conflicting` | true |
| `accepted-operator-note.json` | `operator_note` | `accepted` | false |
| `missing-lender-evidence.json` | `lender_refinance_evidence` | `missing` | true |

## Expected Hint Output Fixtures

Expected output fixtures are in `__tests__/fixtures/phase3-evidence-orchestration-hints/`:

| Fixture | Trigger | Severity | Escalation | reviewRequired |
| --- | --- | --- | --- | --- |
| `weak-comparable-evidence-hints.json` | `weak_evidence` | `high` | `valuation_review`, `evidence_gap` | true |
| `conflicting-legal-evidence-hints.json` | `conflicting_evidence` | `high` | `legal_review` | true |
| `accepted-operator-note-hints.json` | `accepted_evidence_awareness` | `low` | `none` | false |
| `missing-lender-evidence-hints.json` | `missing_evidence` | `high` | `lender_review`, `evidence_gap` | true |

## Evidence Status to Hint Trigger Expectations

| Evidence status | Expected hint trigger | Notes |
| --- | --- | --- |
| `missing` | `missing_evidence` | Gap must remain visible |
| `weak` | `weak_evidence` | Must not appear clean |
| `conflicting` | `conflicting_evidence` | Requires manual reviewer challenge path |
| `accepted` | `accepted_evidence_awareness` | Awareness only — no deterministic decision effect |
| `requires_review` | `missing_evidence` or `weak_evidence` | Depends on category |
| `rejected` | `contract_warning` | Rejected evidence must not be silently dropped |

## Evidence Category to Escalation Route Expectations

| Evidence category | Expected escalation route | Notes |
| --- | --- | --- |
| `comparable_evidence` | `valuation_review`, `evidence_gap` | Comparable quality affects valuation confidence |
| `legal_survey_evidence` | `legal_review` | Conflicting or missing legal support escalates to legal review |
| `lender_refinance_evidence` | `lender_review`, `evidence_gap` | Refinance gaps must not appear as settled finance confidence |
| `refurb_evidence` | `refurb_review` | Scope or cost uncertainty routes to refurb review |
| `listing_evidence` | `evidence_gap` or `manual_review` | Incomplete listing context needs manual challenge path |
| `market_evidence` | `valuation_review` or `manual_review` | Market quality routes into valuation or manual review |
| `operator_note` | `none` when clean/accepted; `manual_review` if weak/conflicting/missing | Notes must not auto-escalate when accepted |
| `system_generated_evidence` | `manual_review` if weak/conflicting | Generated items require visible human challenge when weak or conflicting |

## Guardrails

- hints are advisory only
- hints do not create `Phase3Task` objects in this phase
- hints do not change deterministic deal classifications
- hints do not override governance states or thresholds
- hints do not approve evidence as truth
- accepted evidence awareness does not mean deal approval
- no runtime wiring exists in Phase 3B-1
- no AI, scraping, integration, or persistence behavior exists
- reserved source labels (`future_ai_extracted`, `future_integration`) produce warnings only and require manual confirmation
- weak or conflicting evidence must not appear clean in any output surface

## Contract Shape

Each hint fixture must conform to `EvidenceOrchestrationHints`:

```
{
  tasks: readonly EvidenceOrchestrationHint[]
  escalationRoutes: readonly GovernanceEscalationRoute[]
  warnings: readonly string[]
  reviewRequired: boolean
  advisoryOnly: true
}
```

Each hint item must conform to `EvidenceOrchestrationHint`:

```
{
  id: string
  evidenceItemId?: string
  category: EvidenceCategory
  trigger: EvidenceOrchestrationHintTrigger
  severity: EvidenceOrchestrationHintSeverity
  suggestedTaskCategory: Phase3TaskCategory
  suggestedTaskPriority: Phase3TaskPriority
  suggestedEscalationRoute: GovernanceEscalationRoute
  summary: string
  warnings?: readonly string[]
  advisoryOnly: true
}
```

## What Is Not Built

- no adapter implementation
- no runtime mapping function
- no evidence ingestion or routing
- no governance decisioning
- no AI, scraping, or live integrations
- no persistence expansion
- no CRM or autonomous workflows

## Recommended Next Step

Phase 3B-1 Step 4 — Adapter Implementation (pure function, fixture-tested, no runtime wiring).
