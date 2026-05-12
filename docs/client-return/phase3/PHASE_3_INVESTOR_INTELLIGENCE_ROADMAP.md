# Phase 3 Controlled Roadmap

## Purpose

This document is planning only.

It does not authorize Phase 3 implementation.

James has confirmed that Phase 2 must be fully stabilized before expansion.

Phase 3 should therefore be prepared as a controlled, module-by-module roadmap only.

## Current Boundary

Phase 3 remains blocked until all of the following are true:

- the client accepts the Phase 2 validation package
- the locked validation runner outputs are accepted
- the live calculator walkthrough evidence is accepted
- open Phase 2 limitations are either resolved or explicitly accepted as known operating constraints

Until those conditions are met, no Phase 3 feature should move into implementation.

## James Priority Order

Phase 3 planning must protect this priority order:

1. deterministic reliability
2. governance integrity
3. edge-case handling
4. evidence consistency
5. investor confidence
6. workflow smoothness

The system must feel dependable under real acquisition pressure, not just technically functional.

## Phase 3 Target

Investor Intelligence Engine  
Deep Due Diligence + Signal Extraction Layer

## Core Architecture Rule

Phase 3 must follow:

Deterministic Core + AI Interpretation Layer

This means:

- MAO remains deterministic
- finance calculations remain deterministic
- governance states remain deterministic
- deal classifications remain deterministic
- AI may support interpretation, classification, summarization, and evidence extraction only
- AI must never override the deterministic deal engine

## Non-Negotiable Boundary

The deterministic core remains the system of record.

Deterministic core ownership:

- deal math
- refurb, fee, and finance outputs
- governance gates
- final classification
- evidence status rules
- capital protection rules
- review escalation rules
- audit fields and locked JSON contracts

AI layer allowed scope:

- extract candidate evidence from text documents
- classify text into predefined signal categories
- summarize evidence already present in structured records
- highlight contradictions, gaps, or missing support
- draft investor-facing narrative from deterministic outputs and cited evidence

AI layer forbidden scope:

- changing MAO or any calculation output
- changing governance state
- changing final classification
- suppressing hard warnings or fatal risks
- inventing evidence
- producing uncited claims
- making black-box accept or reject decisions

## Reliability Rule

Phase 3 must be safe even when the AI layer is wrong, unavailable, delayed, or inconsistent.

Therefore:

- the deterministic engine must still run without AI
- AI outputs must be clearly marked advisory
- every AI output must link back to source evidence
- every AI output must be replaceable by manual review
- no AI output may be required for the final deal state

## Pre-Start Stabilization Gate

Before Module 1 starts, the following must be reviewed explicitly:

### Required carry-forward items from Phase 2

- sold comparable ingestion and validation scope
- deterministic sold-price cross-check scope
- builder quote and scope-validation refinement
- legal and survey evidence intake refinement
- lender and refinance validation decision

### Decision requirement

Each item must be marked as one of:

- resolved before Phase 3
- accepted as a temporary limitation
- blocked pending separate approval

Phase 3 should not begin with these items left ambiguous.

## Controlled Module Roadmap

Modules should be implemented one at a time.

Each module must complete validation before the next module begins.

### Module 0 - Phase 2 Closure Gate

Purpose:
Create the formal go/no-go checkpoint before any Phase 3 work starts.

In scope:

- confirm client acceptance of Phase 2 evidence package
- lock the accepted fixture set and review screenshots
- confirm which known limitations remain open
- define the approved risk position for each open limitation

Not allowed:

- no new AI behavior
- no new scoring logic
- no workflow expansion

Exit gate:

- written acceptance that Phase 2 is stable enough for controlled expansion

### Module 1 - Deterministic Evidence Intake Contract

Purpose:
Create the structured evidence model that the future AI layer is allowed to read from and write candidate items into.

In scope:

- comparable record schema
- listing evidence schema
- survey or legal evidence schema
- builder quote evidence schema
- refinance or lender evidence schema
- provenance fields for source, timestamp, operator, and confidence origin

Required behavior:

- every evidence item has a clear source
- every evidence item has a deterministic status
- every missing evidence type is visible
- evidence can be accepted, challenged, or unresolved without hidden state

Not allowed:

- no AI extraction yet
- no investor narrative generation yet
- no governance override changes

Exit gate:

- locked evidence contract
- deterministic validation rules for malformed, partial, duplicate, and conflicting evidence

### Module 2 - Deterministic Evidence Validation and Cross-Checks

Purpose:
Strengthen evidence reliability before any interpretation layer is added.

In scope:

- sold comparable validation rules
- deterministic sold-price cross-check rules
- duplicate comparable detection
- stale evidence detection
- contradiction flags across purchase, GDV, refurb, and finance inputs
- missing-document challenge rules

Required behavior:

- weak evidence cannot appear clean
- unsupported claims are surfaced before summary generation
- edge cases downgrade confidence visibly

Not allowed:

- no AI extraction
- no AI classification
- no AI summary

Exit gate:

- deterministic consistency checks pass
- challenge states and review states are visible in output contracts

### Module 3 - AI Extraction Sandbox

Purpose:
Add a tightly bounded AI layer that converts unstructured text into candidate evidence only.

In scope:

- listing-description extraction
- agent-note extraction
- survey-note extraction
- builder-quote note extraction
- motivation and urgency phrase extraction

Required behavior:

- extracted items are candidates, not truth
- every extraction stores source text references
- extraction confidence is separate from deterministic evidence status
- low-confidence extraction stays non-authoritative

Not allowed:

- no direct write into final deterministic fields
- no automated governance changes
- no final deal recommendation

Exit gate:

- extraction quality benchmark defined
- false-positive and false-negative review pack created
- fallback behavior defined for empty, noisy, contradictory, or irrelevant text

### Module 4 - AI Interpretation and Signal Classification

Purpose:
Use AI to classify evidence into predefined diligence signal buckets without taking final control.

In scope:

- motivation classification
- seller-pressure classification
- refurb-complexity commentary
- execution-risk commentary
- documentation-quality commentary
- evidence-gap labeling

Required behavior:

- classifications map into predefined enums or controlled labels
- deterministic rules decide how those labels are consumed
- all interpretation remains reviewable and reversible

Not allowed:

- no freeform governance override
- no final HOT, WARM, MARGINAL, or NO_DEAL decision from AI
- no uncited investor statements

Exit gate:

- controlled taxonomy approved
- interpretation output attached as advisory fields only

### Module 5 - Evidence Consistency and Challenge Layer

Purpose:
Make contradictions obvious before an investor sees a polished summary.

In scope:

- compare AI-extracted signals with deterministic evidence state
- flag summary claims that lack support
- surface contradictory comparables, pricing, or timeline claims
- generate evidence challenge prompts for manual review

Required behavior:

- contradiction detection is visible
- unsupported summaries are blocked from being presented as clean
- evidence gaps remain prominent under time pressure

Not allowed:

- no silent reconciliation by AI
- no hiding of missing data

Exit gate:

- contradiction states appear consistently in output
- review workflow proves that evidence disputes remain visible

### Module 6 - Investor Summary Layer

Purpose:
Generate readable investor-facing outputs without changing the underlying decision.

In scope:

- executive summary draft
- risk summary draft
- comparable summary draft
- next-step summary draft
- evidence-strength summary draft

Required behavior:

- every summary is grounded in deterministic outputs and cited evidence
- governance state appears exactly as produced by the deterministic engine
- negative or review-required conditions cannot be softened by narrative phrasing

Not allowed:

- no summary may contradict governance
- no summary may remove warnings
- no summary may present assumptions as facts

Exit gate:

- investor-summary outputs reviewed against dangerous, marginal, and contradictory scenarios
- wording rules approved for blocked and review-required deals

### Module 7 - Workflow and Audit Layer

Purpose:
Make the intelligence layer operationally dependable under real acquisition pressure.

In scope:

- review queue states
- analyst confirmation checkpoints
- evidence acceptance or rejection actions
- summary approval states
- audit trail for AI-generated candidate items and summaries

Required behavior:

- every important state change is traceable
- operator actions are distinct from AI suggestions
- unresolved evidence blocks smooth-looking false confidence

Not allowed:

- no hidden auto-accept behavior
- no silent replacement of human-reviewed evidence

Exit gate:

- audit path proves who accepted what, from which evidence, and under which governance state

### Module 8 - Calibration, Replay, and Investor-Confidence Pack

Purpose:
Prove that the new layer is dependable before broad rollout.

In scope:

- locked scenario pack for AI-assisted evidence workflows
- replay tests for edge cases
- contradiction and ambiguity test pack
- investor-summary red-team review
- workflow timing and operator-friction review

Required behavior:

- deterministic core outputs remain unchanged across AI on or off modes
- AI-assisted summaries remain subordinate to governance
- dangerous deals do not look polished or safe by wording alone

Exit gate:

- approval package shows reliability, governance integrity, evidence consistency, and workflow safety

## Module Dependency Order

Recommended order:

1. Module 0
2. Module 1
3. Module 2
4. Module 3
5. Module 4
6. Module 5
7. Module 6
8. Module 7
9. Module 8

Modules 3 to 8 should remain blocked until Modules 1 and 2 are complete.

Investor summary generation should remain blocked until contradiction handling is already working.

## Validation Standard

Each module should prove:

- deterministic core outputs are unchanged unless an approved deterministic rule was intentionally added
- governance remains final authority
- edge cases are surfaced, not hidden
- evidence sources remain visible
- advisory AI output can fail safely without breaking the deal engine

## Out of Scope for This Roadmap

This roadmap does not approve:

- autonomous offer decisions
- AI-driven pricing authority
- AI-driven MAO adjustment
- AI governance override
- uncited investor narratives
- hidden confidence blending between AI and deterministic logic
- live integrations unless separately approved
- broad Phase 3 implementation in one pass

## Readiness Statement

Phase 3 can begin only after formal acceptance that Phase 2 is stable enough to protect investor confidence during expansion.

When Phase 3 is eventually approved, it should begin with deterministic evidence structure and validation first, then add tightly bounded AI interpretation later.

That sequencing is necessary to preserve reliability, governance integrity, evidence consistency, and workflow trust.
