# AGENTS.md — Brik Engine Development Guide

## Project Context

This project is for Brik by Brik Engine.

The product is Brik Engine v1, a UK property deal analysis engine for fix-and-flip property deals.

The goal is to build a lean, accurate, configurable calculation engine before adding advanced product features.

---

## Current Build Status

Phase 1 core calculator exists and is working.

Phase 1A Step 1 has been completed:
- refurb/scope types created
- trade-rate config created
- material baseline config created
- task-cost library created
- README updated
- UI unchanged
- calculations not connected yet

Phase 1A Step 2 has been completed:
- scope-to-task generator created
- 12 tests passing
- UI unchanged
- Phase 1 connection not yet made

Phase 1A Step 3 has been completed:
- refurb cost engine created (calculateRefurbCost)
- timeline engine created (calculateTimeline)
- RefurbTimeline, RefurbPhase, TradeSchedule types added to types/refurb.ts
- 37 tests passing (25 new across 2 test files)
- UI unchanged
- Phase 1 connection not yet made

Phase 1A Step 4 has been completed:
- analyzeDealWithRefurb() orchestrator created in lib/engine/analyze-deal-with-refurb.ts
- DealWithRefurbResult type defined in same file
- when RefurbScopeInput provided: totalRefurbCost from Phase 1A overrides manual refurbCost
- when no scope provided: manual refurbCost passthrough (fallback unchanged)
- existing analyzeDeal() and lib/calculations.ts untouched
- 52 tests passing (15 new), build clean, UI unchanged

Phase 1A Step 5 has been completed:
- toggle added to page.tsx: "Use task-based refurb scope"
- RefurbScopeForm component created - collects RefurbScopeInput, no logic
- RefurbBreakdownSummary component created - displays refurb cost, labour/material split, timeline, warnings
- CalculatorForm updated: shows "overridden by scope" badge on refurb cost field when scope active
- app/page.tsx calls analyzeDealWithRefurb() - scope path or manual fallback depending on toggle
- ResultsDisplay.tsx unchanged - continues to accept DealResult
- 53 tests passing (1 new regression test), build clean

Phase 1A Step 6 has been completed:
- acceptance test suite finalized for Phase 1A mandatory sample and fallback paths
- QA report added: docs/PHASE_1A_QA_REPORT.md
- README finalized with Phase 1A status and explicit phase boundaries
- Phase 1A finalized for MVP QA/client review

Phase 1B Step 1 has been completed:
- cost data layer audited and normalized toward Phase 1B schema objects
- trade rates, material baselines, and task library hardened with validation coverage
- existing Phase 1A engine behavior preserved

Phase 1B Step 2 has been completed:
- manual override layer added for labour day rate, labour days, material price, and task include/exclude
- override application audit output added to generated refurb analysis result
- assumptions reporting consolidated from tasks, timeline assumptions, and applied overrides
- no UI changes; no Phase 2 features added

Post-Phase 1B browser wiring/demo hardening has been completed:
- engine fully wired to minimal browser-testable UI (implemented across Phase 1A Step 5, Phase 1B, and Phase 1D commits)
- RefurbScopeForm collects: bedrooms, bathrooms, floorAreaSqm, kitchen scope/size, bathroom scope, bedroom scope, flooring whole-property toggle, rewire/boiler/roof checkboxes
- analyzeDealWithRefurb() called from page.tsx — scope path when toggle on, manual refurb cost fallback when toggle off
- EngineAnalysisPanel displays: verdict, confidence, MAO targets, total investment, refurb cost, labour/material split, finance cost, fees, timeline, warnings, assumptions, overrides applied, room breakdown, trade breakdown, task list
- empty state shown when no deal inputs entered (hasDealInput guard)
- 90 tests passing, build clean; no Phase 2 features added

Post-Phase 1B engine verdict hardening has been completed:
- verdict and confidence moved from UI heuristics to dedicated engine outputs
- UI now renders engine verdict/confidence directly
- no Phase 2 features added

Official Phase 1C implementation is now in progress:
- Phase 1C-A complete: documentation and type-contract alignment added
- Phase 1C-B complete: standalone deep due diligence engine added
- Phase 1C-C complete: dueDiligence attached to analyzeDealWithRefurb() as an additive nested field
- Phase 1C-D complete: dueDiligence now visible in EngineAnalysisPanel
- no new inputs added; downside/strong GDV remain auto-generated in current UI
- 111 tests passing, build clean; no Phase 2 features added

---

## Development Rule

Build in small controlled steps.

Do not implement multiple phases in one pass.

Each step must be testable and must not break the existing working calculator.

---

## Phase Roadmap

### Phase 1 — Core Deal Engine

Purpose:
Calculate the main deal outputs:
- GDV
- purchase price
- finance cost
- fees
- total investment
- profit targets
- maximum purchase prices
- GO / CONDITIONAL / NO-GO verdict

Status:
Initial calculator exists. Future revisions may align it more closely with the locked Brik by Brik Phase 1 spec.

Finance model alignment note:
- Current MVP finance model is purchase-price-based, matching current implemented README/app behavior.
- Do not introduce loanToValue or LTV-based finance cost unless client explicitly approves a finance model change.
- Any future switch to LTV-based finance must be treated as a separate spec/model change with updated inputs, formulas, tests, and UI copy.

---

### Phase 1A — Builder Scope Engine

Purpose:
Replace manual refurb-cost input with task-based refurb calculations.

Refurb cost must be generated from:
- selected rooms
- selected scope
- task templates
- trade rates
- labour days
- material baseline costs
- scaling rules

Current Step:
Step 6 complete - Phase 1A finalized for MVP QA.

Next Step:
Await client confirmation before starting the next phase.

Phase 1A planned steps:
1. Foundation/config/data ✓
2. Scope-to-task generator ✓
3. Refurb cost + timeline engine ✓
4. Connect generated refurb cost to Phase 1 ✓
5. Minimal UI wiring ✓
6. Tests + README finalization

---

### Phase 1B — UK Cost Data Layer

Purpose:
Provide configurable labour, material, task-cost, confidence, and override data.

For now:
Implement as local config/data files only.


Current Step:
Step 2 complete - manual overrides and assumptions reporting added (engine layer only).

Next Step:
Await client confirmation before any further Phase 1B changes.

Do not build:
- database tables
- admin UI
- live supplier scraping
- automatic pricing refresh

---

### Official Phase 1C — Deep Due Diligence & GDV Intelligence Logic Layer

This is the official Phase 1C from the new blueprint.

It must be implemented logic-first, not UI-first.

It must return structured JSON for future PDF, AI, CRM, and investor-pack outputs.

GDV must be treated as a range:
- downside
- realistic
- strong

Capital protection is a core safety rule.

Existing design and current Phase 1 / 1A / 1B engine behavior must be preserved.

Current Step:
Phase 1C logic layer, engine-result attachment, and minimal analysis-panel visibility are complete.

No new inputs have been added in this phase. Downside and strong GDV remain auto-generated from realistic GDV.

Update:
- Phase 1C due diligence engine is now attached to the existing engine result as an additive nested field.
- Phase 1C due diligence is now visible in the analysis panel.
- No new inputs were added.
- Downside and strong GDV remain auto-generated in this phase.

---

### Phase 2 — Later

Do not build yet:
- PDF export
- saved deal system
- CRM
- investor pack
- offer engine
- dashboard expansion

---

## Non-Negotiable Rules

1. Do not hardcode hidden cost assumptions inside calculation functions.
2. All cost assumptions must live in visible config/data files.
3. Do not modify or optimise client formulas unless explicitly instructed.
4. Do not add AI features.
5. Do not add automation features.
6. Do not add live supplier scraping.
7. Do not add PDF export until Phase 2.
8. Do not add saved deals until Phase 2.
9. Keep UI minimal unless the step specifically asks for UI changes.
10. Keep business logic separate from UI components.
11. Prefer pure functions for all calculations.
12. Every fallback/default assumption must be visible and recorded in assumptions or warnings.

---

## File Organization

Use this structure where possible:

```
app/
  page.tsx
  layout.tsx

components/
  CalculatorForm.tsx
  EngineAnalysisPanel.tsx
  RefurbBreakdownSummary.tsx
  RefurbScopeForm.tsx
  ResultsDisplay.tsx
  Tooltip.tsx

types/
  deal.ts
  due-diligence.ts
  refurb.ts
  scope.ts
  overrides.ts

lib/
  calculations.ts
  formatters.ts
  data/
    validate-cost-data.ts
    trade-rates.ts
    material-baselines.ts
    task-cost-library.ts
  engine/
    analyze-deal-with-refurb.ts
    due-diligence-engine.ts
    scope-to-tasks.ts
    refurb-cost-engine.ts
    timeline-engine.ts
    apply-overrides.ts
```

---

## Phase 1A Step 2 Boundary

When implementing Step 2, build only:

`lib/engine/scope-to-tasks.ts`

Allowed:
- Generate tasks from RefurbScopeInput
- Match scope selections to task templates
- Apply bedroom/bathroom/kitchen/flooring scaling
- Return assumptions and warnings
- Add tests for generated task behavior
- Update README with Step 2 note

Not allowed in Step 2:
- No UI changes
- No final refurb cost engine
- No timeline engine
- No Phase 1 connection
- No PDF
- No saved deals
- No CRM
- No AI
- No live scraping

---

## Quality Checklist

Before reporting completion, run:

- `npm run lint` if available
- `npm run build`
- `npm test` if available

Report:
- files created/changed
- what was implemented
- what was intentionally not implemented
- assumptions introduced
- warnings/defaults used
- test/lint/build result

---

## README Rule

Update README only when it helps explain the current completed step.

Do not claim future features are complete.

Use cautious wording:
- "prepared for"
- "structured to support"
- "not connected yet"
- "Phase 2 later"

---

## Git Hygiene

Do not commit:
- node_modules
- .next
- build artifacts
- .env files
- temporary scratch files

Prefer clear commits:
- `chore: add phase 1a agent guide`
- `feat: add phase 1a foundation config`
- `feat: add scope to task generator`
- `test: add phase 1a scaling tests`
- `docs: update phase 1a implementation notes`

---

## Final Instruction

When uncertain, keep scope smaller, preserve the working calculator, and document assumptions clearly.

<!-- lean-ctx -->
## lean-ctx

Prefer lean-ctx MCP tools over native equivalents for token savings.
Full rules: @LEAN-CTX.md
<!-- /lean-ctx -->
