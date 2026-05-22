# Phase 4A Step 8A Operator Command View Boundary

## Purpose
Define the minimum safe boundary for creating the Phase 4A Operator Command View after saved deals, pipeline, offers, and tasks are working.

## Current Capability
- saved deals can be created, listed, and opened read-only
- pipeline state can be updated with guard enforcement
- offers and counter-offers can be created and viewed
- tasks and blockers can be created and viewed
- no consolidated command view exists yet

## Command View Goal
- James should see one operational view for the selected saved deal
- command view should summarize governance, risk, pipeline, offer position, tasks/blockers, and next action
- command view must show governance and capital protection before execution status
- command view must not recalculate deterministic output
- command view must not mutate saved deal data

## Recommended Minimal Path
1. Reuse the selected saved deal detail panel in `app/page.tsx`.
2. Add a compact `Operator Command` section above pipeline, offer, and task controls.
3. Show:
   - `address`
   - `classification`
   - `governance_state`
   - `capital_protection_state`
   - `pipeline_state`
   - `purchase_price`
   - `gdv_realistic`
   - `refurb_cost`
   - latest offer summary if available
   - open/blocking task summary if available
   - `next_action`
4. Use already loaded selected deal, offers, and tasks state where practical.
5. Do not add new backend routes unless absolutely necessary.

## Display Priority
1. Governance / capital protection
2. Deal decision and blockers
3. Pipeline state
4. Offer position
5. Task status
6. Next action

## Boundaries
- no AI summary
- no investor pack generation
- no exports
- no new persistence
- no new calculations
- no engine recalculation
- no snapshot mutation
- no CRM or dashboard expansion

## Recommended Next Step
Phase 4A Step 8B - Minimal Operator Command View UI Only.

Status note: Phase 4A Step 8B minimal operator command view UI created. No new API route, migration, export, automation, AI, investor pack, saved-deal mutation, pipeline mutation, offer mutation, task mutation, or engine behavior added.
