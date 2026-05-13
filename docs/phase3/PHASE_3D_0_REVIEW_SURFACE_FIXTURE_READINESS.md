# Phase 3D-0 Review Surface Fixture Readiness

## Purpose

This step defines type contracts and fixture pairings for a future developer-only Phase 3 review surface.

This step does not implement a route, UI, or runtime wiring.

## Display Contract Summary

Defined in:

- `types/phase3-review-surface.ts`
- `lib/fixtures/phase3-review-surface-fixtures.ts`

Contracts added:

- `Phase3ReviewSurfaceMode`
- `Phase3ReviewSurfaceSection`
- `Phase3ReviewSurfaceFixtureId`
- `Phase3ReviewSurfaceFixturePair`
- `Phase3ReviewSurfaceDisplayContract`

Static exports:

- `PHASE3_REVIEW_SURFACE_FIXTURE_PAIRS`
- `PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT`

## Fixture Pair List

- `no_deal_with_weak_comparable_hints`
- `review_required_with_legal_conflict_hints`
- `clean_proceed_with_accepted_operator_note`
- `intake_with_missing_lender_hints`

Each pair maps to an existing merged fixture path in `__tests__/fixtures/phase3-merged-orchestration/`.

## Section Order

Display contract section order is defined with deterministic-first rendering:

1. `deterministic_decision`
2. `advisory_merge_summary`
3. `capital_protection`
4. `merged_tasks`
5. `evidence_hints`
6. `warnings`
7. `metadata`
8. `guardrails`

## Guardrails

- developer-only route name: `/phase-3-dev-review`
- advisory-only output contract
- deterministic decision remains source of truth
- capital protection must remain dominant when present
- no approve/send-offer/action CTAs
- no runtime wiring, persistence, AI, scraping, or integrations

## Runtime/Surface Status

Confirmed in this step:

- no route implementation
- no UI implementation
- no runtime wiring
- no client-facing exposure

## Recommended Next Step

**Phase 3D-0 Step 3 -- Developer Review Route Planning or Route Skeleton Decision**

Step 3 should decide whether to create a non-linked dev-only route skeleton using locked fixtures, while still avoiding any client-facing integration.
