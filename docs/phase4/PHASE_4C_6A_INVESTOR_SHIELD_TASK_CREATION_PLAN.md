# Phase 4C-6A Investor Shield Task Creation Plan

## Purpose
This document plans the future conversion of Investor Shield task drafts into persisted `deal_tasks`, but this step adds no writes.

## Current Baseline
- the pure Investor Shield evaluator returns `taskRecommendations` in memory
- the task draft builder converts those recommendations into in-memory task drafts
- no `deal_tasks` writes exist for Investor Shield yet
- no runtime enforcement exists yet

## Non-Negotiable Safety Rule
Investor Shield task creation may increase caution and create follow-up tasks, but it must never soften deterministic capital protection, True MAO, deal classification, or governance risk.

## Proposed 4C-6B Implementation Boundary
The next coding step should be limited to:
- add a narrow helper to persist Investor Shield task drafts
- use the existing deal task repository patterns under `brik_by_brik_engine.deal_tasks`
- keep persistence idempotent by `idempotencyKey`, or use a deterministic title/source/gate-key fallback if schema support is not yet available
- add no UI
- add no pipeline blocking
- add no API expansion unless required by an already-approved existing repository path
- add no automatic evidence satisfaction

## Idempotency Plan
- each Investor Shield task draft already carries a deterministic `idempotencyKey`
- repeated evaluator runs must not create duplicate tasks
- if `deal_tasks` lacks `idempotencyKey`, `source`, or gate-reference columns, use a safe fallback strategy:
  - check existing open tasks for the same `dealId` plus deterministic title/description/source marker before inserting
  - otherwise document that schema extension is required before safe persistence

## Failure Behavior
- task creation failure must not alter evaluator output
- task creation failure must not change saved deal status
- failures should be logged and surfaced in proof/test reporting, not hidden

## Future Helper Shape
Documentation-level only:

`persistInvestorShieldTaskDrafts(dealId, drafts)`

Expected output:
- `insertedCount`
- `skippedDuplicateCount`
- `failedCount`
- `errors`

## Tests Required Before Runtime Use
- inserts one task per unique draft
- skips duplicates on repeated run
- does not insert when no drafts exist
- preserves `dealId` as string
- does not change `saved_deals`
- does not evaluate or enforce pipeline movement
- handles insert failure safely
- creates no duplicate tasks after two identical calls

## Phase Boundary
- `4C-6B` = persist helper only
- `4C-6C` = runtime proof only
- `4C-7` = guarded pipeline movement integration later

## Recommended Next Step
Phase 4C-6B — Persist Task Draft Helper Only.
