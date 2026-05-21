# Phase 4A Saved Deal Repository Implementation Boundary

## Purpose
This document defines the exact narrow boundary for the first saved-deal repository implementation step.

## Pre-Implementation Requirements
- target database must be confirmed
- migration application process must be confirmed
- environment variables must be known only if DB client is added
- existing repository interface must remain the contract
- first implementation must be saved-deal only

## First Implementation Scope
- createOperatorDeal
- getOperatorDealById
- updateOperatorDealMetadata
- archiveOperatorDeal
- createDealSnapshot
- getLatestDealSnapshot
- recordPipelineEvent

## Must Not Implement Yet
- offer repository helpers
- task repository helpers
- evidence repository helpers
- audit repository helpers
- API routes
- UI
- command view
- saved-deal button/wiring
- calculator integration
- migration runner
- broad ORM/framework
- multi-user/auth model

## Snapshot Preservation Rule
- createDealSnapshot stores deterministic output as provided
- pipeline, offer, task, and metadata changes must not rewrite existing snapshots
- if a new analysis is saved later, it should create a new snapshot, not mutate the old one

## Guard Logic Boundary
- evaluateOperatorGuard remains pure
- repository helpers should not decide governance outcomes
- pipeline events may record guard outcomes later
- actual guard invocation is a separate step

## Testing Boundary
- first repository implementation should use isolated tests
- no UI tests yet
- no API tests yet
- no live production DB assumptions
- if no DB client is added, repository implementation should not pretend to persist data

## Explicit Non-Goals
- no implementation in this step
- no DB client
- no DB calls
- no API
- no UI
- no saved-deal runtime behavior
- no deterministic engine changes

## Recommended Next Step
Phase 4A Step 4J - Confirm DB Target + Environment Plan.

Status note: Phase 4A Step 4J DB target/environment plan created. No DB client, DB calls, repository implementation, API, UI, or saved-deal behavior added.
