# Phase 4A Persistence Implementation Plan

## Purpose
This document defines the smallest safe path from Phase 4A contracts/guard logic into persistence implementation.

## Implementation Sequence
1. Create minimal schema/migration for seven data areas.
2. Add repository/storage helpers for saved deals only.
3. Add snapshot preservation on save.
4. Add pipeline event recording.
5. Add offer/task/evidence/audit helpers later in separate steps.
6. Wire UI only after persistence helpers are tested.

## First Migration Scope
- deals
- deal_snapshots
- pipeline_events
- offers
- tasks
- evidence_items
- audit_events

- migration should mirror Step 2B fields only
- no extra CRM fields
- no multi-user ownership fields unless existing app conventions absolutely require it
- no advanced RLS unless repo already uses auth/RLS conventions
- no triggers unless necessary

## First Implementation Boundary
The first implementation step after this plan should only create schema/migration and type alignment, not UI/API.

## Guard Integration Boundary
- evaluateOperatorGuard remains pure
- persistence should record outcomes, not change governance logic
- pipeline progression should call guard later in a separate step
- saved snapshot must not be rewritten by pipeline or offer changes

## Explicit Non-Goals
- no UI
- no API routes yet
- no command view yet
- no offer engine behavior yet
- no task engine behavior yet
- no automation
- no AI/scraping/integrations
- no multi-user permissions
- no deterministic engine changes

## Recommended Next Step
Phase 4A Step 4B - Minimal Schema/Migration Only.
