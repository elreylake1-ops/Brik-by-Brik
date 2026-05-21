# Phase 3A-4 Controlled Runtime Simulation Harness Validation Helper

## Purpose
Add a pure, fixture-only validation helper for controlled runtime simulation fixtures to enforce contract shape and boundary integrity before any future executable harness step.

## Helper-Only Boundary
This step adds validation logic only. It validates fixture structure and forbidden boundary fields but does not execute simulation behavior.

## Validation Rules Summary
The helper validates:
- fixture id, name, and description are present
- input and expectedOutput are present
- lockedBoundaryNotes exists and is non-empty
- input.simulationId matches expectedOutput.simulationId
- runtimeMode is fixture_only or sandbox_only
- governanceVersion is present in input and expectedOutput
- scenarioId is one of the locked simulation scenario ids
- expectedOutput.expectedResult is present
- expectedOutput includes all required output keys
- forbidden live/runtime keys do not appear anywhere in the fixture object
- duplicate fixture ids are rejected when validating arrays

## What It Does Not Do
- does not execute runtime enforcement
- does not execute a simulation runner
- does not mutate fixtures
- does not read/write files
- does not call APIs, AI, scraping, CRM, telemetry storage, or integrations
- does not wire into calculator, workflow engine, app routes, persistence, or UI
- does not use timestamps, clocks, or randomness

## Confirmation It Is Not The Runtime Simulation Harness
This helper is deterministic validation-only and is not the executable runtime simulation harness.

## Recommended Next Step
Phase 3A-4 Step 8D - Controlled runtime simulation harness executor (still isolated and non-runtime-wired).