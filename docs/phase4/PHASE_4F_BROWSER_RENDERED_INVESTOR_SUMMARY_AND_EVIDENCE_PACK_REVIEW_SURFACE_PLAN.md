# Phase 4F-R1 Browser-Rendered Investor Summary and Evidence Pack Review Surface Plan

## Purpose

Lock one implementation-ready, read-only browser review architecture for the canonical Investor Summary and PDF Evidence Pack surface without implementing the page, adding a new API, generating a PDF, or changing any production/runtime boundary.

## Controlling Client Direction

Phase 4E is complete:

`PHASE 4E EVIDENCE LITE COMPLETE — PRODUCTION UI AND REFRESH PERSISTENCE VERIFIED`

The next approved deliverable is:

`Browser-rendered Investor Summary and Evidence Pack review document.`

Binary PDF generation remains prohibited until the browser-rendered review page is implemented, deployed, and visually approved.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `5b34af4b63da2d3fb27da5787361889349ec36d3` |
| `origin/main` | `5b34af4b63da2d3fb27da5787361889349ec36d3` |
| Latest commit | `docs: complete evidence lite production acceptance` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this plan | only the pre-existing unstaged `.gitignore` modification |

Validation baseline before this planning step:

- build passed
- lint passed
- full suite passed
- `110` test files
- `1062` passed tests
- `0` failed tests

## Phase 4E Completion Dependency

This plan depends on the completed and verified Evidence Lite chain:

- controlled production Evidence Lite persistence proof completed
- production UI activation and browser refresh proof completed
- canonical informational-only Evidence Lite display contract verified
- retained controlled production QA deal and Evidence Lite record available for future browser proof

The controlled production reference remains planning context only in this phase. No production access is authorized or performed here.

## Existing Investor Summary Contract

Existing canonical Investor Summary behavior is already locked by the committed repository:

- canonical loader path is `GET /api/saved-deals/[id]/investor-summary` for route-backed UI use
- canonical repository loader is `getInvestorSummaryForDeal(dealId)`
- canonical composition path is:
  `saved deal -> Shield/task/offer reads -> composeInvestorSummaryViewModel(...)`
- canonical identity source is `savedDeal.id` and `savedDeal.address`
- canonical financial fields include:
  - `purchasePrice`
  - `gdvRange.downside`
  - `gdvRange.realistic`
  - `gdvRange.strong`
  - `trueMao.fifteenPercent`
  - `trueMao.twentyPercent`
  - `trueMao.twentyFivePercent`
- canonical business-state fields include:
  - `classification`
  - `capitalProtectionState`
  - `investorShield.overallStatus`
  - `investorShield.missingEvidenceCount`
  - `investorShield.blockedGates`
  - `activeTasks`
  - `latestOffer`
  - `recommendedNextAction`
- missing or unavailable optional values remain `null` and are displayed with the existing repository equivalent of `Unavailable`
- no UI surface is allowed to recalculate True MAO, classification, governance, capital protection, task selection, offer selection, or next action

For the browser review page, Investor Summary data must be consumed only as canonical output, not recomputed locally.

## Existing Investor Shield Contract

Existing canonical Investor Shield behavior is already locked by the committed repository:

- authoritative evaluation contract is `InvestorShieldEnforcementResult`
- authoritative UI aggregation contract is `InvestorShieldUiModel`
- authoritative gate definitions come from `INVESTOR_SHIELD_DEFAULT_GATES`
- deterministic dominance is preserved:
  Investor Shield may block or caution, but it does not soften deterministic reject/governance/capital-protection outcomes
- canonical top-level fields available for the review page include:
  - `overallStatus`
  - `progressionDecision`
  - `canProgress`
  - `blockingGateKeys`
  - `cautionGateKeys`
  - `missingEvidenceGateKeys`
  - `manualOverrideRequired`
  - `taskRecommendations`
  - `deterministicDominanceNote`
- canonical gate display fields already exist in `gateSummaries`:
  - `label`
  - `requiredLabel`
  - `status`
  - `severity`
  - `confidence`
  - `evidenceCount`
  - `missingEvidenceSummary`
  - `shortExplanation`
  - `recommendedNextAction`
  - `waiverReason`
  - `updatedAt`
  - `subGates`
- all committed top-level default gates are required gates
- advisory-only classification currently exists at the committed sub-gate level, most notably `AI_VISUAL_REVIEW_ADVISORY`
- advisory warnings also remain canonical via `advisoryWarnings`

The browser review page must not create another Shield evaluator, must not reinterpret blocking logic, and must not convert informational evidence into authoritative gate satisfaction.

## Existing Evidence Lite Contract

Existing canonical Evidence Lite behavior is already locked by the committed repository:

- canonical read route is `/api/saved-deals/{dealId}/evidence`
- canonical display shell is `EvidenceLitePanel`
- Evidence Lite is informational only and remains non-authoritative
- verified read states already exist:
  - loading: `Loading Evidence Lite records...`
  - empty: `No Evidence Lite records have been added for this deal.`
  - safe error: `Evidence Lite could not be loaded right now. Investor Shield requirements are unchanged.`
  - populated records render:
    - evidence id
    - evidence type
    - linked gate
    - status
    - reviewed state
    - note
    - reviewer note only when non-null
    - created/updated timestamps
- verified separation wording already exists:
  `Evidence Lite is informational and does not by itself satisfy or waive Investor Shield requirements.`
- page-safe fields for the browser review surface are:
  - `evidenceType`
  - `linkedGate`
  - `status`
  - `reviewed`
  - `note`
  - `reviewerNote` only when non-null
  - `createdAt`
  - `updatedAt`
- fields must never imply authoritative completion, approval, waiver, override, gate pass, blocker clearance, or verified due diligence completion

## Existing PDF Evidence Pack Contract

Existing canonical PDF Evidence Pack behavior is already locked by the committed repository:

- canonical top-level sections are:
  - `meta`
  - `identity`
  - `investorSummary`
  - `investorShield`
  - `evidenceIndex`
  - `disclaimers`
- canonical loader is `loadPdfEvidencePackForDeal(...)`
- canonical composition contract is `composePdfEvidencePack(...)`
- canonical Evidence Lite projection helper is `projectEvidenceLiteRecordToPdfEvidenceItem(...)`
- the loader already:
  - normalizes the deal id
  - gates on saved-deal existence first
  - returns `null` for blank or missing deals
  - loads Shield, tasks, offers, and Evidence Lite concurrently after the saved-deal gate
  - reuses canonical Investor Summary composition
  - projects Evidence Lite into pack evidence items
  - assembles the final pack with fixed disclaimers
- required dependency failures remain throw-path failures and are not converted into partial success
- the fixed confidentiality label already selected for future route/page use is:
  `INTERNAL USE ONLY`
- committed disclaimer themes already exist for:
  - informational decision support
  - not legal advice
  - not a valuation
  - not lender approval
  - not a structural survey
  - not a solicitor substitute
  - data may be incomplete or stale
  - evidence does not prove gate satisfaction
  - manual overrides remain visible

The existing aggregation already includes the saved deal, Investor Summary, Investor Shield, Evidence Lite, tasks, and offers. No second aggregation layer is justified.

Current committed gap relevant to the browser page:

- the pack already carries identity, classification, capital protection, Shield, tasks, offers, Evidence Lite, and disclaimers
- the current committed pack contract does not independently surface pipeline state or governance state as named top-level browser-review fields
- the future browser page must therefore reuse canonical saved-deal detail for those header fields without introducing a new API or a new evaluator

## Existing Access-Control Boundary

The current repository state does not include a proven application authentication or deal-authorization boundary for saved-deal routes:

- no application auth/session middleware was found
- no reusable saved-deal authorization helper was found
- no share-token or signed-access boundary was found
- existing saved-deal APIs and pages already expose saved-deal data without an explicit application access-control layer

Planning conclusion for this phase:

- the browser review page must not add a new public JSON API
- the browser review page must not add a download route
- the browser review page must not add public sharing
- the browser review page is suitable only as a controlled review surface under the same current application exposure model
- external public sharing remains prohibited
- authentication, authorization, share-token access, or signed distribution require separate future authorization

This page does not eliminate the access-control gap. It avoids widening that gap through a new machine-consumable endpoint.

## Architecture Options Considered

### Option A — Dedicated dynamic server-rendered page

Candidate path:

`/saved-deals/[id]/review`

Assessment:

- matches the existing saved-deal subresource convention
- produces a stable standalone review document
- keeps data loading server-backed and refresh-safe
- avoids increasing `app/page.tsx` complexity
- avoids adding another public JSON API
- remains suitable for later approved PDF rendering

Decision:

`SELECTED`

### Option B — Review mode inside the current root saved-deal page

Assessment:

- `app/page.tsx` already carries high surface complexity
- root-page embedding would mix mutation controls and review-document presentation
- standalone browser review, print-aware layout, and later visual approval would be weaker
- the result would not be a clean canonical review document

Decision:

`REJECTED`

### Option C — Another repository convention

Assessment:

- existing review routes are fixture/document pages, but no stronger saved-deal review-page convention exists than a dedicated dynamic saved-deal route
- no established alternative improves safety or reduces complexity versus Option A

Decision:

`REJECTED`

## Selected Page Architecture

Selected architecture:

`A dedicated dynamic server-rendered page at /saved-deals/[id]/review that calls loadPdfEvidencePackForDeal(...) directly and does not add another public JSON API.`

Implementation boundary:

- one server route page owns deal-id normalization
- one canonical saved-deal read supplies header-only fields that are not currently named in the committed pack contract:
  - governance state
  - pipeline state
- one canonical PDF pack loader call produces the full read-only review body
- one optional pure presentation mapper prepares browser display labels/grouping only
- one read-only document component renders the review surface
- no client fetch helper is required
- no route-backed browser fetch is required
- no new repository layer is required
- no new business-rule evaluator is required
- no PDF generation occurs in this phase or the next implementation phase

## Selected Page Path

Exact selected page path:

`/saved-deals/[id]/review`

Expected implementation file:

`app/saved-deals/[id]/review/page.tsx`

## Server and Client Rendering Boundary

Locked rendering boundary:

- `page.tsx` is the primary server-rendered authority
- the page normalizes `params.id`
- the page reuses canonical saved-deal detail on the server for governance/pipeline header fields
- the page calls `loadPdfEvidencePackForDeal(...)` directly on the server for the review body
- missing-deal handling uses safe Next not-found behavior
- dependency failures are caught server-side and rendered as a safe unavailable document state
- the document render path stays read-only and server-backed
- no client-side `useEffect`, `fetch`, polling, mutation, or route-panel wrapper is required
- `loading.tsx` may provide a stable document skeleton while the server page resolves
- a pure mapper is allowed only for formatting, section assembly, and gate grouping
- no client state is allowed to become a second source of truth for Summary, Shield, Evidence Lite, tasks, offers, or disclaimers

## Canonical Data-Loading Flow

Locked data flow:

```text
/saved-deals/[id]/review
-> normalize deal ID
-> load canonical saved-deal detail for identity/governance/pipeline and existence gate
-> loadPdfEvidencePackForDeal(...)
-> null pack result triggers safe not-found
-> thrown dependency failure triggers safe unavailable document state
-> canonical saved-deal header fields + canonical PdfEvidencePack
-> optional pure browser-review mapper
-> read-only review document component
```

The mapper is permitted only to:

- format currency, dates, booleans, and labels
- merge canonical saved-deal header fields with canonical pack display fields
- split canonical required and advisory display groups
- flatten or group canonical gate/sub-gate display rows
- arrange document sections

The mapper must not:

- query the database
- call repositories
- recalculate business values
- re-evaluate Shield
- select blockers independently
- alter Evidence Lite meaning
- change disclaimer authority

## Browser Review Section Order

Locked section order:

1. Header
2. Property and deal overview
3. Investment summary
4. Decision and capital-protection status
5. Required hard gates
6. Advisory and caution gates
7. Evidence Lite notes
8. Missing evidence and blockers
9. Tasks and offers
10. Recommended next action
11. Footer

Locked content by section:

### A. Header

- `Brik by Brik Investor Review`
- confidentiality label
- generated timestamp
- deal ID
- review purpose
- non-reliance statement

### B. Property and deal overview

- property identity/address
- classification
- governance state when present from canonical saved-deal/page context
- capital-protection state
- pipeline state

### C. Investment summary

- True MAO
- canonical acquisition/finance figures when available
- latest offer
- recommended next action

### D. Decision and capital-protection status

- capital-protection state
- Shield overall status
- progression decision
- `canProgress`
- blocked/conditional explanation

### E. Required hard gates

- required gates only
- label
- status
- blocker state
- evidence count
- missing-evidence state
- latest update when present

### F. Advisory and caution gates

- advisory-only sub-gates and canonical advisory warnings
- caution-state required gates may also be called out here as caution context, but must remain visually and semantically tied to their required-gate authority
- no required gate may be relabeled as advisory
- if no separate advisory-only gate entries exist, the section must render a truthful empty-state note rather than inventing synthetic advisory gates

### G. Evidence Lite notes

- evidence type
- linked gate
- status
- reviewed state
- note
- reviewer note only when non-null
- relevant timestamp
- always-visible separation notice

### H. Missing evidence and blockers

- missing-evidence count
- blocked gate count
- active blockers
- follow-up requirements

### I. Tasks and offers

- task count
- task statuses
- linked gates when present
- latest offer summary
- correct empty states when none exist

### J. Recommended next action

- canonical recommendation only

### K. Footer

- confidentiality
- generated timestamp
- deal ID
- optional version marker
- non-reliance wording

## Required Versus Advisory Gate Presentation

Locked presentation rule:

- required hard gates remain the primary gate list
- authoritative source is canonical Shield gate data
- top-level default gates remain required gates
- advisory-only content comes from canonical advisory warnings and advisory-only sub-gates such as `AI_VISUAL_REVIEW_ADVISORY`
- required and advisory content must never be merged into one undifferentiated list
- `BLOCKED`, `FAILED`, `MISSING`, `REQUIRED`, and `NOT_STARTED` must never look successful
- caution and advisory styling must remain distinct from blocked styling
- Evidence Lite references may appear beside related gates only as informational context, never as gate-satisfaction proof

## Evidence Lite Separation Contract

The browser review page must always show this wording:

`Evidence Lite is informational and does not by itself satisfy, waive, approve, or override Investor Shield requirements.`

Additional locked behavior:

- Evidence Lite record status is displayed verbatim from canonical data
- `reviewed: false` must remain visibly not reviewed
- `MISSING` must remain visibly non-successful
- null reviewer note is omitted
- missing evidence must not be reworded as completion
- no gate can be marked satisfied from Evidence Lite alone

## Confidentiality and Non-Reliance Copy

Locked minimum copy set:

- confidentiality label: `INTERNAL USE ONLY`
- controlled review statement:
  `Confidential controlled review material for investor decision support.`
- non-reliance statement:
  `This review is read-only investor decision support. It is not a valuation, legal advice, lending advice, or a substitute for professional due diligence.`
- Shield authority statement:
  `Investor Shield status remains authoritative within this application.`
- Evidence Lite statement:
  `Evidence Lite is informational and does not by itself satisfy, waive, approve, or override Investor Shield requirements.`
- missing-evidence statement:
  `Missing evidence must not be interpreted as completed verification.`

Repository-approved source themes reused here:

- informational decision support
- not legal advice
- not a valuation
- not lender approval/lending authority
- data may be incomplete or stale
- evidence does not prove gate satisfaction

## Loading State

Locked loading behavior:

- use the route loading convention with `loading.tsx` or an equivalent stable document skeleton
- do not flash an empty state during loading
- do not show mutation controls
- preserve the document/report feel rather than a dashboard spinner

## Missing-Deal State

Locked missing-deal behavior:

- blank or unusable route ids are normalized and rejected safely
- a missing saved deal results in safe not-found behavior
- no blank report is rendered
- no partial report is fabricated

## Dependency-Error State

Locked dependency-failure behavior:

- dependency failure renders a safe unavailable document state in the page render path
- no SQL, stack trace, credential, environment value, connection detail, or raw exception is exposed
- no partial pack is shown after a failed canonical load
- the state must remain clearly read-only and non-mutating

## Empty-State Contracts

Locked empty-state copy and behavior:

- Empty Evidence Lite:
  `No Evidence Lite records are currently attached to this deal.`
- No tasks:
  `No active tasks are currently recorded for this deal.`
- No offers:
  `No offers are currently recorded for this deal.`
- optional unavailable values:
  `Not available`
  or the existing repository-equivalent unavailable label

Additional empty-state rules:

- always show the Evidence Lite separation notice even when Evidence Lite is empty
- do not invent zeroes for unavailable financial values
- empty arrays remain truthful empty arrays

## Responsive and Print-Aware Presentation

Locked UX and visual expectations:

- professional, restrained, document-focused presentation
- clear report hierarchy
- strong spacing rhythm
- readable typography
- neutral business styling
- no dashboard clutter
- no unnecessary gradients
- no animation
- compact accessible status indicators
- blocked, missing, and not-started states remain visually non-successful
- hard blockers, advisory cautions, and Evidence Lite remain visually distinct
- stable desktop document width
- readable tablet and mobile layout
- no horizontal overflow
- long notes and ids wrap
- semantic headings
- keyboard accessibility
- high contrast
- passive print-aware CSS is allowed
- no print button
- no PDF button
- no download button

## Expected Phase 4F-R2 Files

Selected minimum cohesive implementation set:

- `app/saved-deals/[id]/review/page.tsx`
- `app/saved-deals/[id]/review/loading.tsx`
- `app/saved-deals/[id]/review/not-found.tsx`
- `components/investor-review/InvestorReviewDocument.tsx`
- `lib/investor-review/map-pdf-evidence-pack-to-investor-review.ts`
- `__tests__/investor-review-page.test.tsx`
- `__tests__/investor-review-document.test.tsx`
- `__tests__/investor-review-mapper.test.ts`

No additional API route, download route, PDF generator, storage layer, or navigation change is required for R2.

## Focused Test Plan

Phase 4F-R2 must prove:

1. the selected page uses the canonical saved-deal detail source plus `loadPdfEvidencePackForDeal(...)`
2. deal ID normalization is preserved
3. missing deals use safe not-found behavior
4. dependency failures use a safe unavailable state
5. property and deal summary render
6. True MAO comes from canonical output
7. classification renders
8. governance renders when present from canonical saved-deal/page context
9. capital protection renders
10. pipeline renders
11. Shield overall status renders
12. progression decision renders
13. required gates are separated from advisory content
14. blocking and caution states are visually distinct
15. missing-evidence count renders
16. an Evidence Lite record renders
17. `MISSING` is not shown as success
18. `reviewed: false` is represented correctly
19. null reviewer note is omitted
20. the Evidence Lite separation wording is always visible
21. tasks empty state renders
22. offers empty state renders
23. recommended next action comes from canonical output
24. safe error wording exposes no internal detail
25. no mutation controls exist
26. no PDF, print, or download control exists
27. no duplicated calculation exists
28. semantic section order is retained responsively

## Future Deployment and Browser-Proof Plan

Phase 4F-R3 must prove against the controlled production deal:

- the standalone review page loads on Vercel
- the exact QA deal renders
- True MAO renders from canonical data
- classification, governance, capital protection, and pipeline render
- Shield remains blocked
- required and advisory content remain visibly separated
- the retained Evidence Lite record renders as informational only
- missing-evidence count remains `10`
- tasks and offers show correct empty states
- recommended next action renders
- page refresh reloads the same server-backed review
- a fresh browser context renders the same result
- desktop and mobile layouts pass
- no `POST`, `PATCH`, `PUT`, or `DELETE` occurs
- no PDF is generated
- no download route is requested
- production data remains unchanged

## Screenshot Plan

Planned future screenshot set:

- `browser-review-full-desktop.png`
- `browser-review-shield-gates.png`
- `browser-review-evidence-lite.png`
- `browser-review-after-refresh.png`
- `browser-review-mobile.png`
- `browser-review-safe-error.png`

No screenshots are captured in this phase.

## Visual-Approval Boundary

Locked approval boundary:

- R1 locks architecture
- R2 implements the browser page
- R3 deploys and captures live browser proof
- Karlo and James must approve the browser-rendered document before any binary PDF work
- approval must cover:
  - section completeness
  - True MAO clarity
  - Shield authority
  - hard-gate versus advisory separation
  - Evidence Lite separation
  - confidentiality wording
  - desktop layout
  - mobile layout
  - suitability as the source layout for later PDF rendering

## Binary PDF Deferral

Binary PDF generation remains explicitly deferred.

This phase does not authorize:

- PDF rendering
- PDF libraries
- PDF downloads
- file persistence
- storage
- print/download controls

The browser-rendered document must be implemented and visually approved first.

## Explicit Non-Implementation

Confirmed not added in this phase:

- page implementation
- component implementation
- route implementation
- API endpoint
- PDF generation
- PDF library
- download control
- print control
- storage
- uploads
- sharing
- signed URLs
- authentication
- authorization
- middleware change
- database change
- Evidence Lite mutation
- Shield mutation
- task mutation
- offer mutation
- formula change
- classification change
- governance change
- capital-protection change
- AI
- OCR
- scraping
- CRM expansion
- automation
- role system
- production access
- deployment
- `.gitignore` modification

## Result

`PHASE 4F-R1 BROWSER REVIEW ARCHITECTURE LOCKED — READY FOR READ-ONLY IMPLEMENTATION`

## Recommended Next Step

`Phase 4F-R2 — Implement the read-only browser-rendered Investor Summary and Evidence Pack review page using the locked canonical architecture.`
