# Phase 4D-2D Saved Deal Surface Integration Audit

## Purpose
This audit identifies where the Investor Shield gate summary panel should be connected later, but makes no UI or runtime changes.

## Current UI Assets
- The read-only Investor Shield UI adapter exists in `lib/investor-shield/investor-shield-ui-adapter.ts`.
- The isolated `InvestorShieldGateSummaryPanel` exists in `components/InvestorShieldGateSummaryPanel.tsx`.
- The adapter-to-panel preview fixture exists in `__tests__/investor-shield-adapter-panel-preview.test.tsx`.
- No live page connection exists yet.

## Existing Saved Deal Surfaces Found

### `app/page.tsx`
- Current role: client-rendered saved-deal workspace on the main page.
- Displays saved deal data: yes. It renders the saved deals list, saved deal detail, offers, tasks, and operator-command summary.
- Render mode: client component (`"use client"`).
- Safe for future Investor Shield insertion: yes, but only inside the existing read-only saved-deal detail area. It already centralizes the saved-deal context without requiring a new route or dashboard surface.

### `app/api/saved-deals/route.ts`
- Current role: list/create saved deals.
- Displays saved deal data: no, it serves list and create operations.
- Render mode: server route.
- Safe for future Investor Shield insertion: no. It is a data API, not a UI surface.

### `app/api/saved-deals/[id]/route.ts`
- Current role: load one saved deal by id.
- Displays saved deal data: yes, but only as JSON for the client UI.
- Render mode: server route.
- Safe for future Investor Shield insertion: no direct UI insertion. Useful only as a read source for a later server-data-loading plan.

### `app/api/saved-deals/[id]/offers/route.ts`
- Current role: load and create deal offers.
- Displays saved deal data: partially, but only offer records for one saved deal.
- Render mode: server route.
- Safe for future Investor Shield insertion: no. It is a task/offer mutation surface, not the panel host.

### `app/api/saved-deals/[id]/tasks/route.ts`
- Current role: load and create deal tasks.
- Displays saved deal data: partially, but only task records for one saved deal.
- Render mode: server route.
- Safe for future Investor Shield insertion: no. It is task mutation logic and should stay separate.

### `app/api/saved-deals/[id]/pipeline/route.ts`
- Current role: guarded pipeline movement endpoint.
- Displays saved deal data: indirectly, because it loads saved-deal state before evaluating movement.
- Render mode: server route.
- Safe for future Investor Shield insertion: no. This route must remain behaviorally isolated because it already enforces protected movement.

### `components/EngineAnalysisPanel.tsx`
- Current role: existing read-only analysis panel for the calculator flow.
- Displays saved deal data: no.
- Render mode: client React component.
- Safe for future Investor Shield insertion: not the target surface for Phase 4D. It is a separate analysis surface and would expand the dashboard context.

### `components/ResultsDisplay.tsx`
- Current role: main calculator result display.
- Displays saved deal data: no.
- Render mode: client React component.
- Safe for future Investor Shield insertion: no. It is not the saved-deal context.

### `app/phase-2-live-review/page.tsx`, `app/phase-2-review/page.tsx`, `app/phase-3-dev-review/page.tsx`
- Current role: phase-specific review surfaces.
- Displays saved deal data: not the primary saved-deal surface.
- Render mode: page routes.
- Safe for future Investor Shield insertion: no. They are review-specific surfaces and would broaden the rollout beyond the saved-deal detail context.

## Recommended Future Insertion Point
The safest first live panel connection is the existing read-only **Saved Deal Detail** section inside `app/page.tsx`.

Why this is the safest point:
- It is the closest current surface to the saved-deal context.
- It already displays saved deal details, governance state, capital protection state, pipeline state, and operator-command summary.
- It avoids dashboard expansion.
- It avoids pipeline behavior changes.
- It can remain read-only.
- It lets the Investor Shield panel live beside existing saved-deal state without changing routes or mutating flows.

## Data Availability Notes
Available today:
- saved deal id
- saved deal details
- saved deal list row data
- offers and tasks for the selected saved deal
- pipeline state
- governance state
- capital protection state
- existing Investor Shield evaluator output through the backend read-model path
- UI adapter model from `buildInvestorShieldUiModel`

Likely still needed for a first live panel connection:
- a clear server-side loading path that gathers Investor Shield checks and evidence for one saved deal
- a read-only bridge from the loaded state into the UI adapter
- a safe place in the saved-deal detail UI to render the panel without implying any write capability

## Future Wiring Risks
- Accidentally fetching or mutating from the client when the panel is added.
- Introducing route or API behavior too early.
- Showing an incomplete preview state as if it were final production state.
- Treating advisory evidence as hard proof in the UI presentation.
- Implying that pipeline state changed when only the read-only summary changed.

## Recommended Next Step
Phase 4D-2E — Read-Only Server Data Loading Plan Only

This should plan how to load existing Investor Shield state for one saved deal without adding UI wiring yet.

