# Phase 4D-4A Blocked Movement Message Display Plan

## Purpose
This document plans read-only blocked/review movement message display improvements, but makes no code or runtime changes.

## Current Baseline
- The pipeline route already enforces the Investor Shield guard.
- Protected movement can return `BLOCK` or `NEEDS_REVIEW`.
- Blocked movement does not mutate pipeline state.
- The Investor Shield panel is visible in Saved Deal Detail.
- No enhanced blocked movement UI message exists yet.

## Proposed Message Surface
Plan only:
- Existing Pipeline Update area in Saved Deal Detail
- Display the message after a protected movement attempt returns a blocked or review response
- Do not change pipeline behavior
- Do not move the Investor Shield panel

## Blocked Movement Message Rules
Use copy from the warning copy doc:

Title:
Investor Shield blocked this movement

Body:
This deal cannot move to {requestedStage} yet because required due diligence gates are not clear.

Show if available:
- blocking gate names
- missing evidence
- required next action
- reminder that pipeline state did not change

## Needs Review Message Rules
Title:
Investor Shield review required

Body:
This deal has caution or incomplete due diligence items that should be reviewed before moving to {requestedStage}.

Show if available:
- caution gate names
- weak or missing evidence
- recommended tasks
- manual review note

## Deterministic Governance Dominance
The message must not imply Investor Shield overrides deterministic governance.
Investor Shield cannot soften:
- deterministic NO-GO
- True MAO
- capital protection failure
- governance risk
- Phase 2 / Phase 3 classifications

## Read-Only / No-Mutation Boundaries
Future implementation must not:
- change pipeline route logic
- auto-create tasks
- upload evidence
- edit gates
- edit waivers
- mutate saved deal state beyond existing pipeline route behavior
- add AI/image/video review

## Future Test Expectations
Future implementation should test:
- blocked response displays Investor Shield blocked message
- needs-review response displays review message
- success path remains unchanged
- pipeline state unchanged on blocked response
- no task, upload, or edit controls appear
- deterministic governance message remains visible where applicable

## Recommended Next Step
Phase 4D-4B - Blocked Movement Message Display Only

This should modify only the existing pipeline feedback rendering in `app/page.tsx` if possible, not the pipeline route.
