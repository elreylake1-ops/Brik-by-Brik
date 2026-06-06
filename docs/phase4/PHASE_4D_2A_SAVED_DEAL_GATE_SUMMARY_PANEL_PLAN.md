# Phase 4D-2A Saved Deal Gate Summary Panel Plan

## Purpose
This document plans the first read-only Investor Shield gate summary panel, but adds no React/UI code.

## Current Baseline
- the read-only Investor Shield UI adapter exists in `lib/investor-shield/investor-shield-ui-adapter.ts`
- backend Investor Shield enforcement exists
- protected pipeline movement is already guarded by the backend route flow
- no Investor Shield visual panel exists yet

## Proposed First Panel Surface
Saved Deal Detail / Saved Deal View

Reason:
It is the clearest place to display gate status without changing pipeline behavior or expanding dashboards.

## Panel Scope
The first panel should remain read-only and show only:
- overall Investor Shield status
- progression decision
- can progress flag
- top-level gate list
- blocking gate count
- caution gate count
- missing evidence count
- advisory warning count

## Gate Row Scope
Each gate row may show:
- gate label
- required/advisory label
- status
- severity
- confidence
- evidence count
- short explanation
- recommended next action if available

## Excluded From First Panel
- no evidence upload
- no AI/image/video review
- no editing gate status
- no waiver editing
- no task creation from UI
- no PDF/investor pack
- no CRM expansion
- no pipeline behavior changes

## Data Source
The first panel should use the read-only Investor Shield UI adapter from:

`lib/investor-shield/investor-shield-ui-adapter.ts`

If route or API data is not available yet, the next implementation should stay adapter-level or server-side read-only only.

## Testing Plan
Future implementation should test:
- panel renders all top-level gates
- required and advisory labels display correctly
- blocked, caution, and missing evidence counts display correctly
- no mutation actions exist
- no upload or edit buttons exist
- adapter output maps safely to UI

## Recommended Next Step
Phase 4D-2B — Saved Deal Gate Summary Panel Skeleton Only
