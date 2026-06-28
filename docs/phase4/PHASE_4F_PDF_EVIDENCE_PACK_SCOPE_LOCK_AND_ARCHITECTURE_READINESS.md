# Phase 4F PDF Evidence Pack Scope Lock and Architecture Readiness

## Purpose

Define the smallest safe planning boundary for an Investor Summary / PDF Evidence Pack so the later contract-design step can start from locked scope, documented users, canonical sources, and a clear architecture direction.

## User Approval

Investor Summary / PDF Evidence Pack Planning approved by Karlo.

## Repository Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| `HEAD` | `8581ae0260fb73134645200c64038f60b41be908` |
| `origin/main` | `8581ae0260fb73134645200c64038f60b41be908` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this document | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `AGENTS.md`
- `LEAN-CTX.md`
- `README.md`
- `package.json`
- `docs/phase4/PHASE_4F_ROADMAP_REVIEW_AFTER_INVESTOR_SUMMARY.md`
- `docs/phase4/PHASE_4F_3A_3G_1_INVESTOR_SUMMARY_LOCAL_CLOSURE_AND_PRODUCTION_VERIFICATION_READINESS_REVIEW.md`
- `docs/phase4/PHASE_4F_0C_CANONICAL_INVESTOR_SUMMARY_FIELD_MAPPING.md`
- `docs/phase4/PHASE_4F_1A_CANONICAL_INVESTOR_SUMMARY_TYPE_CONTRACTS.md`
- `docs/phase4/PHASE_4F_1B_CANONICAL_INVESTOR_SUMMARY_CONTRACT_FIXTURES.md`
- `docs/phase4/PHASE_4F_2A_PURE_CANONICAL_INVESTOR_SUMMARY_MAPPER.md`
- `docs/phase4/PHASE_4F_2B_1_PURE_ACTIVE_TASK_SELECTOR.md`
- `docs/phase4/PHASE_4F_2B_2_PURE_LATEST_OFFER_SELECTOR.md`
- `docs/phase4/PHASE_4F_2B_3A_PURE_SELECTOR_TO_MAPPER_COMPOSITION.md`
- `docs/phase4/PHASE_4F_3A_1_SAVED_DEAL_AND_ENGINE_RESULT_EXTRACTION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2A_CANONICAL_INVESTOR_SHIELD_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_1_CANONICAL_DEAL_TASK_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_2_CANONICAL_DEAL_OFFER_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_3A_INVESTOR_SUMMARY_REPOSITORY_AGGREGATION_CONTRACT.md`
- `docs/phase4/PHASE_4F_3A_3B_1_SAVED_DEAL_EXISTENCE_GATE_AND_DEPENDENCY_SEQUENCE.md`
- `docs/phase4/PHASE_4F_3A_3B_2_POST_GATE_CONCURRENCY_AND_READ_CONSISTENCY.md`
- `docs/phase4/PHASE_4F_3A_3C_INVESTOR_SUMMARY_REPOSITORY_FUNCTION_AND_MOCKED_TEST_DESIGN.md`
- `docs/phase4/PHASE_4F_3A_3D_1_INVESTOR_SUMMARY_REPOSITORY_AND_MOCKED_TESTS.md`
- `docs/phase4/PHASE_4F_3A_3D_2_INVESTOR_SUMMARY_ROUTE_BOUNDARY_PLAN.md`
- `docs/phase4/PHASE_4F_3A_3D_3_INVESTOR_SUMMARY_GET_ROUTE_AND_MOCKED_TESTS.md`
- `docs/phase4/PHASE_4F_3A_3E_1_INVESTOR_SUMMARY_READ_ONLY_UI_INTEGRATION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_3E_2_PURE_INVESTOR_SUMMARY_PRESENTATION_COMPONENT_AND_FIXTURE_TESTS.md`
- `docs/phase4/PHASE_4F_3A_3E_3_LOCAL_INVESTOR_SUMMARY_UI_ROUTE_INTEGRATION_AND_MOCKED_FETCH_TESTS.md`
- `docs/phase4/PHASE_4F_3A_3F_1_INVESTOR_SUMMARY_LOCAL_END_TO_END_READ_ONLY_VALIDATION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_3F_2_INVESTOR_SUMMARY_LOCAL_END_TO_END_READ_ONLY_VALIDATION.md`
- `docs/phase4/PHASE_4F_CORRECTED_PRODUCTION_DATABASE_READ_ROUTE_SMOKE_VERIFICATION.md`
- `docs/phase4/PHASE_4D_FINAL_READ_ONLY_INVESTOR_SHIELD_UI_CLOSEOUT.md`
- `docs/phase4/PHASE_4D_7A_READ_ONLY_UI_PHASE_CLOSEOUT_PLAN.md`
- `docs/phase4/PHASE_4E_1_EVIDENCE_LITE_CONTRACTS_AND_VALIDATION.md`
- `docs/phase4/PHASE_4E_2_EVIDENCE_LITE_MIGRATION_LOCAL_ONLY.md`
- `docs/phase4/PHASE_4E_3_EVIDENCE_LITE_REPOSITORY_MOCKED_TESTS.md`
- `docs/phase4/PHASE_4E_4_EVIDENCE_LITE_API_ROUTE_LOCALLY_ONLY.md`
- `docs/phase4/PHASE_4E_5_MINIMAL_EVIDENCE_LITE_UI_LOCAL_ONLY.md`
- `docs/phase4/PHASE_4E_6_EVIDENCE_LITE_ITEM_UPDATE_ROUTE_PLAN.md`
- `docs/phase4/PHASE_4E_7_EVIDENCE_LITE_ITEM_PATCH_LOCAL_ONLY.md`
- `docs/phase4/PHASE_4E_8_MINIMAL_EVIDENCE_LITE_EDIT_UI_DEVELOPMENT_ONLY.md`
- `docs/phase4/PHASE_4E_9_EVIDENCE_LITE_LOCAL_SPRINT_CLOSURE_AND_PRODUCTION_READINESS_AUDIT.md`
- `app/page.tsx`
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

## Completed Prerequisites

- Saved-deal read boundaries
- Investor Shield read-only UI
- Evidence Lite contracts, repository, routes, and UI
- Investor Summary contracts, selectors, mapper, and composition
- Investor Summary repository
- Investor Summary GET route
- Pure Investor Summary presentation
- Local route integration
- Local read-only validation
- Production database and read-route verification

## Business Purpose

Primary purpose:

- investor decision-support pack

Secondary uses:

- internal acquisition review pack
- due-diligence evidence index
- negotiation support document

Not the primary purpose unless later explicitly approved:

- legal opinion
- valuation report
- lender approval document
- solicitor report

## Intended Users

| User type | Information needed | Information to exclude | Privacy concerns | Allow future access? |
| --- | --- | --- | --- | --- |
| Investor | Deal summary, status, Shield warnings, evidence index, key tasks, latest offer, disclaimer text | Internal diagnostics, secrets, raw SQL, internal trace IDs | Financial sensitivity and property confidentiality | Yes, primary audience |
| Internal deal operator | Full decision-support pack plus provenance and current-state detail | Secrets, env values, backend diagnostics | Internal notes and owner details may be sensitive | Yes, primary operational user |
| Acquisition manager | Deal summary, blockers, evidence index, recommended actions | Backend internals, database metadata, unrelated deal records | Commercial sensitivity | Yes, if role-based access is added later |
| Broker or agent | High-level summary, selected evidence references, current negotiation context | Internal notes, private contact details, diagnostics | Potentially broader sharing risk | Maybe, only with redaction / approval |
| Lender or finance broker | Deal summary and evidence references relevant to financing | Internal commentary, unsupported narrative, secrets | Financial and personal-data sensitivity | Maybe, only if a lender-focused view is later approved |
| Solicitor | Evidence index, deal facts, relevant gate state | Unsupported conclusions, private internal notes, diagnostics | Privileged/legal review concerns | Maybe, only if a solicitor-facing view is later approved |
| Contractor or surveyor | Limited evidence references, scope context, site details if needed | Full financials, personal details, diagnostics | Site and contact privacy | Maybe, only for narrow sections |
| External partner | Minimal public-safe summary only | Anything confidential or internal | Highest privacy risk | No by default |

## Proposed Pack Contents

| Section | Canonical Source | Required / Optional | Inclusion Rule | Exclusion Rule |
| --- | --- | ---: | --- | --- |
| Cover and identity | Saved-deal row, generated metadata | Required | Include pack title, saved-deal reference, address, generated date, snapshot timestamp, confidentiality label | Exclude ownership/contact details unless later approved |
| Deal summary | Saved-deal row, persisted engine JSON | Required | Include canonical deal facts, status, classification, financial summary | Exclude recalculated numbers or non-canonical commentary |
| Investor Summary | Investor Summary read model | Required | Include primary status, capital protection, canonical values, recommended action, active tasks, latest offer, warnings, unavailable states | Exclude invented guidance or softened risk language |
| Investor Shield | Canonical Shield read model | Required | Include overall status, required/advisory results, blocked gates, manual overrides, evidence references | Exclude gate reinterpretation and hidden reasoning |
| Evidence Lite | Evidence Lite index | Required as index; attachments optional later | Include evidence type, title, provenance, capture date, review status, Shield relationship, file/link availability if controlled | Exclude embedded attachments in MVP |
| Tasks and actions | Task repository, Investor Summary task selector | Required | Include active tasks, blockers, recommended next actions | Exclude unrelated completed tasks unless useful and authorized |
| Offer information | Offer repository, latest-offer selector | Required | Include latest canonical offer, status, relevant dates, negotiation context only if canonical | Exclude offer ranking logic and unsupported interpretations |
| Warnings and disclaimers | Canonical model plus pack-level rules | Required | Include unavailable fields, stale-data note, non-reliance disclaimer, no legal/valuation/structural/lending certification | Exclude legal advice claims and any certainty not in canonical data |

## Content Source Matrix

| Pack field | Canonical source | Transformation allowed | Inference allowed |
| --- | --- | --- | ---: |
| Pack title | Pack metadata | Yes, formatting only | No |
| Saved-deal reference | Saved-deal row | No | No |
| Property identity / address | Saved-deal row | No | No |
| Generation date | Runtime generation metadata | Formatting only | No |
| Snapshot timestamp | Runtime generation metadata | Formatting only | No |
| Confidentiality label | Pack metadata | Yes, wording only | No |
| Deal classification | Saved-deal row | No | No |
| Capital protection state | Saved-deal row | No | No |
| Financial summary | Saved-deal row and persisted engine JSON | Formatting only | No |
| Investor Summary status | Investor Summary view model | No | No |
| Recommended action | Saved-deal row, then safe shield fallback | Limited fallback only | No |
| Active tasks | Task repository / selector | Yes, selector output only | No |
| Latest offer | Offer repository / selector | Yes, selector output only | No |
| Shield status and blocked gates | Canonical Shield read model | No | No |
| Evidence index | Evidence Lite repository | Yes, index ordering and display shaping only | No |
| Disclaimer text | Pack policy text | Yes, template wording only | No |

## Evidence Inclusion Boundary

Recommended MVP:

- evidence metadata only
- controlled references or identifiers only
- no embedded images
- no embedded PDF pages
- no copied text extracts
- no attachment appendices
- no binary evidence embedding
- no attachment rendering from the PDF pack itself

Assessment:

| Option | User value | Privacy risk | File-size risk | Rendering complexity | Signed-URL needs | Storage implications | Accessibility | Testability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Evidence metadata only | High enough for MVP | Low | Low | Low | No | Minimal | High | High |
| Secure evidence links | Medium | Medium | Low | Low | Yes, later only | Requires controlled storage | Medium | Medium |
| Thumbnails | Medium | Medium | Medium | Medium | Likely | Requires storage and processing | Medium | Medium |
| Embedded images | High for evidence-heavy deals | High | High | High | Yes | High | Medium | Medium |
| Embedded PDF pages | High | High | Very high | High | Yes | High | Lower | Lower |
| Copied text extracts | Medium | Medium | Medium | Medium | No or limited | Medium | Medium | Medium |
| Attachment appendices | High but broad | High | Very high | High | Yes | High | Medium | Lower |
| Evidence hashes / provenance IDs | Medium | Low | Low | Low | No | Low | High | High |

Smallest safe MVP:

- evidence index and controlled references before full attachment embedding

## Deterministic Authority Matrix

| Pack field | Canonical authority | Transformation allowed | Inference allowed |
| --- | --- | --- | ---: |
| Deal classification | Saved-deal row | Formatting only | No |
| Capital protection state | Saved-deal row | Formatting only | No |
| Investor Summary status | Investor Summary view model | Formatting only | No |
| Investor Shield overall status | Canonical Shield read model | Formatting only | No |
| Blocked gates | Canonical Shield read model | Ordering preserved only | No |
| Active tasks | Task selector output | Selector-only shaping | No |
| Latest offer | Offer selector output | Selector-only shaping | No |
| Evidence index | Evidence Lite repository rows | Index shaping only | No |
| Financial summary | Saved-deal row plus persisted engine JSON | Formatting only | No |
| Warnings | Canonical model / pack metadata | Display formatting only | No |

The pack must not:

- recalculate True MAO
- recalculate profit, margin, ROI, yield, or capital exposure
- infer classification
- infer Investor Shield status
- infer gate satisfaction from evidence presence
- infer recommendations from task titles
- choose or reorder offers
- convert unavailable values to zero
- soften blocked risk with advisory text
- generate unsupported commentary
- use AI to summarize or reinterpret canonical findings

## Snapshot and Freshness Model

Options assessed:

- current live state at download time
- persisted immutable snapshot
- versioned historical pack
- generated file with no persisted metadata

Recommendation:

- current live state at download time, generated on demand, with no persisted pack record in the MVP

Why:

- smallest implementation surface
- no storage dependency
- no background regeneration requirement
- easy to validate locally
- avoids inventing historical pack management before the pack itself is proven

Implications:

- reproducibility is tied to source state at generation time
- auditability is provided by the generated timestamp and source references inside the pack
- offers, tasks, Shield gates, and evidence can change after generation
- regenerated packs may differ later
- no persisted snapshot means no built-in historical archive yet

## Generation Architecture Options

| Option | Benefits | Risks | Dependencies | MVP Suitability |
| --- | --- | --- | --- | --- |
| Browser print stylesheet | No PDF library, simple, fast to validate, minimal server risk | Browser variability, print fidelity differences, weaker automation if overused | Read-only pack page and print CSS | High |
| Client-side PDF generation | Can generate directly in the browser | Large bundle, browser memory issues, font consistency issues | PDF library and client rendering | Medium |
| Synchronous server-side PDF route | Centralized and more deterministic than client rendering | Needs PDF library, font handling, timeout risk, more deployment complexity | PDF library, server route, possibly fonts | Medium |
| Asynchronous server-side generation job | Better for large packs or heavy attachments | More infrastructure, storage, queueing, status management | Queue/job system and storage | Low |
| External PDF/document service | Outsources rendering complexity | Vendor, cost, data-sharing, and retention concerns | Third-party service integration | Low |

## Recommended Architecture Direction

Use a browser-rendered read-only pack page with a print stylesheet as the MVP architecture direction.

Why:

- no PDF library is currently installed
- no storage or signed-URL infrastructure is currently available
- no background job system is currently in scope
- it keeps the first pass manual and explicit
- it preserves the current Next.js/App Router structure
- it is the smallest safe path from the current codebase

## Data-Loading Boundary

The existing Investor Summary GET route is not sufficient by itself for the future pack.

Recommended boundary:

- canonical read model -> dedicated pack view model -> renderer

Recommended inputs:

- Investor Summary view model
- canonical Investor Shield read model, or a Shield detail input that can produce the pack summary
- Evidence Lite index
- task selector output
- latest offer selector output
- generated snapshot metadata

Recommended loading shape:

- a dedicated read-only pack aggregation boundary should assemble the pack view model
- the renderer should not query the database directly
- the renderer should not call repository functions

## Privacy and Security Requirements

Include only what the user needs for the chosen audience.

Allowed or potentially allowed:

- property address for authorized users
- saved-deal reference
- deal summary and canonical status
- evidence index metadata
- controlled internal references

Exclude from the MVP:

- `DATABASE_URL`
- connection details
- environment variables
- SQL
- stack traces
- Supabase project identifiers
- internal repository names
- raw diagnostics
- local Windows paths
- private storage URLs without controlled access
- owner or contact details unless a later audience decision explicitly requires them

If secure links are added later:

- they should use controlled access and short-lived access semantics
- they should be redaction-aware for external sharing

## Access and Generation Behavior

Recommended MVP behavior:

- manual, explicit, single-deal generation only

Do not plan in the MVP:

- automatic generation
- scheduled generation
- bulk export
- background generation queues
- implicit regeneration on every save

## Failure and Empty-State Behavior

Plan the future pack to distinguish:

- invalid deal ID
- missing deal
- Investor Summary unavailable
- Investor Shield unavailable
- no evidence
- missing files
- expired evidence links
- unavailable financial fields
- no tasks
- no offer
- blocked Shield status
- generation timeout
- renderer failure
- oversized evidence pack

Do not fabricate missing sections.

Valid empty states should remain explicit:

- no tasks
- no offer
- no evidence
- unavailable summary field

Infrastructure failures should stay explicit:

- route failure
- generation failure
- timeout
- unavailable dependency

## Document-Design Requirements

Recommended print format:

- A4 portrait

Why:

- the product is UK property-focused
- A4 is the most natural default for UK property and due-diligence paperwork
- it keeps the pack closer to a real review document
- it remains readable on screen and when printed to PDF

Design requirements:

- cover page
- table of contents
- section hierarchy
- repeating header/footer
- page numbering
- deal reference
- generated timestamp
- confidentiality label
- risk-status hierarchy
- blocked-state prominence
- evidence index format
- appendix behavior if later approved
- grayscale readability
- accessible text contrast
- selectable text
- link behavior

Do not rely on color alone for risk status.

## Disclaimer Requirements

Plan the following disclaimer categories:

- informational decision support
- not legal advice
- not a valuation
- not a structural survey
- not lender approval
- not planning or building-control certification
- not a replacement for solicitor review
- data may be incomplete or stale
- evidence inclusion does not prove gate satisfaction
- manual overrides must remain visible where applicable

Requires legal review before production use:

- any non-reliance wording that could affect external sharing
- any wording that may be interpreted as legal, valuation, structural, or lending advice
- any wording for solicitor, lender, broker, or external-partner distribution

## Testing Strategy

Plan future tests for:

### Contract tests

- canonical field mapping
- nullable values
- zero versus unavailable
- blocked status preservation
- evidence index ordering
- offer selection authority

### Renderer tests

- required sections present
- no fabricated values
- no sensitive diagnostics
- deterministic ordering
- page-break safety
- long-text handling
- no color-only meaning

### Route tests

- success
- invalid ID
- missing deal
- infrastructure failure
- authorization failure if later added
- safe error envelope

### Output tests

- valid PDF signature
- non-empty output
- expected page count range
- selectable text where applicable
- links where applicable
- no secrets
- file-name safety

### Local integration tests

- manual generation flow
- loading / generating state
- safe failure state
- no duplicate requests
- no mutation

### Production-readiness checks

- Vercel runtime compatibility
- timeout and memory limits
- attachment size limits
- storage and retention behavior
- legitimate positive-data proof

## Production and Operational Risk Register

| Risk | Likelihood | Impact | Mitigation | Blocks MVP |
| --- | --- | --- | --- | ---: |
| Browser print fidelity varies by client | Medium | Medium | Keep the MVP print layout simple and text-first | No |
| Large packs become slow or unstable | Medium | Medium | Limit MVP to metadata and controlled references | No |
| Expired or missing links in future attachments | Medium | Medium | Start with metadata only, add TTL links later | No |
| Sensitive information leaks into pack output | Low | High | Strict field allowlist and explicit exclusion rules | No |
| Stale data is mistaken for current truth | Medium | Medium | Generate on demand and include timestamps | No |
| PDF library/security issues | Low for MVP | High | Avoid library use in MVP | No |
| Storage cost and retention complexity | Medium | Medium | Defer persisted pack storage | No |
| Unauthorized sharing of exported packs | Medium | High | Keep access manual and role-aware if later added | No |
| Over-broad pack scope slows delivery | High | Medium | Keep the MVP read-only and metadata-first | No |
| Legal/reliance wording is over-claimed | Medium | High | Require legal review before production use | No |

## Recommended MVP Boundary

Confirm the narrowest safe MVP:

- one saved deal at a time
- manual user-triggered generation
- read-only data
- canonical Investor Summary
- canonical Investor Shield summary
- Evidence Lite index
- current task context
- latest-offer context
- explicit unavailable states
- deterministic warnings
- controlled disclaimer
- no embedded source attachments initially
- no persistence unless separately justified
- no background jobs
- no bulk export
- no AI-generated narrative

This matches the repository evidence and keeps the first pack pass tractable.

## Deferred Capabilities

Explicitly defer:

- embedded evidence attachments unless separately approved
- background jobs
- scheduled generation
- bulk export
- automatic regeneration
- AI-generated narrative
- OCR
- scraping
- external document service
- persistent pack storage unless separately approved
- production implementation

## Proposed Controlled Subphases

No official phase numbers assigned.

1. Scope lock and architecture readiness
- Purpose: lock user intent, audience, and MVP boundaries
- Files likely involved: this document, later planning docs
- Validation: document review only
- Explicit non-goals: no contracts, no renderer, no route
- Dependency: none

2. Canonical PDF Evidence Pack type contract
- Purpose: define the read-only pack view model
- Files likely involved: `types/pdf-evidence-pack.ts`, `docs/phase4/...`
- Validation: contract review and shape approval
- Explicit non-goals: no rendering, no route, no storage
- Dependency: scope lock

3. Contract fixtures
- Purpose: lock representative pack inputs
- Files likely involved: `__tests__/fixtures/...`, `__tests__/...`
- Validation: fixture shape tests
- Explicit non-goals: no runtime generation
- Dependency: type contract

4. Pure pack view-model composer
- Purpose: assemble canonical inputs into a pack-specific read model
- Files likely involved: `lib/pdf-evidence-pack/...`
- Validation: pure function tests
- Explicit non-goals: no PDF rendering, no storage, no direct DB access in renderer
- Dependency: contract fixtures

5. Renderer technical spike
- Purpose: prove the print/PDF rendering direction
- Files likely involved: a read-only pack page and print styles
- Validation: browser print and layout proof
- Explicit non-goals: no persistence, no bulk generation
- Dependency: pack view-model composer

6. Read-only pack aggregation boundary
- Purpose: define how the pack fetches canonical data
- Files likely involved: route or server-side coordinator planning doc
- Validation: boundary review
- Explicit non-goals: no renderer DB access
- Dependency: composer

7. GET/download route plan
- Purpose: define the read-only generation/download entrypoint
- Files likely involved: future route planning doc
- Validation: route contract review
- Explicit non-goals: no upload, no mutation, no job queue
- Dependency: aggregation boundary

8. Pure document renderer
- Purpose: render the canonical pack to HTML/print output
- Files likely involved: component and CSS plan
- Validation: section and accessibility tests
- Explicit non-goals: no background jobs or storage
- Dependency: renderer spike

9. Local trigger and mocked tests
- Purpose: verify the manual user flow
- Files likely involved: local integration tests
- Validation: mocked route and output tests
- Explicit non-goals: no production access
- Dependency: renderer and route plan

10. Local output validation
- Purpose: verify generated output shape and safety
- Files likely involved: output checks, local QA notes
- Validation: printable output review
- Explicit non-goals: no persistence
- Dependency: mocked tests

11. Production-readiness review
- Purpose: decide whether any production use is warranted
- Files likely involved: production readiness doc
- Validation: deployment and risk review
- Explicit non-goals: no production implementation during planning
- Dependency: local output validation

## User Decisions Required

| Decision | Recommended Default | Alternatives | Needed Before |
| --- | --- | --- | --- |
| Primary audience | Investor | Internal operator, lender, broker, solicitor | Contract design |
| Pack purpose | Investor decision-support pack | Internal review pack, evidence index, negotiation support doc | Contract design |
| Paper size | A4 portrait | Letter, landscape, dual format | Document design |
| Evidence handling | Metadata and controlled references only | Secure links, thumbnails, embedded images, embedded PDF pages | Contract design |
| State model | Current live state at download time | Persisted snapshot, versioned historical pack | Route / storage design |
| Storage model | No persisted pack file in MVP | Stored file, historical archive | Route / storage design |
| Disclaimer ownership | Project-authored with legal review later | External legal text, partner-specific text | Contract design |
| Personal/contact details | Exclude by default | Include for specific roles | Privacy design |
| External sharing | Not in MVP | Approved external sharing mode | Access design |
| Branding | Lightweight project branding only | Investor-branded, partner-branded, white-label | Document design |

## Explicit Non-Implementation

Confirmed:

- no runtime code changed
- no tests changed
- no PDF library installed
- no renderer added
- no route added
- no UI control added
- no database or schema change
- no storage change
- no background job
- no production access
- no deployment
- no environment change
- no migration
- no production data mutation
- `.gitignore` untouched

## Verdict

`PDF EVIDENCE PACK SCOPE LOCK PARTIALLY COMPLETE — USER DECISIONS REQUIRED BEFORE CONTRACT DESIGN`

## Recommended Next Action

Obtain Karlo’s required scope decisions, then prepare the Canonical PDF Evidence Pack Type Contract plan.
