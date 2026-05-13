# Phase 3B-0 Evidence Intake Contract Plan

## Purpose

Phase 3B-0 prepares structured evidence contracts only.

This step is planning-only and does not authorize evidence intake implementation.

Boundaries for this phase:

- no AI extraction
- no scraping
- no live integrations
- no persistence expansion
- no UI wiring
- no calculator behavior changes

## Why This Phase Exists

James accepted Phase 2 limitations, but evidence consistency remains a priority before expansion into intelligence modules.

Evidence contracts are required before controlled development of:

- listing intelligence
- seller motivation scoring
- refurb intelligence
- GDV confidence scoring
- negotiation intelligence
- investor summary composition

## Current Evidence Signals in Phase 2

Current evidence-related signals are already present but distributed across multiple contracts:

- `evidenceStatus` in `Phase2AnalysisOutput`
- `missingCriticalEvidence` in `evidenceStatus`
- evidence-related `riskRadar.riskFlags` (`code`, `label`, `severity`, `source`)
- governance evidence consequences through `governance.blockedBy`, `fatalRisk`, and `reviewRequired`
- `dataConfidence` fields (`overall`, listing, refurb, gdv, legal, finance)
- `limitations` section in `Phase2AnalysisOutput`
- investor summary text (`headline`, `summary`, warnings) that may reference evidence quality outcomes
- validation fixtures and runner checks for missing comparables, weak GDV evidence, structural/legal risk indications, and finance/lender review signals

## Accepted Phase 2 Evidence Limitations

Accepted evidence-related limitations currently carried forward:

- manual comparable input
- no automated sold-price validation
- no live Rightmove/Zoopla/Land Registry integrations
- no automated lender validation
- no legal/survey evidence ingestion
- rules-based refurb assumptions
- no persistent analysis history yet
- no AI extraction or automation layers yet

## Proposed Evidence Contract Categories

Planning-level evidence categories for future type contracts:

- `comparable_evidence`
- `listing_evidence`
- `refurb_evidence`
- `legal_survey_evidence`
- `lender_refinance_evidence`
- `market_evidence`
- `operator_note`
- `system_generated_evidence`

## Proposed Evidence Status Model

Planning-only status model proposal:

- `missing`
- `provided`
- `weak`
- `conflicting`
- `requires_review`
- `accepted`
- `rejected`
- `not_applicable`

## Proposed Evidence Source Model

Planning-only source model proposal:

- `user_supplied`
- `operator_entered`
- `system_generated`
- `third_party_document`
- `future_ai_extracted`
- `future_integration`
- `unknown`

Reserved labels only:

- `future_ai_extracted` and `future_integration` are reserved for forward compatibility and are not implemented in this phase.

## Proposed Evidence Confidence Model

Planning-only confidence model proposal:

- `high`
- `medium`
- `low`
- `unknown`

Confidence must describe evidence quality only.

Confidence must not override deterministic deal decisions or governance outcomes.

## Governance Relationship

Evidence contract behavior should support governance without replacing it:

- evidence may trigger review
- evidence may create tasks
- evidence may lower confidence
- evidence may escalate governance review
- evidence must not automatically change MAO, finance, formulas, or classifications

## Contract Risks

- confusing evidence status with governance state
- allowing weak evidence to appear clean
- relying on free-text labels instead of stable evidence codes
- treating AI-extracted evidence as truth in later phases
- hiding missing evidence behind investor-summary wording
- introducing persistence assumptions before contract stabilization

## Recommended Contract Boundary

Recommended future type boundary:

- `types/phase3-evidence.ts`

Recommended future pure helper boundary:

- `lib/engine/phase3-evidence-contract.ts`

These are recommended next-step locations only and are intentionally not created in this planning step.

## Recommended Next Step

Recommended next step:

**Phase 3B-0 Step 2 — Create Evidence Contract Types Only**

Step 2 should create type definitions and tests only, with no runtime wiring.

## Step 2 - Evidence Contract Types

Phase 3B-0 Step 2 adds evidence contract types and type-level test coverage only.

Summary:

- evidence category, status, source, and confidence unions are created in `types/phase3-evidence.ts`
- advisory evidence item and evidence bundle contracts are created for future integration
- no runtime evidence ingestion or routing wiring is added in this step
- `future_ai_extracted` and `future_integration` are reserved source labels only

## Step 3 - Evidence Fixtures and Contract Validation

Phase 3B-0 Step 3 adds representative evidence fixtures and a pure contract validation helper.

Summary:

- evidence fixtures are added under `__tests__/fixtures/phase3-evidence/`
- pure validation helper is added at `lib/engine/phase3-evidence-contract.ts`
- validation remains advisory and contract-level only
- no governance decisioning or runtime wiring is added in this step
- reserved future source labels produce warnings only

## Step 4 - Evidence Validation Output Fixture Locking

Phase 3B-0 Step 4 locks representative validation outputs for evidence bundle contract behavior.

Summary:

- validation-output fixtures are added under `__tests__/fixtures/phase3-evidence-validation/`
- exact comparison tests are added in `__tests__/phase3-evidence-contract.test.ts`
- warning text and review-required behavior are locked for drift protection
- no runtime wiring or governance decisioning is added in this step
