# Phase 4A Migration Execution Tooling Decision

## Purpose
This document decides the minimum migration execution path before live repository implementation.

## Current Finding
- SQL migration exists
- repository interface exists
- no DB client package found
- no ORM found
- no migration runner found
- no SQL execution script found
- no repository implementation exists yet

## Decision Options Considered
1. Keep raw SQL migration and document manual application.
2. Add a lightweight SQL execution script.
3. Introduce ORM/migration framework.
4. Defer live DB implementation and keep repository interface only.

## Recommended Decision
- Keep the raw SQL migration.
- Do not introduce ORM yet.
- Do not add a migration framework yet.
- Before live repository helpers, add one minimal documented migration application step or script only if needed.
- Keep Phase 4A focused on operational MVP, not infrastructure expansion.

## Why
- project currently has no persistence stack
- adding ORM now risks bloat
- Phase 4A needs saved-deal capability, not enterprise infrastructure
- raw SQL is enough for the current seven-table MVP
- repository interface already protects the application layer from future tooling changes

## Required Before Live Repository Implementation
- confirm target database
- confirm how SQL will be applied locally/production
- confirm environment variables only if DB client is added later
- confirm rollback/manual recovery expectations
- confirm repository implementation should target only saved-deal helpers first

## Explicit Non-Goals
- no ORM adoption now
- no migration runner implementation now
- no DB client install now
- no repository implementation now
- no API routes
- no UI
- no saved deal behavior
- no command view
- no deterministic engine changes

## Recommended Next Step
Phase 4A Step 4H - Minimal Migration Application Notes.
