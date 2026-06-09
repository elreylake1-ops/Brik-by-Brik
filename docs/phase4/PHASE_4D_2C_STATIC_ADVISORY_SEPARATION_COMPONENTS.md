# Phase 4D-2C Static Advisory Separation Components Only

## Purpose
This phase adds static advisory-only components to separate advisory signals from hard Investor Shield gates.

## Files Added / Changed
- `components/InvestorShieldAdvisorySignal.tsx`
- `components/InvestorShieldAdvisoryList.tsx`
- `components/InvestorShieldPanel.tsx`
- `__tests__/investor-shield-advisory-signal.test.tsx`
- `__tests__/investor-shield-panel.test.tsx`
- `docs/phase4/PHASE_4D_2C_STATIC_ADVISORY_SEPARATION_COMPONENTS.md`

## Advisory Component Summary
- signal label
- source
- confidence label
- warning text
- advisory-only label
- cannot-satisfy-hard-gate copy

## Data Source
- fixture/static data only
- no live API binding
- no production data dependency
- no route/API changes

## Visual Safety Rules Preserved
- advisory items do not look like hard gates
- advisory items do not satisfy evidence
- advisory optimism does not soften deterministic warnings
- advisory section remains visually secondary to deterministic governance and required gates
- no mutation controls added

## Explicit Non-Implementation
- no live binding
- no route/API changes
- no evidence upload
- no waiver actions
- no task creation actions
- no pipeline movement actions
- no AI runtime review
- no schema changes
- no production data changes
- no runtime mutation

## Recommended Next Step
Phase 4D-3A â€” Bind Read-Only Investor Shield Model

## Result
STATIC ADVISORY SEPARATION ONLY
