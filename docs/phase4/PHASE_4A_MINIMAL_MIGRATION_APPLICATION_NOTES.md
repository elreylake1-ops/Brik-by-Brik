# Phase 4A Minimal Migration Application Notes

## Purpose
This document records the minimum practical notes for applying the raw Phase 4A SQL migration when live persistence begins.

## Current Migration File
- db/migrations/20260521_phase4a_minimal_schema.sql

## Application Assumption
- migration is raw SQL
- no ORM or migration framework is currently adopted
- SQL should be applied manually or through a minimal script only after target DB is confirmed

## Before Applying
- confirm target database
- confirm local vs production DB environment
- confirm backup/rollback expectation
- confirm operator command tables do not already exist
- confirm SQL syntax matches target DB
- confirm child table foreign keys are acceptable for the chosen DB

## Minimal Manual Application Path
1. Open target DB SQL console or approved SQL client.
2. Review the SQL file.
3. Apply the migration once.
4. Verify the seven tables exist.
5. Do not seed data unless separately approved.

## Rollback Note
- rollback is not automated yet
- if rollback is required, create a reviewed manual rollback plan before applying to production
- do not drop tables casually once live deal data exists

## Repository Dependency Note
- repository helpers should not be considered live until the migration has been applied to the target DB
- repository implementation should start with saved-deal helpers only

## Explicit Non-Goals
- no script added
- no DB client added
- no ORM/migration framework added
- no repository implementation
- no API routes
- no UI
- no saved deal behavior
- no deterministic engine changes

## Recommended Next Step
Phase 4A Step 4I - Saved Deal Repository Implementation Boundary.

Status note: Phase 4A Step 4I saved-deal repository implementation boundary created. No DB client, DB calls, repository implementation, API, UI, or saved-deal runtime behavior added.
