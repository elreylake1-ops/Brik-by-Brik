# Phase 4A DB Target Environment Plan

## Purpose
This document defines what must be confirmed before adding live saved-deal repository implementation.

## Current State
- raw SQL migration exists
- repository interface exists
- no DB client exists
- no ORM exists
- no migration runner exists
- no live repository implementation exists

## DB Target Decision Needed
Before live persistence, the project must confirm:
- target database
- local database setup
- production database setup
- migration application method
- connection environment variables
- whether DB access happens server-side only

## Recommended Lean Path
- use raw SQL migration already created
- avoid ORM for now
- add the smallest DB client only after target DB is confirmed
- implement saved-deal repository helpers first
- defer offers/tasks/evidence/audit helpers
- keep repository behind the existing adapter interface

## Environment Variables To Confirm Later
- DATABASE_URL or equivalent
- DB_SSL_MODE if required
- any provider-specific connection variable if chosen later

Do not add these variables until DB target is confirmed.

## Security Boundary
- DB credentials must never be exposed client-side
- repository helpers should remain server-side only
- command UI should call safe server actions/API only in later steps
- no public SaaS or multi-user model in Phase 4A

## Migration Application Boundary
- SQL should be applied only after target DB confirmation
- rollback plan should be reviewed before production application
- no seed data should be added unless approved

## Explicit Non-Goals
- no DB client installation
- no repository implementation
- no migration runner
- no API routes
- no UI
- no saved-deal runtime behavior
- no deterministic engine changes

## Recommended Next Step
Phase 4A Step 4K - DB Client Decision + Minimal Install Plan.

Status note: Phase 4A Step 4K DB client decision and install plan created. No DB client, DB adapter, repository implementation, API, UI, or saved-deal behavior added.
