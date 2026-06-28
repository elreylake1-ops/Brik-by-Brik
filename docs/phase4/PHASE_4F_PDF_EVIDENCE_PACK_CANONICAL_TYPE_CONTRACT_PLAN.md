# Phase 4F PDF Evidence Pack Canonical Type Contract Plan

## Purpose

Define the canonical type-contract boundary for the PDF Evidence Pack so the later implementation step can be built from locked scope, approved user decisions, and existing repository authority.

## User-Approved Scope Decisions

These decisions are already approved and are treated as locked for this plan.

| Decision | Approved value | Status |
| --- | --- | --- |
| Primary audience | Investor | Locked |
| Pack purpose | Investor decision-support pack | Locked |
| Evidence inclusion | Evidence metadata and controlled references only | Locked |
| Disclaimer ownership | Project-authored disclaimer language, with legal review required before production use | Locked |
| Deal count | One saved deal at a time | Locked |
| Generation mode | Manual, explicit generation only | Locked |
| Data access | Read-only data | Locked |
| Freshness | Current live state at download time | Locked |
| Delivery | Immediate download | Locked |
| Pack storage in MVP | No persisted PDF file | Locked |
| Personal/contact details | Exclude by default | Locked |
| External sharing | Not in MVP | Locked |
| Branding | Lightweight project branding | Locked |
| Paper size | A4 portrait | Locked |
| Background jobs | None | Locked |
| Scheduled generation | None | Locked |
| Bulk export | None | Locked |
| Automatic regeneration | None | Locked |
| AI narrative | None | Locked |
| OCR | None | Locked |
| Scraping | None | Locked |
| External document service | None | Locked |
| Renderer DB access | No direct database access from the renderer | Locked |

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `936957915398e0c060e719970e2e8c0438c29e8f` |
| `origin/main` | `936957915398e0c060e719970e2e8c0438c29e8f` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this document | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `AGENTS.md`
- `LEAN-CTX.md`
- `README.md`
- `package.json`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_SCOPE_LOCK_AND_ARCHITECTURE_READINESS.md`
- `docs/phase4/PHASE_4F_ROADMAP_REVIEW_AFTER_INVESTOR_SUMMARY.md`
- `docs/phase4/PHASE_4F_3A_3G_1_INVESTOR_SUMMARY_LOCAL_CLOSURE_AND_PRODUCTION_VERIFICATION_READINESS_REVIEW.md`
- `docs/phase4/PHASE_4D_FINAL_READ_ONLY_INVESTOR_SHIELD_UI_CLOSEOUT.md`
- `docs/phase4/PHASE_4D_7A_READ_ONLY_UI_PHASE_CLOSEOUT_PLAN.md`
- `docs/phase4/PHASE_4E_1_EVIDENCE_LITE_CONTRACTS_AND_VALIDATION.md`
- `docs/phase4/PHASE_4F_3A_3D_1_INVESTOR_SUMMARY_REPOSITORY_AND_MOCKED_TESTS.md`
- `docs/phase4/PHASE_4F_3A_3F_1_INVESTOR_SUMMARY_LOCAL_END_TO_END_READ_ONLY_VALIDATION_PLAN.md`
- `app/api/saved-deals/[id]/route.ts`
- `app/api/saved-deals/[id]/investor-summary/route.ts`
- `app/api/saved-deals/[id]/evidence/route.ts`
- `app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts`
- `app/api/saved-deals/[id]/offers/route.ts`
- `app/api/saved-deals/[id]/tasks/route.ts`
- `components/investor-summary/InvestorSummaryPanel.tsx`
- `components/investor-summary/InvestorSummaryRoutePanel.tsx`
- `components/SavedDealInvestorShieldPanel.tsx`
- `components/InvestorShieldPanel.tsx`
- `components/evidence-lite/EvidenceLitePanel.tsx`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/select-active-investor-summary-tasks.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/investor-summary-repository.ts`
- `lib/investor-summary/fetch-investor-summary.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/investor-shield/evaluate-investor-shield.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/evidence-lite/evidence-lite-repository.ts`
- `types/investor-summary.ts`
- `types/investor-shield.ts`
- `types/evidence-lite.ts`

## Contract Objective

Define a single canonical PDF Evidence Pack type contract that:

- represents a read-only investor decision-support pack
- composes only from existing canonical read models and selectors
- keeps the renderer free of direct repository or database access
- preserves authoritative blocked, unavailable, and warning states
- prevents invented commentary, recalculation, or scope expansion
- stays aligned with the locked MVP boundary

## Canonical Source Authority Matrix

| Pack area | Canonical authority | Contract rule |
| --- | --- | --- |
| Deal identity | Saved-deal row | Must be passed through without reinterpretation |
| Investor Summary status | Investor Summary read model | Must be preserved as authored by the canonical model |
| Investor Shield status | Canonical Shield read model | Must be preserved as authored by the canonical model |
| Evidence index | Evidence Lite repository output | Must stay metadata-first and reference-only |
| Tasks | Task selector output | Must remain selector-driven and read-only |
| Latest offer | Latest-offer selector output | Must remain selector-driven and read-only |
| Pack metadata | Runtime generation metadata | Must be generated, not persisted in MVP |
| Disclaimer text | Pack contract constants | Must be template-driven and reviewable |

The contract must not infer or recalculate:

- deal classification
- capital protection state
- Shield outcomes
- gate satisfaction
- task priority
- offer ranking
- recommendation text
- evidence sufficiency
- legal or valuation conclusions

## Proposed Top-Level Contract

The pack should be expressed as one top-level read-only contract with a stable envelope and nested sections.

Proposed shape:

- `PDFEvidencePack`
  - `metadata`
  - `identity`
  - `dealSummary`
  - `investorSummary`
  - `investorShield`
  - `evidenceLiteIndex`
  - `tasks`
  - `latestOffer`
  - `warnings`
  - `disclaimer`
  - `availability`
  - `version`

Contract rule:

- the renderer consumes this contract only
- the renderer does not assemble authoritative business data itself

## Metadata Contract

Metadata should carry only runtime-safe pack context.

Required fields:

- generated at timestamp
- source-state timestamp
- saved-deal identifier
- confidentiality label
- audience label
- paper size
- generation mode
- snapshot semantics

Forbidden fields:

- secrets
- connection strings
- raw SQL
- stack traces
- environment variables
- internal trace IDs
- private filesystem paths

## Identity Contract

Identity should capture the human-recognizable deal header without adding new meaning.

Expected fields:

- saved-deal reference
- property address
- display title
- generated timestamp label
- confidentiality label

Rules:

- no contact details by default
- no ownership expansion
- no inferred identity normalization beyond formatting

## Investor Summary Contract

The investor summary section should mirror the canonical read model, not reinterpret it.

Expected fields:

- current summary status
- canonical values already present in the source model
- recommended action if the source model exposes one
- active tasks
- latest offer reference if surfaced by the source model
- unavailable field indicators
- warnings preserved from canonical data

Rules:

- unavailable stays unavailable
- zero stays zero only when the canonical source says zero
- no softened narration
- no added confidence language

## Investor Shield Contract

The Shield section should preserve the canonical read model and its gate status.

Expected fields:

- overall Shield status
- required gate results
- advisory gate results
- blocked gates
- manual override visibility
- evidence references
- explicit unavailable states

Rules:

- blocked remains blocked
- evidence presence does not imply gate satisfaction
- manual overrides remain visible
- do not suppress warnings for presentation reasons

## Evidence Lite Index Contract

The pack should include only controlled evidence metadata and references in MVP.

Expected fields:

- evidence item identifier
- evidence type
- title
- source/provenance label
- capture or review date
- review status
- Shield relation if explicitly canonical
- file/link availability marker if already controlled

Rules:

- no embedded attachments
- no embedded PDF pages
- no copied text extracts
- no binary evidence payloads
- no attachment appendix in MVP

## Task and Action Contract

Task content should stay narrowly tied to the canonical task source.

Expected fields:

- active tasks
- blocker state
- recommended next actions
- task availability state

Rules:

- selector output only
- no unrelated completed-task dump
- no auto-generated task prioritization

## Latest-Offer Contract

Offer information should reflect the canonical latest-offer selection only.

Expected fields:

- latest offer identity
- offer status
- relevant dates
- negotiated context if already canonical
- availability state

Rules:

- no offer-ranking inference
- no offer history speculation
- no unsupported negotiation commentary

## Warning Contract

Warnings should encode canonical caution signals without invention.

Expected fields:

- unavailable data warnings
- stale-data note
- blocked-state warning
- evidence-boundary note
- non-reliance warning

Rules:

- do not turn warnings into advice
- do not hide warnings behind color alone
- do not dilute blocked-state prominence

## Disclaimer Contract

The disclaimer must be project-authored and reviewable.

Required disclaimer categories:

- informational decision support only
- not legal advice
- not a valuation
- not a structural survey
- not lender approval
- not a planning or building-control certificate
- not a solicitor substitute
- data may be incomplete or stale
- evidence inclusion does not prove gate satisfaction
- manual overrides remain visible where applicable

Rules:

- legal review required before production use
- non-reliance wording must be reviewed before external sharing
- the contract must not claim professional certification

## Unavailable and Empty-State Semantics

The contract must distinguish explicit absence from failure.

Required semantics:

- missing deal
- invalid deal ID
- Investor Summary unavailable
- Investor Shield unavailable
- no evidence
- no tasks
- no offer
- unavailable financial fields
- expired or missing controlled reference
- generation failure
- route failure
- timeout

Rules:

- do not fabricate placeholder values
- do not collapse failure into empty-state
- do not replace missing data with zero unless the canonical source says zero

## Versioning Strategy

Use a contract version field that can support later evolution without breaking the MVP boundary.

Rules:

- version changes must be explicit
- versioning should be additive where possible
- the renderer should only accept the planned version(s)
- breaking schema changes require a separate contract decision

## Ordering Guarantees

The contract should preserve deterministic ordering for stable output.

Required ordering:

- metadata first
- identity next
- deal summary before detailed sections
- investor summary before evidence detail
- Shield warnings before secondary evidence
- active tasks before latest offer if both are present
- warnings and disclaimer last in the body

Rules:

- no data-order randomness
- no order derived from incidental repository behavior
- no reordering that changes meaning

## Data-Minimization Rules

Only include fields needed for the approved investor decision-support pack.

Rules:

- exclude secrets
- exclude raw diagnostics
- exclude environment values
- exclude DB connection details
- exclude internal repository names
- exclude local machine paths
- exclude private contact details by default
- exclude embedded evidence content in MVP

## Serialization Requirements

The contract should serialize cleanly for future renderer and test use.

Required properties:

- JSON-safe field shapes
- explicit nullable handling
- explicit empty-array handling
- stable string values for statuses
- no function values
- no class instances

Rules:

- serialization must not require database access
- serialization must not require browser-only state
- serialization must not rely on runtime-only secrets

## Contract Validation Requirements

The later implementation should be validated against the contract boundary, but this plan does not create tests yet.

Future validation must confirm:

- authoritative field mapping
- nullable handling
- unavailable-state preservation
- deterministic ordering
- no fabricated values
- no sensitive data leakage
- no direct renderer DB dependency

## Fixture Scenarios

The future fixture set should cover:

- fully populated investor pack
- missing deal
- missing investor summary
- missing investor shield
- no evidence
- no tasks
- no offer
- blocked Shield state
- unavailable financial fields
- stale-data warning state
- controlled reference only

## Future Contract-Test Plan

Future tests should cover:

- top-level contract shape
- field-by-field authority mapping
- edge-case serialization
- empty-state behavior
- warning preservation
- ordering stability
- forbidden-data rejection

This plan intentionally does not create those tests.

## Boundaries With Later Subphases

This contract plan only defines the canonical type boundary.

It does not:

- add a renderer
- add a route
- add a button
- add storage
- add a migration
- add background generation
- add a PDF library
- add embedded attachments
- add OCR
- add AI narration
- add direct renderer DB access

## Proposed Future Files

Likely next files after this plan:

- `types/pdf-evidence-pack.ts`
- `docs/phase4/...` contract fixture plan
- `__tests__/pdf-evidence-pack-contract.test.ts`
- `lib/pdf-evidence-pack/...` pure composition boundary

These are only planning candidates. They are not created by this step.

## Remaining Decisions and Timing

No additional user decision is required before contract design beyond the locked scope above.

If a later implementation step needs broader distribution, embedded evidence, persistent storage, or alternate audiences, those should be treated as separate approvals.

## Explicit Non-Implementation

Confirmed:

- no runtime code changed
- no tests changed
- no PDF library installed
- no renderer added
- no route added
- no UI control added
- no storage added
- no migration added
- no background job added
- no direct renderer database access added
- no production deployment
- `.gitignore` untouched

## Verdict

`PDF EVIDENCE PACK CANONICAL TYPE CONTRACT PLAN COMPLETE — READY FOR CONTRACT IMPLEMENTATION`

## Recommended Next Action

Implement the Canonical PDF Evidence Pack Type Contract and focused contract tests.
