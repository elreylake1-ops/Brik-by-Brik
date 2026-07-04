# Phase 4H-3C Investor Shield Governance SOP

## Purpose

Investor Shield is the deterministic governance and progression-control layer.

This SOP documents how the current Investor Shield read model should be interpreted in the handover, without implying any permission to change governance state, pipeline state, or evidence authority.

## Governance Boundary

The current Investor Shield workflow is read-only from the perspective of the operator review surface.

Relevant source evidence:

- `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
- `lib/investor-shield/load-investor-shield-ui-model.ts`
- `lib/investor-shield/map-investor-shield-ui-view-model.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/investor-shield/investor-shield-ui-adapter.ts`
- `components/InvestorShieldPanel.tsx`
- `components/InvestorShieldGateList.tsx`
- `components/InvestorShieldProtectedMovement.tsx`
- `components/InvestorShieldTaskRecommendationList.tsx`
- `components/InvestorShieldWaiverDisplay.tsx`
- `components/InvestorShieldAdvisoryList.tsx`
- `__tests__/investor-shield-ui-route.test.ts`
- `__tests__/load-investor-shield-ui-model.test.ts`
- `__tests__/investor-shield-ui-mapper.test.ts`
- `__tests__/investor-shield-panel.test.tsx`
- `__tests__/investor-shield-ui-fixtures.test.ts`
- `docs/handover/PHASE_4H_1A_CURRENT_SYSTEM_ARCHITECTURE.md`
- `docs/handover/PHASE_4H_3A_INVESTOR_REVIEW_WORKFLOW_SOP.md`
- `docs/handover/PHASE_4H_3B_EVIDENCE_LITE_WORKFLOW_SOP.md`

## Opening a Shield View

The canonical Shield read route is:

```text
/api/saved-deals/{deal-id}/investor-shield-ui
```

The read model is also rendered in the saved-deal review experience through the current Investor Shield panel.

Opening rules:

1. confirm the saved deal id
2. trim the id before use
3. reject blank or missing ids safely
4. load the saved deal first
5. load the Shield read model from the saved-deal inputs
6. render the current deterministic view model

## Review Order

Review the Shield surface in this order:

1. Deterministic Governance
2. Required Gates
3. Protected Movement
4. Task Recommendations
5. Manual Review / Waiver
6. Advisory Signals

This order matches the current panel structure and keeps deterministic governance visible before advisory material.

## Status Interpretation

### Overall Shield Status

The current view model reports one of three overall states:

- `clear`
- `caution`
- `blocked`

Interpretation:

- `clear` means the current canonical Shield state allows progression.
- `caution` means human review is still prudent and progression may remain constrained.
- `blocked` means progression is not allowed.

### Progression

The `canProgress` flag is the authoritative read-only progression indicator in the current view model.

- `true` means the current canonical read model permits movement.
- `false` means movement remains blocked.

Do not override `canProgress` with advisory interpretation.

### Gate Status

Gate summaries can display:

- `not_started`
- `missing_evidence`
- `weak_evidence`
- `failed`
- `satisfied`
- `waived`
- `manual_review_required`
- `advisory_only`
- `blocked`

Operational meaning:

- `satisfied` means the gate is currently met.
- `waived` means the gate is traceably waived, not silently satisfied.
- `manual_review_required` means a human review step remains open.
- `missing_evidence` means required evidence is still absent.
- `weak_evidence` means the evidence is present but not strong enough to treat as fully satisfactory.
- `failed` means the gate has failed.
- `blocked` means progression is blocked by the current state.
- `advisory_only` means the signal is informational and cannot satisfy a hard gate.

### Deterministic Governance

Deterministic governance is visually dominant and must remain separate from advisory material.

The panel surfaces:

- classification
- governance state
- capital protection state
- dominant/deterministic status

These values are descriptive of the current deal state and do not themselves mutate the deal.

## Gate Authority Rules

Required gates are authoritative.

Rules:

- required gate state drives the progression decision
- advisory signals cannot satisfy hard gates
- task recommendations do not satisfy a gate by themselves
- waivers remain visually distinct from satisfied evidence
- manual review does not clear a gate
- blocked and failed states stay negative until the canonical read model changes

The current UI and tests explicitly preserve these boundaries.

## Operator Actions

The operator should:

1. verify the deal identity
2. confirm the overall Shield status
3. inspect deterministic governance first
4. review required gates and their missing evidence
5. review protected movement and the blocked reason
6. review task recommendations
7. review manual review and waiver detail
8. review advisory signals separately
9. escalate inconsistencies instead of reinterpreting the model

## Protected Movement

Protected movement is a read-only explanation of whether the current deal may progress.

Expected behavior:

- if `canProgress` is false, the UI should state that movement is blocked
- the pipeline state should be shown without pretending it has changed
- the blocked reason should be explained in read-only terms
- the current surface must not create a pipeline mutation control

## Task Recommendations

Task recommendations are supporting actions derived from the current governance state.

Rules:

- recommendations are duplicate-safe
- recommendations are read-only guidance
- recommendations do not equal gate satisfaction
- recommendations should be reviewed after the blocked/protected movement section

## Manual Review and Waivers

Manual review and waivers are not the same as satisfied evidence.

Rules:

- manual review can be required even when a waiver exists
- a waiver must remain visibly separate from satisfied evidence
- waiver reason should be reviewed before relying on any progression decision
- `doesNotClearGate` remains true in the current model

The operator must not treat a waiver as a hidden approval.

## Advisory Signals

Advisory signals are informational only.

Rules:

- advisory signals cannot satisfy hard gates
- advisory signals should be reviewed after the deterministic and required-gate sections
- AI advisory content is separated from required gate content
- advisory content should not be used to claim completion of a blocking gate

## Refresh and Persistence

The current Shield surface is backed by live repository reads.

Operational behavior:

- refresh reloads current server-backed data
- the page is not a historical snapshot
- the view model should remain stable for repeated reads with unchanged source data
- changed underlying records may change the current Shield output

## Error Handling

Safe error handling is required.

Expected behavior:

- missing or blank ids return a safe 400
- a missing saved deal returns a safe 404
- loader failure returns a safe 500 envelope
- the route must not surface credentials, SQL, or stack text
- the UI should keep the error response safe and non-authoritative

## Mobile Use

Mobile is supported.

Operational notes:

- the panel contains multiple sections
- the operator should not rely only on the top summary
- the deterministic and blocking sections should remain readable on smaller screens
- desktop is preferred for final detailed review when available

## Audit Boundary

The current Investor Shield surface:

- performs no mutation from the review panel
- does not create tasks or offers
- does not change the pipeline by itself
- does not update saved-deal data
- does not generate a PDF
- does not replace the separate Evidence Lite workflow

## Known Limitations

- access-control and ownership proof are documented separately
- waivers remain distinct from satisfied evidence
- advisory content is informational only
- the model depends on current source data from the saved deal and related records
- the read model is a view of the current state, not an immutable historical archive

## Explicit Non-Implementation

This SOP does not:

- change runtime code
- change UI behavior
- change routes
- change database data
- change environment variables
- update README
- create a release tag
- begin Phase 5 work
- generate a PDF
- add AI, OCR, upload, scraping, automation, or CRM expansion

## Result

`PHASE 4H-3C INVESTOR SHIELD GOVERNANCE SOP COMPLETE — READY FOR PHASE 4H-4 README AND HANDOVER INDEX`
