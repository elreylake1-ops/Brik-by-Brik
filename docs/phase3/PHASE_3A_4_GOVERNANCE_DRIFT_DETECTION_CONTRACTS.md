# Phase 3A-4 Governance Drift Detection Contracts

## Purpose
Define Phase 3A-4 governance drift detection contracts and fixtures for controlled hardening without runtime detection behavior.

## Drift Types
- advisory_authority_drift
- ui_fatal_softening_drift
- workflow_reject_bypass_drift
- ai_governance_approval_drift

## Drift Actions
- block_and_log
- escalate_review
- preserve_deterministic_result
- require_manual_review

## Fixture List
- advisory-authority-drift.json
- ui-fatal-softening-drift.json
- workflow-reject-bypass-drift.json
- ai-governance-approval-drift.json
- clean-no-drift.json

## Clean No-Drift Fixture
`clean-no-drift.json` captures a no-drift case with `driftDetected: false`.

## Confirmation This Is Contract/Fixture-Only
This step adds type contracts and JSON fixtures only. No runtime detection behavior is added.

## Confirmation No Runtime Detection Exists
No detection helpers or runtime wiring were added to engine, orchestrator, UI, or routes.

## Confirmation No AI Logic Exists
No AI evaluation logic or model invocation behavior was added.

## Recommended Next Step
Phase 3A-4 Step 8 — Controlled Runtime Simulation Harness
