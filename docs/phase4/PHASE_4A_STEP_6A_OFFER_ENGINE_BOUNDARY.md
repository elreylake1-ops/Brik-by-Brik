# Phase 4A Step 6A Offer Engine Boundary

## Purpose
This document defines the minimum safe boundary for adding offer/counter-offer tracking after saved-deal and pipeline movement are working.

## Current Capability
- saved deals can be created
- saved deals can be listed
- saved deals can be opened read-only
- pipeline state can be updated with guard enforcement
- no offer engine exists yet

## Offer Engine Goal
- James should be able to record an offer or counter-offer for a saved deal
- offer records must attach to a saved deal
- offer records must not rewrite `engine_result_json`
- offer records must not override governance state
- offer above MAO/capital-safe threshold should be warning/review later, not silent approval

## Recommended Minimal Path
1. Add minimal `deal_offers` migration/table only.
2. Add offer repository helpers only.
3. Add `POST /api/saved-deals/[id]/offers` only.
4. Add `GET /api/saved-deals/[id]/offers` only.
5. Add minimal offer UI after route tests pass.

## Minimal Offer Fields
- `id`
- `deal_id`
- `offer_amount`
- `offer_type`
- `offer_status`
- `offer_rationale`
- `seller_response`
- `created_at`

## Boundary Rules
- no automated offer generation
- no emails
- no AI summaries
- no negotiation automation
- no task creation yet
- no command view yet
- no engine recalculation
- no snapshot mutation

## Recommended Next Step
Phase 4A Step 6B - Minimal `deal_offers` Migration Only.

Status note: Phase 4A Step 6B minimal deal_offers migration created. No offer repository, API, UI, task, note, command view, or engine behavior added.
