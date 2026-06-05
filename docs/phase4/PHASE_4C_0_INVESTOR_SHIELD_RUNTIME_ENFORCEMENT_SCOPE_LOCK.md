# Phase 4C-0 Investor Shield Runtime Enforcement Scope Lock

## Purpose
This document defines the safe implementation boundary for Phase 4C Investor Shield™ / Due Diligence Lock™ runtime enforcement.

Phase 4C will later define and implement Investor Shield runtime evaluation in small controlled steps, but this step is documentation and planning only.

## Current Phase 4B Baseline
- default Investor Shield gates exist
- default check-builder exists
- repository helpers exist for Investor Shield tables under `brik_by_brik_engine`
- saved deal creation now creates 10 default Investor Shield checks
- staging/runtime proof passed for default check creation
- `saved_deals.id` remains `TEXT`
- Investor Shield `deal_id` columns remain `TEXT`
- no runtime enforcement exists yet
- no task generation exists yet
- no pipeline blocking exists yet

## Non-Negotiable Rule
Investor Shield may increase caution, block progression, require evidence, create follow-up tasks, or downgrade confidence.

Investor Shield must never soften deterministic capital protection, True MAO, deal classification, or governance risk.

## Phase 4C Scope
Phase 4C is limited to:
- pure evaluator for Investor Shield gate state
- enforcement result contract
- safe progression and blocking recommendation
- task-generation plan for weak or failed gates
- repository read-only evaluation first
- later guarded integration with pipeline movement only after tests

## Explicit Non-Goals
- no UI panels
- no PDF or investor pack
- no evidence upload
- no AI/image/video runtime review
- no live scraping
- no CRM expansion beyond existing task model
- no automation dashboards
- no multi-user roles
- no formula changes
- no Phase 2 behavior changes
- no Phase 3 behavior changes

## Proposed Phase 4C Substeps
### 4C-1 Evaluator contracts only
- enforcement result types
- progression status
- blocking reason types
- task recommendation types
- no runtime wiring

### 4C-2 Pure evaluator only
- input: checks, evidence, risk flags, manual overrides
- output: enforcement result
- no DB calls
- no tasks created
- no saved-deal movement changes

### 4C-3 Evaluator tests and fixtures
- all gates satisfied
- missing sold comps
- failed title
- weak refurb certainty
- advisory AI only cannot satisfy evidence
- manual override requires reason
- waived blocker still records caution
- deterministic reject cannot be softened

### 4C-4 Repository read-model helper
- load Investor Shield state by `dealId`
- compose evaluation input
- no writes
- no movement blocking yet

### 4C-5 Task recommendation builder only
- creates task recommendations in memory
- no DB task insert yet

### 4C-6 Optional task creation wiring
- create `deal_tasks` for weak or failed required gates
- idempotent
- no UI changes

### 4C-7 Guarded pipeline movement integration
- check Investor Shield before movement
- block only where configured
- deterministic governance remains dominant
- no override without reason

### 4C-8 Runtime proof
- saved deal with weak gates
- evaluator blocks or warns as expected
- task generation proof if separately approved

## Enforcement Evaluation Rules Draft
- `SATISFIED` gates do not block
- `REQUIRED` and `NOT_STARTED` required gates create evidence-needed status
- `WEAK` gates create caution and possible task recommendation
- `FAILED` `BLOCKER` and `FATAL` gates block progression
- `WAIVED` gates require manual override reason
- AI advisory evidence can support review but cannot satisfy hard evidence alone
- `REFURB_CERTAINTY` remains blocked unless builder, professional, document, or measurement evidence exists
- deterministic `NO-GO` remains `NO-GO` regardless of Investor Shield state

## Suggested Enforcement Output Shape
Documentation-level shape only:
- `dealId`
- `evaluatedAt` optional
- `overallStatus`: `CLEAR | CAUTION | BLOCKED`
- `canProgress`: boolean
- `blockingGateKeys`
- `cautionGateKeys`
- `missingEvidenceGateKeys`
- `taskRecommendations`
- `manualOverrideRequired`
- `advisoryOnlyEvidenceWarnings`
- `deterministicDominanceNote`

No TypeScript types are added in this step.

## Safety Rules
- evaluator must be pure before any repository integration
- no evaluator result may improve deterministic risk
- task generation must be idempotent
- pipeline blocking must be tested before runtime wiring
- manual override must require reason
- advisory-only AI cannot close hard proof gates

## Recommended Next Step
Phase 4C-1 — Evaluator Contracts Only

## Safety Confirmation
- no enforcement code added
- no evaluator code added
- no DB changes applied
- no API behavior changed
- no UI changed
- no runtime behavior changed
- deterministic engine untouched
