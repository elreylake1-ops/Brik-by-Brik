# Phase 4G-R1-3 Evidence Command API Route Support and Mocked Tests

## Purpose

Extend the Evidence Lite API routes so they can accept and return the Evidence Command shape already defined by validation and repository mapping, while keeping the work limited to route behavior, mocked tests, and documentation.

## Files Changed

- `app/api/saved-deals/[id]/evidence/route.ts`
- `app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts`
- `__tests__/evidence-lite-api-route.test.ts`
- `__tests__/evidence-lite-item-api-route.test.ts`
- `docs/phase4/PHASE_4G_R1_3_EVIDENCE_COMMAND_API_ROUTE_SUPPORT_AND_MOCKED_TESTS.md`

## API Behavior Added

- Collection `GET` now returns structured Evidence Command fields when the repository includes them.
- Collection `POST` now accepts either the legacy Evidence Lite payload or the structured Evidence Command payload.
- Collection `POST` now applies the command defaults for optional fields without implying approval.
- Item `PATCH` now accepts structured Evidence Command field updates, including partial command updates.
- Item `PATCH` still supports the legacy mutable fields and legacy solicitor feedback alias.
- `dealId` remains route-authoritative in both routes.

## Validation Behavior Confirmed

- Unknown evidence type is rejected.
- `GENERAL` is rejected as an evidence type.
- Unknown status is rejected.
- Unknown strength is rejected.
- Unknown review state is rejected.
- Unknown blocker impact is rejected.
- Unknown professional gate is rejected.
- Invalid Investor Shield gate is rejected.
- Empty required title is rejected.
- Empty required evidence summary is rejected.
- Invalid expiry/update date is rejected.

## Mocked Test Coverage

- GET returns structured Evidence Command fields.
- GET still returns an empty evidence array for a valid deal with no evidence rows.
- POST accepts legacy Evidence Lite create payloads.
- POST accepts structured Evidence Command payloads.
- POST applies safe command defaults.
- POST accepts photo evidence as a structured command type.
- POST rejects invalid controlled values and body-supplied `dealId`.
- PATCH accepts legacy mutable fields.
- PATCH accepts structured Evidence Command fields, including partial updates.
- PATCH rejects invalid controlled values.
- PATCH rejects body-supplied `dealId`.
- Routes stay clear of task, offer, pipeline, and Investor Shield mutation wiring.

## Route `dealId` Authority

The route parameter remains the source of truth for the saved deal. A body `dealId` is rejected before the route proceeds with validation or persistence.

## Governance Boundary

- No UI changes.
- No Investor Review changes.
- No migration execution.
- No production access.
- No deploy.
- No release tag.
- No Investor Shield evaluator changes.
- No deterministic engine changes.
- No Phase 5 work.

## Photo/Video Boundary

Photo and video evidence remain structured evidence types only. There are no upload fields, file paths, OCR steps, or media processing paths in the API layer.

## Explicit Non-Implementation

This step does not add UI, does not apply the migration, does not change the repository mapping step, and does not expand governance or production scope.

## Result

PHASE 4G-R1-3 EVIDENCE COMMAND API ROUTE SUPPORT AND MOCKED TESTS COMPLETE — READY FOR 4G-R1-4 MOBILE-FIRST EVIDENCE COMMAND UI
