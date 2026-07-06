# Phase 4G-R1-1 Evidence Command Type Contracts and Validation

## Purpose
Define the controlled Evidence Command contract for Phase 4G-R1 without touching persistence, routes, UI, Investor Review, production, or deployment behavior.

## Files Changed
- `types/evidence-lite.ts`
- `lib/evidence-lite/evidence-lite-validation.ts`
- `__tests__/evidence-lite-validation.test.ts`
- `docs/phase4/PHASE_4G_R1_1_EVIDENCE_COMMAND_TYPE_CONTRACTS_AND_VALIDATION.md`

## Contracts Added
- `EvidenceCommandType`
- `EvidenceCommandStatus`
- `EvidenceCommandStrength`
- `EvidenceCommandReviewState`
- `EvidenceCommandBlockerImpact`
- `EvidenceCommandProfessionalGate`
- `EvidenceCommandInput`
- `NormalizedEvidenceCommandInput`
- `EvidenceCommandValidationResult`
- `EVIDENCE_COMMAND_DEFAULTS`
- `validateEvidenceCommandInput(...)`
- `normalizeEvidenceCommandInput(...)`

## Controlled Enums
### Evidence Type
- `SOLD_COMPARABLE`
- `TITLE_LEGAL`
- `LEASEHOLD`
- `PLANNING_BUILDING_CONTROL`
- `REFURB`
- `BUILDER_QUOTE`
- `DAMP_STRUCTURAL`
- `LENDER_BROKER`
- `RENTAL_DEMAND`
- `SOLICITOR_REVIEW`
- `AGENT_RESPONSE`
- `PHOTO_EVIDENCE`
- `VIDEO_EVIDENCE`
- `SURVEYOR_EVIDENCE`
- `OFFER_NEGOTIATION_EVIDENCE`
- `OTHER`

### Evidence Status
- `MISSING`
- `REQUESTED`
- `RECEIVED`
- `REVIEWED`
- `SUFFICIENT`
- `INSUFFICIENT`
- `REJECTED`
- `EXPIRED`

### Evidence Strength
- `WEAK`
- `MODERATE`
- `STRONG`

### Review State
- `NOT_REVIEWED`
- `REVIEWED_BY_OPERATOR`
- `PROFESSIONAL_REVIEW_REQUIRED`
- `PROFESSIONAL_CONFIRMED`

### Blocker Impact
- `DOES_NOT_BLOCK`
- `CAUTION_ONLY`
- `BLOCKS_PROGRESSION`
- `REQUIRES_MANUAL_REVIEW`

### Professional Gate
- `NONE`
- `SOLICITOR_TITLE_REVIEW`
- `BROKER_CONFIRMATION`
- `SURVEYOR_REPORT`
- `BUILDER_QUOTE`
- `PLANNING_BUILDING_CONTROL_CONFIRMATION`
- `ACTUAL_SOLD_COMPARABLE_REVIEW`
- `LENDER_BROKER_CONFIRMATION`
- `SPECIALIST_REPORT`

## Validation Rules
- accept only controlled Evidence Command values
- accept canonical Investor Shield gate keys from the app
- reject `GENERAL`
- reject ad-hoc statuses, strengths, review states, blocker impacts, and professional gates
- trim required and optional text fields
- reject empty `title`
- reject empty `evidenceSummary`
- allow optional `source`
- allow optional `mobileCaptureNote`
- allow optional `recommendedNextAction`
- allow optional `expiryOrUpdateDate`
- validate `expiryOrUpdateDate` as date-like text only when supplied
- return structured validation errors without stack traces or SQL details

## Safe Defaults
- `evidenceStatus`: `MISSING`
- `evidenceStrength`: `WEAK`
- `reviewState`: `NOT_REVIEWED`
- `blockerImpact`: `DOES_NOT_BLOCK`
- `linkedProfessionalGate`: `NONE`

These defaults are defensive only. They do not imply approval, sufficiency, professional confirmation, or progression.

## Backward Compatibility
- Existing Evidence Lite create and update validation behavior remains intact.
- Legacy solicitor-feedback normalization remains in the Evidence Lite validator path.
- The new Evidence Command validator is additive and separate from the legacy create/update validators.

## Photo and Video Placeholder Boundary
- `PHOTO_EVIDENCE` and `VIDEO_EVIDENCE` are structured Evidence Command types only.
- They do not introduce uploads, OCR, AI analysis, file storage paths, or media metadata handling.

## Governance Boundary
Evidence Command validation does not:
- satisfy hard gates
- waive gates
- approve progression
- move pipeline state
- create tasks
- alter True MAO
- alter formulas
- alter classifications
- alter capital protection
- alter governance thresholds

## Explicit Non-Implementation
- no migration
- no repository persistence mapping
- no API route change
- no UI change
- no Investor Review change
- no production access
- no deployment
- no PDF work
- no Phase 5 work
- no AI/OCR/upload/scraping/automation/CRM work

## Result
PHASE 4G-R1-1 EVIDENCE COMMAND TYPE CONTRACTS AND VALIDATION COMPLETE - READY FOR 4G-R1-2 MIGRATION DRAFT AND REPOSITORY MAPPING
