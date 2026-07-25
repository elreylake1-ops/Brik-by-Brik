# Phase 5B-2A Browser Investor and Deal Summary Architecture

## Purpose

Lock one implementation-ready, read-only, browser-rendered Investor and Deal Summary architecture that reuses existing canonical outputs without adding new calculations, new authority, PDF generation, or new database aggregation.

## Repository Baseline

- repository: `Brik-by-Brik`
- planning branch: `phase5b-2a-investor-deal-summary-architecture`
- planning branch base: `main`
- `main`: `6d0981b4de7097b36e3995ff1733784a0c0fdaa5`
- `origin/main`: `6d0981b4de7097b36e3995ff1733784a0c0fdaa5`
- remote: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- working tree was clean before this documentation phase

## Frozen Phase 5A and Phase 5B Branches

- Phase 5A readiness integration branch: `phase5a-5b-professional-readiness-investor-review`
- Phase 5A local and remote frozen HEAD: `5ade84138727a489390a6eab958e3f399af95f0f`
- Phase 5B Deal Formulation integration branch: `phase5b-1d-deal-formulation-investor-review`
- Phase 5B local and remote frozen HEAD after freeze docs: `1e2c2abf4d2aa1b44b8f6cd48ed8f554c418b70d`
- Phase 5B implementation commit carrying actual product code: `4eb911e54bbaede9291e328876b955e6da734c96`
- these frozen branches were inspected only and were not modified

## Files Inspected

- `types/investor-summary.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/fetch-investor-summary.ts`
- `lib/investor-summary/investor-summary-repository.ts`
- `components/investor-summary/InvestorSummaryRoutePanel.tsx`
- `components/investor-summary/InvestorSummaryPanel.tsx`
- `__tests__/investor-summary-composition.test.ts`
- `types/investor-shield.ts`
- `types/investor-shield-enforcement.ts`
- `lib/investor-shield/evaluate-investor-shield.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `types/evidence-lite.ts`
- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`
- `lib/pdf-evidence-pack/compose-pdf-evidence-pack.ts`
- `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts`
- `app/globals.css`
- `docs/phase4/PHASE_4F_BROWSER_RENDERED_INVESTOR_SUMMARY_AND_EVIDENCE_PACK_REVIEW_SURFACE_PLAN.md`
- `docs/phase4/PHASE_4F_R2B_1_INVESTOR_REVIEW_SERVER_DATA_LOADING_BOUNDARY.md`
- frozen Phase 5A branch refs:
  - `app/saved-deals/[id]/review/page.tsx`
  - `app/saved-deals/[id]/review/loading.tsx`
  - `app/saved-deals/[id]/review/not-found.tsx`
  - `components/investor-review/InvestorReviewUnavailable.tsx`
  - `components/investor-review/InvestorReviewDocument.tsx`
  - `lib/investor-review/investor-review-view-model.ts`
  - `lib/investor-review/load-investor-review-page-model.ts`
  - `lib/investor-review/map-pdf-evidence-pack-to-investor-review.ts`
  - `types/professional-evidence-gateway.ts`
  - `lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model.ts`
  - `docs/phase5/PHASE_5A_5C_BLOCKED_PR_PACKAGE.md`
- frozen Phase 5B branch refs:
  - `types/deal-formulation.ts`
  - `lib/deal-formulation/compose-deal-formulation-view-model.ts`
  - `lib/deal-formulation/extract-deal-formulation-canonical-input.ts`
  - `lib/deal-formulation/load-deal-formulation-view-model.ts`
  - `docs/phase5/PHASE_5B_1E_BLOCKED_PR_PACKAGE.md`

## Existing Canonical Contracts

- Canonical Investor Summary loader is `getInvestorSummaryForDeal(dealId)`.
- Canonical Investor Summary composition path is `composeInvestorSummaryViewModel(...)`.
- Canonical Investor Summary already includes identity, purchase price, GDV range, True MAO, capital protection, classification, Shield summary, active tasks, latest offer, and canonical recommended next action.
- Canonical Investor Shield authority comes from `loadAndEvaluateInvestorShield(dealId)` -> `InvestorShieldEnforcementResult`.
- Canonical PDF aggregation comes from `loadPdfEvidencePackForDeal(...)` -> `PdfEvidencePack`.
- Frozen Investor Review page loader is `loadInvestorReviewPageModel(dealId)`.
- Frozen Investor Review ready model is `InvestorReviewReadyViewModel`.
- Frozen Investor Review ready model already carries:
  - property identity;
  - classification;
  - governance;
  - capital protection;
  - pipeline;
  - Shield progression summary;
  - required gates;
  - advisory items;
  - Evidence Lite rows and notice;
  - tasks;
  - latest offer;
  - recommended next action;
  - Deal Formulation;
  - Professional Evidence Gateway;
  - professional readiness presentation.
- Frozen Deal Formulation contract already locks unavailable acquisition costs, ROI, and unsupported offer-ladder values.
- Frozen professional readiness contract already locks advisory-only authority and exact authority notice.
- Existing dynamic saved-deal review route already proves server-rendered `page.tsx` + `loading.tsx` + `not-found.tsx` convention.

## Architecture Options Considered

### Option A - Reuse Investor Review page model

- uses one existing canonical server loader: `loadInvestorReviewPageModel(dealId)`
- already includes Investor Summary-derived values, Deal Formulation, Investor Shield, professional readiness, Evidence Lite, tasks, offers, property identity, pipeline, governance, and recommended next action
- avoids another aggregation layer
- avoids another evidence read
- supports preferred future flow:
  `canonical Investor Review page model -> optional pure presentation mapper -> read-only summary page`

Assessment:

`SELECTED`

### Option B - Reuse PDF Evidence Pack plus Deal Formulation

- PDF Evidence Pack remains canonical and read-only
- but frozen Investor Review loader already adds Deal Formulation and professional readiness on top of that pack
- selecting pack plus Deal Formulation would re-open orchestration already solved by `loadInvestorReviewPageModel(...)`
- would force summary page to rebuild distinctions the frozen review loader already guarantees

Assessment:

`REJECTED`

### Option C - Create narrow pure summary mapper over canonical models

- pure mapper is useful for presentation shape only
- but mapper alone is not source of truth
- using it as primary architecture without existing page model would still need another upstream orchestrator

Assessment:

`REJECTED AS PRIMARY SOURCE`

## Selected Canonical Data Source

Selected source:

`loadInvestorReviewPageModel(dealId)` returning `LoadInvestorReviewPageModelResult` with `InvestorReviewReadyViewModel`.

Reason:

- already canonical in frozen integrated implementation;
- already normalizes deal ID;
- already gates missing deal safely;
- already returns safe unavailable state for dependency failure;
- already assembles Investor Review + Deal Formulation + Professional Evidence Gateway + Evidence Lite through one server boundary;
- already preserves Investor Shield authority, professional readiness advisory status, and Evidence Lite informational status;
- avoids duplicate financial loading and duplicate evidence aggregation.

## Selected Page Architecture

Selected architecture:

`dynamic server-rendered summary page -> loadInvestorReviewPageModel(dealId) -> optional pure presentation mapper -> read-only summary document`

Implementation note for future Phase 5B-2B:

- implementation should branch from frozen Phase 5B integration work, not from this planning branch, because selected canonical source lives on frozen integration branch code;
- frozen branches stay unchanged;
- Phase 5B-2B should create a new implementation branch over frozen integrated code.

## Selected Page Path

Selected route:

`/saved-deals/[id]/summary`

Rationale:

- matches existing saved-deal nested route convention;
- uses existing `[id]` pattern;
- clearly indicates browser summary;
- does not imply PDF output;
- does not imply public sharing or tokenized access.

## Server and Client Rendering Boundary

- page is dynamic server-rendered
- page resolves and normalizes route id on server
- page calls exactly one canonical loader: `loadInvestorReviewPageModel(dealId)`
- `not_found` result uses Next safe not-found behavior
- `unavailable` result uses safe unavailable document state
- `ready` result passes prepared read-only data to presentation layer
- no client fetch for initial content
- no React-side financial parsing
- no mutation control
- no general state-management layer
- client components are not required for locked initial implementation

## Canonical Data Flow

```text
/saved-deals/[id]/summary
-> server resolves params.id
-> normalize deal id
-> loadInvestorReviewPageModel(dealId)
-> result.status === not_found -> notFound()
-> result.status === unavailable -> safe unavailable summary state
-> result.status === ready -> InvestorReviewReadyViewModel
-> optional mapInvestorReviewToDealSummary(viewModel)
-> InvestorDealSummaryDocument
```

Upstream canonical flow already remains:

```text
saved deal gate
-> loadPdfEvidencePackForDeal(...)
-> loadDealFormulationViewModel(...)
-> mapPdfEvidencePackToInvestorReview(...)
-> loadProfessionalEvidenceGatewayViewModel(...)
-> InvestorReviewReadyViewModel
```

## Exact Summary Section Order

### A. Header

- `Brik by Brik Investor and Deal Summary`
- confidentiality label
- generated timestamp
- deal ID
- property address or label
- short purpose statement

### B. Executive decision snapshot

- verdict
- persisted classification
- governance state
- capital-protection state
- pipeline state
- Investor Shield progression
- professional readiness state

### C. Core financial position

- purchase price
- realistic GDV
- downside GDV
- strong GDV
- refurbishment cost
- finance cost
- total investment
- projected profit
- profit margin
- optional canonical component costs when available:
  - stamp duty
  - legal costs
  - sale costs

### D. True MAO

- 25% band
- 20% band
- 15% band
- exact note:
  `No single investor-facing True MAO band has been selected in the current canonical model.`

### E. Offer position

- latest recorded offer
- latest offer status
- no-offer empty state
- unsupported fields left unavailable:
  - opening offer
  - target offer
  - final offer
  - walk-away amount
  - walk-away threshold
- exact note:
  `No canonical monetary offer ladder currently exists.`

### F. Unsupported values

- acquisition-cost aggregate - `Not available`
- ROI - `Not available`
- existing exact reasons shown below values

### G. Investor Shield

- overall status
- progression
- `canProgress`
- blocking-gate count
- caution-gate count
- missing-evidence count
- required hard gates
- advisory gates

### H. Professional readiness

- readiness label
- supporting summary
- exact authority notice:
  `Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.`

### I. Evidence Lite

- concise evidence records or short canonical summary
- exact informational notice:
  `Evidence Lite records are informational and do not constitute professional confirmation.`

### J. Risks, blockers, and missing evidence

- canonical warnings
- active blockers
- missing evidence
- unavailable fields

### K. Recommended next action

- canonical recommended next action only

### L. Footer

- confidentiality
- generated timestamp
- deal ID
- non-reliance wording
- current-state notice

## Decision and Authority Separation

Locked authority chain:

```text
deterministic financial calculations
-> True MAO and capital protection
-> deterministic verdict and persisted classification
-> Investor Shield progression authority
-> saved-deal pipeline state
-> professional readiness advisory status
-> Evidence Lite informational status
-> UI presentation
```

Confirmed:

- Investor Shield may block progression but does not rewrite financial outputs
- professional readiness does not rewrite verdict, classification, capital protection, or financial values
- Evidence Lite cannot create professional confirmation
- latest offer does not alter True MAO
- unavailable values are not estimated
- presentation copy cannot become calculation source

## True MAO Presentation Contract

- show all three canonical bands
- use equal visual weight
- do not select one as official
- do not label 20% as default
- do not turn bands into offer ladder
- always show:
  `No single investor-facing True MAO band has been selected in the current canonical model.`

## Unsupported-Value Contract

Display contract:

- use `Not available`
- do not show zero
- do not show fabricated currency
- do not calculate fallback values

Exact reasons:

- acquisition costs:
  `No canonical acquisition-cost aggregate currently exists.`
- ROI:
  `ROI is not available from the current canonical engine output.`
- offer ladder:
  `No canonical monetary offer ladder currently exists.`

Optional missing canonical values render `Not available` and are not treated as application errors by themselves.

## Offer-Position Contract

- show only canonical latest recorded offer amount and status
- no-offer empty state remains valid
- exact empty-state copy:
  `No offers are currently recorded for this deal.`
- unsupported ladder fields remain unavailable
- latest offer must not be treated as final offer
- latest offer must not be treated as walk-away value
- latest offer must not change True MAO

## Investor Shield Contract

- summary reuses existing canonical Shield outputs already carried by frozen Investor Review page model
- required hard gates remain distinct from advisory gates
- blocked and caution states remain visually distinct
- required and advisory lists are not merged
- exact authority boundary preserved from frozen Phase 5B work:
  `Investor Shield progression authority remains separate from Deal Formulation financial presentation.`

## Professional Readiness Contract

- summary reuses `professionalEvidenceGateway.readinessPresentation`
- readiness remains advisory only
- supporting summary comes from canonical readiness classifier output
- exact boundary remains:
  `Professional readiness remains read-only decision support and does not change Deal Formulation financial outputs.`
- exact authority notice shown in readiness section:
  `Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.`

## Evidence Lite Contract

- summary reuses existing canonical Evidence Lite projection already surfaced in frozen Investor Review page model
- Evidence Lite remains informational
- Evidence Lite never implies gate completion, readiness confirmation, or progression approval
- always show:
  `Evidence Lite records are informational and do not constitute professional confirmation.`
- when no records exist, show:
  `No Evidence Lite records are currently attached to this deal.`

## Confidentiality and Non-Reliance Copy

Use existing approved wording where available.

Locked minimum wording set:

- confidentiality label:
  `INTERNAL INVESTOR DECISION SUPPORT`
- purpose statement:
  `Confidential controlled review material for investor decision support.`
- non-reliance wording:
  `This summary is read-only investor decision support. It is not a valuation, legal advice, lending advice, or a substitute for professional due diligence.`
- Shield authority wording:
  `Investor Shield remains authoritative for application progression.`
- Evidence Lite wording:
  `Evidence Lite records are informational and do not constitute professional confirmation.`
- missing evidence wording:
  `Missing evidence must not be interpreted as completed verification.`
- unsupported values wording:
  `Unsupported values remain unavailable and are not estimated.`
- current-state wording:
  `This page reflects current canonical application output and is not a historical snapshot.`

## Loading State

- use route-level `loading.tsx`
- use stable document skeleton like existing review route
- no empty flash
- no dashboard spinner dependence
- preserve document-style structure while loading

## Missing-Deal State

- use Next not-found route segment
- blank or unusable deal id resolves to safe not-found behavior
- do not render empty summary
- do not fabricate partial document

## Dependency-Error State

- reuse safe unavailable-state pattern from existing review route
- no SQL
- no stack trace
- no environment values
- no connection strings
- no repository internals
- no partial misleading summary after dependency failure

## Empty and Partial States

- no offer:
  `No offers are currently recorded for this deal.`
- no Evidence Lite:
  `No Evidence Lite records are currently attached to this deal.`
- no canonical warnings:
  do not render empty warnings section
- optional missing value:
  `Not available`
- unsupported acquisition costs:
  `Not available` plus exact reason
- unsupported ROI:
  `Not available` plus exact reason
- unsupported offer-ladder fields:
  `Not available` plus exact reason

## Responsive and Accessibility Requirements

- professional
- restrained
- document-focused
- readable on desktop and mobile
- no dashboard clutter
- no animation
- no unnecessary gradients
- semantic headings and regions
- keyboard accessible
- high contrast
- wrapping-safe for long IDs, notes, reasons, and amounts
- no horizontal overflow
- passive print-aware CSS only
- no print, download, or PDF controls

Visual authority requirements:

- adverse and blocked states must not look positive
- neutral unavailable states must not look like failures
- all True MAO bands must receive equal weight
- Investor Shield must remain visually distinct
- professional readiness must appear advisory
- Evidence Lite must appear informational

## Optional Presentation Mapper Decision

Decision:

`REQUIRED`

Scope of mapper:

- pure mapper only
- input: `InvestorReviewReadyViewModel`
- output: future summary display model
- allowed:
  - arrange canonical sections
  - create display labels
  - flatten concise summary rows
  - group required versus advisory gates
  - centralize unavailable-state metadata
  - lock exact summary ordering
- prohibited:
  - calculate financial values
  - select True MAO band
  - calculate ROI
  - sum acquisition costs
  - generate offer ladder
  - classify deal
  - evaluate Investor Shield
  - classify readiness
  - query database
  - separately read Evidence Lite
  - generate advice

Reason:

`InvestorReviewReadyViewModel` is canonical but document-oriented. Summary page needs smaller, concise display ordering without reusing full review component layout.

## Minimum Phase 5B-2B File Set

- `app/saved-deals/[id]/summary/page.tsx`
- `app/saved-deals/[id]/summary/loading.tsx`
- `app/saved-deals/[id]/summary/not-found.tsx`
- `components/investor-summary/InvestorDealSummaryDocument.tsx`
- `lib/investor-summary/map-investor-review-to-deal-summary.ts`
- `types/investor-deal-summary.ts`
- `__tests__/investor-deal-summary-document.test.tsx`
- `__tests__/investor-deal-summary-page.test.tsx`
- `docs/phase5/PHASE_5B_2B_INVESTOR_DEAL_SUMMARY_IMPLEMENTATION.md`

Not required:

- new API route
- new repository
- new aggregation service
- PDF route
- print/download/share controls
- extra fragmented section subcomponents unless implementation complexity proves necessary

## Focused Test Plan

Phase 5B-2B must prove:

1. selected page uses one canonical loader
2. deal ID normalization is preserved
3. missing deal uses safe not-found behavior
4. dependency failure uses safe error behavior
5. property identity renders
6. verdict renders
7. classification renders separately
8. capital protection renders
9. pipeline state renders
10. Investor Shield progression renders
11. professional readiness renders as advisory
12. purchase price renders canonically
13. GDV range renders
14. refurbishment cost renders
15. finance cost renders
16. total investment renders
17. projected profit renders
18. profit margin renders
19. all three True MAO bands render equally
20. no selected True MAO renders
21. acquisition costs remain unavailable
22. ROI remains unavailable
23. latest offer renders when present
24. no-offer state renders
25. offer ladder remains unavailable
26. required and advisory Shield gates stay separate
27. Evidence Lite separation wording always renders
28. Evidence Lite cannot imply professional confirmation
29. canonical warnings render
30. recommended next action comes from canonical output
31. unavailable values do not render as zero
32. no mutation control exists
33. no PDF/download control exists
34. no duplicated calculations exist
35. responsive section order is preserved
36. safe errors reveal no internal detail

Existing composer, loader, Shield, readiness, and Deal Formulation unit tests must not be duplicated.

## Future Browser-Proof Plan

After implementation and infrastructure recovery, live proof must verify:

- summary route loads for controlled saved deal
- values match Investor Review
- all three True MAO bands match
- unsupported values remain unavailable
- latest offer and no-offer state are correct
- Investor Shield remains unchanged
- professional readiness remains advisory
- Evidence Lite remains informational
- recommended next action matches canonical Investor Summary
- refresh returns same server-backed values
- fresh browser returns same values
- desktop layout passes
- mobile layout passes
- no mutation request occurs
- no PDF request occurs
- database remains unchanged

## Screenshot Plan

Planned screenshots:

- `investor-deal-summary-desktop.png`
- `investor-deal-summary-financials.png`
- `investor-deal-summary-true-mao.png`
- `investor-deal-summary-shield-readiness.png`
- `investor-deal-summary-evidence-lite.png`
- `investor-deal-summary-mobile.png`
- `investor-deal-summary-safe-error.png`

No screenshots are captured in this phase.

## Human Visual-QA Boundary

- Phase 5B-2A locks architecture
- Phase 5B-2B implements page
- Phase 5B-2C deploys and captures live proof after infrastructure recovery
- Karlo and James must visually approve desktop and mobile
- automated screenshots are insufficient
- PDF generation remains prohibited until browser summary approval
- approval must cover:
  - section completeness
  - financial readability
  - True MAO equal weighting
  - unsupported-value clarity
  - Investor Shield authority
  - readiness boundary
  - Evidence Lite separation
  - desktop layout
  - mobile layout
  - suitability as future PDF source

## PDF Deferral

PDF generation remains prohibited in this phase and remains deferred until:

- read-only browser summary is implemented
- live server-backed route is verified after infrastructure recovery
- desktop and mobile human visual QA are approved
- summary layout is accepted as future PDF source

No PDF route, PDF library, print/download button, or PDF output is authorized in Phase 5B-2A.

## Explicit Non-Implementation

Confirmed no:

- page implementation
- component implementation
- route implementation
- API endpoint
- new aggregation layer
- database query
- repository
- migration
- database access
- production access
- deployment
- PDF generation
- PDF library
- storage
- share token
- signed URL
- authentication
- authorization
- middleware change
- formula change
- True MAO selection
- ROI calculation
- acquisition-cost calculation
- offer-ladder calculation
- Investor Shield change
- readiness change
- Evidence Lite change
- task, offer, or pipeline mutation
- AI, OCR, scraping, upload, CRM, or automation

## Result

`PHASE 5B-2A INVESTOR AND DEAL SUMMARY ARCHITECTURE LOCKED â€” READY FOR READ-ONLY IMPLEMENTATION`

## Recommended Next Step

`Phase 5B-2B â€” Implement the read-only browser-rendered Investor and Deal Summary using the locked canonical architecture.`
