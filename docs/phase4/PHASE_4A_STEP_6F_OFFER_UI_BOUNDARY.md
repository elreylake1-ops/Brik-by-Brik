# Phase 4A Step 6F Offer UI Boundary

## Purpose
This document defines the minimum safe UI boundary for adding offer/counter-offer recording after offer POST/GET API routes are working.

## Current Capability
- saved deals can be created, listed, opened read-only
- pipeline state can be updated with guard enforcement
- offers can be created through POST API
- offers can be listed through GET API
- no offer UI exists yet

## Offer UI Goal
- James should be able to record an offer or counter-offer from the selected saved deal panel
- James should be able to see offer history for the selected saved deal
- UI should call `POST /api/saved-deals/[id]/offers`
- UI should call `GET /api/saved-deals/[id]/offers`
- offer UI must not modify `saved_deals`
- offer UI must not change pipeline state
- offer UI must not recalculate engine result

## Recommended Minimal Path
1. Add small offer form inside selected saved deal panel.
2. Fields:
   - `offer_amount`
   - `offer_type`
   - `offer_status`
   - `offer_rationale`
   - `seller_response`
3. Add `Add Offer` button.
4. Fetch and display offer history for selected saved deal.
5. Refresh offer list after successful add.
6. Keep status/seller-response updates for later.

## Boundaries
- no automated offer generation
- no email/send behavior
- no negotiation automation
- no task creation
- no command view
- no pipeline mutation from offer UI
- no engine recalculation
- no snapshot mutation

## Recommended Next Step
Phase 4A Step 6G - Minimal Offer UI Only.
