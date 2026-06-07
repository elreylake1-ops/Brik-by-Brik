# Phase 4D-6A Manual Review / Waiver Indicator Plan

## Purpose
This document plans read-only manual review and waiver indicator display, but makes no code or runtime changes.

## Current Baseline
- Investor Shield panel is live and read-only.
- Gate details and missing evidence display are complete.
- Blocked/review pipeline messaging is complete.
- Task recommendations are display-only.
- Manual review / waiver visibility has not yet been enhanced.

## Proposed Display Surface
Plan only:
- Display manual review and waiver indicators inside the existing Investor Shield panel.
- Keep the panel in Saved Deal Detail.
- Do not move or redesign the panel.
- Do not add editing or waiver controls.

## Manual Review Display Rules
Plan:
- Show when a gate requires manual review.
- Show when manual override is required.
- Show gate name/key when available.
- Show reason/status if already present in the read-only model.
- Clearly state that manual review does not automatically clear the risk.

## Waiver Display Rules
Plan:
- Show waived status when a gate is waived.
- Show waiver reason if present.
- Show missing-reason warning if waiver reason is absent.
- Do not allow waiver editing.
- Do not imply waiver is equivalent to hard evidence.

## Read-Only Boundaries
Future implementation must not:
- create manual overrides
- edit manual overrides
- delete manual overrides
- edit waivers
- satisfy gates automatically
- upload evidence
- create tasks
- mutate pipeline state
- add AI/image/video review

## Governance Rules
- Manual review and waiver indicators are visibility only.
- Waived/manual review states must not soften deterministic NO-GO, True MAO, capital protection, governance risk, or Phase 2 / Phase 3 classifications.
- Missing waiver reasons should remain visible as review risk.

## Future Test Expectations
Future implementation should test:
- manual review indicator displays when present.
- waived gate indicator displays when present.
- waiver reason displays when present.
- missing waiver reason warning displays when absent.
- no waiver edit/create/delete controls render.
- no upload/edit/task controls render.
- existing panel behavior remains intact.

## Recommended Next Step
Phase 4D-6B - Manual Review / Waiver Indicator Display Only

This should modify only the isolated Investor Shield panel and direct tests if possible, not `app/page.tsx` or API routes.
