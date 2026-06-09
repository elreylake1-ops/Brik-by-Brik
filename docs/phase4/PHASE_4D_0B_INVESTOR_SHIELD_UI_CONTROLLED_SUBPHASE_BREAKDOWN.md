# Phase 4D-0B Investor Shield UI Controlled Subphase Breakdown

## Purpose
This document breaks Phase 4D into controlled subphases before UI implementation begins.

## Current Baseline
- Phase 4C accepted
- 4D-0A scope locked
- production read-only MVP runtime verified
- deterministic engine untouched
- no UI implementation yet

## Implementation Philosophy
Phase 4D must be built in small controlled increments, with each step producing one reviewable artifact or one isolated UI change.

No step may combine contracts, mapping, components, binding, visual polish, and QA all at once.

## Phase 4D Subphase List

### 4D-0C - UI Architecture Readiness Audit Only
- Goal: Audit existing routes, components, and data surfaces before implementation.
- Likely files touched: docs only, plus awareness reads of saved-deal detail and Investor Shield route files.
- Explicit exclusions: no code changes unless documentation only.
- Acceptance criteria: current UI surface map is documented and no implementation work is started.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-1A - UI View Model Contracts Only
- Goal: Define TypeScript types/contracts for the Investor Shield UI display model.
- Likely files touched: new or existing type files for UI display contracts, plus supporting docs.
- Explicit exclusions: no mapper, no components, no route changes.
- Acceptance criteria: contract shape covers gates, advisory separation, blocked movement, waiver visibility, and task recommendation states.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-1B - UI Fixture Examples Only
- Goal: Create representative fixtures for required gates, advisory signals, blocked movement, waiver, and task recommendation states.
- Likely files touched: fixture files and supporting docs.
- Explicit exclusions: no mapper, no components.
- Acceptance criteria: fixtures exercise the intended display states without live binding.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-1C - View Model Mapper Only
- Goal: Map existing Investor Shield UI route/model data into the display model.
- Likely files touched: mapper code and mapper tests.
- Explicit exclusions: no visible UI changes.
- Acceptance criteria: live read-only data can be converted into the display model deterministically.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-2A - Static Panel Shell Only
- Goal: Create a static read-only panel shell with placeholder data.
- Likely files touched: panel shell component and minimal support styles.
- Explicit exclusions: no live binding, no mutation, no task actions.
- Acceptance criteria: shell renders safely with placeholder content and no action controls.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-2B - Static Gate Row Components Only
- Goal: Create gate row and status display components using static fixtures.
- Likely files touched: gate row components and fixture-backed tests.
- Explicit exclusions: no live binding.
- Acceptance criteria: required gates display distinctly and advisory content remains visually separate.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-2C - Static Advisory Separation Components Only
- Goal: Create a separate advisory-only visual section.
- Likely files touched: advisory components and copy tests.
- Explicit exclusions: no live binding.
- Acceptance criteria: advisory content cannot look authoritative or override required gates visually.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-3A - Bind Read-Only Investor Shield Model
- Goal: Bind the live read-only model to the panel.
- Likely files touched: data wiring, adapter glue, and panel integration points.
- Explicit exclusions: no mutations, no evidence upload, no waiver actions.
- Acceptance criteria: the panel renders live data without write paths or side effects.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-3B - Blocked Movement Explanation Display
- Goal: Display protected movement explanation and blocked movement warning.
- Likely files touched: blocked movement message components and tests.
- Explicit exclusions: no pipeline mutation.
- Acceptance criteria: blocked or rejected movement is explained clearly and remains visibly blocked.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-3C - Task Recommendation Display
- Goal: Display task recommendations linked to gates.
- Likely files touched: task recommendation display components and tests.
- Explicit exclusions: no task creation buttons or mutation.
- Acceptance criteria: recommendations are visible, linked to gates, and read-only.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-3D - Waiver Display
- Goal: Display waiver status and waiver reasons distinctly from satisfied evidence.
- Likely files touched: waiver display components and tests.
- Explicit exclusions: no waiver creation or editing.
- Acceptance criteria: waiver state is visible without being confused with normal satisfaction.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-4A - Visual Dominance and Copy QA
- Goal: Review copy and visual hierarchy to ensure deterministic governance remains dominant.
- Likely files touched: copy, styling, and review notes only.
- Explicit exclusions: no new features.
- Acceptance criteria: governance, capital protection, True MAO, and classification remain visually dominant over advisory content.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-4B - Manual Browser QA
- Goal: Manual browser checks with screenshots and edge cases.
- Likely files touched: QA notes, screenshots, and review docs only.
- Explicit exclusions: no feature expansion.
- Acceptance criteria: browser behavior matches the read-only scope and the blocked/review states are clear.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

### 4D-4C - Final Phase 4D Review Pack
- Goal: Prepare the final review pack for James.
- Likely files touched: summary docs only.
- Explicit exclusions: no new code.
- Acceptance criteria: the review pack clearly states scope, results, and remaining boundaries.
- Validation commands: `npm run build`, `npm run lint`, `npm test`

## Hard Gates Before Visible UI
4D-0A, 4D-0B, 4D-0C, 4D-1A, 4D-1B, and 4D-1C must be complete before live UI binding.

## Safety Rules Across All Phase 4D Steps
- no AI
- no image/video runtime review
- no evidence upload UI
- no PDF investor pack
- no CRM expansion
- no scraping
- no automation
- no formula/classification changes
- no production mutation
- no visual softening of blocked or rejected movement
- advisory signals must remain visually separate from required gates
- deterministic governance must remain visually dominant

## Validation Pattern
Default validation:
- `npm run build`
- `npm run lint`
- `npm test`

Manual browser QA starts only in 4D-4B unless a specific earlier step requires it.

## Recommended Next Step
Phase 4D-0C - UI Architecture Readiness Audit Only

## Result
PLANNED ONLY
