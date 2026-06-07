# Phase 4D-2E Read-Only Server Data Loading Plan

## Purpose
This document plans how to load Investor Shield state for one saved deal later, but makes no code, runtime, or UI changes.

## Current Read-Only Building Blocks
- Repository list helpers exist in `lib/investor-shield/investor-shield-repository.ts`.
- A read model helper exists in `lib/investor-shield/investor-shield-read-model.ts`.
- The evaluator exists in `lib/investor-shield/evaluate-investor-shield.ts`.
- The UI adapter exists in `lib/investor-shield/investor-shield-ui-adapter.ts`.
- The panel component exists in `components/InvestorShieldGateSummaryPanel.tsx`.
- No live page wiring exists yet.

## Proposed Future Data Flow
1. Saved deal id is known.
2. Load Investor Shield checks, evidence, risk flags, and manual overrides using the existing read model.
3. Evaluate Investor Shield state.
4. Build the Investor Shield UI model using the adapter.
5. Pass the model into the read-only panel.
6. Render the panel in the saved deal detail area.

## Server-Side Loading Preference
The first live wiring should prefer server-side, read-only loading where practical, not client-side mutation or ad-hoc fetching.

## Data Needed
- `dealId`
- `checks`
- `evidenceItems`
- `riskFlags`
- `manualOverrides`
- deterministic deal status or governance state, if needed by the evaluator
- enforcement result
- UI model

## Data Not Needed Yet
- upload payloads
- AI review payloads
- PDF generation payloads
- CRM data
- scraping data
- task mutation payloads
- waiver mutation payloads

## Safety Rules For Future Implementation
- Read-only only.
- No writes.
- No task creation from the panel.
- No evidence upload.
- No waiver editing.
- No pipeline mutation.
- No client-side secret or database access.
- Advisory evidence must remain clearly labeled.

## Recommended First Runtime Shape
A small server-side composition path is sufficient if needed:
- load the saved deal
- call existing `loadAndEvaluateInvestorShield`
- call `buildInvestorShieldUiModel`
- pass the model to the panel component

Do not implement this in this step.

## Future Test Expectations
Future implementation should test:
- loading works for one saved deal id
- missing Investor Shield checks do not crash the panel
- evaluator output maps into the UI model
- no write helpers are called
- no task creation occurs
- no pipeline state mutation occurs

## Recommended Next Step
Phase 4D-2F — Read-Only Server Composition Helper Only

This should be a tiny pure/server helper if needed, still not connected to `app/page.tsx`.

