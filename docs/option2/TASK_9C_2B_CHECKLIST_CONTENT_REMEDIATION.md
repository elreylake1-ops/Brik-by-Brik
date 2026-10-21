# Task 9C-2B: Checklist Content Remediation and History Isolation Report

## Executive Summary

Task 9C-2B replaces all 58 checklist items previously adapted from third-party material (Martin Rapley / Refurbishment Mastery 2021) in `lib/viewing-assessment/checklist-v1.ts` with 100% original, independently authored Brik-by-Brik property assessment language.

All functional contracts, stable machine-readable identifiers (`C01`–`C45` and `V01`–`V13`), finding-to-work mapping bindings, database/API schema requirements, and AI safety invariants have been preserved without alteration.

This remediation clears tracked application files of third-party checklist expression. However, because historical commit `3a0f253` introduced third-party wording into the Git tree history of branch `feat/video-assessment-integration`, a clean publication branch strategy is documented and required before pushing or deploying to any public or remote repository.

---

## 1. Inventory and Entries Replaced

All 58 checklist entries in `lib/viewing-assessment/checklist-v1.ts` have been replaced with independent Brik UK property assessment language.

### Structure Replaced
- **Total entries:** 58 (45 core inspection checks + 13 viewing supplement checks).
- **Core inspection range:** `C01` to `C45` (source: `"45-check inspection"`).
- **Viewing supplement range:** `V01` to `V13` (source: `"Viewing supplement"`).
- **Header & provenance:** Replaced historical third-party attribution comment with independent authorship declaration and functional versioning guidance.

### Summary of Replaced Subjects (All 58 Items)
- **Roof (`C01`–`C03`):** Pitched roof coverings, ridge and pitch profile deflection, flat roof membranes and decks.
- **Chimneys (`C04`–`C05`):** Chimney stack verticality, masonry/flaunching/terminal pots.
- **Rainwater goods (`C06`–`C07`):** Gutters/downpipes/drainage fittings, eaves/fascias/soffits/bargeboards.
- **External walls (`C08`–`C10`):** External masonry and wall finishes, mortar pointing, structural movement/cracking/lintel deflection.
- **External glazing and doors (`C11`–`C14`):** Window frames and sash operation, double-glazing sealed unit failure, glazing safety/thermal specification, external entrance doors and locking assemblies.
- **External grounds (`C15`–`C16`):** Paved pathways/steps/driveways (trip hazards/access), ground clearance and damp-proof course elevation.
- **Ceilings (`C17`–`C19`):** Ceiling linings/plaster/deflection, textured coatings (ACMs sampling), fire compartmentation/resistance evidence.
- **Internal walls (`C20`–`C23`):** Partition construction vs structural walls, surface linings/coatings, dampness/salt/mould signs, services impacted by wall removals.
- **Floors (`C24`–`C27`):** Suspended floor spring/bounce, floor surface levels and gradients, floor deck construction and sub-floor access, existing floor coverings retention vs renewal.
- **Internal doors (`C28`–`C29`):** Internal doorsets/linings/ironmongery, fire-rated doorsets/intumescent seals.
- **Wall tiling (`C30`):** Wall tiling adhesion, substrate degradation, and water leakage.
- **Drainage (`C31`–`C32`):** Soil vent stacks and waste pipework, below-ground inspection chambers and gullies.
- **Heating (`C33`–`C36`):** Radiator emitters/valves/corrosion, boiler make/model/flue exit, Gas Safe commissioning/service records, heating system capacity/thermal adequacy.
- **Electrical (`C37`–`C38`):** Consumer unit intake and RCD protection, electrical socket provision and lighting points.
- **Kitchen (`C39`–`C40`):** Cabinet carcass soundness/swelling, worktops/fascias/appliances retention vs strip-out.
- **Bathroom (`C41`–`C42`):** Sanitary appliances condition/chips/cracks, water delivery/flow and mechanical extract.
- **Decoration (`C43`):** Decorative wall/ceiling finishes and surface preparation requirements.
- **Garden (`C44`):** Boundary fences, retaining walls, trees in proximity to foundations, garden waste clearance.
- **General (`C45`):** Miscellaneous layout anomalies, low ceiling heights, space constraints.
- **Services (`V01`–`V02`):** Mains water delivery/pressure testing, sanitary flushing and basic lighting circuits.
- **Connectivity (`V03`):** Mobile cellular signal strength and broadband infrastructure.
- **Security (`V04`):** Ground floor window key locks and intruder alarm operation.
- **Bathroom Supplement (`V05`):** Perimeter silicone sealants, grout lines, and mould inspection.
- **Outside space (`V06`):** Vehicular parking, dropped kerbs, shared rights of way, outdoor amenities.
- **Sale context (`V07`–`V08`):** Marketing history/price reductions/aborted sales, vendor motivation/chain/timetable.
- **Legal information (`V09`–`V10`):** Tenure classification/lease terms/vacant possession, planning permissions and building regulation completion certificates.
- **Property details (`V11`, `V13`):** Property orientation/fixture inventory/council tax, address verification/construction era/gross internal area.
- **Financing (`V12`):** Mortgageability constraints, cash-buyer restrictions, structural defects, lender survey down-valuations.

---

## 2. Functional Contracts Preserved

1. **Identifier Stability:** All 58 identifiers (`C01`–`C45` and `V01`–`V13`) remain intact, uniquely ordered, and match `VIEWING_CHECKLIST_IDS`.
2. **Schema & Typings:** Conforms strictly to `ChecklistItem` type with `id`, `group`, `title`, `prompt`, and `source` (`"45-check inspection"` or `"Viewing supplement"`).
3. **Finding-to-Work Mapping:** `FINDING_WORK_MAPPINGS` in `lib/data/finding-work-mapping.ts` relies on check ID references only (`MAPPED_CHECK_IDS`). All 18 mapped scopes and unpriced repair items resolve without modification.
4. **Drift Guard Integrity:** Wording independence test in `__tests__/refurb-findings-to-work.test.ts` (asserting no checklist wording appears in business mapping labels or quantity notes) passes cleanly.
5. **Deterministic AI Fixtures:** Deterministic provider fixtures in `lib/viewing-assessment/ai/fixture-provider.ts` continue to cite valid check IDs (`C01`, `C08`, `C10`, `C11`, `C41`) and pass all tests.
6. **Financial & Governance Engines:** True MAO, Refurb Engine calculations, and Investor Shield gating remain 100% untouched and deterministic.
7. **AI Safety Configuration:** Paid AI remains disabled by default; `VIEWING_CHECKLIST_WORDING_APPROVED` gate remains functional as an operational guard.

---

## 3. Tests Performed and Verification Results

| Suite / Command | Scope | Result | Details |
|---|---|---|---|
| `npm run lint` | Full workspace ESLint | **PASSED** | 0 errors, 0 warnings (clean). |
| `npm run build` | Next.js 16.2.4 production build | **PASSED** | Optimized production build and static pages compiled in 11.9s. |
| `npm run test` | Full Vitest test suite | **PASSED** | 165 test files passed, 2,234 passed, 129 skipped, 0 failed. |
| `node scripts/qa/local-postgres.mjs test` | Local isolated PostgreSQL suite | **PASSED** | 6 test files passed, 128 tests passed across auth, sessions, viewing repo, and refurb plan. |
| `npx playwright test` | Chromium desktop & mobile browser walkthrough | **PASSED** | 6 tests passed in 26.1s (smoke tests + 16-stage operator walkthrough). |
| `npx vitest run __tests__/viewing-checklist-remediation.test.ts` | Remediation-focused verification | **PASSED** | 7 tests passed (schema, ID uniqueness, mapping resolution, negative attribution test, fixture determinism, financial invariance). |

### TypeScript Diagnostics Note
`npx tsc --noEmit` reports 37 pre-existing diagnostics across legacy test files (`__tests__/investor-summary-mapper.test.ts`, `__tests__/load-pdf-evidence-pack.test.ts`, `__tests__/phase3-orchestration-merge-types.test.ts`, `__tests__/professional-evidence-gateway-source-compatibility.test.ts`, and `__tests__/saved-deal-investor-shield-panel.test.tsx`).
Zero diagnostics exist in `lib/viewing-assessment/checklist-v1.ts` or `__tests__/viewing-checklist-remediation.test.ts`.

---

## 4. Remaining Restricted-Content Risks

- **Current Tracked Files:** 0% third-party content. All tracked application code, schemas, and prompts are original Brik authorship.
- **Audit Documentation:** Documentation files (`TASK_3A`, `TASK_4A`, `TASK_9C_2A`) record historical provenance and the existence of the restricted commit for transparency. These are internal markdown docs.

---

## 5. Git-History Publication Risk

Commit `3a0f253d6144a3d4728d1f39277ab9ff2a9e88ca` (`restricted: third-party checklist wording (DO NOT PUSH until reuse rights are confirmed)`) was committed on branch `feat/video-assessment-integration` on Tue Oct 20 15:57:28 2026 +08:00.

Because Git commit trees are immutable:
- Even though the current working tree is remediated and clean, `3a0f253` remains embedded in the commit ancestry of `feat/video-assessment-integration`.
- Pushing `feat/video-assessment-integration` directly to any public or remote repository would publish commit `3a0f253` in the Git history.
- **Rule Enforced:** No history rewriting, rebase, force-push, or branch reset was performed.

---

## 6. Recommended Clean-Branch Strategy

To eliminate Git-history risk without altering the local audit branch:

1. **Keep `feat/video-assessment-integration` local:** Preserve it as the complete audit trail and working feature branch.
2. **Construct Clean Publication Branch:**
   - Create a clean branch from `d83fc03` (the parent commit immediately preceding `3a0f253`).
   - Export the clean working tree (or squash the verified Option 2 changes onto `d83fc03`) containing the original `checklist-v1.ts`.
   - Alternatively, create a squashed PR commit onto `main` that contains only the finalized, remediated state.
3. **Verify Clean Tree:**
   - Run `git log -S "Martin Rapley" <clean-branch>` to confirm zero occurrences in history.
4. **Publish Only Clean Branch:** Push only the clean branch to remote after explicit owner approval.

---

## 7. Required Owner Decisions

1. **Content Approval:** Confirm acceptance of the original Brik inspection wording in `lib/viewing-assessment/checklist-v1.ts`.
2. **Clean Publication Strategy:** Authorize creating a clean publication branch from base `d83fc03` to exclude `3a0f253` prior to any remote push.
3. **Implementation Commit:** Authorize creating a clean local commit on `feat/video-assessment-integration` for the Task 9C-2B changes.

---

## 8. Final Verdict

`TASK 9C-2B CONTENT REMEDIATION COMPLETE — HISTORY REVIEW REQUIRED`

**Evidence:**
1. All 58 checklist items in `lib/viewing-assessment/checklist-v1.ts` replaced with original Brik assessment text.
2. Functional contracts, IDs (`C01`–`C45`, `V01`–`V13`), and finding-work mappings 100% preserved.
3. Focused remediation test suite (`__tests__/viewing-checklist-remediation.test.ts`) passes (7/7).
4. Full Vitest test suite passes (2,234 passed, 129 skipped, 0 failed).
5. Local PostgreSQL test suite passes (128/128).
6. Playwright browser walkthrough passes (6/6).
7. Production build and lint pass with zero errors.
8. Implementation remains uncommitted for owner review, and commit `3a0f253` remains isolated locally.
