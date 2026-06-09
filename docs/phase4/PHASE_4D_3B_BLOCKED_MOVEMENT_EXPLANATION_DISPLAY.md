# Phase 4D-3B Blocked Movement Explanation Display

## Purpose
This phase adds read-only blocked/protected movement explanation display.

## Files Added / Changed
- `components/InvestorShieldProtectedMovement.tsx`
- `components/InvestorShieldPanel.tsx`
- `__tests__/investor-shield-panel.test.tsx`
- `__tests__/saved-deal-investor-shield-panel.test.tsx`
- `docs/phase4/PHASE_4D_3B_BLOCKED_MOVEMENT_EXPLANATION_DISPLAY.md`

## Display Summary
- current pipeline state
- attempted pipeline state
- movement allowed
- blocked reason
- blocking gate keys
- pipelineMutationPrevented
- explanation

## Read-Only Confirmation
- no pipeline movement action
- no mutation controls
- no task creation
- no waiver actions
- no evidence upload
- no route/API changes
- no schema changes
- no production data changes

## Visual Safety Rules Preserved
- blocked movement is not softened
- pipeline state unchanged is visible
- allowed movement does not imply financial approval
- advisory signals do not soften hard blocks
- deterministic governance remains dominant

## Explicit Non-Implementation
- no live mutation
- no workflow action
- no task action
- no waiver/evidence action
- no formula/classification changes

## Recommended Next Step
Phase 4D-3C â€” Task Recommendation Display

## Result
BLOCKED MOVEMENT DISPLAY ONLY
