# Phase 4C-7C-A Pipeline Route Integration Audit

## Purpose
This audit prepares future Investor Shield route integration into the existing saved-deal pipeline route, but this step adds no runtime behavior.

## Existing Pipeline Route Behavior
- Route path: `app/api/saved-deals/[id]/pipeline/route.ts`
- Current request input: route param `id` plus JSON body field `requested_pipeline_state`
- Current pipeline states accepted by route: `UNDER_ANALYSIS`, `READY_FOR_OFFER`, `OFFER_SENT`, `NEGOTIATING`, `DUE_DILIGENCE`, `FINANCE_REVIEW`, `COMPLETED`, `REJECTED`, `ARCHIVED`
- Current response shape on success: `{ success: true, deal, guard }` with HTTP `200`
- Current response shape on guard block/review/task requirement: `{ success: false, allowed: false, guard, error }` with HTTP `409`
- Current response shape on invalid input: `{ success: false, error }` with HTTP `400`
- Current response shape on not found: `{ success: false, error }` with HTTP `404`
- Current response shape on unexpected failure: `{ success: false, error }` with HTTP `500`
- Current mutation behavior: route loads saved deal, runs `evaluateOperatorGuard(...)`, and only then calls `updateSavedDealPipelineState(id, requestedPipelineState)` if the operator guard allows movement
- Current deterministic/operator guard behavior: operator governance guard is the only movement gate in the live route today
- Current error handling: safe generic repository error on `500`, safe governance block message on `409`
- Current tests cover: success path, `404`, `400`, `409` block path, `409` review/task path, safe `500`, guard input shape, import boundaries, and forbidden runtime keys

## Investor Shield Components Available
- Read-model helper: `lib/investor-shield/investor-shield-read-model.ts`
- Pure evaluator: `lib/investor-shield/evaluate-investor-shield.ts`
- Pure movement guard helper: `lib/investor-shield/guard-investor-shield-pipeline-movement.ts`
- Task draft builder: `lib/investor-shield/build-investor-shield-task-drafts.ts`
- Task persistence helper: `lib/investor-shield/persist-investor-shield-task-drafts.ts`
- Runtime proof status: task persistence runtime proof passed in `docs/phase4/PHASE_4C_6C_INVESTOR_SHIELD_TASK_PERSISTENCE_RUNTIME_PROOF.md`

## Proposed Integration Point
- Run Investor Shield route integration after request validation succeeds
- Run it after the current saved deal and current pipeline state are loaded
- Run it before any saved-deal pipeline mutation
- Run it after the deterministic/operator guard if the current architecture keeps operator guard as the first route gate
- Deterministic/operator guard must never be softened by Investor Shield
- If desired for defense-in-depth, the route may pass deterministic state into the Investor Shield read/evaluate/guard chain, but the dominant rule remains the same

## Proposed Behavior
- If Investor Shield guard returns `ALLOW`, continue existing route behavior
- If Investor Shield guard returns `NEEDS_REVIEW`, do not mutate protected stage automatically unless the route already has an approved review pathway
- If Investor Shield guard returns `BLOCK`, do not mutate saved deal stage or status
- Non-protected movements may proceed or require review according to the Investor Shield guard result
- Deterministic/operator guard remains dominant and may still block before Investor Shield is considered complete enough to allow continuation

## Response Shape Risk
- Current route tests assert status codes and specific keys such as `success`, `allowed`, `guard`, and `error`
- Current tests do not appear to snapshot the entire success payload, but they do assume the route keeps the existing guard-oriented contract
- Minimal risk approach for Phase `4C-7C-B`: preserve the current response shape and reuse the existing `409` error pattern for Investor Shield block or review results
- Avoid additive fields unless they are required for safe testable diagnostics

## Task Persistence Interaction
- Phase `4C-7C` should not persist tasks yet unless explicitly approved
- If later enabled, task persistence must remain idempotent and use the proven helper
- No duplicate `deal_tasks` may be created by later route integration

## Failure Behavior
- If Investor Shield read or evaluation fails during protected movement, fail closed
- Do not mutate saved deal stage on Investor Shield guard failure
- Return or log a safe reason
- Do not leak secrets, connection details, or raw runtime internals

## Minimal Patch Plan for Next Step
- Phase `4C-7C-B` should integrate `loadInvestorShieldEvaluationInput` or `loadAndEvaluateInvestorShield` plus `guardInvestorShieldPipelineMovement` into the existing route
- No task persistence
- No UI changes
- No response redesign unless required by the existing route contract
- Add tests for `ALLOW`, `BLOCK`, and `NEEDS_REVIEW`
- Fail closed for protected movement if Investor Shield read/evaluation fails

## Required Tests for 4C-7C-B
- existing movement behavior remains unchanged when Investor Shield guard returns `ALLOW`
- protected movement `BLOCK` prevents saved deal mutation
- protected movement `NEEDS_REVIEW` prevents mutation or returns review response according to the current route pattern
- non-protected movement remains safe
- deterministic/operator guard dominance is preserved
- Investor Shield read failure fails closed for protected target
- no task persistence is called
- no duplicate tasks are created
- response shape remains backward compatible
