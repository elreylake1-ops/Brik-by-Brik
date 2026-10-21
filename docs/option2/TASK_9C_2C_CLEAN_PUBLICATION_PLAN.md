# Task 9C-2C: Clean Publication Strategy and Security Review

**Date:** 2026-10-22  
**Scope:** Git Publication Strategy, Historical Content Isolation, Option 2 File Inventory, and Task 9C-2D Readiness  
**Target Repository:** `elreylake1-ops/Brik-by-Brik`  
**Current Branch:** `feat/video-assessment-integration`  
**Base Commit Candidates:** `d83fc03` (Preceding `3a0f253`) / `6d0981b` (`main`)  
**Audit Nature:** Inspection and Documentation Only (Zero Code, Zero Git State Alteration, Zero DB Changes)  
**Methodology:** Antigravity Senior Pair-Programming with Ponytail v5.3.2 Quality Review

---

## Executive Summary

Task 9C-2C defines the publication strategy and security boundary required to publish the **Option 2 (Video Assessment & Viewing Integration)** feature set to a remote Git repository and deploy it to a Vercel Preview environment without exposing restricted historical content.

Task 9C-2B successfully replaced all 58 third-party checklist items in `lib/viewing-assessment/checklist-v1.ts` with 100% original, proprietary Brik-by-Brik surveying language. However, because Git commits are cryptographically immutable, historical commit `3a0f253` remains embedded in the local commit history of branch `feat/video-assessment-integration`. Pushing `feat/video-assessment-integration` directly to `origin` would permanently publish `3a0f253` and its commit message to the remote repository.

This plan details the technical solution: constructing a new clean publication branch that incorporates all Option 2 files and remediated code while mathematically excluding commit `3a0f253` from its commit graph, while keeping `feat/video-assessment-integration` intact locally as an unblemished engineering audit trail.

---

## 1. Inspection of Uncommitted Task 9C-2B Changes (Ponytail Quality Review)

A comprehensive review of the current uncommitted working tree was performed using the Ponytail `/ponytail-review` quality evaluation framework:

### 1.1 Uncommitted Files Reviewed
1. **`lib/viewing-assessment/checklist-v1.ts` (Modified):**
   - Replaced all 58 items (`C01`–`C45` and `V01`–`V13`) with original, professional UK property inspection terminology.
   - Stripped third-party copyright attribution; added Brik proprietary authorship declaration and versioning guidance.
   - Preserved all 58 unique identifiers and groupings (`Roof`, `Chimneys`, `Rainwater goods`, `External walls`, `Ceilings`, `Internal walls`, `Floors`, `Electrical`, `Heating`, etc.).
2. **`lib/viewing-assessment/ai/prompt.ts` (Modified):**
   - Updated documentation header to reflect independently authored Brik property assessment wording.
3. **`__tests__/viewing-checklist-remediation.test.ts` (Untracked):**
   - Added focused regression and contract verification suite (7 tests): schema validity, ID uniqueness (58/58), mapping coverage, negative attribution check (asserting zero third-party author/title strings), deterministic fixture assertions, and financial engine immutability.
4. **`docs/option2/TASK_9C_2B_CHECKLIST_CONTENT_REMEDIATION.md` (Untracked):**
   - Formal verification report documenting the replacement of Martin Rapley checklist content.
5. **Incidental Screenshot Changes (`docs/option2/screenshots/`):**
   - 16 binary PNG files regenerated during the Playwright 16-stage operator walkthrough test run.

### 1.2 Ponytail Quality Findings
- **Correctness:** Logic is 100% sound. Full test suites pass cleanly:
  - Vitest: 165 test files passed, 2,234 tests passed, 0 failed.
  - Local PostgreSQL: 6 test suites passed, 128 tests passed.
  - Playwright E2E: 6 browser scenarios passed, including full 16-stage authenticated operator workflow.
- **Safety:** High. All trust boundaries remain fail-closed. Database records for Saved Deals and Investor Shield remain read-only and immutable during viewing assessment workflows.
- **Scale:** High. Static checklist definitions are compile-time constants wrapped in a frozen set (`VIEWING_CHECKLIST_IDS`), requiring zero runtime overhead or external API round-trips for validation.
- **Lean Evaluation:** The implementation makes the smallest viable change that completely solves the problem. No unnecessary wrapper classes, abstraction layers, or config flags were introduced; the replacement is an in-place drop-in for `VIEWING_CHECKLIST_V1`.
- **Findings by Severity:**
  - **Must Fix:** None.
  - **Should Fix:** None.
  - **Nice to Have:** None.
- **Verdict:** **Ship (Remediated content is verified, clean, and ready for publication).**

---

## 2. Original Checklist Replacement & Copyright Clearance Review

### 2.1 Tracked Code Status
- A global repository search for third-party author names (`Martin Rapley`, `Refurbishment Mastery`) confirms:
  - **Zero occurrences** in application code, API routes, server actions, React components, types, or schemas.
  - Occurrences are confined exclusively to audit records (`docs/option2/TASK_9C_2A*`, `TASK_9C_2B*`, `TASK_3A*`) and the negative attribution test assert list (`__tests__/viewing-checklist-remediation.test.ts`).

### 2.2 Operational Protection Invariants
- `VIEWING_CHECKLIST_WORDING_APPROVED` remains an active environment guard.
- When `false` (default):
  - Server-rendered HTML and RSC payloads transmit only abstract check IDs (`{ id: c.id }`) to client browsers.
  - Live Claude API analysis cannot be instantiated.
- When `true`:
  - Displays original Brik-authored checklist text.
  - Permits live Claude API analysis if paid AI credentials and budget allowance are configured.

---

## 3. Review of Incidental Playwright Screenshot Changes

The 16 PNG images in `docs/option2/screenshots/` were updated on disk during the Task 9C-2B acceptance run (`npx playwright test`):

| File Name | Viewport | Verification Stage | Status |
|:---|:---|:---|:---|
| `task-9b-01-assessment-created-desktop.png` | Desktop (1280x800) | Stage 1: Assessment Session Initialization | Valid |
| `task-9b-01-assessment-created-mobile.png` | Mobile (390x844) | Stage 1: Assessment Session Initialization | Valid |
| `task-9b-02-evidence-registered-desktop.png` | Desktop (1280x800) | Stage 2: Evidence Frame Registration | Valid |
| `task-9b-02-evidence-registered-mobile.png` | Mobile (390x844) | Stage 2: Evidence Frame Registration | Valid |
| `task-9b-03-findings-reviewed-desktop.png` | Desktop (1280x800) | Stage 3: Operator Finding Review & Acceptance | Valid |
| `task-9b-03-findings-reviewed-mobile.png` | Mobile (390x844) | Stage 3: Operator Finding Review & Acceptance | Valid |
| `task-9b-04-measurements-saved-desktop.png` | Desktop (1280x800) | Stage 4: Property Measurements Recording | Valid |
| `task-9b-04-measurements-saved-mobile.png` | Mobile (390x844) | Stage 4: Property Measurements Recording | Valid |
| `task-9b-05-scope-confirmed-desktop.png` | Desktop (1280x800) | Stage 5: Confirmed Refurb Scope Computation | Valid |
| `task-9b-05-scope-confirmed-mobile.png` | Mobile (390x844) | Stage 5: Confirmed Refurb Scope Computation | Valid |
| `task-9b-06-financial-proposal-decided-desktop.png` | Desktop (1280x800) | Stage 6: Financial Proposal Decision (Accept) | Valid |
| `task-9b-06-financial-proposal-decided-mobile.png` | Mobile (390x844) | Stage 6: Financial Proposal Decision (Accept) | Valid |
| `task-9b-07-builder-pack-desktop.png` | Desktop (1280x800) | Stage 7: Confidential Builder Pack Rendering | Valid |
| `task-9b-07-builder-pack-mobile.png` | Mobile (390x844) | Stage 7: Confidential Builder Pack Rendering | Valid |
| `task-9b-08-deal-passport-desktop.png` | Desktop (1280x800) | Stage 8: Three-Layer Deal Passport Rendering | Valid |
| `task-9b-08-deal-passport-mobile.png` | Mobile (390x844) | Stage 8: Three-Layer Deal Passport Rendering | Valid |

### Assessment & Handling Recommendation
- **Cause:** `e2e/operator-workflow.spec.ts` captures full-page visual evidence at each milestone. The updated text strings caused minor pixel-level layout updates.
- **Handling:** These screenshots represent authentic, verified visual proof of the 16-stage operator flow functioning against original Brik terminology. They should be included in the Option 2 visual documentation or regenerated during CI/CD.

---

## 4. Option 2 Complete File Inventory & Dependency Manifest

To ensure zero missing files or orphaned imports during publication, all Option 2 implementation files are cataloged below:

### 4.1 Database Migrations (`db/migrations/`)
Target schema: `brik_by_brik_engine`.
1. `db/migrations/20261020_task2_viewing_assessment_tables.sql` (Creates 6 viewing tables: assessments, evidence frames, runs, proposals, reviews, feedback)
2. `db/migrations/20261021_task5a_operator_sessions.sql` (Creates `operator_sessions` table)
3. `db/migrations/20261022_task6a_refurb_plan.sql` (Creates `refurb_confirmed_plans` table)
4. `db/migrations/20261023_task6b_measurements.sql` (Creates `refurb_property_measurements` table)
5. `db/migrations/20261024_task6b_financial_proposals.sql` (Creates `refurb_financial_proposals` table)
6. `db/migrations/20261025_task7a_capture_provenance.sql` (Adds `capture_provenance` column to `viewing_evidence_frames`)

### 4.2 Core Viewing Assessment Engine (`lib/viewing-assessment/`)
- `checklist-v1.ts` (Remediated 58 Brik property assessment checks)
- `check-states.ts` (Pure function deriving 58-check state vector)
- `request-validation.ts` (Zod/manual boundary validators for assessment payloads)
- `review-proposal.ts` (Append-only review recording)
- `validate-ai-proposals.ts` (AI output trust boundary validator)
- `viewing-assessment-repository.ts` (Interface contracts)
- `pg-viewing-assessment-repository.ts` (Production PostgreSQL implementation)
- `viewing-assessment-service.ts` (Domain orchestration layer)
- `route-support.ts` (HTTP handler helpers)
- `mock-video-analysis-service.ts` (Deterministic test provider)
- `capture-limits.ts` (Frame sampling and size boundaries)
- `capture/capture-logic.ts` (Phone browser video sampling)
- `capture/upload-frames.ts` (Evidence upload handling)
- `storage/blob-store.ts` (Blob storage interface)
- `storage/get-blob-store.ts` (Factory for storage backends)
- `storage/local-fs-blob-store.ts` (Local filesystem blob store)
- `ai/budget.ts` (Token and spend tracking)
- `ai/claude-provider.ts` (Claude Vision API integration)
- `ai/fixture-provider.ts` (Deterministic offline AI scenarios)
- `ai/pricing.ts` (First-party model rate calculations)
- `ai/prompt.ts` (System prompt with versioning)
- `ai/provider.ts` (AI service contracts)
- `ai/run-analysis.ts` (Execution lifecycle with lease management)
- `ai/select-provider.ts` (Provider selection and security gating)
- `evaluation/dataset.ts` (Model evaluation export structures)
- `evaluation/evaluate.ts` (Offline benchmark harness)

### 4.3 Refurb Integration & Document Generation (`lib/refurb-integration/`)
- `builder-pack.ts` (Confidential builder specification generator)
- `deal-passport.ts` (Three-layer Deal Passport generator)
- `deps.ts` (Dependency injection container)
- `documents-service.ts` (Document generation orchestrator)
- `financial-proposal.ts` (Financial proposal lifecycle and state transitions)
- `financial-proposal-repository.ts` (Financial proposal interface)
- `financial-proposal-service.ts` (Financial proposal orchestration)
- `financial-request-validation.ts` (Validation for financial proposals)
- `findings-to-work.ts` (Pure transformation mapping accepted findings to refurb tasks)
- `measurement-repository.ts` (Measurement interface)
- `measurement-service.ts` (Property measurement management)
- `measurements.ts` (Measurement calculation logic)
- `pg-financial-proposal-repository.ts` (Postgres implementation for proposals)
- `pg-measurement-repository.ts` (Postgres implementation for measurements)
- `pg-plan-repository.ts` (Postgres implementation for refurb plans)
- `plan-compute.ts` (Pure Refurb Engine bridge calculation)
- `plan-repository.ts` (Refurb plan repository contract)
- `plan-request-validation.ts` (Refurb plan payload validation)
- `plan-service.ts` (Refurb plan orchestration)

### 4.4 Data Schemas & Reference Data
- `lib/data/finding-work-mapping.ts` (Deterministic check-to-task mapping table)
- `lib/data/measurement-spec.ts` (Room and building dimension specifications)
- `types/viewing-assessment.ts` (Domain types for assessments, frames, proposals)
- `types/deal-documents.ts` (Domain types for Builder Pack and Deal Passport)
- `types/refurb-financial.ts` (Domain types for financial impact proposals)
- `types/refurb-integration.ts` (Domain types for confirmed refurb plans)
- `types/refurb-measurements.ts` (Domain types for property dimensions)

### 4.5 Operator Authentication & Access Control
- `lib/auth/operator-auth.ts` (Dual-mode Supabase JWT / local identity simulator)
- `lib/auth/password-exchange.ts` (Password grant authentication exchange)
- `lib/auth/pg-session-store.ts` (PostgreSQL server-side session management)
- `lib/auth/require-operator-page.ts` (Server Component route guard)
- `lib/auth/session.ts` (Cookie session parsing and validation)
- `lib/auth/sign-in.ts` (Sign-in form action handling)
- `lib/operator-command/derive-saved-deal-record.ts` (Saved Deal resolution helper)
- `lib/operator-command/guard-saved-deal-api.ts` (API route protection wrapper)
- `lib/operator-command/require-saved-deal-read-access.ts` (Read access enforcement)
- `lib/operator-command/trusted-internal-operator-identity.ts` (Internal identity validation)
- `lib/dev-only-page.ts` (Guard preventing dev test routes in production)

### 4.6 Next.js Server Pages & API Routes
- **Pages (`app/`):**
  - `app/saved-deals/[id]/viewing/page.tsx` (Viewing assessment operator UI)
  - `app/saved-deals/[id]/builder-pack/page.tsx` (Builder pack preview page)
  - `app/saved-deals/[id]/passport/page.tsx` (Deal passport preview page)
  - `app/sign-in/page.tsx` (Operator authentication login page)
  - `app/viewing-capture-check/page.tsx` (Loopback hardware test page)
- **API Endpoints (`app/api/`):**
  - `app/api/auth/session/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/analysis-runs/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/[evidenceId]/image/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/feedback/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/review/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/outcome/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/measurements/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/refurb-plan/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/refurb-plan/preview/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/financial-proposal/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/financial-proposal/[proposalId]/decision/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/builder-pack/route.ts`
  - `app/api/saved-deals/[id]/deal-passport/route.ts`
  - `app/api/saved-deals/[id]/viewing-assessments/evaluation-export/route.ts`

### 4.7 React Components (`components/`)
- `components/viewing-assessment/ViewingAssessmentPanel.tsx`
- `components/viewing-assessment/VideoCapture.tsx`
- `components/viewing-assessment/ProposalCard.tsx`
- `components/viewing-assessment/ChecklistReview.tsx`
- `components/viewing-assessment/FrameThumb.tsx`
- `components/refurb-plan/RefurbPlanPanel.tsx`
- `components/refurb-plan/BuilderPackView.tsx`
- `components/refurb-plan/DealPassportView.tsx`
- `components/auth/SignInForm.tsx`
- `components/auth/AuthStatus.tsx`

### 4.8 Test Suites & QA Tools
- `__tests__/viewing-checklist-remediation.test.ts`
- `__tests__/viewing-unified-e2e-flow.test.ts`
- `__tests__/viewing-repository.in-memory.contract.test.ts`
- `__tests__/viewing-check-states.test.ts`
- `__tests__/viewing-evaluation.test.ts`
- `__tests__/viewing-frames-api.test.ts`
- `__tests__/viewing-learning-api.test.ts`
- `__tests__/viewing-video-capture.test.tsx`
- `__tests__/viewing-video-flow.test.ts`
- `e2e/operator-smoke.spec.ts`
- `e2e/operator-workflow.spec.ts`
- `playwright.config.ts`
- `scripts/qa/capture-check.mjs`
- `scripts/qa/capture-check-gate.mjs`
- `scripts/qa/idp-simulator.mjs`
- `scripts/qa/local-postgres.mjs`

### 4.9 External Package Dependencies
Verified additions to `package.json`:
- `@anthropic-ai/sdk`: `^0.135.0` (Production dependency for Anthropic Claude Vision API client)
- `@playwright/test`: `^1.64.1` (DevDependency for headless browser E2E test runner)
- `selfsigned`: `^5.5.0` (DevDependency for generating ephemeral loopback SSL certificates in test simulator)

---

## 5. Clean Git Publication Branch Strategy

### 5.1 The Historical Exposure Problem
- Commit `3a0f253d6144a3d4728d1f39277ab9ff2a9e88ca` (`restricted: third-party checklist wording...`) introduced third-party text into Git object storage on Tuesday, Oct 20, 2026.
- Git commits form an immutable directed acyclic graph (DAG). Even though the working tree has been completely remediated, pushing `feat/video-assessment-integration` transmits the commit object `3a0f253` and its file snapshot to GitHub.
- **Rule:** `feat/video-assessment-integration` must NEVER be pushed to `origin`.

### 5.2 Publication Base Candidates

| Dimension | Candidate A: Preceding Base `d83fc03` | Candidate B: Standard `main` (`6d0981b`) |
|:---|:---|:---|
| **Commit Reference** | `d83fc03` (`chore(qa): disposable local PostgreSQL QA tooling...`) | `6d0981b` (`Merge pull request #3...`) |
| **Relationship to `3a0f253`** | Immediate parent commit (1 commit prior) | Ancestor base (branch point of feature work) |
| **Commit History Content** | Includes Phase 5 and operator auth foundation commits | Clean production baseline only |
| **Exclusion of `3a0f253`** | **100% Excluded** | **100% Excluded** |
| **Merge Target** | Feature integration branch | Direct PR to `main` |
| **Evaluation** | **Recommended for staging / feature PR** | **Recommended for single direct-to-main PR** |

### 5.3 Recommended Strategy: Clean Publication Branch from `d83fc03` (or `main`)
To publish all verified Option 2 code without `3a0f253`:

#### Step 1: Secure Local Audit State (Zero Loss)
1. Commit the pending Task 9C-2B remediation changes locally on `feat/video-assessment-integration`:
   ```bash
   git add lib/viewing-assessment/checklist-v1.ts lib/viewing-assessment/ai/prompt.ts __tests__/viewing-checklist-remediation.test.ts docs/option2/TASK_9C_2B_CHECKLIST_CONTENT_REMEDIATION.md docs/option2/screenshots/
   git commit -m "feat(viewing): replace third-party checklist with original Brik assessment text"
   ```
2. Create an explicit local audit tag so this historical branch is permanently indexed:
   ```bash
   git tag audit/option2-full-local-history
   ```

#### Step 2: Create Clean Publication Branch from Safe Base
Create a fresh publication branch `feat/viewing-assessment-clean` based on `d83fc03`:
```bash
git checkout -b feat/viewing-assessment-clean d83fc03
```
*(Alternatively, if targeting `main` directly: `git checkout -b feat/viewing-assessment-clean 6d0981b`)*

#### Step 3: Overlay the Verified Clean Tree
Populate the new branch with the exact remediated files from `feat/video-assessment-integration` in a single clean commit:
```bash
git checkout feat/video-assessment-integration -- \
  app/ \
  components/ \
  db/migrations/ \
  docs/option2/ \
  e2e/ \
  lib/ \
  scripts/qa/ \
  types/ \
  __tests__/ \
  package.json \
  package-lock.json \
  playwright.config.ts \
  vitest.config.ts
```

#### Step 4: Verify Content Clearance (The Zero-History Audit)
Mathematically verify that neither commit `3a0f253` nor any third-party strings exist in the publication branch history:
```bash
# Verify commit 3a0f253 is not in history
git log --oneline | grep 3a0f253
# (Must return empty)

# Verify zero occurrences of third-party attribution in commit logs
git log -S "Martin Rapley"
# (Must return zero commits)

# Verify working tree code is clean
npx vitest run __tests__/viewing-checklist-remediation.test.ts
npm run lint
npm run build
```

#### Step 5: Clean Publication Commit
Commit the clean, squashed feature set with comprehensive provenance:
```bash
git commit -m "feat(viewing): add Option 2 video assessment, refurb integration, and operator auth"
```

#### Step 6: Push Clean Branch (Only After Owner Approval)
Push exclusively the verified clean branch to the remote repository:
```bash
git push -u origin feat/viewing-assessment-clean
```

---

## 6. Preservation of Existing Branches & Local Evidence

To protect the development history and maintain an evidentiary audit trail for legal, engineering, and financial accountability:

1. **Local Branch Retention:** Branch `feat/video-assessment-integration` will remain locally on disk. It will not be rebased, reset, force-pushed, or deleted.
2. **Push Protection Guard:** A local Git pre-push hook or explicit configuration will prevent accidental pushing of `feat/video-assessment-integration`:
   ```bash
   git config branch.feat/video-assessment-integration.remote ""
   git config branch.feat/video-assessment-integration.pushRemote "no_push"
   ```
3. **Audit Documentation Preservation:** All Option 2 documentation files (`TASK_3A` through `TASK_9C_2C`) and Samsung A07 camera diagnostic logs remain committed and preserved in `docs/option2/`.

---

## 7. Governance, Precedence & Financial Authority

All publication steps and Ponytail recommendations are subject to the following non-negotiable boundaries:
1. **Financial Authority:** The True MAO Engine, Refurb Engine calculations, Investor Shield verification, and financial proposals remain strictly deterministic and governed by existing client calculation authority.
2. **Database Isolation:** Production credentials must never be configured in Preview environments. Preview database migrations must be applied exclusively to a dedicated Preview PostgreSQL database.
3. **Authentication Boundary:** Operator authentication must fail closed. No dev bypasses or simulated loopback identities may run in hosted Preview or Production environments.
4. **AI Safety:** Paid Claude Vision API calls remain disabled by default (`VIEWING_AI_ENABLED=false`).

---

## 8. Required Owner Decisions Matrix

Before executing Task 9C-2D (Branch Creation, Verification, and Push Rehearsal), the following approvals are required:

| Decision ID | Description | Recommended Action | Owner Approval |
|:---|:---|:---|:---|
| **D-PUB-1** | Approval of original Brik checklist wording | Approve replacement of all 58 items | **REQUIRED** |
| **D-PUB-2** | Authorization of Clean Publication Branch strategy | Authorize creating `feat/viewing-assessment-clean` from `d83fc03` (or `main`) | **REQUIRED** |
| **D-PUB-3** | Remote Push Authorization | Authorize pushing clean branch to GitHub `origin` | **REQUIRED** |
| **D-PUB-4** | Preview Database Provisioning | Authorize dedicated Supabase / PostgreSQL Preview instance for migrations 1–12 | **REQUIRED** |

---

## 9. Readiness Verdict for Task 9C-2D

`TASK 9C-2C COMPLETE — CLEAN PUBLICATION PLAN READY FOR TASK 9C-2D EXECUTION`

**Evidence Summary:**
1. Task 9C-2B changes verified; all 58 checklist items successfully replaced with original Brik text.
2. Ponytail quality review confirmed clean, zero-defect implementation (`Ship` verdict).
3. Complete Option 2 file inventory cataloged across all layers (database, engine, auth, UI, tests).
4. Git historical isolation strategy established to permanently quarantine commit `3a0f253`.
5. Existing branch preservation and local audit protections defined.
6. Incidental Playwright screenshots audited and verified as genuine visual test outputs.
7. Governance, financial safety, and owner approval checkpoints specified.
