# Phase 4A DB Client Decision and Install Plan

## Purpose
This document records the DB client decision path before any installation or repository implementation.

## Current State
- raw SQL migration exists
- repository interface exists
- DB target not confirmed
- no DB client installed
- no ORM installed
- no migration runner installed
- no live repository implementation exists

## Decision Principle
- do not add ORM yet
- prefer the smallest DB client compatible with the confirmed target DB
- keep repository implementation behind the existing adapter interface
- saved-deal helpers first only
- no offer/task/evidence/audit helpers yet

## Candidate Paths
1. Native Postgres client if target DB is Postgres-compatible.
2. Provider SDK only if the target provider requires it.
3. Lightweight SQL client only if target DB requires it.
4. No client until DB target is confirmed.

## Recommended Decision For Now
- Do not install a DB client yet.
- Confirm the DB target first.
- Once confirmed, install only the smallest suitable server-side client.
- Avoid ORM/migration framework unless later complexity proves necessary.

## Minimal Install Plan After DB Target Confirmation
1. Add one DB client dependency.
2. Add one server-only DB adapter file.
3. Use existing repository interface.
4. Implement saved-deal repository helpers only.
5. Keep migration application separate.
6. Keep UI/API wiring separate.

## Environment Variables To Add Later
- DATABASE_URL or provider equivalent
- DB_SSL_MODE only if required
- provider-specific env var only if chosen

Do not add env vars until the target is confirmed.

## Explicit Non-Goals
- no package installation now
- no DB adapter now
- no repository implementation now
- no migration runner now
- no API routes
- no UI
- no saved-deal behavior
- no deterministic engine changes

## Recommended Next Step
Phase 4A Step 4L - Confirm DB Target With James/Karlo.
