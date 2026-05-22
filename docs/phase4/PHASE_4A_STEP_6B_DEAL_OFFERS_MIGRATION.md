# Phase 4A Step 6B deal_offers Migration

## Purpose
Add the minimal Phase 4A `deal_offers` table migration only.

## Table Created
- `deal_offers`
- migration: `db/migrations/20260522_phase4a_deal_offers_table.sql`

## Field List
- `id`
- `deal_id`
- `offer_amount`
- `offer_type`
- `offer_status`
- `offer_rationale`
- `seller_response`
- `created_at`

## Migration Boundary
- migration/schema only
- no repository helpers
- no API routes
- no UI wiring
- no guard changes
- no engine logic changes

## Intentionally Not Added
- no extra fields
- no triggers
- no RLS
- no seed data
- no additional indexes
- no tasks/notes/evidence/audit/command view behavior

## Recommended Next Step
Phase 4A Step 6C - Offer repository helpers only.

Status note: Phase 4A Step 6B-1 reconciled deal_offers.deal_id with saved_deals.id type. No offer repository, API, UI, task, note, command view, or engine behavior added.
