# Phase 3D-0 Runtime Review Surface Plan

## Purpose

This phase is planning-only for a future developer-only runtime review surface for Phase 3 merged advisory output.

This step does not implement runtime behavior.

Boundaries in this step:

- no route implemented yet
- no UI implemented yet
- no runtime wiring added
- no client-facing exposure
- no calculator changes
- no Phase 2 route changes
- no deterministic behavior changes

## Why This Phase Exists

The backend advisory chain is complete and fixture-locked through Phase 3C-0.

Before any runtime surface is introduced, the review surface must be designed so advisory output cannot be mistaken for final investment approval and cannot interfere with deterministic or existing review flows.

## Current Backend Chain Available

```
Phase2AnalysisOutput
-> mapPhase2OutputToPhase3Snapshot()
-> Phase3DeterministicSnapshot
-> buildPhase3Orchestration()
-> Phase3OrchestrationOutput

Phase3EvidenceBundle
-> validatePhase3EvidenceBundle()
-> mapEvidenceBundleToOrchestrationHints()
-> EvidenceOrchestrationHints

Phase3OrchestrationOutput + EvidenceOrchestrationHints
-> mergeOrchestrationWithEvidenceHints()
-> Phase3MergedOrchestrationOutput
```

## Proposed Future Review Surface

Recommended future route name:

- `/phase-3-dev-review`

This is safer than `/phase-3-review` because explicit `dev` naming reduces the chance of being interpreted as client-ready or decision-authoritative.

Future route requirements:

- explicitly developer/internal only
- start with locked fixtures, not live user input
- show merged output as advisory
- display deterministic state separately and above advisory evidence hints
- display `capital_protection` / `no_deal` status prominently
- never replace `/`
- never replace `/phase-2-review`
- never replace `/phase-2-live-review`

## Required UI Guardrails

- banner: `Developer Review Only - Advisory Phase 3 Output`
- deterministic decision section first
- advisory merged tasks below deterministic decision
- capital protection warnings visually dominant
- evidence hints labeled advisory
- no `approve deal` CTA
- no `send offer` CTA
- no automated action buttons
- no hidden warnings
- no confidence blending that makes weak evidence look clean

## Data Source Boundaries

Initial future route data source:

- locked Phase 3 fixtures only
- no live user input
- no database
- no external services
- no AI
- no scraping

Must not use:

- Rightmove / Zoopla / Land Registry
- saved deal persistence
- CRM data
- uploaded evidence files
- AI extraction

## Review Scenarios To Display Later

- no-deal with weak comparable hints
- review-required with legal conflict hints
- clean proceed with accepted operator note
- intake with missing lender hints

## Risk Controls

- risk: advisory output appears like final decision
  control: deterministic decision shown first and labeled source of truth
- risk: evidence hints soften no-deal
  control: capital protection remains dominant
- risk: operator thinks accepted evidence means accepted deal
  control: accepted evidence displayed as evidence status only
- risk: route gets used by client prematurely
  control: developer-only naming and documentation
- risk: UI grows into product dashboard too early
  control: fixture-only minimal review surface

## What Not To Build Yet

- no route implementation in this step
- no UI components in this step
- no live data
- no persistence
- no client-facing dashboard
- no AI/scraping/integration
- no workflow actions

## Recommended Next Step

**Phase 3D-0 Step 2 -- Runtime Review Surface Type/Fixture Readiness**

Step 2 should define route fixture pairings and display-section contracts only, with no route implementation yet.

## Step 2 -- Type and Fixture Readiness

Status: complete.

- display contract types added
- fixture pair data added
- guardrail tests added
- no route/UI implementation added

## Step 3 -- Developer Review Route Decision

Status: complete.

- route decision documented
- safety constraints defined
- no route/UI implementation added

## Step 4 -- Non-Linked Developer Route Skeleton

Status: complete.

- `/phase-3-dev-review` route created
- fixture-only data source
- not linked from existing routes
- no user input/actions
- advisory-only display
- no runtime behavior changes to calculator or Phase 2 routes
