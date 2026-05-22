# Phase 4A Step 6D Offer API Route Boundary

## Purpose
This document defines the minimum safe API boundary for adding offer/counter-offer routes after repository helpers are ready.

## Current Capability
- saved deals can be created, listed, opened
- pipeline can be updated with guard enforcement
- `deal_offers` table exists
- offer repository helpers exist
- no offer API routes exist yet

## Offer API Goal
- James should be able to record an offer/counter-offer for a saved deal
- James should be able to list offers for a saved deal
- offer routes must attach to saved deal id
- offer routes must not rewrite `engine_result_json`
- offer routes must not modify governance/pipeline state yet

## Recommended Minimal Path
1. Add `POST /api/saved-deals/[id]/offers` only.
2. Add `GET /api/saved-deals/[id]/offers` only.
3. Keep update status/seller response routes for later.
4. Add offer UI only after route tests pass.

## Planned POST Input
- `offer_amount`
- `offer_type`
- `offer_status`
- `offer_rationale`
- `seller_response`

## Planned GET Response
- `success`
- `offers` array

## Boundaries
- no offer UI yet
- no automated offer generation
- no email/send behavior
- no negotiation automation
- no task creation
- no command view
- no engine recalculation
- no snapshot mutation

## Recommended Next Step
Phase 4A Step 6E - Offer POST/GET API Routes Only.
