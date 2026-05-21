# Phase 4A Repository Adapter Interface

## Purpose
Define the minimal Phase 4A repository adapter interface contracts before any saved-deal persistence behavior is implemented.

## Interface-Only Boundary
This step adds TypeScript interface/input contracts only. It does not add repository implementation, DB calls, business logic, API routes, UI, or runtime wiring.

## Methods Included
- createOperatorDeal
- getOperatorDealById
- updateOperatorDealMetadata
- archiveOperatorDeal
- createDealSnapshot
- getLatestDealSnapshot
- recordPipelineEvent

## What This Does Not Do
- does not execute SQL or connect to a DB client
- does not implement helper behavior
- does not add saved-deal workflows
- does not add offer/task/evidence helper implementations

## Why No DB Calls Were Added Yet
Migration SQL exists, but migration execution workflow/tooling and DB adapter conventions remain unconfirmed in this repo.

## Recommended Next Step
Phase 4A Step 4G - Minimal Repository Adapter Skeleton with explicit TODO boundaries (still no live DB wiring until migration tooling is confirmed).

Status note: Phase 4A Step 4G migration execution tooling decision created. No migration tooling, DB client, repository implementation, API, UI, or saved-deal behavior added.
