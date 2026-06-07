# Phase 4D-2K Client Fetch Wiring Plan

## Purpose
This document plans the client fetch wiring only and makes no runtime, UI, or code changes.

## Current Ready Pieces
- The read-only API route exists at `app/api/saved-deals/[id]/investor-shield-ui/route.ts`.
- The isolated panel component exists in `components/InvestorShieldGateSummaryPanel.tsx`.
- The Investor Shield UI model type exists in `lib/investor-shield/investor-shield-ui-adapter.ts`.
- The saved deal detail surface exists in `app/page.tsx`.
- The panel is not connected yet.

## Proposed Future Client Flow
1. User selects a saved deal.
2. Selected saved deal id is available in `app/page.tsx`.
3. Client requests `GET /api/saved-deals/{id}/investor-shield-ui`.
4. Response model is stored in local read-only state.
5. Panel receives model as prop.
6. Loading, empty, and error copy render safely.
7. No writes, task creation, or pipeline mutation occur.

## Minimal State Shape
- `investorShieldModel`
- `investorShieldLoading`
- `investorShieldError`

## Fetch Trigger Rules
- Fetch only when selected saved deal id changes.
- Clear previous model when no saved deal is selected.
- Ignore stale responses if the selected id changes before fetch completes.
- Do not fetch during unrelated calculator edits.
- Do not retry aggressively.

## UI Placement
- Render inside the existing Saved Deal Detail section.
- Place after the core saved deal summary and before offers/tasks if practical.
- Avoid dashboard expansion.
- Avoid changing calculator results layout.

## Fallback Copy
- Loading: `Loading Investor Shield status...`
- Empty: `Investor Shield status is not available yet.`
- Error: `Investor Shield status could not be loaded. Pipeline rules remain unchanged.`

## Safety Rules For Future Wiring
Future implementation must:
- call only the read-only GET endpoint
- not call task persistence endpoints
- not call pipeline endpoints
- not add action buttons
- not add upload/edit/waiver controls
- not expose secrets
- not treat advisory evidence as hard proof
- not change existing saved-deal behavior

## Future Test Requirements
Future implementation should test:
- panel renders when API returns a model
- loading state appears during request
- error state appears on failed response
- empty state appears when no model is returned
- changing selected saved deal refetches safely
- no upload/edit/task buttons appear
- existing saved deal list/detail behavior still works

## Recommended Next Step
Phase 4D-2L — Client Fetch Helper Only

This should add the smallest client-side helper or isolated fetch function if needed, before modifying `app/page.tsx`.
