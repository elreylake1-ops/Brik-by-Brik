# Phase 3 Internal Implementation Plan

## Purpose

This document is the internal implementation-control plan for Phase 3.

It aligns with the client-facing roadmap in `docs/client-return/phase3/PHASE_3_INVESTOR_INTELLIGENCE_ROADMAP.md`, but it is stricter about sequencing, module boundaries, test gates, and execution control inside the repo.

This document is planning only.

It does not authorize Phase 3 implementation.

## Status Note

Phase 2 acceptance has been received.

First approved implementation scope is Phase 3A-0 orchestration foundation only.

Phase 3A-0 is closed. Phase 3A-1 has begun with orchestration integration readiness only; no UI wiring, intelligence, AI, scraping, or persistence has been approved.

Phase 3A-1 is closed. The Phase 2 to Phase 3 orchestration bridge is proven in tests but remains unwired to runtime UI. Recommended next phase is Phase 3B-0 Evidence Intake Contract Foundation.

Phase 3B-0 has begun with evidence intake contract planning only. No evidence ingestion, AI, scraping, persistence, or UI wiring is approved.

## Blocking Rule

Phase 3 remains blocked until Phase 2 operational acceptance is complete.

That means Phase 3 implementation must not start until the following are accepted:

- the Phase 2 validation package
- the locked validation runner outputs
- the live calculator walkthrough evidence
- the open Phase 2 limitations or explicit operating acceptance of those limitations

Phase 3 must not be used to compensate for unresolved Phase 2 issues.

## James Stabilization Priorities

All Phase 3 planning and later implementation must preserve this priority order:

1. deterministic reliability
2. governance integrity
3. edge-case handling
4. evidence consistency
5. investor confidence
6. workflow smoothness

If a proposed Phase 3 module weakens any higher-priority item in order to improve a lower-priority item, the module should be blocked until redesigned.

## Architecture Rule

Phase 3 is an interpretation and intelligence layer only.

The deterministic core remains locked.

Phase 3 must follow:

Deterministic Core + AI Interpretation Layer

### Locked deterministic core

The following remain source-of-truth outputs and must not be overridden by Phase 3:

- True MAO
- finance calculations
- governance states
- governance thresholds
- deal classifications
- core deal math
- capital protection logic
- final deterministic deal result

### Allowed Phase 3 role

Phase 3 may support:

- evidence extraction
- evidence tagging
- evidence interpretation
- confidence commentary
- signal classification
- investor-facing summary composition
- negotiation framing support

### Forbidden Phase 3 role

Phase 3 must never:

- override MAO
- override finance logic
- override governance states
- override deal classifications
- change deterministic formulas
- suppress warnings or fatal risk states
- act as the final deal decision maker

AI must never override MAO, finance logic, governance states, or deal classifications.

## Implementation Control Rules

- Phase 3 must be implemented module-by-module.
- Every module requires a test gate before the next module can start.
- No single Codex instruction should implement all of Phase 3.
- No Phase 3 work should bypass the existing deterministic engine boundaries.
- Advisory outputs must remain visibly advisory.
- Manual reviewer challenge paths must remain available wherever interpretation is added.

## Phase 3A-0 - Foundation

Purpose:
Prepare controlled implementation foundations without introducing live intelligence behavior.

Planned scope:

- schemas
- evidence tags
- shared confidence model
- validators
- fixtures
- feature flag

Boundaries:

- no UI
- no AI
- no parser yet

Release gate:

- contracts are locked
- fixtures cover normal, weak, contradictory, and incomplete evidence cases
- feature flag defaults to off

## Phase 3A - Listing Intelligence + Seller Motivation

Purpose:
Interpret listing text and seller signals without changing the deterministic deal engine.

Planned scope:

- listing parser
- seller motivation index
- negotiation pressure flags
- advisory listing signals

Required release condition:

- 50+ listing fixtures before release

Boundaries:

- no change to MAO
- no change to finance outputs
- no automatic governance override
- no final deal classification changes from listing intelligence alone

## Phase 3B - Refurb Intelligence

Purpose:
Improve interpretive understanding of property condition while keeping refurb cost authority deterministic.

Planned scope:

- manual photo or room notes first
- condition tiers
- likely refurb tasks
- evidence tags

Boundaries:

- no auto-overrides to refurb cost without user approval
- no automatic replacement of task-based refurb engine outputs
- no hidden capex uplift

Required release condition:

- advisory refurb intelligence stays visibly separate from deterministic refurb cost

## Phase 3C - GDV Confidence

Purpose:
Add a controlled confidence layer around comparable quality and valuation support.

Planned scope:

- comparable scoring
- recency scoring
- proximity scoring
- similarity scoring
- condition-match scoring
- confidence label
- evidence gaps
- required evidence to upgrade confidence

Boundaries:

- no automated valuation guarantee
- no automatic MAO changes
- no hidden adjustment to deterministic GDV logic unless explicitly approved in a later deterministic phase

Required release condition:

- confidence downgrade logic is visible and challengeable

## Phase 3D - Negotiation Intelligence

Purpose:
Support disciplined acquisition conversations without encouraging overpaying.

Planned scope:

- first offer framing
- justification bullets
- agent script
- WhatsApp summary
- offer ladder
- walk-away threshold

Boundaries:

- no overpay encouragement
- no automated offer submission
- no automatic decision to exceed deterministic safety boundaries

Required release condition:

- negotiation outputs remain subordinate to deterministic capital-protection logic

## Phase 3E - Investor Summary / Export Readiness

Purpose:
Prepare structured investor-facing outputs while keeping export implementation deferred.

Planned scope:

- structured investor summary
- export-ready section structure
- summary composition rules

Boundary:

- PDF-ready sections later only after UI outputs pass
- no CRM automation unless separately approved

Required release condition:

- summaries preserve warnings, review states, and evidence gaps without softening them

## Module Map

Planned module map:

- Listing Intelligence Parser
- Seller Motivation Index
- Photo/Refurb Intelligence
- GDV Confidence Engine
- Value-Add Detector
- Risk Radar Engine
- Negotiation Intelligence Layer
- Investor Summary Composer

These modules are intelligence modules only.

They do not become the source of truth for the final deal result.

## Architecture Notes

Phase 3 should fit above the existing deterministic core using a layered structure:

1. existing deterministic core
2. structured evidence store or interface
3. intelligence modules
4. optional AI wrapper later
5. composer and export layer

Architecture rules:

- all intelligence outputs are advisory only
- deterministic deal result remains source of truth
- evidence provenance must remain visible
- summary layers must consume deterministic outputs, not replace them
- optional AI wrapper remains optional and should be introduced only after deterministic evidence contracts are stable

## Testing Gates

Every module should define and pass relevant gates before progression:

- schema validation tests
- golden property tests
- dangerous deal tests
- evidence quality tests
- false-positive tests
- duplicate signal tests
- prompt injection tests once AI wrapper exists
- UI speed tests
- PDF tests only when PDF is approved

Testing intent by phase:

- Phase 3A-0: schema validation, fixtures, duplicate signal coverage, evidence quality tests
- Phase 3A: listing fixtures, false-positive tests, dangerous deal tests, golden property tests
- Phase 3B: evidence quality tests, false-positive condition tests, dangerous deal tests
- Phase 3C: golden comparable scoring tests, downgrade-path tests, evidence-gap tests
- Phase 3D: negotiation safety tests, walk-away threshold tests, dangerous deal wording tests
- Phase 3E: summary integrity tests, warning-preservation tests, UI speed tests when UI exists

## Operational Gate Rules

- A module should not release on anecdotal success.
- A module should not ship with unresolved dangerous-deal false positives.
- A module should not hide missing evidence behind polished wording.
- A module should not increase workflow smoothness by weakening governance integrity.
- A module should not be merged as a broad Phase 3 batch.

## Explicit Non-Goals

This planning step does not approve:

- live scraping now
- automated valuation guarantee
- automatic MAO changes
- AI-driven deal decision
- automated offer submission
- CRM automation universe
- PDF implementation in this planning step
- persistence expansion in this planning step

It also does not approve:

- Phase 3 source code generation in one pass
- schema or validator implementation in this planning step
- fixture creation in this planning step
- UI component implementation in this planning step
- parser implementation in this planning step

## Repo Execution Note

When implementation eventually begins, each Phase 3 module should be delivered in small isolated instructions with explicit file boundaries, explicit tests, and an explicit statement of what remains intentionally unimplemented.

That control is required to protect deterministic reliability, governance integrity, and investor confidence while the intelligence layer expands.
