# Phase 4A Minimal Schema Migration

## Purpose
Define the minimal Phase 4A schema/migration footprint for operator command persistence tables only.

## Tables Created
- deals
- deal_snapshots
- pipeline_events
- offers
- tasks
- evidence_items
- audit_events

## Boundary Confirmation
This step adds schema/migration artifacts only and mirrors Step 2B planned fields without additional product behavior.

## What Was Intentionally Not Added
- no repository helpers
- no persistence business logic
- no API routes
- no UI
- no saved deal behavior
- no runtime wiring
- no AI/scraping/CRM/integrations

## Recommended Next Step
Phase 4A Step 4C - Repository Helpers for Saved Deals Only.
