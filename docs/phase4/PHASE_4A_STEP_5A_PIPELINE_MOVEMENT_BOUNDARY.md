# Phase 4A Step 5A Pipeline Movement Boundary

## Purpose
This document defines the minimum safe boundary for moving a saved deal through pipeline states.

## Current Capability
- saved deals can be created
- saved deals can be listed
- saved deals can be opened read-only
- pure guard logic exists
- no runtime pipeline movement exists yet

## Pipeline Goal
- James should be able to change a saved deal pipeline state
- movement must respect governance guard logic
- REJECT/FATAL or unsafe states must not move to offer-ready
- movement must not recalculate engine results
- movement must not mutate `engine_result_json`

## Recommended Minimal Path
1. Add repository helper for pipeline state update only if missing.
2. Add `POST /api/saved-deals/[id]/pipeline` only.
3. Route should call `evaluateOperatorGuard` before update.
4. Route should update `pipeline_state` only when allowed.
5. UI should come later after API tests pass.

## Boundary Rules
- no offer behavior yet
- no task behavior yet
- no command view yet
- no archive/edit behavior yet
- no engine recalculation
- no snapshot mutation
- guard logic remains pure

## Recommended Next Step
Phase 4A Step 5B - Pipeline API Route Only.
