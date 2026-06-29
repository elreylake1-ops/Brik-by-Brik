# Phase 4E-P4A Production Evidence Lite UI Activation and Browser Proof

## Purpose

Activate the existing Evidence Lite surface in production with production-safe wording, preserve the existing read-only GET contract, verify loading, empty, populated, and safe-error UI states locally, then complete controlled live deployment and browser-refresh proof against the retained production QA deal and retained production Evidence Lite record.

## Repository Baseline

- Branch: `main`
- Baseline `HEAD` / `origin/main`: `f3e15e731a9e2e5afb6187554163f235bfeeae4c`
- Latest baseline commit: `docs: correct local repository audit wording`
- Pre-existing dirty file intentionally left untouched: `.gitignore`

## Authoritative Production Target

- Vercel project: `brik-by-brik-engine`
- Production domain: `https://brik-by-brik-engine-chi.vercel.app`
- Supabase project: `jagjbwxodnbgbhhojuzo`
- Database: `postgres`

## Controlled Deal and Evidence Record

- Controlled saved deal ID: `4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863`
- Controlled saved deal address: `QA Controlled Production Verification Deal - Keep For Live Evidence Lite`
- Retained evidence ID: `evidence_9f9a344c-ed1c-4510-bb46-c8d3b88fce96`
- Retained evidence status: `MISSING`
- Retained evidence reviewed state: `false`
- Retained evidence linked gate: `SOLICITOR_REVIEW`
- Retained evidence type: `TITLE_REVIEW`
- Retained evidence reviewer note: `null`
- Retained evidence note: `Controlled QA evidence only; not substantive due diligence evidence. Verified via canonical POST and PATCH.`

## Existing UI Inspection

- `app/page.tsx` mounted `EvidenceLitePanel` on the canonical saved-deal detail surface through `selectedSavedDeal.id` and `selectedSavedDeal.address`.
- The exact production guard was `const showEvidenceLitePanel = process.env.NODE_ENV !== "production"`.
- `components/evidence-lite/EvidenceLitePanel.tsx` owned the evidence fetch path through `loadEvidenceLiteRecords(savedDealId)`.
- The client fetch path was already the approved read boundary: `GET /api/saved-deals/{dealId}/evidence`.
- The panel previously exposed local create controls and development-only copy.
- The prior empty state was `No evidence records yet.`
- The prior loading state was `Loading evidence records...`
- The prior error state surfaced the route error text directly.
- The panel did not previously render the evidence `status` explicitly.
- The panel did not previously render the evidence `id`.
- The panel rendered on the correct saved-deal review surface, but only when the non-production guard allowed it.

Files requiring change before editing:

- `app/page.tsx`
- `components/evidence-lite/EvidenceLitePanel.tsx`
- `__tests__/evidence-lite-panel.test.tsx`

## Production Guard Removed

- Removed the `process.env.NODE_ENV !== "production"` guard from `app/page.tsx`.
- `EvidenceLitePanel` now renders on the canonical saved-deal detail surface in production as soon as a saved deal is selected.

## Development Copy Replaced

- Replaced the development-only heading with `Evidence Lite`.
- Replaced the development-only explanation with:
  `Deal-linked evidence notes for review and follow-up. Evidence Lite is informational and does not by itself satisfy or waive Investor Shield requirements.`
- Added the explicit separation reminder:
  `Evidence Lite does not replace required Investor Shield evidence.`
- Removed the rendered local-only create workflow from the panel so the activated production UI remains read-only.

## Loading State

- The panel keeps a stable mounted shell.
- `aria-busy` is set while the request is in flight.
- The loading copy is:
  `Loading Evidence Lite records...`
- The focused panel and page integration test prove the loading state appears before the response resolves.

## Empty State

- When the route returns `200` with `[]`, the panel shows:
  `No Evidence Lite records have been added for this deal.`
- The separation reminder remains visible in the empty state.
- The focused panel test and the saved-deal detail integration test both verify the empty state.

## Populated State

- The panel now renders:
  - evidence ID
  - evidence type
  - linked gate
  - status
  - reviewed / not reviewed state
  - note
  - reviewer note only when non-null
  - created and updated timestamps
- The focused populated-state test verifies explicit `MISSING` and `REVIEWED` rendering, `Not reviewed` and `Reviewed` labels, and conditional reviewer-note rendering.
- The saved-deal detail integration test verifies canonical deal-ID wiring into the evidence GET path and populated record rendering on the selected review surface.

## Safe Error State

- The panel now converts failed evidence reads into the user-safe message:
  `Evidence Lite could not be loaded right now. Investor Shield requirements are unchanged.`
- The panel no longer surfaces raw route error codes such as `EVIDENCE_LITE_READ_FAILED`.
- Focused tests verify that stack traces, SQL text, repository text, and token-like content are not surfaced.

## Investor Shield Separation

- The panel copy states that Evidence Lite is informational only.
- The panel does not render gate-passed, blocker-cleared, approved, or requirement-complete wording.
- The local integration test verifies surrounding Investor Summary, Investor Shield, and Operator Command content remain present while Evidence Lite stays separate.
- The rendered production-safe panel is read-only and does not issue POST, PATCH, PUT, or DELETE requests during the local page proof.

## Files Changed

- `app/page.tsx`
- `components/evidence-lite/EvidenceLitePanel.tsx`
- `__tests__/evidence-lite-panel.test.tsx`

## Focused Test Results

- `npm test -- --run __tests__/evidence-lite-panel.test.tsx`
  - passed
  - `1` file
  - `7` tests
- Key focused assertions now cover:
  - production-safe static shell
  - empty state
  - populated state
  - safe error state
  - canonical route helper
  - production-mode mount on the saved-deal detail surface
  - removal of the production guard from `app/page.tsx`

## Pre-Deployment Validation

- `npm run lint`: passed
- `npm run build`: passed
- `npm test`: passed
- Full test totals:
  - `110` test files
  - `1062` tests
  - `1062` passed
  - `0` failed

## Implementation Commit

- Commit: `c2ab59b`
- Message: `feat: activate evidence lite production ui`
- Push target: `origin/main`
- Result: pushed successfully

## Production Deployment

- Deployment ID: `dpl_HEbuDrQd13HgKDbh6Sq1AFed9BXB`
- Project: `brikbybrik-engine/brik-by-brik-engine`
- Deployment URL: `https://brik-by-brik-engine-3p05uu9nv-brikbybrik-engine.vercel.app`
- Production alias: `https://brik-by-brik-engine-chi.vercel.app`
- Additional aliases:
  - `https://brik-by-brik-engine-brikbybrik-engine.vercel.app`
  - `https://brik-by-brik-engine-git-main-brikbybrik-engine.vercel.app`
- Target: `production`
- State: `READY`
- Creation time: `Mon Jun 29 2026 19:54:34 GMT+0800 (Singapore Standard Time)`
- Build log confirmation:
  - Git branch: `main`
  - Git repository: `github.com/elreylake1-ops/Brik-by-Brik`
  - Deployed commit: `c2ab59b`

## Deployment-to-Commit Match

Passed.

- Vercel build logs show:
  `Cloning github.com/elreylake1-ops/Brik-by-Brik (Branch: main, Commit: c2ab59b)`
- The deployed production alias points at deployment `dpl_HEbuDrQd13HgKDbh6Sq1AFed9BXB`.
- The deployed commit matches the implementation commit exactly.

## Live API Pre-Browser Verification

Passed.

Read-only GET checks before browser proof:

- `/api/saved-deals`
  - `200`
  - saved deal count: `1`
  - returned deal ID: `4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863`
- `/api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863`
  - `200`
  - classification: `CONDITIONAL`
  - governance: `MANUAL_REVIEW_REQUIRED`
  - capital protection: `PROTECTED`
  - pipeline: `UNDER_ANALYSIS`
- `/api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/investor-shield-ui`
  - `200`
  - overall status: `BLOCKED`
  - progression: `BLOCKED`
  - `canProgress: false`
  - missing-evidence gates: `10`
- `/api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/investor-summary`
  - `200`
  - route success: `true`
  - deal address matches the controlled QA fixture
- `/api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/tasks`
  - `200`
  - task count: `0`
- `/api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/offers`
  - `200`
  - offer count: `0`
- `/api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/evidence`
  - `200`
  - evidence count: `1`
  - evidence ID: `evidence_9f9a344c-ed1c-4510-bb46-c8d3b88fce96`
  - evidence type: `TITLE_REVIEW`
  - linked gate: `SOLICITOR_REVIEW`
  - status: `MISSING`
  - reviewed: `false`
  - reviewer note: `null`

No `42P01`, `28P01`, or unexpected `500` response was observed in the pre-browser route sweep.

## Live Browser Navigation

Passed.

Playwright navigated the live production alias through the actual user interface:

1. Opened `https://brik-by-brik-engine-chi.vercel.app`
2. Waited for the controlled QA saved deal to appear in the saved-deals table
3. Opened the deal via the visible `View` action in the canonical saved-deal list row
4. Waited for the production Evidence Lite panel to render on the saved-deal detail surface
5. Verified the surrounding Investor Summary, Investor Shield, and Operator Command surfaces remained present

## Populated-State Proof

Passed.

The rendered production page showed:

- controlled deal address:
  `QA Controlled Production Verification Deal - Keep For Live Evidence Lite`
- deal ID:
  `4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863`
- classification:
  `CONDITIONAL`
- governance:
  `MANUAL_REVIEW_REQUIRED`
- capital protection:
  `PROTECTED`
- pipeline:
  `UNDER_ANALYSIS`
- Evidence Lite record title:
  `Controlled QA evidence record`
- evidence ID:
  `evidence_9f9a344c-ed1c-4510-bb46-c8d3b88fce96`
- evidence type:
  `Title review`
- linked gate:
  `Solicitor review`
- status:
  `MISSING`
- reviewed label:
  `Not reviewed`
- controlled note:
  `Controlled QA evidence only; not substantive due diligence evidence. Verified via canonical POST and PATCH.`
- separation copy:
  `Evidence Lite does not replace required Investor Shield evidence.`

No gate-passed, blocker-cleared, approved, or equivalent authoritative approval wording appeared in the rendered Evidence Lite surface.

## Browser Refresh Persistence Proof

Passed.

- After the populated record rendered, a full browser refresh was performed.
- The page reloaded normally.
- The controlled deal row remained available.
- The same deal was reopened through the normal `View` action.
- The same retained evidence ID rendered again:
  `evidence_9f9a344c-ed1c-4510-bb46-c8d3b88fce96`
- The same `MISSING` status, `Not reviewed` state, linked gate, and controlled QA note remained visible.
- No duplicate record appeared.

## Fresh Browser Context Proof

Passed.

- A second fresh Playwright browser context loaded the production alias independently.
- The controlled deal was reopened from the saved-deals list.
- The same retained Evidence Lite record rendered again with the same ID and values.
- This provided server-backed persistence proof independent of the first browser context.

## Mobile Viewport Proof

Passed.

- A mobile-sized browser context rendered the populated production page and Evidence Lite panel.
- Screenshot captured:
  `production-evidence-lite-mobile.png`
- Measured viewport result:
  - `scrollWidth: 417`
  - `innerWidth: 417`
- No horizontal overflow was detected in the captured mobile viewport.

## Empty-State Proof

Passed.

- Browser proof used the live production UI with a controlled route interception for the Evidence Lite GET call only.
- Intercepted response:
  `200` with `[]`
- Verified rendered empty-state copy:
  `No Evidence Lite records have been added for this deal.`
- Verified separation reminder remained visible.
- Screenshot captured:
  `evidence-lite-empty-state.png`
- This screenshot is local mocked-state browser proof, not a production data mutation.

## Safe Error-State Proof

Passed.

- Browser proof used the live production UI with a controlled route interception for the Evidence Lite GET call only.
- Intercepted response:
  `500` with safe route payload
- Verified rendered user-safe message:
  `Evidence Lite could not be loaded right now. Investor Shield requirements are unchanged.`
- Verified the UI did not surface `EVIDENCE_LITE_READ_FAILED`, SQL text, or stack text.
- Screenshot captured:
  `evidence-lite-safe-error-state.png`
- This screenshot is local mocked-state browser proof, not a production data mutation.

## Browser Network Mutation Check

Passed.

- Live browser instrumentation recorded requests during initial load, refresh, and the fresh browser context.
- Observed non-GET / non-HEAD requests: `0`
- No Evidence Lite `POST`, `PATCH`, `PUT`, or `DELETE` request occurred.
- No saved-deal mutation request occurred.
- No task, offer, waiver, override, upload, OCR, AI, or workflow mutation request occurred.
- Browser console error count: `0`

## Investor Shield Separation Reproof

Passed.

- The live browser and live route checks both showed Investor Shield remained `BLOCKED`.
- Missing-evidence gate count remained `10`.
- `canProgress` remained `false`.
- The Evidence Lite record was rendered only as informational review context.
- No Evidence Lite content was shown as satisfying, waiving, or approving an Investor Shield gate.

## Production Before/After Counts

Read-only before/after route checks remained unchanged:

Before browser proof:

- saved deals: `1`
- Evidence Lite records: `1`
- tasks: `0`
- offers: `0`
- Shield overall: `BLOCKED`
- missing-evidence gates: `10`

After browser proof:

- saved deals: `1`
- returned saved deal ID: `4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863`
- Evidence Lite records: `1`
- retained evidence ID unchanged:
  `evidence_9f9a344c-ed1c-4510-bb46-c8d3b88fce96`
- tasks: `0`
- offers: `0`
- Shield overall: `BLOCKED`
- Shield progression: `BLOCKED`
- `canProgress: false`
- missing-evidence gates: `10`
- classification: `CONDITIONAL`
- governance: `MANUAL_REVIEW_REQUIRED`
- capital protection: `PROTECTED`
- pipeline: `UNDER_ANALYSIS`

Additional note:

- A direct workstation reconnect to the pulled production `DATABASE_URL` for auxiliary table count re-query was not available because the connection refused local TCP access.
- Zero-mutation proof therefore relied on:
  - live browser request capture showing no write method
  - unchanged before/after route-level counts and statuses
  - the absence of any runtime control in the activated Evidence Lite panel that could issue a production write

## Screenshot Index

- `production-evidence-lite-populated.png`
  - live production deal opened
  - production Evidence Lite panel visible
  - retained record visible
  - linked gate and `MISSING` status visible
- `production-evidence-lite-after-refresh.png`
  - same record visible again after full browser refresh and normal reopen flow
- `production-evidence-lite-mobile.png`
  - populated live production state in a mobile viewport
  - no horizontal overflow detected
- `evidence-lite-empty-state.png`
  - controlled local mocked browser proof of the empty state on the live UI
- `evidence-lite-safe-error-state.png`
  - controlled local mocked browser proof of the safe error state on the live UI

## Final Validation

Pending final local rerun after this documentation update.

## Explicit Non-Implementation

Confirmed in the implementation step:

- no Evidence Lite POST during validation
- no Evidence Lite PATCH during validation
- no evidence deletion
- no second saved deal
- no saved-deal update
- no persisted Shield initialization
- no authoritative evidence creation
- no risk-flag mutation
- no task or offer mutation
- no waiver or override mutation
- no pipeline movement
- no classification, governance, or capital-protection change
- no database migration
- no environment change
- no Vercel relink
- no Investor Summary / Evidence Pack review page
- no PDF generation
- no AI / OCR / upload / scraping
- no CRM expansion
- no automation
- no role or authentication expansion
- no formula change

## Final Phase 4E Acceptance Matrix

| Requirement                            | Result | Evidence |
| -------------------------------------- | ------ | -------- |
| Evidence Lite visible in production    | Passed | live production browser proof and populated screenshot |
| Development-only guard removed         | Passed | `app/page.tsx` source and focused test |
| Production-safe copy                   | Passed | `EvidenceLitePanel.tsx`, focused test, live browser proof |
| Controlled record displayed            | Passed | live route checks and populated screenshot |
| Record persists after refresh          | Passed | refresh screenshot and retained ID reproof |
| Fresh browser context persistence      | Passed | second browser-context reproof |
| Empty state verified                   | Passed | focused test plus mocked browser screenshot |
| Loading state verified                 | Passed | focused test plus live browser navigation |
| Safe error state verified              | Passed | focused test plus mocked browser screenshot |
| Mobile layout verified                 | Passed | mobile screenshot and equal scroll/inner widths |
| No duplicate evidence                  | Passed | before/after route counts plus browser reproof |
| No production mutation during UI proof | Passed | no non-GET requests observed; counts unchanged |
| Investor Shield remains blocked        | Passed | live route checks and live browser proof |
| Evidence Lite remains informational    | Passed | copy, live browser proof, and Shield separation checks |
| Build passes                           | Passed | `npm run build` |
| Lint passes                            | Passed | `npm run lint` |
| Full suite passes                      | Passed | `npm test` |
| Deployment commit verified             | Passed | Vercel build log commit `c2ab59b` |

## Result

`PHASE 4E EVIDENCE LITE COMPLETE — PRODUCTION UI AND REFRESH PERSISTENCE VERIFIED`

## Recommended Next Step

`Proceed to the approved browser-rendered Investor Summary and Evidence Pack review document. Binary PDF generation remains deferred until visual review approval.`
