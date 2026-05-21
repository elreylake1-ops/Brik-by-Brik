# Phase 4A Minimal Table Field Plan

## Purpose
This document lists the minimal planned fields for the Phase 4A data areas before any implementation.

## Field Planning Rules
- documentation-only
- no schema implementation yet
- single-operator first
- only fields needed for Phase 4A MVP
- preserve deterministic engine snapshot
- workflow cannot override governance
- evidence cannot reduce deterministic risk
- no CRM or multi-user expansion

## deals
Purpose:
Saved operational deal record.

Minimal fields:
- id
- address
- source_url
- pipeline_state
- governance_state
- classification
- notes
- created_at
- updated_at
- archived_at

## deal_snapshots
Purpose:
Preserved deterministic engine output at time of save.

Minimal fields:
- id
- deal_id
- engine_snapshot_json
- created_at

Note:
Pipeline and offer changes must not rewrite this snapshot.

## pipeline_events
Purpose:
State transition history.

Minimal fields:
- id
- deal_id
- from_state
- to_state
- reason
- blocked
- block_reason
- created_at

## offers
Purpose:
Offer and negotiation history.

Minimal fields:
- id
- deal_id
- offer_amount
- offer_type
- offer_rationale
- response_status
- counter_offer_amount
- negotiation_notes
- next_negotiation_action
- created_at

## tasks
Purpose:
Execution tasks and blockers.

Minimal fields:
- id
- deal_id
- task_type
- title
- status
- priority
- blocking
- created_by
- due_date
- completed_at
- created_at
- updated_at

## evidence_items
Purpose:
Light evidence placeholders only.

Minimal fields:
- id
- deal_id
- category
- title
- source_url
- notes
- file_placeholder
- created_at

## audit_events
Purpose:
Minimal operational traceability.

Minimal fields:
- id
- deal_id
- event_type
- event_payload_json
- created_at

## Explicit Non-Goals
- no schema implementation
- no migration
- no API route
- no UI
- no persistence logic
- no TypeScript contracts yet
- no saved deal functionality
- no advanced audit system
- no CRM abstraction
- no multi-user model
- no AI/scraping/integrations
- no changes to deterministic engine

## Recommended Next Step
Phase 4A Step 2C - Governance Guard Mapping.
