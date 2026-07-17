# Phase 5A-4 Scope Proposal - Professional Evidence Gateway Read-Only Integration

## Purpose

Phase 5A-4 should be limited to proposing and, only after James approves, connecting the accepted Phase 5A-3 Professional Evidence Gateway read-model/helper mapping to existing read-only server-side loading paths.

This document is a proposal only. It does not implement Phase 5A-4.

## Proposed Scope

Proposed phase label:

```text
Phase 5A-4 - Professional Evidence Gateway Read-Only Integration Proposal
```

Recommended implementation scope after approval:

- Connect the accepted Phase 5A-3 read-model/helper mapping to existing read-only server-side loading paths.
- Keep `deal_evidence` and existing Evidence Command evidence as the source surface.
- Preserve evidence visibility while keeping professional confirmation separate from operator-only evidence.
- Keep the integration read-only and non-authoritative.
- Return or compose Professional Evidence Gateway view-model data only where an existing read-only loader already assembles review data.
- Add focused tests proving the integration is read-only, non-authoritative, and source-compatible.

## Explicit Exclusions

Phase 5A-4 must not include:

- No new database tables.
- No migrations.
- No writes.
- No API mutation.
- No UI changes unless separately approved.
- No config changes.
- No database/repository persistence changes.
- No Investor Shield authority changes.
- No automatic gate clearing.
- No pipeline mutation.
- No True MAO changes.
- No scoring changes.
- No Phase 5B work.
- No Market History work.
- No AI work.
- No OCR work.
- No scraping work.
- No CRM work.
- No upload work.
- No PDF work.
- No production deployment as part of implementation unless separately approved.

## Accepted Phase 5A-3 Locked Rightmove Rule

The accepted Phase 5A-3 rule remains locked:

- `RIGHTMOVE_SOLD_DATA` remains visible portal evidence.
- `RIGHTMOVE_SOLD_DATA` is non-confirming by itself.
- `RIGHTMOVE_SOLD_DATA` cannot confirm `SOLD_COMPARABLE_REVIEW` without review or validation by a qualifying professional or approved source.
- `SOLD_COMPARABLE_REVIEW` can be professionally confirmed only by `SURVEYOR`, `SOLICITOR`, or `LAND_REGISTRY`.

Phase 5A-4 must preserve this rule in integration tests.

## Data / Source Assumptions

- Existing Evidence Command evidence remains the source surface.
- Existing `deal_evidence` records remain the storage source.
- Existing evidence IDs and linked Investor Shield gate labels should be preserved in the read model.
- Operator-only evidence can remain visible but must not become professional confirmation.
- Agent evidence can remain visible but must not become professional confirmation.
- Missing, unknown, or incompatible sources must not produce professional confirmation.
- The Phase 5A-3 helpers remain the canonical compatibility and view-model mapping layer.

## Proposed Files To Inspect

Before implementation approval, inspect:

```text
lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility.ts
lib/professional-evidence-gateway/professional-evidence-gateway-read-model.ts
types/professional-evidence-gateway.ts
lib/evidence-lite/evidence-lite-repository.ts
lib/pdf-evidence-pack/load-pdf-evidence-pack.ts
lib/investor-review/load-investor-review-page-model.ts
lib/investor-summary/compose-investor-summary-view-model.ts
app/saved-deals/[id]/review/page.tsx
app/api/saved-deals/[id]/evidence/route.ts
__tests__/professional-evidence-gateway-source-compatibility.test.ts
__tests__/professional-evidence-gateway-read-model.test.ts
```

## Proposed Files That May Change Only After James Approves

Likely allowed implementation files after approval:

```text
lib/professional-evidence-gateway/professional-evidence-gateway-read-model.ts
lib/investor-review/load-investor-review-page-model.ts
__tests__/professional-evidence-gateway-read-only-integration.test.ts
docs/phase5/PHASE_5A_4_READ_ONLY_INTEGRATION.md
```

Possible alternative files after inspection and approval:

```text
lib/pdf-evidence-pack/load-pdf-evidence-pack.ts
lib/investor-summary/compose-investor-summary-view-model.ts
```

Files that should not change in Phase 5A-4 without separate approval:

```text
app/api/**
app/**
db/**
next.config.ts
eslint.config.mjs
package.json
package-lock.json
types/investor-shield*.ts
lib/investor-shield/**
lib/operator-command/*repository*
```

## Test Plan

Add or update tests only after James approves implementation:

- Prove existing evidence is read and mapped into Professional Evidence Gateway view-model data.
- Prove the integration performs no writes.
- Prove the integration does not mutate pipeline state.
- Prove the integration does not clear gates.
- Prove the integration does not change Investor Shield authority.
- Prove `RIGHTMOVE_SOLD_DATA` remains visible but non-confirming by itself.
- Prove professional confirmation still requires compatible qualifying sources.
- Prove missing or incompatible sources remain non-confirming.
- Prove linked evidence IDs and gate labels are preserved.

## Validation Plan

For the proposal-only documentation step:

```text
npm run lint
npm run build
npm test -- --testTimeout 60000
```

For any later approved implementation:

```text
npx vitest run __tests__/professional-evidence-gateway-source-compatibility.test.ts
npx vitest run __tests__/professional-evidence-gateway-read-model.test.ts
npx vitest run __tests__/professional-evidence-gateway-read-only-integration.test.ts
npm run lint
npm run build
npm test -- --testTimeout 60000
```

## Risks / Open Questions

- Confirm the exact read-only loader that should expose Professional Evidence Gateway data first.
- Confirm whether the view model should be attached to Investor Review, Investor Summary, PDF Evidence Pack preparation, or a narrower server-only model.
- Confirm whether any UI exposure is intentionally out of scope for Phase 5A-4.
- Confirm whether `deal_evidence` has all fields required for source compatibility without schema changes.
- Confirm whether existing fixture evidence covers professional sources, portal sources, agent sources, and operator-only sources.
- Confirm whether any naming should distinguish Evidence Command evidence from Professional Evidence Gateway read-model output.

## Approval Gate

No Phase 5A-4 implementation should begin until James approves this proposal.

Approval must happen before:

- code changes
- test additions
- loader integration
- UI exposure
- API changes
- persistence changes
- deployment

## Boundary Confirmation

This document is proposal-only.

Confirmed for this step:

- No Phase 5A-4 implementation started.
- No UI changes.
- No API changes.
- No migration changes.
- No config changes.
- No database/repository persistence changes.
- No Investor Shield authority changes.
- No gate-clearing.
- No pipeline mutation.
- No True MAO changes.
- No scoring changes.
- No Phase 5B work.
- No Market History work.

## Result

PHASE 5A-4 SCOPE PROPOSAL READY FOR JAMES REVIEW ONLY
