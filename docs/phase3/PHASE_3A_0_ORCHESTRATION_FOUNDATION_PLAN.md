# Phase 3A-0 Orchestration Foundation Plan

## Status

Phase 2 has been accepted with limitations acknowledged.

Controlled Phase 3A-0 may begin.

Phase 3A-0 closure report created; orchestration foundation is ready for review before the next controlled phase.

## Phase Boundary

Phase 3A-0 is orchestration-only.

This phase does not authorize intelligence extraction, scoring changes, or autonomous actions.

## What Is Approved In Phase 3A-0

- orchestration foundation
- workflow state handling
- global deal states
- central engine orchestrator
- shared types and interfaces
- standardized JSON-style contracts
- task generation framework
- governance escalation routing

## What Is Not Approved In Phase 3A-0

- AI layers
- scraping
- Rightmove, Zoopla, or Land Registry integrations
- CRM expansion
- autonomous workflows
- persistence expansion
- heavy UI scaling
- public SaaS scaling
- mobile app expansion

## Deterministic Protection Rule

The deterministic core remains the source of truth.

During Phase 3A-0:

- existing deterministic outputs must remain stable
- no deterministic formulas are changed
- True MAO is unchanged
- finance calculations are unchanged
- governance thresholds are unchanged
- deal classifications are unchanged
- capital protection logic is unchanged
- main calculator behavior is unchanged

## Purpose Of This Foundation

Phase 3A-0 prepares structure for later intelligence modules without implementing those modules.

It creates safe orchestration scaffolding so future modules can plug in without weakening governance-first deterministic control.

## Step 2 - Contract Hardening

Phase 3A-0 Step 2 hardens orchestration contracts for safe module plug-in behavior.

Scope summary:

- contract stability for orchestration input, output, metadata, tasks, and escalation route
- no randomness and no date/time generation in orchestration output
- no mutation of deterministic snapshot input or accepted limitation inputs
- stable task IDs for repeatable downstream routing
- advisory-only orchestration output with no decision override authority
- deterministic engine remains the source of truth for final deal decisions

## Step 3 - Task Generation Framework

Phase 3A-0 Step 3 hardens orchestration task generation for predictable workflow guidance.

Scope summary:

- stable task IDs for consistent downstream workflow references
- deterministic task order across repeated identical inputs
- no duplicate trigger tasks when evidence-gap inputs contain duplicates
- manual review orientation for evidence and governance escalations
- accepted limitations are awareness-only and non-blocking by themselves
- tasks remain advisory and do not alter deterministic engine results

## Step 4 - Governance Escalation Routing

Phase 3A-0 Step 4 hardens escalation routing for deterministic and review-safe orchestration behavior.

Scope summary:

- deterministic routing priority with explicit guardrail behavior for unsupported states
- capital protection route priority for deterministic blocked or no-deal outcomes
- evidence-gap routing remains manual-review oriented, with explicit valuation, legal, and lender review routes only when related evidence gaps are present
- accepted limitations remain awareness-only and do not trigger escalation by themselves
- escalation remains advisory workflow routing only and cannot override deterministic decisions
- deterministic engine remains the source of truth for governance and final classification

## Step 5 - Output Fixture Locking

Phase 3A-0 Step 5 locks representative orchestration outputs as stable contract references.

Scope summary:

- representative output fixtures captured for intake, no-deal, review-required, valuation-review, and accepted-limitations awareness scenarios
- exact output comparison tests validate workflow state, deal state, escalation route, metadata, and full task arrays
- fixture JSON files serve as stable contract references for future module integration work
- fixture-lock tests provide drift protection so later Phase 3 modules cannot silently alter orchestration contracts
