# Phase 5A-5A Professional Readiness Classifier

## Purpose

Implement one pure, advisory-only Professional Evidence Gateway readiness classifier that converts canonical professional-evidence inputs into one conservative readiness state without UI wiring, database access, or Investor Review integration.

## Repository Baseline

- Repository: `Brik-by-Brik`
- Base branch used: `main`
- Working branch: `phase5a-5a-professional-readiness-classifier`
- Base `main` / `origin/main`: `6d0981b4de7097b36e3995ff1733784a0c0fdaa5`
- Frozen branch intentionally left untouched: `phase5a-4c-investor-review-professional-gateway` at `c945e3e11771ce6ee33e0457da966e1f58815fd8`

## Files Inspected

- `AGENTS.md`
- `LEAN-CTX.md`
- `docs/phase5/PHASE_5A_1_PROFESSIONAL_EVIDENCE_GATEWAY_DETAILED_IMPLEMENTATION_PLAN.md`
- `docs/phase5/PHASE_5A_4_SCOPE_PROPOSAL.md`
- `types/professional-evidence-gateway.ts`
- `types/evidence-lite.ts`
- `types/investor-shield.ts`
- `lib/professional-evidence-gateway/professional-evidence-gateway-validation.ts`
- `lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility.ts`
- `lib/professional-evidence-gateway/professional-evidence-gateway-read-model.ts`
- `lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model.ts`
- `lib/investor-review/load-investor-review-page-model.ts`
- `lib/investor-review/map-pdf-evidence-pack-to-investor-review.ts`
- `components/professional-evidence-gateway/ProfessionalEvidenceGatewayProofPanel.tsx`
- `__tests__/professional-evidence-gateway-read-model.test.ts`
- `__tests__/professional-evidence-gateway-readonly-integration.test.ts`
- `__tests__/fixtures/phase3-authority/authority-doctrine.json`

## Files Added or Changed

- `lib/professional-evidence-gateway/classify-professional-readiness.ts`
- `__tests__/classify-professional-readiness.test.ts`
- `docs/phase5/PHASE_5A_5A_PROFESSIONAL_READINESS_CLASSIFIER.md`

## Readiness States

Exact classifier states:

```text
READY_FOR_REVIEW
PROFESSIONALLY_CONFIRMED
WEAK_OR_NON_CONFIRMING
MISSING
ADVERSE
EXPIRED
MANUAL_REVIEW_REQUIRED
```

These states are separate from the existing broader Phase 5A `ProfessionalReadiness` aggregate enum and were kept isolated inside the classifier module to avoid competing repository-wide enum changes in this small phase.

## Input Contract

Classifier input uses actual repository contracts only:

- canonical professional gate area from `types/professional-evidence-gateway.ts`
- canonical professional review source from `types/professional-evidence-gateway.ts`
- canonical Evidence Command fields from `types/evidence-lite.ts`:
  - `evidenceType`
  - `linkedProfessionalGate`
  - `evidenceStatus`
  - `evidenceStrength`
  - `reviewState`
  - `blockerImpact`
  - `expiryOrUpdateDate`
- existing linked Investor Shield gate label as read-only text only

Actual canonical repository fields currently available for professional evidence therefore include:

- linked gate
- professional evidence type
- review / confirmation state
- status
- expiry / update date
- adverse findings through `REJECTED` or `BLOCKS_PROGRESSION`
- weak or non-confirming findings through `WEAK`, `INSUFFICIENT`, operator-only review, or non-qualifying source
- missing evidence through `MISSING` or `REQUESTED`
- manual-review requirements through `REQUIRES_MANUAL_REVIEW`

## Classification Precedence

Implemented conservative precedence:

```text
ADVERSE
-> EXPIRED
-> MISSING
-> MANUAL_REVIEW_REQUIRED
-> WEAK_OR_NON_CONFIRMING
-> PROFESSIONALLY_CONFIRMED
-> READY_FOR_REVIEW
-> MANUAL_REVIEW_REQUIRED fallback
```

Reason for placing `MANUAL_REVIEW_REQUIRED` ahead of weak/non-confirming:

- explicit manual-review flags must not be hidden
- conflicting confirmation signals must fail conservatively
- this preserves the authority doctrine that advisory outputs may increase review burden but may not reduce deterministic risk

## Conservative Fallback Behavior

- `REJECTED` or `BLOCKS_PROGRESSION` always classifies as `ADVERSE`
- explicit or date-derived expiry cannot classify as confirmed
- `MISSING` or `REQUESTED` cannot classify as ready
- invalid expiry input or invalid reference date fails to `MANUAL_REVIEW_REQUIRED`
- explicit confirmation without sufficient evidence fails conservatively
- weak or operator-only evidence cannot classify as professionally confirmed
- mere record presence does not create professional confirmation
- unhandled residual combinations fall back to `MANUAL_REVIEW_REQUIRED`

## Investor Shield Authority Boundary

Classifier is advisory only.

It does not:

- satisfy an Investor Shield gate
- waive a gate
- clear a blocker
- change `canProgress`
- change progression state
- change deterministic classification
- change governance
- change capital protection
- change True MAO
- change finance
- create tasks
- move pipeline state
- mutate evidence
- write to a database

Locked doctrine preserved:

`Advisory outputs may increase review burden, but they may not reduce deterministic risk.`

## Evidence Lite Separation

Evidence Lite record presence does not constitute professional confirmation and does not satisfy Investor Shield requirements.

This classifier preserves that boundary by requiring explicit compatible qualifying professional sources before returning `PROFESSIONALLY_CONFIRMED`. Operator-only or Evidence Lite-like review context remains `WEAK_OR_NON_CONFIRMING`.

## Deterministic Date Handling

- classifier accepts deterministic `referenceDate` input
- classifier does not call `new Date()` or generate current time internally
- ISO-compatible date strings are parsed deterministically
- invalid or ambiguous dates fail conservatively to `MANUAL_REVIEW_REQUIRED`
- date-only values are evaluated in UTC

## Focused Test Coverage

Focused test file:

- `__tests__/classify-professional-readiness.test.ts`

Covered scenarios:

1. explicit adverse evidence
2. expired evidence
3. missing required evidence
4. weak or non-confirming evidence
5. ambiguous / conflicting evidence
6. explicit professional confirmation
7. ready for professional review
8. mere record presence is not confirmation
9. Evidence Lite does not confirm
10. input immutability
11. repeated-call determinism
12. no DB / API / env / live infra dependency
13. no Investor Shield mutation or recalculation path
14. adverse / expired / missing / weak inputs do not downgrade into safer states

## Explicit Non-Implementation

Confirmed no:

- UI
- Investor Review wiring
- database access
- migration
- API route
- evidence mutation
- task creation
- pipeline movement
- Investor Shield mutation
- gate clearing
- True MAO change
- finance change
- classification change
- production access
- deployment
- AI, OCR, scraping, upload, PDF, CRM, or automation

## Result

PHASE 5A-5A PROFESSIONAL READINESS CLASSIFIER COMPLETE — PURE LOGIC VERIFIED

## Recommended Next Step

Phase 5A-5B — Integrate the professional readiness state into the Investor Review presentation on the Phase 5A-4C branch only after the blocked branch is safely recovered or through an approved clean integration branch.
