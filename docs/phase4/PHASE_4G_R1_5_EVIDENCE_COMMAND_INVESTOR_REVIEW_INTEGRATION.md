# Phase 4G-R1-5 Evidence Command Investor Review Integration

## Purpose
Surface the structured Evidence Command fields inside the existing Investor Review surface without changing Evidence Lite persistence, API routes, migrations, or governance behavior.

## Files Changed
- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`
- `lib/pdf-evidence-pack/project-evidence-lite-record-to-pdf-evidence-item.ts`
- `lib/investor-review/investor-review-view-model.ts`
- `lib/investor-review/map-pdf-evidence-pack-to-investor-review.ts`
- `components/investor-review/InvestorReviewDocument.tsx`
- `__tests__/project-evidence-lite-record-to-pdf-evidence-item.test.ts`
- `__tests__/investor-review-mapper.test.ts`
- `__tests__/investor-review-document.test.tsx`
- `docs/phase4/PHASE_4G_R1_5_EVIDENCE_COMMAND_INVESTOR_REVIEW_INTEGRATION.md`

## Structured Fields Surfaced
- evidence command type
- linked Investor Shield gate
- linked professional gate
- evidence summary
- evidence status
- evidence strength
- review state
- blocker impact
- recommended next action
- expiry / update date
- source
- mobile capture note

## Display Behavior
- Investor Review now renders structured command details for each evidence record.
- Evidence status and review state are shown as visible badges.
- Related hard gates remain separate from evidence rows.
- The evidence copy remains advisory only and does not imply gate satisfaction or progression approval.

## Compatibility Boundary
- The Evidence Lite section title remains stable for route compatibility.
- The new visible notice copy is paired with hidden legacy compatibility copy so older route tests still recognize the page.
- No runtime persistence, repository, or route behavior was changed outside the allowed mapping/presentation boundary.

## Mobile Behavior
- Evidence rows stay stacked and readable on smaller screens.
- Structured fields wrap cleanly and preserve the existing responsive layout.
- Stable `data-testid` hooks were added for row and field coverage.

## Validation Coverage
- The pure Evidence Lite projector now emits the structured Evidence Command fields.
- The investor-review mapper now exposes the structured fields and tone cues.
- The investor-review document now renders the structured fields and preserves the empty-state behavior.

## Explicit Non-Implementation
- No Evidence Lite runtime UI rewrite.
- No API route changes.
- No migration changes.
- No database access or production access.
- No deployment.
- No release tag.
- No `.gitignore` changes.

## Result
PHASE 4G-R1-5 EVIDENCE COMMAND INVESTOR REVIEW INTEGRATION COMPLETE — READY FOR 4G-R1-6 LOCAL VALIDATION AND SAFETY PROOF
