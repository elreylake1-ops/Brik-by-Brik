# Phase 5A-1 - Professional Evidence Gateway Detailed Implementation Plan Only

## 1. Purpose

This document is a detailed Phase 5A implementation plan only.

No Phase 5 coding has started.
This is documentation-only planning.

## 2. Locked Phase 4 Baseline

- `phase4-final-approved` remains the official Phase 4 release baseline.
- The tag target remains `5d13f0cfdf4484f9bfe5be4626ac554d0c74680e`.
- The Phase 4 tag must not be moved, recreated, or amended.
- Current `main` includes post-tag documentation-only commits.
- Phase 5A must build on the accepted Phase 4 architecture.

## 3. Phase 5A Scope

Phase 5A is limited to the Professional Evidence Gateway.

In scope:

- solicitor review
- leasehold advice
- broker/lender confirmation
- builder quote confirmation
- surveyor report
- sold comparable review
- professional readiness status
- final decision lock display

Out of scope:

- Phase 5B Deal Formulation Engine
- any Phase 5 coding that changes runtime behavior before approval

## 4. Existing Schema Reuse

The current audit supports reuse of the existing canonical tables.

Confirmed tables to reuse:

- `brik_by_brik_engine.saved_deals`
- `brik_by_brik_engine.deal_evidence`
- `brik_by_brik_engine.investor_shield_checks`
- `brik_by_brik_engine.risk_flags`
- `brik_by_brik_engine.manual_overrides`
- `brik_by_brik_engine.deal_tasks`
- `brik_by_brik_engine.deal_offers`

Reuse intent:

- `saved_deals` remains the top-level deal authority container.
- `deal_evidence` remains the canonical Evidence Command and Professional Evidence Gateway surface.
- `investor_shield_checks` remains the hard gate authority source.
- `risk_flags`, `manual_overrides`, `deal_tasks`, and `deal_offers` remain supporting context only.

## 5. New Tables / Extensions Decision

Current decision for Phase 5A:

- no new table is required based on the current audit
- no duplicate evidence ledger will be created
- no duplicate gate namespace will be created
- `deal_evidence` remains the canonical Evidence Command / Professional Evidence Gateway surface
- optional future indexes or additive fields require separate approval

## 6. Professional Gate Model

The gateway should be planned as a read-focused layer over the existing evidence and Investor Shield authority.

| Professional Area | Linked Investor Shield Gate | Linked Professional Gate | Evidence Needed | Blocker/Caution Condition | Recommended Next Action | Automatic Action Prohibited |
| --- | --- | --- | --- | --- | --- | --- |
| Solicitor review | `SOLICITOR_REVIEW` | solicitor review | solicitor feedback, legal note, title comment, completion risk note | missing, adverse, expired, or operator-only evidence | request solicitor review or update legal evidence | no automatic gate waiver |
| Leasehold advice | `LEASEHOLD` | leasehold advice | lease summary, lease terms review, lease extension risk note | lease issue unresolved or lease evidence absent | obtain leasehold advice / confirm lease position | no automatic progression |
| Broker / lender confirmation | `LENDER_CRITERIA` | broker/lender confirmation | lender criteria confirmation, lending note, term confirmation | finance criteria uncertain or contradictory | obtain broker/lender confirmation | no automatic finance approval |
| Builder quote confirmation | `REFURB_CERTAINTY` / `BUILDER_PROPOSAL_CONTRACT` | builder quote confirmation | builder quote, scope confirmation, contract-ready evidence | quote missing, weak, or inconsistent with scope | obtain builder quote and scope confirmation | no automatic refurb certainty |
| Surveyor report | `DAMP_STRUCTURAL` | surveyor report | survey report, structural note, damp evidence | structural or damp concern unresolved | request surveyor report | no automatic structural clearance |
| Sold comparable review | `SOLD_COMPS` | sold comparable review | sold comp evidence, comparable review note | insufficient or stale comparables | refresh sold comparable review | no automatic GDV validation |

This is planning-only. The mapping remains subject to final review before coding begins.

## 7. Planning-Only Gate Statuses / Enums

The following statuses are proposed for planning only.

Professional gate status:

```text
NOT_STARTED
REQUESTED
RECEIVED
UNDER_REVIEW
CONFIRMED
ADVERSE
EXPIRED
NOT_REQUIRED
```

Professional readiness:

```text
NOT_READY
PARTIALLY_READY
READY_FOR_REVIEW
PROFESSIONALLY_CONFIRMED
BLOCKED
```

Decision lock status:

```text
LOCKED
UNLOCKED_FOR_REVIEW
BLOCKED_BY_HARD_GATE
BLOCKED_BY_PROFESSIONAL_EVIDENCE
MANUAL_REVIEW_REQUIRED
```

These statuses are not implemented yet and require approval before any coding begins.

## 8. Evidence Command Linkage

Phase 5A plans to link through `deal_evidence`.

Rules:

- Evidence Command remains canonical.
- Professional confirmation must be distinguishable from operator notes.
- Weak, missing, expired, or operator-only evidence cannot be treated as professional confirmation.
- Photo and video placeholders remain structured evidence categories only.
- No uploads are added in Phase 5A.

## 9. Investor Shield Rules

The gateway must preserve the existing authority chain.

Rules:

- Investor Shield remains authoritative.
- Hard gates remain dominant.
- Professional evidence supports review but does not automatically clear hard gates.
- No score can override a hard gate.
- No professional gateway status can waive gates automatically.
- Missing or adverse evidence can create blocker/caution visibility.
- Final decision lock cannot bypass hard, safety, or legal blockers.

## 10. Final Decision Lock Logic

The first Phase 5A implementation should be display-only.

It should show:

- current Investor Shield progression state
- whether final proceed is unavailable
- reason for lock
- required professional checks
- linked evidence
- recommended next action
- manual review requirement where applicable

No pipeline mutation is allowed in Phase 5A unless separately approved.

## 11. API / Service Plan

Prefer the existing Evidence Command routes:

- `GET /api/saved-deals/[id]/evidence`
- `POST /api/saved-deals/[id]/evidence`
- `PATCH /api/saved-deals/[id]/evidence/[evidenceId]`

Only if a composed read model is later needed, propose a future read-only route:

- `GET /api/saved-deals/[id]/professional-readiness`

API rules:

- route deal id remains authoritative
- controlled enum validation
- safe errors only
- no SQL, stack, or environment leakage
- no automatic task creation
- no pipeline mutation
- no gate waiver
- no duplicate tasks

## 12. UI / Component Plan

Proposed UI surfaces, if approved later:

- `ProfessionalEvidenceGatewayPanel`
- professional gate readiness cards
- linked Evidence Command evidence list
- blocker, caution, and next-action display
- final decision lock banner
- Investor Review professional readiness summary

Reuse:

- `EvidenceLitePanel`
- `InvestorReviewDocument`
- existing Investor Review read model

Explicitly excluded:

- upload flow
- AI/OCR/media controls

## 13. No-Mutation Proof Plan

Phase 5A must prove it does not mutate:

- Investor Shield status
- pipeline state
- deal status
- tasks
- offers
- True MAO
- formulas
- classification
- capital protection
- governance thresholds

The proof plan should rely on read-only validation, route checks, and regression testing against the Phase 4 baseline.

## 14. Test Matrix

Planned validation coverage:

- enum/type validation tests
- repository mocked tests
- API mocked tests
- UI component tests
- Investor Review mapper/display tests
- no-mutation governance tests
- gate namespace tests
- safe error tests
- mobile layout tests
- persistence tests
- Phase 4G-R1 regression tests
- full lint/build/test validation

## 15. Migration Plan

Default:

- no schema change for Phase 5A

If a later change is justified:

- migration must be additive only
- no scaffold SQL directly in production
- no production migration without written approval
- development/staging validation first
- rollback notes are required

## 16. Rollback Plan

If anything fails later:

- preserve the Phase 4 tagged baseline
- if migration fails, stop and report
- if deploy fails, stop and report
- if QA fails, stop and report
- no ad hoc production patching
- destructive rollback requires separate written approval

## 17. Acceptance Pack Plan

The Phase 5A acceptance pack should include:

- schema reuse proof
- Evidence Command linkage proof
- professional evidence creation/update proof
- readiness display proof
- final decision lock proof
- Investor Shield no-mutation proof
- persistence after refresh
- mobile screenshots
- Investor Review screenshots
- lint/build/test proof
- deterministic safety proof

## 18. Delivery Dates

These dates are planning estimates only.

- Phase 5A-1 detailed plan: current step
- Phase 5A-2 type contracts/enums after approval
- Phase 5A-3 repository/API mapping after approval
- Phase 5A-4 UI after approval
- Phase 5A-5 Investor Review readiness integration after approval
- Phase 5A-6 validation/safety proof
- Phase 5A-7 live proof only if needed and approved
- Phase 5A-8 acceptance pack

## 19. Implementation Subphase Proposal

Future Phase 5A work should be broken into approval-controlled tasks:

- 5A-2 type contracts and enum validation only
- 5A-3 repository/API support only
- 5A-4 Professional Gateway UI only
- 5A-5 Investor Review readiness integration only
- 5A-6 local validation and safety proof only
- 5A-7 controlled live proof only if needed and approved
- 5A-8 final Phase 5A acceptance pack only

## 20. Explicit Non-Implementation

This document does not:

- change code
- create type files
- create tests
- change UI
- change API
- change repositories
- change migrations
- access production
- deploy
- generate PDFs
- begin Phase 5 coding

## 21. Result

PHASE 5A-1 PROFESSIONAL EVIDENCE GATEWAY DETAILED IMPLEMENTATION PLAN COMPLETE - READY FOR JAMES REVIEW BEFORE CODING
