# Phase 4D-2G Live Saved Deal Panel Wiring Plan

## Purpose
This document plans the first live panel wiring, but makes no code, runtime, or UI changes.

## Current Ready Pieces
- The UI adapter exists in `lib/investor-shield/investor-shield-ui-adapter.ts`.
- The panel component exists in `components/InvestorShieldGateSummaryPanel.tsx`.
- The adapter-to-panel fixture preview proves the adapter-to-panel path.
- The server UI model loader exists in `lib/investor-shield/load-investor-shield-ui-model.ts`.
- The saved deal detail surface exists in `app/page.tsx`.
- No live wiring exists yet.

## Proposed First Live Wiring Target
Use the existing Saved Deal Detail section inside `app/page.tsx`.

Why:
- The saved deal id is already available there.
- The panel belongs near the saved deal context.
- It avoids dashboard expansion.
- It avoids pipeline behavior changes.
- It keeps the first implementation read-only.

## Proposed Future Data Flow
1. User selects or opens a saved deal.
2. Saved deal id is available.
3. Investor Shield UI model is loaded read-only.
4. Panel receives the model as a prop.
5. Panel renders the gate summary.
6. No writes, task creation, or pipeline mutation occur.

## Integration Boundary
Future implementation must:
- pass only an `InvestorShieldUiModel` into the panel
- show a fallback if no model is available
- avoid upload, edit, or action buttons
- avoid task creation
- avoid route behavior changes
- avoid changing pipeline guard behavior

## Loading / Error / Empty States
Planned copy only:
- Loading: `Loading Investor Shield status...`
- Empty: `Investor Shield status is not available yet.`
- Error: `Investor Shield status could not be loaded. Pipeline rules remain unchanged.`

## Safety Checks For Future Wiring
Future implementation must verify:
- no API or DB write helpers are called
- no task persistence helper is called
- no pipeline update is triggered
- the panel does not render action buttons
- deterministic NO-GO/governance dominance remains unchanged

## Recommended Implementation Size
Keep the future code step very small:
Phase 4D-2H — Saved Deal Panel Read-Only Wiring Only

Allowed in 4D-2H:
- minimal state/load path needed for the selected saved deal
- render the panel when a model exists
- render a safe fallback when missing or errored

Not allowed in 4D-2H:
- upload, edit, or waiver controls
- task creation
- pipeline behavior changes
- API route expansion
- dashboard redesign

## Recommended Next Step
Phase 4D-2H — Saved Deal Panel Read-Only Wiring Only

