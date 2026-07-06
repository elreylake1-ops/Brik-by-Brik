# Phase 4G-R1-0 Evidence Command Baseline Scope Lock and Implementation Plan

## Purpose
This document locks the implementation scope for Phase 4G-R1 Evidence Command Baseline before any further coding work.
It is a local-only stabilization artifact; the migration is not applied and live Vercel proof remains pending.

## James Direction Summary
- Evidence Lite must become a structured evidence control layer.
- The system must remain phone-first and evidence-led.
- Evidence must support continue, pause, renegotiate, or walk-away decisions.
- Evidence must remain lean but not weak.
- Final release tagging remains paused until Evidence Command is live, verified, and accepted unless James separately approves tagging with R1 as a post-tag patch.

## Non-Negotiable Boundaries
- no AI
- no OCR
- no automatic image/video analysis
- no heavy file upload
- no PDF generation
- no scraping
- no automation
- no CRM expansion
- no formula changes
- no classification changes
- no True MAO changes
- no capital-protection changes
- no deterministic governance changes
- no automatic hard-gate satisfaction
- no automatic waiver
- no automatic progression approval
- no pipeline mutation

## Current Evidence Lite Baseline

### Table / Model
- Primary storage remains `brik_by_brik_engine.deal_evidence`.
- Current additive migration widens the existing table rather than replacing it.
- Repository mapping still centers on the saved-deal evidence routes and the `EvidenceLiteRecord` contract in `types/evidence-lite.ts`.

### Current Fields
- Core legacy fields: `id`, `dealId`, `evidenceType`, `linkedGate`, `title`, `note`, `status`, `reviewed`, `reviewerNote`, `createdAt`, `updatedAt`.
- Current structured additions already present in the live contract: `linkedInvestorShieldGate`, `linkedProfessionalGate`, `evidenceSummary`, `evidenceStatus`, `evidenceStrength`, `reviewState`, `blockerImpact`, `recommendedNextAction`, `expiryOrUpdateDate`, `source`, `mobileCaptureNote`.

### Current Validation
- Create and update validation normalize trimmed text, reject unknown fields, and validate controlled enums.
- Legacy evidence type aliases still normalize into the current structured evidence types.
- Legacy status and reviewed behavior still map into the new structured fields.
- Unknown statuses and unknown evidence types are rejected unless mapped to `other` or a supported legacy alias.

### Current Statuses
- Legacy status enum: `MISSING`, `RECORDED`, `REVIEWED`, `VERIFIED`, `REJECTED`.
- Structured evidence status enum: `missing`, `requested`, `received`, `reviewed`, `sufficient`, `insufficient`, `rejected`, `expired`.
- Structured strength enum: `weak`, `moderate`, `strong`.
- Structured review state enum: `not reviewed`, `reviewed by operator`, `professional review required`, `professional confirmed`.
- Structured blocker impact enum: `does not block`, `caution only`, `blocks progression`, `requires manual review`.

### Current API Routes
- `GET /api/saved-deals/[id]/evidence`
- `POST /api/saved-deals/[id]/evidence`
- `PATCH /api/saved-deals/[id]/evidence/[evidenceId]`

### Current UI Display
- The Evidence Lite panel is a mobile-first saved-deal capture surface.
- It already shows structured fields such as evidence status, evidence strength, review state, blocker impact, recommended next action, and mobile capture note.
- Photo and video are represented as structured evidence types, not as upload workflows.

### Current Investor Review Integration
- Investor Review renders Evidence Lite records as informational support.
- Evidence Lite references and structured rows are visible in the investor review document/view model.
- Evidence Lite remains read-only evidence context and does not satisfy Investor Shield requirements.

### Current Persistence Behavior
- Evidence records persist through the repository layer into `deal_evidence`.
- IDs are generated server-side.
- The repository preserves backward compatibility by mapping legacy and structured fields together.

### Current Limitations
- Evidence Lite is informational only.
- It does not mutate Investor Shield gates.
- It does not move pipeline state.
- It does not create tasks automatically.
- It does not add AI, OCR, uploads, PDF output, scraping, or CRM behavior.

## Required Evidence Command Fields

| SOP Field | Current Support | Required Change | Proposed Type / Enum | Notes |
|---|---|---|---|---|
| evidence type | Yes | Keep controlled evidence typing with legacy alias support | `EvidenceLiteEvidenceType` | Include structured evidence labels and `other` fallback |
| linked Investor Shield gate | Yes | Keep canonical gate linkage and validate against gate list | `EvidenceLiteGateKey` | Used for evidence-to-gate mapping and review display |
| linked professional gate | Yes | Preserve separate professional-review routing field | `EvidenceLiteProfessionalGateKey \| null` | Placeholder control field, not an approval signal |
| title | Yes | Keep required title with length-safe validation | `string` | Still the primary label for each evidence row |
| evidence summary | Yes | Keep as structured summary separate from note | `string \| null` | Capture the short evidence narrative |
| evidence status | Yes | Keep controlled operational evidence state | `EvidenceLiteEvidenceStatus` | Drives display and blocker logic |
| evidence strength | Yes | Keep controlled strength assessment | `EvidenceLiteEvidenceStrength` | Keep weak/moderate/strong only |
| review state | Yes | Keep controlled review state | `EvidenceLiteReviewState` | Distinguish operator review from professional confirmation |
| blocker impact | Yes | Keep controlled blocker impact | `EvidenceLiteBlockerImpact` | Must remain advisory, not automatic governance |
| recommended next action | Yes | Keep optional guidance text | `string \| null` | Phone-first next-step prompt |
| expiry/update date | Yes | Keep optional date text field | `string \| null` | Structured text only unless a later date type is approved |
| source | Yes | Keep optional source attribution | `string \| null` | Useful for evidence provenance and audit context |
| mobile capture note | Yes | Keep lightweight capture note | `string \| null` | Supports phone-first capture without uploads |
| created_at / updated_at | Yes | Preserve timestamps in storage and view models | `string` | Must remain authoritative from persistence |
| photo evidence placeholder | Yes | Keep as structured evidence type only | `EvidenceLiteEvidenceType` | No upload pipeline |
| video evidence placeholder | Yes | Keep as structured evidence type only | `EvidenceLiteEvidenceType` | No upload pipeline |

## Controlled Enum Plan

### Evidence Type
Use implementation-friendly values aligned to the live contract:
- sold comparable
- title/legal
- leasehold
- planning/building control
- refurb
- builder quote
- damp/structural
- lender/broker
- rental demand
- solicitor review
- agent response
- photo evidence
- video evidence
- surveyor evidence
- offer/negotiation evidence
- other

Legacy aliases remain supported only for normalization:
- `SOLD_COMP`
- `TITLE_REVIEW`
- `LEASEHOLD_REVIEW`
- `PLANNING_BUILDING_CONTROL`
- `REFURB_NOTE`
- `BUILDER_QUOTE`
- `SURVEY_NOTE`
- `LENDER_NOTE`
- `RENTAL_DEMAND`
- `SOLICITOR_REVIEW`
- `SOLICITOR_FEEDBACK`
- `AGENT_RESPONSE`
- `PHOTO_EVIDENCE`
- `VIDEO_EVIDENCE`
- `SURVEYOR_EVIDENCE`
- `OFFER_NEGOTIATION_EVIDENCE`
- `OTHER`

### Evidence Status
- missing
- requested
- received
- reviewed
- sufficient
- insufficient
- rejected
- expired

### Evidence Strength
- weak
- moderate
- strong

### Review State
- not reviewed
- reviewed by operator
- professional review required
- professional confirmed

### Blocker Impact
- does not block
- caution only
- blocks progression
- requires manual review

### Professional Gate
Use a controlled placeholder list only where supported by the SOP:
- solicitor title review
- broker confirmation
- surveyor report
- builder quote
- planning/building control confirmation
- actual sold comparable review
- lender/broker confirmation
- specialist report
- none

## Gate Mapping Plan
- sold comparable -> SOLD_COMPS
- title/legal -> TITLE
- leasehold -> LEASEHOLD
- planning/building control -> PLANNING_BUILDING_CONTROL
- refurb -> REFURB_CERTAINTY
- builder quote -> REFURB_CERTAINTY / BUILDER_PROPOSAL_CONTRACT
- damp/structural -> DAMP_STRUCTURAL
- lender/broker -> LENDER_CRITERIA
- rental demand -> RENTAL_DEMAND
- solicitor review -> SOLICITOR_REVIEW
- photo evidence -> operator-selected gate only
- video evidence -> operator-selected gate only

## Proposed Safe Substeps

### 4G-R1-1 - Type Contracts and Validation Only
- update Evidence Command types
- define controlled enums
- update validation
- no schema migration yet
- no UI yet

### 4G-R1-2 - Migration Draft and Repository Mapping Only
- extend existing Evidence Lite persistence model
- preserve existing records
- no production migration yet
- repository maps new fields safely

### 4G-R1-3 - API Route Support and Mocked Tests Only
- POST creates structured evidence
- PATCH updates structured fields
- GET returns structured evidence
- no Investor Shield mutation
- no pipeline mutation
- no task duplication

### 4G-R1-4 - Mobile-First Evidence Command UI Only
- stacked phone-first form
- controlled dropdowns
- evidence summary
- status / strength / review state / blocker impact
- recommended next action
- photo/video as evidence types only, no upload

### 4G-R1-5 - Investor Review Integration Only
- display structured evidence summary
- show linked gate
- show status/strength/review state/blocker impact/next action
- keep hard gates dominant
- show disclaimer that evidence does not automatically satisfy gates

### 4G-R1-6 - Local Full Validation and Safety Proof
- build/lint/test
- proof deterministic files untouched
- proof no formula/classification/governance/capital protection changes
- proof no automatic gate satisfaction

### 4G-R1-7 - Controlled Production Migration, Deployment, and Live Vercel Proof
- only after local validation
- migration approval required
- deploy to Vercel
- live evidence creation proof
- persistence after refresh
- mobile screenshot
- Investor Review structured evidence screenshot
- blocked movement remains blocked

### 4G-R1-8 - Final R1 Acceptance Pack for James
- compile proof
- submit live URL
- screenshots
- validation totals
- safety confirmations
- request R1 acceptance and release-tag authorization

## Data Migration Risk
- existing Evidence Lite records must remain readable
- new fields need safe defaults or nullable fields
- production migration must be approved separately
- no destructive migration
- no enum migration that blocks future controlled values without review
- `.gitignore` remains untouched

## API and Validation Risk
- unknown statuses must be rejected
- unknown evidence types must be rejected unless mapped to `other`
- route `dealId` remains authoritative
- body cannot override saved deal identity
- evidence must not create tasks automatically
- evidence must not move pipeline state
- evidence must not mutate Investor Shield gates

## UI Risk
- mobile-first does not mean feature-heavy
- avoid dashboard bloat
- keep short stacked fields
- no upload UI unless separately approved
- photo/video are structured evidence types/placeholders only
- status/strength/review/blocker/next action must be visible

## Investor Review Risk
- structured evidence must display as support, not approval
- hard gates remain visually and logically dominant
- Evidence Command must not imply professional confirmation unless review state says professional confirmed
- sufficient operator evidence is not the same as professional confirmation

## Acceptance Proof Checklist
- live Vercel URL
- evidence record creation proof
- evidence persistence after refresh
- evidence linked to Investor Shield gate proof
- evidence status / strength / review-state proof
- blocker impact proof
- recommended next action proof
- mobile screenshot of evidence capture/display
- Investor Review page showing structured evidence
- proof Evidence Command does not automatically satisfy hard gates
- proof blocked movement remains blocked
- proof no duplicate tasks created
- build/lint/test confirmation
- deterministic engine untouched confirmation

## Explicit Non-Implementation
- no runtime code changed by this planning step
- no tests changed by this planning step
- no migration changed by this planning step
- no UI changed by this planning step
- no API changed by this planning step
- no database changed by this planning step
- no production access
- no deployment
- no release tag
- no PDF work
- no Phase 5 work

## Result
PHASE 4G-R1-0 EVIDENCE COMMAND BASELINE SCOPE LOCKED - READY FOR 4G-R1-1 TYPE CONTRACTS AND VALIDATION
