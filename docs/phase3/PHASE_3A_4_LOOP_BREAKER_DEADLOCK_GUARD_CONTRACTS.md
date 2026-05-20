# Phase 3A-4 Loop Breaker and Deadlock Guard Contracts

## Purpose
Define Phase 3A-4 loop breaker and deadlock guard contracts for controlled hardening without runtime detection or workflow behavior changes.

## Loop Risk Types
- repeated_same_escalation
- repeated_failed_transition
- unresolved_advisory_loop
- workflow_stuck_between_states
- recurring_manual_review_trigger

## Loop Breaker Contract
- riskType
- status
- progression
- reason
- thresholdExceeded
- manualReviewRequired
- advisoryOnly

## Deadlock Guard Contract
- detectedRiskTypes
- status
- progression
- reason
- manualReviewRequired
- advisoryOnly

## Threshold-Exceeded Expected Contract State
If threshold is exceeded, contract state must be:
- status = manual_review_required
- progression = blocked
- reason = loop_or_deadlock_risk
- manualReviewRequired = true

## Confirmation This Is Contract-Only
This step adds type contracts and readonly constants only. No runtime loop detection behavior is added.

## Confirmation No Runtime Detection/Workflow Mutation Exists
No runtime detection helpers, transition logic, or workflow mutation behavior was added.

## Recommended Next Step
Phase 3A-4 Step 7 — Governance Drift Detection Contracts + Fixtures
