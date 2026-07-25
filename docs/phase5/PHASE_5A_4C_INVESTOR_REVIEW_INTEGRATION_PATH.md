# Phase 5A-4C - Investor Review Integration Path

## Purpose

This document locks the read-only Professional Evidence Gateway integration path for the real saved-deal Investor Review page.

## Repository Baseline

- Starting branch: `main`
- Starting commit: `6d0981b4de7097b36e3995ff1733784a0c0fdaa5`
- Feature branch: `phase5a-4c-investor-review-professional-gateway`
- Clean-tree status: clean before branch creation

## Confirmed Investor Review Owner

- Page path: `app/saved-deals/[id]/review/page.tsx`
- Canonical loader: `loadInvestorReviewPageModel`
- Result model: `ready` / `not_found` / `unavailable`
- Current document section order:
  - Header
  - Property and deal overview
  - Investment summary
  - Decision and capital-protection status
  - Required hard gates
  - Advisory and caution gates
  - Evidence Lite records
  - Missing evidence and blockers
  - Tasks and offers
  - Recommended next action
  - Footer
- Existing canonical data already available:
  - saved-deal existence
  - `PdfEvidencePack`
  - Investor Summary
  - Investor Shield
  - Evidence Lite
  - tasks
  - offers

## Confirmed Professional Gateway Boundary

- Gateway loader: `loadProfessionalEvidenceGatewayViewModel`
- Behavior: pure and read-only
- Required inputs:
  - `savedDealId`
  - already-loaded evidence array
  - optional lock status and reason
- Repository or database calls: none
- Mutation authority: none
- Development-only proof-panel wording that must not reach production:
  - `Read-only dev/demo proof`
  - `Professional Evidence Gateway Proof`
  - `Seeded saved deal identifier`

## Selected Canonical Evidence Source

Locked source: `PdfEvidencePack.evidenceIndex`

Reason:

- canonical
- already loaded
- rich field set
- avoids a second database read
- avoids display-shaped evidence rows

## Selected Adapter Boundary

Plan one pure adapter:

```text
PdfEvidencePack.evidenceIndex
→ LoadedProfessionalEvidenceGatewayEvidence[]
```

The adapter performs field translation only. It performs no database access. It does not duplicate readiness or compatibility rules. Gateway rules remain owned by the Gateway loader.

## Selected Loader Integration

Locked flow:

```text
loadInvestorReviewPageModel
→ load saved deal
→ load PdfEvidencePack
→ map standard Investor Review model
→ adapt PdfEvidencePack.evidenceIndex
→ call loadProfessionalEvidenceGatewayViewModel
→ attach professionalEvidenceGateway to ready view model
```

The page must not construct the Gateway model.

## Selected Page-Model Contract

Add in PR #4B:

```ts
professionalEvidenceGateway: ProfessionalEvidenceGatewayViewModel
```

This field is always present for a `ready` result. Zero evidence is a valid conservative model. No separate partial-success union is added.

## Failure Contract

Locked behavior:

- adapter or Gateway model failure causes Investor Review `unavailable`
- never convert failure into empty evidence
- never convert failure into `NOT_STARTED`
- no internal error details
- Investor Shield remains unchanged

## Production Component Contract

Plan a small production component.

Required title:

`Professional Evidence Gateway`

Required notice:

`Read-only professional decision support. This section does not satisfy, waive, approve, or override Investor Shield requirements.`

Production must not render:

- `Read-only dev/demo proof`
- `Professional Evidence Gateway Proof`
- `Seeded saved deal identifier`

## Display Contract

Aggregate summary:

- professional gate status
- professional readiness
- final decision-lock status
- lock reason

Per-gate cards:

- professional gate area
- required evidence summary
- confirming or visible/non-confirming state
- review source
- professional gate status
- professional readiness
- linked Evidence Command evidence ID
- professional confirmation summary
- recommended next action
- expiry or review date when present

## Placement Contract

Use exactly:

```text
Required hard gates
→ Advisory and caution gates
→ Professional Evidence Gateway
→ Evidence Lite records
→ Missing evidence and blockers
```

- same order on desktop and mobile
- Investor Shield remains visually authoritative
- Gateway remains secondary decision support
- Evidence Lite remains informational

## Empty-State Contract

Always show the authority notice.

For zero compatible evidence show:

`No compatible professional evidence is currently available for review.`

Also show canonical conservative aggregate values.

## State-Presentation Contract

- Confirming: use canonical confirming state only; still non-authoritative
- Visible but non-confirming: show as non-successful and keep qualifying-source caution intact
- Weak: never use successful presentation
- Adverse: never use successful presentation
- Expired: never use successful presentation
- Manual review required: never use successful presentation
- Missing / not started: never use successful presentation

Non-confirming, weak, adverse, expired, manual-review, missing, and not-started states must never use successful presentation.

## Investor Shield Authority Boundary

Gateway cannot:

- satisfy or waive gates
- override Investor Shield
- change `canProgress`
- change classification
- change governance
- change capital protection
- change True MAO
- create tasks
- move pipeline state
- mutate evidence

## Minimum PR #4B Scope

Plan only:

- page-model type update
- canonical loader integration
- one pure adapter
- one production read-only component
- `InvestorReviewDocument` placement
- focused tests
- completion documentation

Explicitly exclude:

- new API
- repository changes
- second aggregation layer
- database changes
- route changes
- proof-page changes
- persistence changes
- broad redesign

## PR #4B Test Plan

Keep grouped under:

- data path
- authority
- presentation
- failure behavior

Locked tests:

- already-loaded canonical evidence is reused
- no second repository read
- Gateway loader receives mapped canonical evidence
- saved-deal existence behavior remains unchanged
- no Investor Shield result changes
- no gate-clearing language
- no mutation controls
- no True MAO, classification, governance, or capital-protection changes
- production title and notice render
- development/proof wording does not render
- aggregate and per-gate fields render as locked
- panel appears in the locked section order
- empty, weak, adverse, expired, and manual-review states remain non-successful
- Gateway failure enforces whole-page `unavailable`
- no internal error detail is shown

## PR #4C Boundary

PR #4C will separately handle:

- preview deployment
- desktop visual QA
- mobile visual QA
- live wording and layout verification
- screenshots
- PR closeout

PR #4B implementation must not include deployment or screenshots.

## Explicit Non-Implementation

This phase adds no:

- runtime code
- adapter
- component
- tests
- API
- route
- database query
- persistence
- UI change
- Investor Shield change
- task, offer, or pipeline mutation
- formula, True MAO, finance, scoring, classification, governance, or capital-protection change
- AI, OCR, scraping, upload, CRM, automation, PDF, or external integration

## Result

`PR #4A COMPLETE — INVESTOR REVIEW INTEGRATION PATH LOCKED`

## Recommended Next Step

`PR #4B-1 — Implement the canonical evidence adapter and Investor Review page-model integration only.`
