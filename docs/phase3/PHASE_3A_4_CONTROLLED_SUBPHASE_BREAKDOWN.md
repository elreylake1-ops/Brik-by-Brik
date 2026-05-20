# Phase 3A-4 Controlled Subphase Breakdown

## Purpose
This document breaks Phase 3A-4 into small controlled subphases with audit stops.

## Implementation Rule
Phase 3A-4 must not be implemented as one large build.

## Required Audit Stop Rule
Every subphase must:
- inspect relevant docs/contracts first
- make only scoped changes
- run tests/build/lint
- commit only if checks pass
- report final git status
- stop for review before next subphase

## Proposed Subphases

### Step 1A — SOP Intake + Scope Boundary
Status: complete.

### Step 1B — Controlled Subphase Breakdown
Status: current step.

### Step 1C — Architecture Readiness Audit
Documentation only. Audit existing Phase 3A-3 enforcement engine, probe, merge layer, orchestration layer, and dev review surface against Phase 3A-4 needs.

### Step 2 — Severity Tiers + Precedence Matrix Contracts
Types/tests only. No runtime wiring.

### Step 3 — Safe Runtime Mode + Governance Version Metadata Contracts
Types/tests only. No runtime behavior.

### Step 4 — Conflict Visualization + Telemetry Contracts
Contracts/tests only. No persistence.

### Step 5 — Human Override Governance Contracts
Contracts/tests only. No runtime override behavior.

### Step 6 — Loop Breaker + Deadlock Guard Contracts
Contracts/fixtures/tests only. No runtime wiring.

### Step 7 — Governance Drift Detection Contracts + Fixtures
Contracts/fixtures/tests only. No AI.

### Step 8 — Controlled Runtime Simulation Harness
Isolated simulation only. No live app wiring.

### Step 9 — Isolated Orchestration Enforcement Integration Probe
Probe only. No live runtime behavior.

### Step 10 — Closure Report + Client Checkpoint
Documentation only.

## Subphase Non-Goals
- no AI
- no scraping
- no persistence
- no CRM
- no external integrations
- no automation scaling
- no heavy UI expansion
- no formula changes
- no True MAO changes
- no finance changes
- no governance threshold changes
- no classification changes
- no capital protection weakening

## Recommended Next Step
Phase 3A-4 Step 1C — Architecture Readiness Audit
