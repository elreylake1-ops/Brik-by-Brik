# Phase 4A Minimal Data Model Boundary

## Purpose
This document defines the minimum persistence boundary for the Phase 4A single-operator command MVP.

## Design Rules
- single-operator first
- operational command system, not CRM
- deterministic engine snapshot must be preserved
- workflow cannot override governance
- simple tables only
- no enterprise abstraction
- no multi-user permissions
- no AI, scraping, or integrations

## Required Data Areas
- deals
- deal_snapshots
- pipeline_events
- offers
- tasks
- evidence_items
- audit_events

## What Each Area Is For
- deals: saved operational deal record.
- deal_snapshots: preserved deterministic engine output at time of save.
- pipeline_events: state transition history.
- offers: offer and negotiation history.
- tasks: due diligence, blockers, review, and execution tasks.
- evidence_items: light evidence placeholders only.
- audit_events: minimal operational traceability.

## Explicit Non-Goals
- no schema implementation yet
- no migration yet
- no API routes
- no UI
- no saved deal behavior yet
- no full field definitions yet
- no multi-user model
- no CRM abstraction
- no AI/scraping/integrations
- no changes to deterministic engine

## Recommended Next Step
Phase 4A Step 2B - Minimal Table Field Plan.
