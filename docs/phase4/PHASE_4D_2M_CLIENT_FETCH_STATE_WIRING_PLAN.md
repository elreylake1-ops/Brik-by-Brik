# Phase 4D-2M Client Fetch State Wiring Plan

## Purpose
This document plans the smallest safe `app/page.tsx` wiring, but makes no runtime or UI changes.

## Current Ready Pieces
- The read-only API endpoint exists at `app/api/saved-deals/[id]/investor-shield-ui/route.ts`.
- The client-safe fetch helper exists in `lib/investor-shield/fetch-investor-shield-ui-model.ts`.
- The read-only panel component exists in `components/InvestorShieldGateSummaryPanel.tsx`.
- The saved deal detail surface exists in `app/page.tsx`.
- The panel is still not connected.

## Proposed Minimal app/page.tsx State
- `investorShieldModel`
- `investorShieldLoading`
- `investorShieldError`

## Proposed Fetch Trigger
- When selected saved deal id changes, call `fetchInvestorShieldUiModel`.
- Clear state when no saved deal is selected.
- Set loading true while the request is active.
- Ignore stale responses if the selected deal changes before the request completes.
- Never fetch during unrelated calculator edits.

## Proposed Rendering Placement
- Render inside the existing Saved Deal Detail section.
- Place after the core saved deal summary.
- Place before offers/tasks if practical.
- Avoid dashboard redesign.
- Avoid calculator layout changes.

## Proposed Fallback Behavior
- Loading: `Loading Investor Shield status...`
- Empty: `Investor Shield status is not available yet.`
- Error: `Investor Shield status could not be loaded. Pipeline rules remain unchanged.`

## Safety Requirements For Implementation
Future implementation must:
- call only `fetchInvestorShieldUiModel`
- call only the read-only GET route indirectly
- not call task APIs
- not call pipeline APIs
- not add action buttons
- not add upload, edit, or waiver controls
- not mutate saved deal state except local Investor Shield display state
- not change existing saved deal list/detail behavior

## Recommended Test Coverage
Future implementation should test:
- fetch helper called when a saved deal is selected
- panel renders when model exists
- loading fallback appears
- error fallback appears
- clearing selected deal clears model
- no upload, edit, or task controls render
- existing saved deal detail still renders

## Recommended Next Step
Phase 4D-2N — `app/page.tsx` Read-Only Investor Shield State Wiring Only.
