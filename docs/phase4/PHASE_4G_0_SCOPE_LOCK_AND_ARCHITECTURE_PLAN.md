# Phase 4G-0 Scope Lock and Architecture Plan

## Purpose

Determine whether Phase 4G already has an authoritative definition, inventory the Phase 4F and PDF Evidence Pack assets any future implementation must reuse, and lock the approval gate that blocks implementation until Karlo and James complete visual approval of the browser-rendered Investor Review page. This document contains no runtime code, no route, and no dependency change.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `6804159e3be4ae99e403323ed50ce799de09bf2f` |
| `origin/main` | `6804159e3be4ae99e403323ed50ce799de09bf2f` |
| Latest commit | `docs: record investor review production proof` |
| Dirty state before this phase | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `AGENTS.md`, `LEAN-CTX.md`, `README.md`
- `docs/phase4/PHASE_4F_BROWSER_RENDERED_INVESTOR_SUMMARY_AND_EVIDENCE_PACK_REVIEW_SURFACE_PLAN.md`
- `docs/phase4/PHASE_4F_R2A_INVESTOR_REVIEW_PRESENTATION_MAPPER_AND_DOCUMENT.md`
- `docs/phase4/PHASE_4F_R2B_1_INVESTOR_REVIEW_SERVER_DATA_LOADING_BOUNDARY.md`
- `docs/phase4/PHASE_4F_R2B_2_DYNAMIC_INVESTOR_REVIEW_PAGE_AND_SAFE_STATES.md`
- `docs/phase4/PHASE_4F_R2C_LOCAL_BROWSER_REVIEW_RESPONSIVE_HARDENING_AND_IMPLEMENTATION_CLOSURE.md`
- `docs/phase4/PHASE_4F_R3_CONTROLLED_PRODUCTION_BROWSER_PROOF.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_SCOPE_LOCK_AND_ARCHITECTURE_READINESS.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_PURE_COMPOSER_PLAN.md` / `..._COMPLETION.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_SOURCE_LOADING_AND_AGGREGATION_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_AGGREGATION_REPOSITORY_AND_MOCKED_TEST_PLAN.md` / `..._MOCKED_TESTS.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_GET_ROUTE_AND_SAFE_RESPONSE_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_ACCESS_CONTROL_BOUNDARY_RESOLUTION.md`
- `docs/phase4/PHASE_4F_SAVED_DEAL_INTERNAL_ACCESS_MODEL_AND_MINIMAL_GUARD_PLAN.md`
- `docs/phase4/PHASE_4F_MINIMAL_SERVER_IDENTITY_GUARD_AND_MOCKED_TESTS.md`
- `docs/phase4/PHASE_4F_0A_EXISTING_REPOSITORY_AND_SCHEMA_INVENTORY.md`, `PHASE_4F_0B_CODE_PACK_COMPATIBILITY_AUDIT.md`
- `docs/phase4/PHASE_4_COMPLETION_CODE_PACK_BATCH_1_INVENTORY_MAPPING.md`
- `docs/phase4/PHASE_4E_P1B_SCHEMA_RECONCILIATION_AND_PRODUCTION_ACTIVATION_READINESS.md`, `PHASE_4E_P2B_..._MIGRATION_AND_SCHEMA_VERIFICATION.md`, `PHASE_4E_P3_CONTROLLED_PRODUCTION_EVIDENCE_LITE_PERSISTENCE_PROOF.md`
- `app/saved-deals/[id]/review/page.tsx`
- `components/investor-review/InvestorReviewDocument.tsx`
- `lib/investor-review/load-investor-review-page-model.ts`
- `lib/investor-review/map-pdf-evidence-pack-to-investor-review.ts`
- `lib/investor-review/investor-review-view-model.ts`
- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`
- `lib/pdf-evidence-pack/compose-pdf-evidence-pack.ts`
- `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts`
- `lib/pdf-evidence-pack/project-evidence-lite-record-to-pdf-evidence-item.ts`
- `lib/operator-command/require-saved-deal-read-access.ts`, `trusted-internal-operator-identity.ts`
- `package.json`
- Investor Review and PDF Evidence Pack test files (`__tests__/investor-review-*`, `__tests__/*pdf-evidence-pack*`, `__tests__/require-saved-deal-read-access.test.ts`, `__tests__/trusted-internal-operator-identity.test.ts`)

## Current Phase 4F Status

`PHASE 4F-R3 PARTIALLY COMPLETE — DEPLOYMENT PASSED BUT REQUIRED BROWSER PROOF IS INCOMPLETE`

Production Investor Review page: `https://brik-by-brik-engine-chi.vercel.app/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/review`. Desktop and mobile screenshots have been captured. Karlo and James visual approval has not yet been recorded in this repository.

## Phase 4G Repository Definition Search

Searched for `Phase 4G`, `PHASE_4G`, `4G`, `PDF generation`, `PDF rendering`, `browser review approval`, `download`, `print`, `export`, `evidence pack` across `AGENTS.md`, `LEAN-CTX.md`, `README.md`, and `docs/phase4/`.

Findings:

- No `docs/phase4/PHASE_4G_*.md` file exists prior to this document.
- `AGENTS.md` mentions PDF export only under the original, now-superseded Phase 2 roadmap (`Do not add PDF export until Phase 2`) — this predates the Phase 4 rebuild and is not an authoritative Phase 4G scope statement.
- Older Phase 4E docs (`PHASE_4E_P1B_...`, `PHASE_4E_P2B_...`, `PHASE_4E_P3_...`) reference "Phase 4G" only as a forward pointer with no defined content, e.g. `17. proceed to Phase 4G`, `6. Phase 4G acceptance pack`, `Phase 4G acceptance evidence` — sequencing labels, not scope.
- `PHASE_4F_0A_EXISTING_REPOSITORY_AND_SCHEMA_INVENTORY.md` and `PHASE_4F_0B_CODE_PACK_COMPATIBILITY_AUDIT.md` reference a hypothetical `docs/qa/phase4g_acceptance_checklist.md` from an external code-pack inventory exercise. That path does not exist in this repository (`docs/qa/` is absent) and was explicitly logged as `NO EXACT CHECKLIST FILE EXISTS` / `DOCUMENTATION/CHECKLIST ONLY`, not an approved scope document.
- `PHASE_4A_REPOSITORY_ADAPTER_INTERFACE.md`'s "Phase 4A Step 4G" is an unrelated Phase 4A sub-step label (repository adapter skeleton), a naming coincidence with no connection to a product "Phase 4G".
- The one substantive, repeated, and consistent signal is the Phase 4F planning chain itself: `PHASE_4F_BROWSER_RENDERED_INVESTOR_SUMMARY_AND_EVIDENCE_PACK_REVIEW_SURFACE_PLAN.md` states "Binary PDF generation remains prohibited until the browser-rendered review page is implemented, deployed, and visually approved" and defines a `Visual-Approval Boundary` requiring Karlo and James to approve the page before "any binary PDF work." Every subsequent R2A/R2B/R2C/R3 completion document repeats "Do not begin PDF work" / defers "binary PDF work" as the next approved deliverable after visual approval, without ever specifying rendering technology, response mechanism, or file layout for that future work.

## Authoritative Phase 4G Scope Finding

`PARTIALLY DEFINED`

Proven scope (repository evidence, Phase 4F R1 plan and all subsequent Phase 4F completion documents):

- the next deliverable after Karlo and James approve the browser-rendered Investor Review document is binary PDF generation of that same approved document;
- the PDF must reuse the approved browser layout as its source of truth, not a redesigned document;
- no PDF work of any kind is authorized before that approval is recorded.

Unresolved decisions (no repository evidence, must not be assumed):

- exact PDF rendering technology (e.g., headless-browser printing, a dedicated PDF library, or another method);
- whether PDF generation happens synchronously on request or via another mechanism;
- the exact response/delivery boundary (inline route response vs. another approved mechanism);
- whether a download control is ever authorized, and under what access model;
- how the still-unresolved saved-deal access-control gap (see below) will be closed before any PDF response route is exposed;
- exact file/route naming for the future implementation.

This document does not fill those gaps. It records the proven direction and leaves the rest to future approval.

## Approval Gate

```text
Phase 4F browser document deployed
→ desktop and mobile screenshots captured
→ Karlo visual approval
→ James visual approval
→ Phase 4F-R3 formally closed
→ Phase 4G implementation may begin
```

Current position: deployment done, screenshots captured, both approvals **outstanding**. Until both are recorded in this repository:

- Phase 4G remains plan-only;
- no dependency may be installed;
- no rendering code may be added;
- no route may be added;
- no download behavior may be added;
- no deployment may occur.

## Existing Browser Review Assets to Reuse

- `app/saved-deals/[id]/review/page.tsx` — the approved server page: normalizes the route id implicitly via the loader, calls `loadInvestorReviewPageModel(...)` exactly once, and dispatches on `{ ready | not_found | unavailable }`.
- `lib/investor-review/load-investor-review-page-model.ts` — the approved server-loading boundary (`loadInvestorReviewPageModel`), which itself calls only `getSavedDealById(...)`, `loadPdfEvidencePackForDeal(...)`, and `mapPdfEvidencePackToInvestorReview(...)`, with one generated timestamp and the fixed `INTERNAL USE ONLY` confidentiality label.
- `lib/investor-review/map-pdf-evidence-pack-to-investor-review.ts` (`mapPdfEvidencePackToInvestorReview`) — the approved pure presentation mapper; owns required/advisory gate grouping, Evidence Lite row projection, and all display formatting.
- `lib/investor-review/investor-review-view-model.ts` — the approved `InvestorReviewViewModel` contract and locked copy constants (empty-state text, Evidence Lite separation notice, `Not available` label).
- `components/investor-review/InvestorReviewDocument.tsx` — the approved, visually-reviewed read-only document component and its locked section order (header, overview, investment summary, decision/capital-protection, required gates, advisory/caution, Evidence Lite, blockers, tasks/offers, recommended action, footer).
- `components/investor-review/InvestorReviewUnavailable.tsx` and `app/saved-deals/[id]/review/not-found.tsx` / `loading.tsx` — the approved safe route states, useful as reference for equivalent safe states in any future generation boundary.
- The full Investor Review test suite (`investor-review-mapper.test.ts`, `investor-review-document.test.tsx`, `load-investor-review-page-model.test.ts`, `investor-review-page.test.tsx`) as existing proof that must not be duplicated.

## Existing PDF Evidence Pack Assets to Reuse

- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts` — canonical `PdfEvidencePack` shape (`meta`, `identity`, `investorSummary`, `investorShield`, `evidenceIndex`, `disclaimers`).
- `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts` (`loadPdfEvidencePackForDeal`) — canonical aggregation loader; normalizes the deal id, gates on saved-deal existence first, loads Shield/tasks/offers/Evidence Lite concurrently, reuses `composeInvestorSummaryViewModel`, and returns `null` on a missing deal. Already the sole aggregation point — no second aggregation layer is justified.
- `lib/pdf-evidence-pack/compose-pdf-evidence-pack.ts` (`composePdfEvidencePack`) — pure composer assembling the final pack, including the ten fixed, `required: true` disclaimer entries (informational decision support, not legal advice, not a valuation, not a structural survey, not lender approval, not a planning/building-control certificate, not a solicitor substitute, data may be incomplete or stale, evidence does not prove gate satisfaction, manual overrides remain visible).
- `lib/pdf-evidence-pack/project-evidence-lite-record-to-pdf-evidence-item.ts` — canonical Evidence Lite → pack-evidence-item projection.
- Confidentiality label ownership: fixed at `INTERNAL USE ONLY`, owned by the caller (currently `loadInvestorReviewPageModel`), never accepted from a request.
- Missing-deal behavior: `loadPdfEvidencePackForDeal` returns `null`; the current page boundary converts that into `not_found`. Any future generation boundary must preserve this, not invent a different missing-deal response.
- Dependency-failure behavior: `loadPdfEvidencePackForDeal` lets required-dependency failures throw; the current page boundary converts an unexpected throw into the safe `unavailable` state with no internal detail exposed. Any future boundary must do the same, not leak exceptions into a PDF or HTTP response.
- Privacy/access-control finding (`PHASE_4F_PDF_EVIDENCE_PACK_ACCESS_CONTROL_BOUNDARY_RESOLUTION.md`): a prior attempt to add a JSON `GET` route for the pack was formally blocked — `PDF EVIDENCE PACK ACCESS BOUNDARY BLOCKED — NO SAFE ACCESS MODEL EXISTS` — because no saved-deal route in this repository has application-level authentication or authorization. A `SINGLE TRUSTED INTERNAL OPERATOR` access model was later approved and a reusable guard was built (`lib/operator-command/trusted-internal-operator-identity.ts`, `lib/operator-command/require-saved-deal-read-access.ts`, with their own mocked tests) but **that guard has not been wired into any route, including the current Investor Review page** — confirmed by repository search: no reference to it exists outside its own definition/test files. This gap is unresolved and directly relevant to any future PDF response boundary.
- No PDF library, headless-browser dependency, or rendering package is present in `package.json`.

## Proposed Phase 4G Boundary

**PROPOSED, NOT YET AUTHORIZED.** Consistent with the one proven repository signal (Phase 4F's "binary PDF generation" deferral), the smallest plausible post-approval boundary would:

- produce an approved PDF rendering of the existing browser-rendered Investor Review layout;
- reuse `loadInvestorReviewPageModel(...)` (or the canonical pack loader beneath it, only if the approved rendering architecture requires the raw pack rather than the mapped view model) as the sole data source;
- reuse `InvestorReviewDocument` (or its exact rendered output) as the sole document layout — no second document-composition system;
- add only the minimum generation and response boundary needed to turn that rendering into PDF bytes;
- preserve all confidentiality and non-reliance wording verbatim;
- remain fully read-only, with no mutation of any kind.

This paragraph is a proposal to frame future subphases. It is not scope authorization.

## Explicit Non-Goals

Regardless of which architecture is eventually approved, Phase 4G must not include:

- public sharing
- email delivery
- CRM workflows
- bulk exports
- background generation
- persistent report history
- document editing
- user-customized branding
- attachment embedding
- uploads
- AI summaries
- OCR
- signed external links

## Architecture Options Considered

### Option A — Reuse the approved browser page as the rendering source

Advantages: one document layout; no duplicate presentation logic; visual consistency with the approved browser page (the artifact Karlo and James actually approve).

Risks and requirements: the specific rendering technology (e.g., headless-browser printing of the live route, or another server-side rendering method) is not yet chosen; server/runtime compatibility with the Vercel deployment target must be proven before any dependency is installed; the unresolved access-control gap above must be closed before any response route exposing this rendering is added.

### Option B — Create a separate PDF-specific React document

Rejected as a default. It would recreate section order, formatting, gate grouping, Evidence Lite mapping, disclaimer content, and business-value presentation that already exist and are already visually under review in `InvestorReviewDocument.tsx`. This duplicates presentation logic and risks the PDF and browser documents silently drifting apart. Only reconsider if a concretely proven rendering-technology constraint makes Option A technically infeasible, and only with explicit approval.

### Option C — Browser print only (no generated PDF file)

Not assessed as sufficient absent client confirmation: Phase 4F's own planning document explicitly separates "browser-rendered document" (already built) from "binary PDF generation" (explicitly deferred, implying an actual generated file is the intended deliverable, not merely browser print styling). Selecting this option merely because it avoids adding a dependency would not be responsive to the recorded client direction. Do not select it without confirming it satisfies the actual requirement.

## Recommended Architecture

`PENDING APPROVAL`

Repository evidence supports Option A in principle (reuse the approved page as the rendering source) over Option B (duplicate document), but the concrete rendering technology, the response/delivery mechanism, and the access-control boundary are all unresolved. No architecture may be finalized until Karlo and James approve the browser document and the authoritative Phase 4G scope (rendering technology, delivery mechanism, access control) is separately confirmed.

## Canonical Authority and No-Duplication Rules

Any future Phase 4G implementation must reuse, unchanged:

- `loadInvestorReviewPageModel(...)`, or the existing canonical pack loader (`loadPdfEvidencePackForDeal`) only when the approved architecture requires the raw pack instead of the mapped view model;
- `InvestorReviewDocument`;
- the existing `InvestorReviewViewModel` and its locked constants;
- the existing required/advisory gate separation;
- the existing Evidence Lite separation and its locked notice text;
- the existing confidentiality (`INTERNAL USE ONLY`) and non-reliance copy.

It must not:

- recalculate True MAO;
- reconstruct Investor Summary;
- reevaluate Investor Shield;
- independently select tasks;
- independently select offers;
- reinterpret Evidence Lite;
- invent new recommendations;
- change unavailable values to zero;
- alter the browser-review section order without separate approval.

## Proposed Controlled Subphases

Proposal only — none of these may begin before both visual approvals and an authoritative scope decision are recorded.

### Phase 4G-1 — Rendering Technology Decision and Proof of Compatibility

Evaluate and prove one minimal rendering method against the approved page layout in a disposable/local proof, without adding a production route.

### Phase 4G-2 — Read-Only Generation Boundary

Implement the smallest approved server-side generation function reusing the canonical loader/mapper/document. No storage, no sharing.

### Phase 4G-3 — Controlled Response Boundary

Add only the approved, access-controlled response mechanism (closing the access-control gap identified above as a prerequisite). No public link.

### Phase 4G-4 — Local and Production Proof

Verify document completeness, browser/PDF parity, privacy, and absence of mutation, mirroring the Phase 4F R2C/R3 proof pattern.

Do not further subdivide this sequence unless a future authoritative scope document defines a different approved breakdown.

## Future Test Plan

Plan (do not create yet) focused tests proving:

- canonical values are preserved between the browser view model and the generated PDF;
- exact section order is preserved;
- required and advisory content remain separate;
- Evidence Lite remains informational, with its separation notice present;
- confidentiality and non-reliance wording remain present;
- missing values remain `Not available`, never coerced to zero or blank;
- no recalculation of any canonical value occurs in the generation path;
- no mutation occurs;
- no storage occurs unless separately approved;
- no public sharing path exists;
- correct missing-deal behavior (mirrors the existing `not_found` semantics);
- safe dependency-failure behavior (mirrors the existing `unavailable` semantics, no internal detail leaked);
- valid PDF output — only once PDF is confirmed as the approved scope, not assumed;
- desktop/browser and rendered-document parity;
- no live database required for the focused unit tests (mocked canonical dependencies, matching existing repository convention).

## Minimum Future File Set

Potential future files, kept small:

- one rendering/generation helper (e.g. under `lib/investor-review-pdf/` or an equivalent single new directory — exact naming deferred to the approved subphase);
- one focused test file for that helper;
- one approved route or response boundary, only after the access-control gap is closed;
- one route test;
- one completion document per subphase.

Do not plan: a generic document framework; a dependency-injection system; a storage service; a background queue; a share-token system; a document database; a duplicate page or mapper; multiple renderer abstractions.

## Access, Privacy, and Confidentiality Boundary

- The existing Investor Review page and PDF Evidence Pack loader carry no application-level authentication or authorization (`NO APPLICATION ACCESS CONTROL` across all inspected saved-deal routes).
- A `SINGLE TRUSTED INTERNAL OPERATOR` access model was approved and a reusable guard (`require-saved-deal-read-access.ts`, `trusted-internal-operator-identity.ts`) exists in the codebase but is **not wired into any route today**, including the Investor Review page itself.
- Any future PDF response boundary is a new, more sensitive exposure surface (a downloadable/renderable artifact rather than an HTML page) and must not be implemented until this access-control gap is closed — this is a prerequisite for Phase 4G-3, not an optional hardening step.
- `INTERNAL USE ONLY` labeling and non-obvious deal IDs are confirmed, by prior repository analysis, not to constitute access control.
- Confidentiality and non-reliance copy already locked in the browser document must be preserved verbatim in any future PDF output.

## Risks and Blockers

- Karlo visual approval is pending.
- James visual approval is pending.
- The exact Phase 4G client scope (rendering technology, delivery mechanism) remains unresolved beyond "produce an approved PDF from the approved browser document."
- Rendering technology has not been evaluated or approved.
- Production runtime (Vercel) compatibility with any chosen rendering technology has not been verified.
- The saved-deal access-control gap (no wired authentication/authorization) remains unresolved and blocks any future PDF response route, independent of Phase 4G approval status.
- A PDF output route must not create a new public exposure path for sensitive deal/financial/Shield/Evidence Lite data.
- The approved browser layout must remain the single source of truth; no second document-composition system may be introduced.
- Binary PDF work of any kind remains prohibited until both visual approvals are recorded.

## Implementation Readiness Checklist

- [ ] Karlo visual approval received
- [ ] James visual approval received
- [ ] Phase 4F-R3 formally closed
- [ ] authoritative Phase 4G scope confirmed
- [ ] rendering architecture approved
- [ ] access boundary confirmed
- [ ] no duplicate document logic required
- [ ] focused tests planned
- [ ] production proof plan approved

None of the above items are checked. No evidence in this repository supports marking any of them complete.

## Explicit Non-Implementation

Confirmed not added in this phase:

- source code
- tests
- package dependency
- rendering library
- route
- API endpoint
- PDF output
- download
- print control
- storage
- persistence
- sharing
- authentication
- authorization
- middleware change
- database access
- migration
- production access
- deployment
- business-logic change
- Investor Review modification
- AI, OCR, upload, scraping, CRM, automation, or roles

## Result

`PHASE 4G-0 SCOPE LOCK COMPLETE — IMPLEMENTATION BLOCKED PENDING KARLO AND JAMES VISUAL APPROVAL`

## Recommended Next Step

`Obtain Karlo and James visual approval and confirm the authoritative Phase 4G implementation scope before beginning Phase 4G-1.`
