# Phase 5A-0A Professional Evidence Gateway Schema Audit and Implementation Plan

## Purpose

This document turns the completed Phase 5A schema audit into the committed planning artifact for the Professional Evidence Gateway.

Scope is planning only.

No implementation starts here.

## Baseline Confirmed

- Branch: `main`
- `HEAD`: `5d13f0cfdf4484f9bfe5be4626ac554d0c74680e`
- `origin/main`: `5d13f0cfdf4484f9bfe5be4626ac554d0c74680e`
- Final Phase 4 tag: `phase4-final-approved`
- Tag target: `5d13f0cfdf4484f9bfe5be4626ac554d0c74680e`
- Live URL: `https://brik-by-brik-engine-chi.vercel.app`
- Evidence Command Baseline: accepted
- Working tree: clean

## Source Material Reviewed

1. The Phase 5A audit response produced in the prior Codex run.
2. The supplied Phase 5 SOP / doctrine-aligned instructions from James.
3. The accepted Phase 4 production architecture and handover pack.
4. The Phase 4G-R1 Evidence Command acceptance pack and namespace correction note.
5. The current repo schema, migrations, repositories, API routes, and read-model surfaces.

## Audit Summary

The current repository already contains the canonical persistence and read-model surfaces needed for a Professional Evidence Gateway.

The audit result is reuse-first:

- reuse the existing saved-deal record as the top-level authority container
- reuse `deal_evidence` as the canonical evidence-command storage surface
- reuse Investor Shield tables and evaluation logic as the authority source for gate state
- reuse tasks and offers as downstream context only
- do not introduce a second authority layer

No new table is genuinely required for Phase 5A based on the current repo state.
Phase 5B Deal Formulation Engine is not included in this step.

## Confirmed Existing Table Names

All current app tables are schema-qualified under `brik_by_brik_engine`.

### Core deal tables

- `brik_by_brik_engine.saved_deals`
- `brik_by_brik_engine.deal_tasks`
- `brik_by_brik_engine.deal_offers`

### Investor Shield tables

- `brik_by_brik_engine.investor_shield_checks`
- `brik_by_brik_engine.evidence_items`
- `brik_by_brik_engine.risk_flags`
- `brik_by_brik_engine.manual_overrides`
- `brik_by_brik_engine.builder_proposals`
- `brik_by_brik_engine.builder_contract_checks`

### Evidence command table

- `brik_by_brik_engine.deal_evidence`

### Legacy inventory only

- `deals`
- `deal_snapshots`
- `pipeline_events`
- `offers`
- `tasks`
- `evidence_items`
- `audit_events`

Those legacy unqualified tables are historical migration evidence only and are not the current repository surface.

## Tables To Reuse

### `saved_deals`

Use for:

- canonical deal state
- persisted engine outputs
- gateway summary snapshot
- final decision state readout

Important existing fields:

- `classification`
- `governance_state`
- `capital_protection_state`
- `pipeline_state`
- `engine_result_json`
- `risk_summary_json`
- `next_action`

### `deal_evidence`

Use for:

- structured evidence records
- Evidence Command metadata
- professional evidence linkage
- review state and blocker impact tracking

Current additive command columns already exist:

- `linked_investor_shield_gate`
- `evidence_command_type`
- `evidence_summary`
- `evidence_status`
- `evidence_strength`
- `review_state`
- `blocker_impact`
- `linked_professional_gate`
- `recommended_next_action`
- `expiry_or_update_date`
- `source`
- `mobile_capture_note`

### `investor_shield_checks`

Use for:

- hard gate status
- evidence sufficiency
- blocker state
- final progression authority

### `manual_overrides`

Use for:

- explicit approved exceptions
- audit trail of manual decisions

### `risk_flags`

Use for:

- caution and blocker narratives
- advisory-only warnings

### `deal_tasks`

Use for:

- follow-up actions
- review work items

### `deal_offers`

Use for:

- downstream deal context only
- not gateway authority

## Proposed Table Extensions

None are required for Phase 5A at this stage.

If later profiling shows a real need, the first candidates should be additive indexes only:

- `deal_evidence (deal_id, linked_investor_shield_gate)`
- `deal_evidence (deal_id, linked_professional_gate)`
- `deal_evidence (deal_id, review_state)`
- `deal_evidence (deal_id, evidence_status)`

No destructive rewrite is justified.
No new authority table is justified.
No duplicate evidence ledger should be created.
No duplicate gate namespace should be created.

## New Tables Only If Genuinely Needed

Current decision: none.

The audit does not show a missing persistence surface that cannot be covered by the existing schema and read models.

If the product later requires a dedicated professional gateway snapshot table, it must be justified by a demonstrated write/read separation problem, not by preference.

## API Plan

### Reuse existing routes

- `GET /api/saved-deals`
- `POST /api/saved-deals`
- `GET /api/saved-deals/[id]`
- `GET /api/saved-deals/[id]/evidence`
- `POST /api/saved-deals/[id]/evidence`
- `PATCH /api/saved-deals/[id]/evidence/[evidenceId]`
- `GET /api/saved-deals/[id]/investor-shield-ui`
- `GET /api/saved-deals/[id]/investor-summary`
- `POST /api/saved-deals/[id]/pipeline`
- `GET /api/saved-deals/[id]/tasks`
- `POST /api/saved-deals/[id]/tasks`
- `GET /api/saved-deals/[id]/offers`
- `POST /api/saved-deals/[id]/offers`

### Phase 5A API shape

- Keep write behavior inside the existing evidence and saved-deal routes.
- Keep the gateway read-only from the user-facing review surface.
- Add no new mutation route until a specific gap is proven.
- Prefer composed read models over new gateway writes.

### Gateway API intent

If a later Phase 5 implementation needs a dedicated gateway read endpoint, it should:

- read from `saved_deals`, `deal_evidence`, and Investor Shield read models
- return a composed summary only
- not mutate Investor Shield authority
- not reclassify the deal
- not change pipeline state

No automatic task creation is allowed in the planning scope.
No pipeline mutation is allowed in the planning scope.
No gate waiver is allowed in the planning scope.

## UI / Component Plan

### Reuse current surfaces

- `components/evidence-lite/EvidenceLitePanel.tsx`
- `components/investor-review/InvestorReviewDocument.tsx`
- `components/investor-review/InvestorReviewUnavailable.tsx`

### UI decision

Do not build a new interaction surface for Phase 5A.

The current UI already covers the relevant domain:

- structured evidence capture
- read-only investor review
- blocked movement and gate visibility
- task and offer context

### Later-only UI candidate

If needed after approval, a gateway summary component may be added as a read-only composition panel.

It must not become a second authoritative control surface.

Possible later additions only, after approval:

- Professional Evidence Gateway panel
- professional gate status rows and cards
- linked Evidence Command records
- blocker, caution, and next-action display
- final decision lock banner

## Gate Statuses And Enums

### Investor Shield authority enums

- `InvestorShieldOverallStatus`: `CLEAR`, `CAUTION`, `BLOCKED`
- `InvestorShieldProgressionDecision`: `CAN_PROGRESS`, `NEEDS_REVIEW`, `BLOCKED`
- `InvestorShieldGateKey`: includes `SOLICITOR_REVIEW`

### Evidence Lite enums

- `EvidenceLiteStatus`: `MISSING`, `RECORDED`, `REVIEWED`, `VERIFIED`, `REJECTED`
- `EvidenceLiteGateKey`: includes `SOLICITOR_REVIEW`

### Evidence Command enums

- `EvidenceCommandType`
- `EvidenceCommandStatus`
- `EvidenceCommandStrength`
- `EvidenceCommandReviewState`
- `EvidenceCommandBlockerImpact`
- `EvidenceCommandProfessionalGate`

### Canonical solicitor gate rule

- Canonical gate: `SOLICITOR_REVIEW`
- Legacy alias only: `SOLICITOR_FEEDBACK`

`SOLICITOR_FEEDBACK` remains compatibility-only and must not re-enter gate authority.

## Evidence Command Linkage

The gateway must use the existing evidence-command linkage already present in `deal_evidence`.

Required linkage behavior:

- evidence records must link to an Investor Shield gate
- evidence records may also link to a professional gate
- evidence records must carry review state and blocker impact
- evidence records must remain auditable and readable in investor review

The evidence command layer is already normalized in repository code and route validation.

## Investor Shield Rules

The gateway must preserve the existing authority chain.

Rules:

- Investor Shield remains the hard gate authority.
- Evidence supports review, but evidence alone does not satisfy a hard gate.
- Evidence cannot waive progression by itself.
- Manual overrides remain explicit and auditable.
- Deterministic reject / NO-GO dominance is untouched.
- True MAO stays untouched.
- Capital protection stays untouched.
- Classification logic stays untouched.
- Gate authority stays untouched.

## Final Decision Lock Logic

Final lock logic must continue to derive from the current Investor Shield read model.

Use the existing progression semantics:

- `CLEAR` with `CAN_PROGRESS` means unlocked
- `CAUTION` with `NEEDS_REVIEW` means review required
- `BLOCKED` with `BLOCKED` means locked

The gateway must not introduce a parallel decision source that can outvote the existing shield result.
The gateway must not bypass hard, safety, or legal blockers.

Display-only lock states for Phase 5A planning:

- locked
- review required
- professionally confirmed
- blocked by hard gate
- blocked by professional evidence
- manual review required

## No-Mutation Proof Plan

Before any future implementation step, capture a no-mutation proof set:

1. `git status --short`
2. `git rev-parse HEAD`
3. `git rev-parse origin/main`
4. `git tag --list phase4-final-approved`
5. repository schema snapshot references
6. approval checkpoint note for James

Phase 5A-0A itself remains documentation only.

## Test Matrix

### Schema checks

- saved-deals table presence
- deal-evidence table presence
- Investor Shield table presence
- additive Evidence Command columns present

### Repository checks

- evidence create/update round-trip
- legacy alias normalization still works
- command payload validation still routes correctly
- gateway reads still pull from canonical evidence rows

### API checks

- evidence list/create/update still works
- investor-summary remains read-only
- investor-shield-ui remains read-only
- pipeline guard behavior remains unchanged

### UI checks

- Evidence Lite command panel still renders
- Investor Review still renders as read-only
- blocked movement messaging still reflects shield authority

### Governance checks

- `SOLICITOR_REVIEW` remains canonical
- `SOLICITOR_FEEDBACK` remains legacy-only
- capital protection remains unchanged
- classification remains unchanged
- True MAO remains unchanged

## Migration And Rollback Plan

### Default

No migration is expected for Phase 5A.

### If an additive migration is later approved

- keep it additive only
- prefer indexes before new columns
- avoid renames
- avoid destructive rewrites
- document rollback before execution

### Rollback shape

- drop any new indexes
- drop any new nullable columns only if they were added
- preserve canonical gate values
- preserve the existing evidence-command compatibility path

Development/staging validation comes before any future production migration decision.
Destructive rollback requires separate approval.

## Acceptance Pack Plan

The Phase 5A acceptance pack should include:

- schema audit findings
- confirmed table inventory
- reuse decision
- no-new-table decision
- API plan
- UI/component plan
- gate status and enum matrix
- Evidence Command linkage summary
- Investor Shield authority summary
- final decision lock logic
- no-mutation proof plan
- test matrix
- migration / rollback summary
- approval checkpoint record

## Implementation Subphase Proposal

- `5A-1` Type contracts and enums only
- `5A-2` Repository/API mapping only
- `5A-3` Professional Gateway UI only
- `5A-4` Investor Review readiness integration only
- `5A-5` Local validation and safety proof only
- `5A-6` Controlled migration/live proof only if needed and approved
- `5A-7` Final Phase 5A acceptance pack only

## Delivery Dates

Target dates assume approval and no scope change.

| Date | Deliverable |
|---|---|
| 2026-07-10 | Schema audit committed as planning document |
| 2026-07-11 | Review and approval checkpoint |
| 2026-07-14 | Phase 5A implementation start, if approved |
| 2026-07-16 | API / UI integration checkpoint, if approved |
| 2026-07-17 | Validation and acceptance-pack readiness, if approved |

## Explicit Non-Implementation

This document does not:

- start Phase 5 coding
- modify runtime code
- modify UI
- modify API routes
- modify repository code
- modify migrations
- access production
- deploy
- apply migrations
- create PDFs
- add AI, OCR, scraping, CRM, uploads, automation, or media handling
- change True MAO, Investor Shield, capital protection, classification logic, or gate authority
- touch `.gitignore`

## Result

PHASE 5A-0 PROFESSIONAL EVIDENCE GATEWAY SCHEMA AUDIT AND IMPLEMENTATION PLAN COMPLETE — READY FOR JAMES REVIEW BEFORE PHASE 5A CODING
