# Phase 3B-1 Evidence Orchestration Adapter

## Purpose

This document describes the pure evidence-to-orchestration adapter delivered in Phase 3B-1 Step 4.

The adapter transforms evidence bundles into advisory hint outputs only.

It is not wired to any runtime path.

## Adapter Boundary

```
lib/engine/phase3-evidence-orchestration-adapter.ts
```

Exported function:

```
mapEvidenceBundleToOrchestrationHints(bundle: Phase3EvidenceBundle): EvidenceOrchestrationHints
```

## Adapter Rules

- pure function only
- no side effects
- no external calls
- no mutation of input
- no random values
- no timestamps
- stable output order
- deterministic hint IDs (derived from item.stableCode when present)
- advisoryOnly: true on all outputs

## Mapping Behavior

### Status to trigger

| Evidence status | Hint trigger |
| --- | --- |
| `missing` | `missing_evidence` |
| `weak` | `weak_evidence` |
| `conflicting` | `conflicting_evidence` |
| `requires_review` | `missing_evidence` |
| `rejected` | `contract_warning` |
| `accepted` | `accepted_evidence_awareness` |
| `provided` | skipped (no hint) |
| `not_applicable` | skipped (no hint) |

Reserved sources (`future_ai_extracted`, `future_integration`) always produce `reserved_source_review` hint, overriding the status-based trigger.

### Category to escalation route

| Evidence category | Suggested escalation route |
| --- | --- |
| `comparable_evidence` | `valuation_review` |
| `legal_survey_evidence` | `legal_review` |
| `lender_refinance_evidence` | `lender_review` |
| `refurb_evidence` | `refurb_review` |
| `listing_evidence` | `evidence_gap` when review-required, else `none` |
| `market_evidence` | `valuation_review` when review-required, else `none` |
| `operator_note` | `manual_review` when review-required, else `none` |
| `system_generated_evidence` | `manual_review` when weak/conflicting, else `none` |

### Bundle-level escalation routes

Collected from hint routes. `evidence_gap` added when `bundle.missingCriticalEvidence` is non-empty. `none` sentinel used when hints exist but all have route `none`. Empty array for empty bundle.

### Bundle-level warnings

Risk phrases for category+trigger combinations, followed by formatted `missingCriticalEvidence` entries.

### reviewRequired

True when `bundle.reviewRequired` is true OR any hint has trigger `missing_evidence`, `weak_evidence`, `conflicting_evidence`, or `reserved_source_review`.

## Fixture Coverage

| Input fixture | Expected output fixture |
| --- | --- |
| `weak-comparable-evidence.json` | `weak-comparable-evidence-hints.json` |
| `conflicting-legal-evidence.json` | `conflicting-legal-evidence-hints.json` |
| `accepted-operator-note.json` | `accepted-operator-note-hints.json` |
| `missing-lender-evidence.json` | `missing-lender-evidence-hints.json` |

All 4 exact fixture comparisons pass.

## Guardrails

- hints are advisory only
- hints do not create `Phase3Task` objects
- hints do not change deterministic deal classifications
- hints do not override governance states or thresholds
- hints do not approve evidence as truth
- accepted evidence awareness does not mean deal approval
- adapter is not wired to runtime behavior
- no AI, scraping, integration, or persistence behavior exists
