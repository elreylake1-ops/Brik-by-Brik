# Phase 4A Schema Type Alignment Check

## Purpose
This document checks alignment between the Phase 4A TypeScript contracts, minimal SQL migration, and Step 2B field plan.

## Alignment Scope
- deals
- deal_snapshots
- pipeline_events
- offers
- tasks
- evidence_items
- audit_events

## Alignment Checklist
- deals: fields match Step 2B; TypeScript object exists (`OperatorDeal`); SQL table exists; no extra CRM fields; no multi-user ownership fields; no AI/scraping/integration fields.
- deal_snapshots: fields match Step 2B; TypeScript object exists (`DealSnapshot`); SQL table exists; no extra CRM/multi-user/integration fields; `engine_snapshot_json` is JSON-compatible (`Record<string, unknown>` / `JSONB`).
- pipeline_events: fields match Step 2B; TypeScript object exists (`PipelineEvent`); SQL table exists; no extra CRM/multi-user/integration fields.
- offers: fields match Step 2B; TypeScript object exists (`OfferRecord`); SQL table exists; no extra CRM/multi-user/integration fields.
- tasks: fields match Step 2B; TypeScript object exists (`OperatorTask`); SQL table exists; no extra CRM/multi-user/integration fields.
- evidence_items: fields match Step 2B; TypeScript object exists (`EvidenceItem`); SQL table exists; no extra CRM/multi-user/integration fields.
- audit_events: fields match Step 2B; TypeScript object exists (`AuditEvent`); SQL table exists; no extra CRM/multi-user/integration fields; `event_payload_json` is JSON-compatible (`Record<string, unknown>` / `JSONB`).

## Expected Type / SQL Notes
- string IDs map to UUID/TEXT depending migration choice
- string fields map to TEXT
- numeric offer fields map to NUMERIC
- booleans map to BOOLEAN
- JSON objects map to JSONB
- date strings map to TIMESTAMPTZ
- nullable operational fields are allowed where planned

## Migration Framework Note
No existing migration framework was found, so the SQL file currently lives under:
`db/migrations/20260521_phase4a_minimal_schema.sql`

Future implementation should confirm how this SQL will be applied before runtime persistence is built.

## Findings
- aligned: Step 2B field plan, TypeScript contracts, and SQL migration align for all seven tables.
- minor follow-up needed: choose and standardize migration execution workflow/tooling before runtime persistence rollout.
- blocking issue: none.

No blocking alignment issues found.

## Explicit Non-Goals
- no schema expansion
- no repository helpers
- no API routes
- no UI
- no persistence business logic
- no saved deal behavior
- no deterministic engine changes

## Recommended Next Step
Phase 4A Step 4D - Minimal Repository Interface Plan.
