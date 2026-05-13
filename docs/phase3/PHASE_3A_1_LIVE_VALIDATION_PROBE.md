# Phase 3A-1 Live Validation Runner Probe

## Purpose

This probe validates that live Phase 2 validation runner outputs can be converted into Phase 3 orchestration outputs through a non-UI path.

It exists to verify integration compatibility before any runtime route wiring.

## What The Probe Validates

- all locked Phase 2 scenarios can produce full `Phase2AnalysisOutput` via the live validation runner
- each scenario can produce a `Phase3DeterministicSnapshot` through the pure adapter
- each snapshot can produce a `Phase3OrchestrationOutput` through the orchestration engine
- outputs remain deterministic and repeatable

## Why This Is Not UI Wiring

The probe runs only in helper/test paths:

- helper: `lib/validation/run-phase3-orchestration-probe.ts`
- tests: `__tests__/phase3-orchestration-probe.test.ts`

No app route or calculator rendering path is modified.

## Expected Source

Source is the live Phase 2 validation runner full `actualOutput` payload per scenario, not summary JSON.

## Expected Transformation

`Phase2AnalysisOutput` -> `Phase3DeterministicSnapshot` -> `Phase3OrchestrationOutput`

## Safety Boundaries

- no UI route wiring
- no app/page calculator wiring
- no AI or scraping
- no external service calls
- no persistence expansion
- no file writes by the probe helper
- no changes to Phase 2 validation runner behavior

## Test Coverage Summary

Probe coverage currently validates:

- full scenario coverage across all 15 locked fixtures
- snapshot and orchestration output creation per scenario
- non-mutation of Phase 2 `actualOutput` when probing from an existing validation run
- absence of AI/scraping/CRM/persistence fields
- deterministic repeatability across repeated probe runs
- no-deal mapping to `no_deal` with `capital_protection` routing
- review-required mapping to `review_required` with manual/evidence routing classes
