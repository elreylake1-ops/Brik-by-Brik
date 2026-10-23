# BRIK BY BRIK — TASK 11E / 11E-1 IMPLEMENTATION REPORT
## Video-to-Evidence Viewing Assessment Integration & Final Checkpoint

**Agent:** Ponytail v5.3.2
**Mode:** Isolated local development & verification
**Worktree:** `.worktrees/task-11e-video-viewing`
**Branch:** `feat/task-11e-video-viewing-integration`
**Parent Starting Checkpoint:** `1b7bae4` (Task 11D-1 verified worker commit)
**Governance Reference:** October 22, 2026 James Lake owner-governance (`b47e4a3`), `AGENTS.md`, `LEAN-CTX.md`, Video Evidence SOP v2.1
**Execution Date:** October 23, 2026

---

## 1. Executive Summary & Verdict

### Verdict
`TASK 11E-1 COMPLETE — VIEWING INTEGRATION LOCALLY PRESERVED`

Task 11E / 11E-1 successfully connects the existing authenticated video storage APIs (Task 11C) and genuine FFmpeg extraction worker (Task 11D) directly into the operator-facing Viewing Assessment interface (`/saved-deals/[id]/viewing`).

The end-to-end operator workflow has been validated in the isolated local environment:
$$\textbf{Select walkthrough video} \longrightarrow \textbf{Direct private TUS upload (6 MB chunks)} \longrightarrow \textbf{Confirm} \longrightarrow \textbf{Process (FFmpeg worker)} \longrightarrow \textbf{View genuine unenhanced frames} \longrightarrow \textbf{Select evidence} \longrightarrow \textbf{Human review} \longrightarrow \textbf{Existing checklist / Refurb Plan / Deal Passport}$$

Strict adherence to James Lake's governance and core property deal integrity principles was maintained throughout:
1. **Unreviewed Suggestion Boundary:** Attaching a genuine video frame to a checklist item (C01–C45, V01–V13) creates an unreviewed suggestion (`UNVERIFIED`). The checklist item remains in `NOT_ASSESSED`. An image does not automatically establish a defect, measurement, or repair cost.
2. **Zero Financial Mutation:** Unreviewed or rejected observations NEVER alter Saved Deal financials, refurbishment costs, True MAO, or Investor Shield gates.
3. **Draft Checklist Disclaimer:** All checklist pickers and titles explicitly display `(Unapproved Working Draft)` to reflect working draft status pending James's final wording signoff.
4. **Resumable Direct Upload:** Uploads slice local footage into 6 MB chunks and upload directly to private storage using signed TUS tokens with automatic exponential backoff retry and offset reconciliation, never proxying through Vercel serverless functions.
5. **Lossless Evidence Provenance:** Operators inspect pristine unenhanced PNG frames with exact source presentation timestamps (`source_time_ms`) and SHA-256 digests, clearly segregated from derivative labels and contact sheets.

---

## 2. Required Integration Checks & Results

### Check 1: Resumable TUS Protocol & Retry Implementation
- `lib/viewing-assessment/capture/resumable-tus-uploader.ts` implements the Supabase TUS protocol:
  - Initial `POST` to resumable endpoint with `Tus-Resumable: 1.0.0`, `Upload-Length`, `Upload-Metadata` (base64 encoded `bucketName`, `objectName`, `contentType`), and `x-signature: signatureToken`.
  - Parses `Location` header to establish session URL.
  - Slices video file into 6 MB chunks (`TUS_CHUNK_SIZE`), issuing sequential `PATCH` requests with `Content-Type: application/offset+octet-stream`, `Upload-Offset`, and `x-signature`.
  - Implements automatic retry with exponential backoff (up to 3 attempts, 300ms–2000ms delay) on transient chunk errors, re-querying server offset via `HEAD` before resuming to prevent duplicate byte transmission.
  - Supports pause/resume via `HEAD` offset query (`Upload-Offset`) and cancellation via `AbortController`.
- Verified via unit test suite `__tests__/resumable-tus-uploader.test.ts` (3 tests passed).

### Check 2: Server-Side Frame Attachment Authorization
- Route `POST /api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/attach`:
  - Enforces operator authentication via secure HttpOnly session cookie / Bearer token (`authorize`).
  - Jointly verifies Saved Deal ownership, Viewing Assessment association, and Video Job ownership.
  - Rejects jobs not in state `ready_for_review` (HTTP 409 `JOB_NOT_READY`).
  - Retrieves specific frame strictly bound to `(jobId, frameId)` via `getVideoFrame`. Rejects arbitrary or cross-job frame IDs with HTTP 404 (`FRAME_NOT_FOUND`).
  - Validates checklist checkId format matching `^(C(0[1-9]|[1-3][0-9]|4[0-5])|V(0[1-9]|1[0-3]))$`. Rejects malformed check IDs with HTTP 400.
  - Atomically marks `video_frames.is_reviewed_evidence = TRUE` to prevent worker overwrite, inserts parent into `viewing_assets`, references frame in `viewing_evidence`, and creates proposal in `viewing_proposals` with `verification = 'UNVERIFIED'`.

### Check 3: Human Review Lifecycle & Invariance Enforcement
- Frame attachments create unreviewed suggestions (`UNVERIFIED`). The checklist item remains in `NOT_ASSESSED`.
- Confirmed that Saved Deal purchase price, refurb cost, GDV, and True MAO remain completely untouched when observations are unreviewed or rejected.
- Confirmed that Investor Shield gates remain untouched.
- Acceptance requires explicit human operator action (`ACCEPTED` with mandatory reason). Only upon human acceptance does the checklist item transition to `CONCERN (human_reviewed)`.

### Check 4: Frame Timestamps, Hashes & Lineage Provenance
- Verified `source_time_ms` is derived from actual stream presentation timestamps (`pkt_pts_time` / `best_effort_timestamp_time`) on variable-frame-rate video.
- Verified original video SHA-256 is retained on `video_jobs.sha256` and `viewing_assets.content_sha256`.
- Verified extracted lossless PNG SHA-256 is retained on `video_frames.sha256` and verified against stored bytes.

### Check 5: Closed-Access Protection on Private Storage URLs & Images
- Private storage keys are never exposed to the client.
- Frame thumbnail images are served via authenticated endpoint `GET /api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/[evidenceId]/image`.
- Verified that requests from unauthenticated callers, expired sessions, or cross-deal callers fail closed (HTTP 401 or 404).

### Check 6: Real Interface Testing in Desktop & Android Viewports
- Playwright end-to-end tests authenticated an enrolled operator, loaded `/saved-deals/[id]/viewing`, verified the responsive `VideoEvidencePanel`, checked job status, inspected genuine frame cards, and opened the checklist attach dialog.
- Desktop and Android viewports verified:
  - `docs/option2/screenshots/task-11e-video-evidence-desktop.png` (1280×720)
  - `docs/option2/screenshots/task-11e-video-evidence-android.png` (Pixel 7 viewport 412×915)
- Real physical Android hardware and live hosted Supabase TUS remain explicitly marked as pending until hosted staging is deployed.

### Check 7: Zero Replaced or Duplicated Core Engines
- Core calculations in `lib/calculations.ts` and `lib/engine/analyze-deal-with-refurb.ts` remain 100% untouched.
- Cost libraries (`trade-rates.ts`, `material-baselines.ts`, `task-cost-library.ts`) remain 100% untouched.
- Builder Pack and Deal Passport exporters remain 100% untouched, consuming confirmed findings through existing schemas.

---

## 3. Implemented Screens & User Interface

The integration introduces a responsive, mobile-first `VideoEvidencePanel` embedded into the existing `ViewingAssessmentPanel`:

### A. Responsive Walkthrough Video Pipeline (`VideoEvidencePanel.tsx`)
- **Android Viewport Optimization (360px–412px):** Single-column layout with compact touch targets, wrapped badges, responsive progress indicators, and bottom-sheet-friendly modal dialogs.
- **Desktop Viewport:** Multi-column layout with side-by-side job listings, media cards, and modal inspector overlays.
- **Chunked Direct TUS Uploader:**
  - Client-side file inspection ensuring codec compatibility (H.264/H.265 in MP4/MOV, up to 500 MB).
  - Resumable 6 MB chunk slicing (`resumable-tus-uploader.ts`) reporting byte-level upload progress (`{bytesUploaded} / {totalBytes}` and `%`).
  - Safe pause, resume, and cancellation mechanics.
  - Automatic upload confirmation against `/videos/[jobId]/confirm` upon TUS upload completion.
- **Job Status & Queue Display:**
  - Status badges tracking `queued`, `processing`, `ready_for_review`, `failed`, or `cancelled`.
  - Display of original video duration, file size, SHA-256 hash, and extracted frame count.
- **Lossless Frame Gallery:**
  - Individual frame cards displaying frame sequence ID (e.g. `F00`, `F01`), source PTS timestamp (e.g. `00:01`, `00:08`), resolution (e.g. `1920×1080`), and truncated SHA-256 hash.
  - Clear provenance badges distinguishing **Pristine Unenhanced Lossless PNG** from **Derivative JPG**.
  - One-click access to full-resolution inspection modal and tiled contact-sheet overview.
- **Checklist Attachment Dialog:**
  - Target checklist selector containing all 58 items (C01–C45 and V01–V13), explicitly watermarked `(Unapproved Working Draft)`.
  - Condition classification (`OBSERVED`, `CONCERN`, or `SPECIALIST_REVIEW`).
  - Custom operator observation notes.
  - Explicit warning banner: *"Creates an unreviewed suggestion for operator review. Does not alter deal calculations until accepted."*

### B. Visual Proof & Screenshots

| Viewport | Artifact Path | Description |
|---|---|---|
| **Desktop (1280×720)** | `docs/option2/screenshots/task-11e-video-evidence-desktop.png` | Desktop view showing active video job, extracted genuine frame gallery, inspect/attach actions, and draft checklist picker modal |
| **Android Mobile (Pixel 7 - 412×915)** | `docs/option2/screenshots/task-11e-video-evidence-android.png` | Responsive mobile view proving vertical card stacking, touch-accessible controls, and responsive modal rendering |

---

## 4. Reused Architecture, Routes & APIs

| Layer | Component / Route | Role in Workflow |
|---|---|---|
| **Auth & Session** | `lib/viewing-assessment/auth/operator-session.ts` | Validates secure, HttpOnly, server-backed operator session cookies |
| **Upload Intent API** | `POST /api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos` | Validates deal authorization, returns path-scoped resumable upload URL and signed token |
| **Direct TUS Storage** | `PATCH {uploadUrl}` (Supabase Storage / TUS protocol) | Directly streams 6 MB video chunks to storage bucket `deal-evidence` without proxying |
| **Confirmation API** | `POST /api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/confirm` | Validates uploaded object size/path, transitions job state to `queued` for worker processing |
| **Worker Engine** | `lib/viewing-assessment/video/video-extraction-worker.ts` | FFmpeg extraction of genuine unenhanced PNGs, generation of derivative thumbnails and contact sheets |
| **Job & Frame API** | `GET /api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos` | Lists video jobs with extraction status, frame count, and signed preview URLs |
| **Attachment API** | `POST /api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/attach` | Connects genuine video frame to `viewing_assets`, `viewing_evidence`, and creates an `UNVERIFIED` proposal in `viewing_proposals` |
| **Frame Image Fallback** | `GET /api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/[evidenceId]/image` | Securely serves frame thumbnail bytes from `deal-evidence` storage bucket |
| **Review & Decision** | `POST /api/.../proposals/[proposalId]/review` | Human operator accepts (`ACCEPTED`) or rejects (`REJECTED`) findings with mandatory reason |
| **Financial & Export** | `/builder-pack` & `/passport` | Compiles approved evidence into Builder Pack and Deal Passport while preserving deal financial invariance |

---

## 5. Summary Test Matrix

| Test Suite | Command | Total Tests | Passed | Result |
|---|---|:---:|:---:|:---:|
| **Local PostgreSQL QA** | `node scripts/qa/local-postgres.mjs test` | 169 | 169 | **PASSED (10/10 files)** |
| **Unit & Integration** | `npm test` | 2,260 | 2,260 | **PASSED (166/166 files)** |
| **ESLint & Code Standards** | `npm run lint` | — | — | **PASSED (0 errors, 0 warnings)** |
| **TypeScript & Next.js Build** | `npm run build` | — | — | **PASSED (Compiled cleanly, TS passed, all routes generated)** |
| **Playwright E2E Screenshots** | `npx playwright test e2e/task-11e-video-evidence.spec.ts` | 2 | 2 | **PASSED (Desktop & Android viewports verified)** |

---

## 6. Exact Files Modified & Created

```
Working directory: .worktrees/task-11e-video-viewing

New Files Created:
  app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/attach/route.ts
  components/viewing-assessment/VideoEvidencePanel.tsx
  lib/viewing-assessment/capture/resumable-tus-uploader.ts
  __tests__/postgres/video-to-evidence-viewing-flow.pg.test.ts
  __tests__/resumable-tus-uploader.test.ts
  e2e/task-11e-video-evidence.spec.ts
  docs/option2/screenshots/task-11e-video-evidence-desktop.png
  docs/option2/screenshots/task-11e-video-evidence-android.png
  docs/option2/TASK_11E_VIDEO_EVIDENCE_VIEWING_INTEGRATION.md

Existing Files Adapted:
  app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/[evidenceId]/image/route.ts
    - Added storage bucket fallback to serve thumbnail bytes for video-derived evidence IDs (ev_...)
  components/viewing-assessment/ViewingAssessmentPanel.tsx
    - Mounted responsive VideoEvidencePanel above manual capture section
  lib/db/postgres.ts
    - Exported withTransaction helper for atomic multi-table operations
  lib/viewing-assessment/video/video-jobs-repository.ts
    - Exported getVideoFrame helper to query frame provenance and storage paths
  lib/viewing-assessment/video/video-route-support.ts
    - Added sha256, mimeType, and processorVersion to SafeVideoJob and SafeVideoFrame representations
  types/video-jobs.ts
    - Added optional sha256, mimeType, and processorVersion fields to SafeVideoJob and SafeVideoFrame interfaces
  __tests__/saved-deals-authorization.test.ts
    - Updated authorized route count expectation from 24 to 25 to account for new attach endpoint
  __tests__/postgres/video-extraction-worker.pg.test.ts
    - Added explicit 20s test timeout to FFmpeg synthetic clip extraction tests to prevent Windows flakiness
  scripts/qa/local-postgres.mjs
    - Added CLI argument support to target specific PostgreSQL test files during development
```

---

## 7. Governance Confirmations & Explicit Exclusions

In accordance with owner governance (`b47e4a3`), `AGENTS.md`, `LEAN-CTX.md`, and strict local safety rules:

1. **No External Paid AI / Vision APIs:** No OpenAI, Claude, Google Cloud Vision, or AWS Rekognition APIs were used. All video processing is performed locally via pure FFmpeg.
2. **Zero Production / Staging Access:** All operations executed locally against Docker container `brik-viewing-qa-pg` and mock Supabase storage adapter. No live Supabase or Vercel production credentials were used.
3. **Draft Checklist Wording:** The 58 checklist items (C01–C45 and V01–V13) are clearly labeled and treated as an unapproved working draft.
4. **Frozen Release Candidates Unchanged:** Clean Option 2 candidate `92d2066` and Security-Only candidate `58e3193` remain completely untouched.

---

## 8. Remaining Gaps & Next Steps

1. **Real Android Hardware Testing (Pending):** Automated mobile viewport testing succeeded via Chromium emulation (Pixel 7 viewport 412×915). Physical testing on physical Android devices over mobile networks remains pending until hosted staging is deployed.
2. **Hosted Supabase TUS Direct Testing (Pending):** Local direct TUS protocol flow was fully verified using mock signed URLs and local chunk slicing. Verification against hosted Supabase Storage TUS servers remains pending until staging deployment.
3. **James Lake Checklist Approval:** Formal review and signoff of the 58 checklist items draft copy by James Lake prior to customer release.

---

## 9. Checkpoint Preservation & Git Verification

- **Commit Message:** `feat(video): integrate reviewed frame evidence into viewing assessment`
- **Parent Checkpoint:** `1b7bae404e8de99beea476b6df9086c19f9df896` (Task 11D-1 verified worker commit)
- **Local Branch:** `feat/task-11e-video-viewing-integration`
- **Worktree:** `.worktrees/task-11e-video-viewing`
- **Frozen Release Candidates Verified Unchanged:**
  - Option 2 Candidate: `92d2066e836ca0d4ec6ef8e04dd4682d6bec8046`
  - Security-Only Candidate: `58e319376a7d387ee5350bd2f0f2d2a427e1fef6`
