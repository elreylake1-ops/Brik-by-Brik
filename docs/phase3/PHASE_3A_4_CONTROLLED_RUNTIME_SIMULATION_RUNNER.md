# Phase 3A-4 Controlled Runtime Simulation Runner

## Purpose
Provide a pure, deterministic, fixture-only simulation runner that validates controlled simulation fixtures and returns locked expected outputs for Step 8 scenarios.

## Runner-Only Boundary
This step adds isolated fixture runner functions only:
- runControlledSimulationFixture(fixture)
- runControlledSimulationFixtures(fixtures)

No runtime wiring or live enforcement behavior is added.

## How It Differs From Live Runtime Enforcement
The runner does not evaluate governance logic at runtime. It only validates fixture contract integrity and returns fixture.expectedOutput when valid.

## Input/Output Summary
Single fixture runner result:
- valid
- simulationId
- scenarioId
- output (expectedOutput or null)
- errors
- warnings

Multi-fixture runner summary:
- valid
- fixtureCount
- passedCount
- failedCount
- results
- errors
- warnings

## Deterministic Behavior Rules
- validate fixture(s) first
- if validation fails: return failed deterministic result with output:null
- if validation passes: return fixture expectedOutput exactly
- no mutation of input fixtures
- no timestamps, randomness, or generated ids

## What It Does Not Do
- does not execute live runtime enforcement
- does not infer new governance behavior
- does not run workflow transitions
- does not call APIs, AI, scraping, CRM, or integrations
- does not read/write files at runtime
- does not access database or persistence
- does not wire into UI, routes, calculator, or orchestration runtime

## Current Test Coverage
Covers successful runs across all locked fixtures, invalid fixture handling, deterministic repeated output equality, no-mutation guarantees, and no forbidden runtime/live fields introduced in outputs.

## Recommended Next Step
Phase 3A-4 Step 8E - isolated orchestration integration probe (still non-runtime-wired).