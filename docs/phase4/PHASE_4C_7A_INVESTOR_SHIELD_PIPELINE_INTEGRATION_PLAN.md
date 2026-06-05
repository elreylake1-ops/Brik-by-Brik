# Phase 4C-7A Investor Shield Pipeline Integration Plan

## Purpose
This document plans future guarded Investor Shield integration into saved-deal and pipeline movement, but this step adds no runtime behavior.

## Current Baseline
- default Investor Shield checks exist for saved deals
- the Investor Shield evaluator is pure and returns enforcement state in memory
- the read-model helper loads Investor Shield state by `dealId`
- task recommendations, task draft building, and task persistence are implemented and proven
- no Investor Shield pipeline blocking exists yet

## Non-Negotiable Rule
Investor Shield may block progression, require review, and create caution tasks.

It must never soften deterministic `NO-GO`, True MAO, capital protection, or governance risk.

## Proposed 4C-7B Boundary
The next coding step should be limited to:
- add a guard helper that evaluates Investor Shield before pipeline movement
- return `ALLOW`, `NEEDS_REVIEW`, or `BLOCK`
- add no UI changes
- avoid direct route response redesign unless already needed by the existing movement path
- keep deterministic governance dominant over any Investor Shield result

## Movement Guard Rule Draft
- `CLEAR` -> allow movement
- `CAUTION` -> allow only if the target stage does not require lock clearance; otherwise return review-needed
- `BLOCKED` -> block movement into protected stages
- deterministic `NO-GO` or `REJECT` always blocks progression regardless of Investor Shield state
- waived blocker requires a manual override reason
- advisory-only AI evidence cannot clear hard evidence gates

## Protected Stage Draft
Candidate protected transitions for the next implementation step:
- moving to `READY_FOR_OFFER`
- moving to `DUE_DILIGENCE`
- moving to `COMPLETED`
- moving to `OFFER_SENT` or later offer-progression stages where evidence confidence is assumed complete
- any future stage such as `due-diligence-complete`, `exchange-ready`, or `investor-pack-ready`
- any stage that implies evidence confidence is complete

## Non-Protected Stage Draft
Candidate safe stages:
- `UNDER_ANALYSIS`
- review-oriented states
- evidence-gathering states
- negotiation preparation states before protected progression
- any future `draft`, `analysis`, `review`, `evidence-gathering`, or `negotiation-prep` equivalents

## Task Creation Interaction
- if movement is blocked or needs review, task draft persistence may be triggered only if separately approved
- task persistence must remain idempotent
- no duplicate `deal_tasks` may be created

## Failure Behavior
- if Investor Shield evaluation fails, fail closed for protected movement
- do not mutate saved deal stage on guard failure
- return or log a safe reason
- do not hide errors during proof or tests

## Future Helper Shape
Documentation-level only:

`guardInvestorShieldPipelineMovement({ dealId, currentStage, requestedStage, deterministicDealStatus })`

Expected output:
- `canMove`
- `movementDecision: ALLOW | NEEDS_REVIEW | BLOCK`
- `enforcementResult`
- `taskDrafts` optional
- `taskPersistenceResult` optional only if enabled
- `reasons`

## Tests Required Before Runtime Use
- clear gates allow movement to protected stage
- blocked gates block protected stage
- caution gates require review for protected stage
- caution gates allow movement to evidence-gathering
- deterministic `NO-GO` blocks all protected movement
- failed evaluation fails closed
- no saved deal mutation occurs when blocked
- task creation remains idempotent if enabled

## Phase Boundary
- `4C-7B` = pure movement guard helper only
- `4C-7C` = repository and route integration behind the existing movement path
- `4C-7D` = runtime proof
- UI panels remain Phase `4D`

## Recommended Next Step
Phase 4C-7B - Pure Pipeline Movement Guard Helper Only.
