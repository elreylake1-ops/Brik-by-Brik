# BRIK BY BRIK — CONSERVATIVE ACCEPTANCE MATRIX
## SOP v2.1 Requirements Mapping (VT-01 Through VT-14)

**Document Reference:** `docs/option2/preview-readiness/VT01_VT14_ACCEPTANCE_MATRIX.md`  
**Application Checkpoint:** `bddab6390799328b18068e48922963f370c8edbd`  
**Parent Checkpoint:** `1b7bae404e8de99beea476b6df9086c19f9df896`  
**Owner Governance:** October 22, 2026 James Lake approvals (`b47e4a3`)  
**Target Decision Date:** November 6, 2026 Controlled Preview  

---

## 1. Acceptance Taxonomy & Status Categories

To prevent premature claims of completion, requirements are categorized strictly across technical validation tiers:
1. **PASSED LOCALLY (CONTRACT / UNIT TEST):** Logic, database schema, and route contracts verified in isolated local PostgreSQL and Vitest suites.
2. **PASSED LOCALLY (EMULATED VIEWPORT):** Component layout, controls, and DOM responsiveness verified in Chromium browser emulation (Desktop 1280×720 and Pixel 7 412×915).
3. **PARTIAL / FIELD PENDING:** Local implementation and contract tests pass, but physical Android hardware, cellular network transmission, or live hosted cloud verification is required for full acceptance.
4. **PENDING OWNER DECISION / HOSTED PROVISIONING:** Requires external owner verification, written sign-off, or deployment authorization before acceptance can occur.

---

## 2. Acceptance Status Matrix (VT-01 Through VT-14)

| Requirement ID | SOP Description | Conservative Verification Status | Local Evidence & Tests | Outstanding Real-World Validation | Owner Action Required |
|:---:|:---|:---:|:---|:---|:---:|
| **VT-01** | Authenticated Android video upload, 2–5 min, resumable recovery | **PARTIAL — LOCAL CHUNKING PASSED; HARDWARE & HOSTED TUS PENDING** | `resumable-tus-uploader.ts`, `POST /videos`, `POST /confirm`, `resumable-tus-uploader.test.ts` (3 tests) | Physical Android camera upload over 4G/5G; hosted Supabase Storage TUS chunking | Test upload on physical Android device |
| **VT-02** | Deal association, original video SHA-256 and immutability | **PASSED LOCALLY (CONTRACT VERIFIED) — HOSTED DB PENDING** | `video_jobs` constraints, streaming SHA-256 in worker, `video-upload-api.pg.test.ts` (14 tests) | Migration verification on hosted Preview database | None |
| **VT-03** | 20–40 real frames, accurate timestamps and labelled contact sheet | **PASSED LOCALLY (ENGINE VERIFIED) — HOSTED WORKER PENDING** | `video-extraction-worker.ts`, `video-extraction-worker.pg.test.ts` (15 tests: genuine PTS, contact sheet, VFR) | Processing performance verification on target hosted micro-container | Approve worker hosting specification |
| **VT-04** | Mobile thumbnail gallery and authorized full-size frame access | **PARTIAL — BROWSER VIEWPORT PASSED; PHYSICAL ANDROID TOUCH PENDING** | `VideoEvidencePanel.tsx`, `GET /evidence/[id]/image`, Playwright E2E spec (`task-11e-video-evidence.spec.ts`) | Physical Android touchscreen field testing (touch gestures, camera handoff) | Review captured screenshots |
| **VT-05** | Invalid file, duration, codec, size and corruption rejection | **PASSED LOCALLY (ENGINE & ROUTE CONTRACTS)** | `video-extraction-worker.ts`, `video-extraction-worker.pg.test.ts` (codec, duration, resolution, corruption) | None | None |
| **VT-06** | Anonymous, unauthorized and cross-deal access denial | **PASSED LOCALLY (ROUTE GUARDS) — HOSTED IDP PENDING** | `authorize()`, `video-upload-api.pg.test.ts` (14 tests), `video-to-evidence-viewing-flow.pg.test.ts` | Verification against live Supabase Auth project | Provide operator UUID allowlist |
| **VT-07** | Unchanged C01–C45/V01–V13 registry and evidence integration | **PARTIAL — CODE INTEGRATED; OWNER WORDING APPROVAL PENDING** | `checklist-v1.ts`, `POST /attach`, `video-to-evidence-viewing-flow.pg.test.ts` | Formal written approval of rewritten checklist copy by James Lake | Review and approve checklist document |
| **VT-08** | No unsupported hidden-defect diagnosis | **PASSED LOCALLY (SAFETY ARCHITECTURE)** | `attach/route.ts` (sets `verification = 'UNVERIFIED'`, check stays `NOT_ASSESSED`), UI draft banners | None | None |
| **VT-09** | Rejected finding does not change approved costs or MAO | **PASSED LOCALLY (CONTRACT VERIFIED)** | `video-to-evidence-viewing-flow.pg.test.ts` (Step 6 operator rejection verifies deal invariance) | None | None |
| **VT-10** | Accepted priced work uses existing supplier/labour/VAT/contingency pipeline | **PASSED LOCALLY (CONTRACT VERIFIED)** | `plan-service.ts`, `refurb-plan.pg.test.ts` (69 tests), `video-to-evidence-viewing-flow.pg.test.ts` | None | None |
| **VT-11** | Deterministic finance, 15% target and Investor Shield unchanged | **PASSED LOCALLY (REGRESSION VERIFIED)** | `phase-1-mvp-regression.test.ts`, `investor-shield-enforcement-contract.test.ts`, worker invariance tests | None | None |
| **VT-12** | Builder Pack and Deal Passport include approved, attributable evidence | **PASSED LOCALLY (EXPORT CONTRACTS)** | `/builder-pack`, `/passport`, `video-to-evidence-viewing-flow.pg.test.ts` (Step 8) | None | None |
| **VT-13** | Isolated Preview and independent security release; Production unchanged | **PENDING — PRODUCTION SECURITY & HOSTED STAGING UNVERIFIED** | Commit isolation verified (`58e3193` vs `bddab639`); local e2e auth flow rehearsed (17 tests) | Production deployment protection verification; separate security-only authorization; hosted staging provisioning | Verify deployment protection; authorize security release |
| **VT-14** | Actual diff, commit, screenshots, browser demo, test results and costs | **PARTIAL — LOCAL DELIVERABLES COMPLETE; HOSTED DEMO PENDING** | Commit `bddab639`, 169 Postgres tests, 2,260 Vitest tests, Playwright screenshots | Live operator walkthrough demonstration on hosted Preview URL | Authorize Preview deployment |

---

## 3. Explicit Gap Analysis

### A. Real Android Device Hardware Acceptance (Pending)
- **What Was Tested Locally:** Playwright automated test (`e2e/task-11e-video-evidence.spec.ts`) executed on an emulated Pixel 7 viewport (412×915) running headless Chromium.
- **What Remains Pending:**
  1. Testing file upload on physical Android hardware across diverse device manufacturers (Samsung, Google Pixel, Xiaomi).
  2. Operating on real mobile cellular connections (4G/5G) with variable latency, packet loss, and connection interruptions.
  3. Testing mobile browser camera input (`<input type="file" accept="video/*" capture="environment">`) versus gallery selection.
  4. Evaluating mobile battery and memory impact when uploading large video files (up to 500 MB).

### B. Hosted Supabase Storage TUS Chunking (Pending)
- **What Was Tested Locally:** Browser-side client chunking (`resumable-tus-uploader.ts`) was tested via simulated mock fetch endpoints and local file buffers (POST creation, PATCH offsets, HEAD queries).
- **What Remains Pending:**
  1. Verifying compatibility with Supabase's hosted resumable upload server infrastructure.
  2. Testing Supabase's actual 2-hour signed token expiry and up to 24-hour TUS upload URL validity window in live staging.
  3. Confirming that Supabase Storage's `x-signature` validation strictly respects path bounds under real network conditions.

### C. Hosted Worker Container Execution (Pending)
- **What Was Tested Locally:** FFmpeg worker executed locally via Node.js/child process against Docker PostgreSQL container `brik-viewing-qa-pg`.
- **What Remains Pending:**
  1. Deploying the worker to an isolated container runtime (Railway, Render, Fly.io, or AWS Lightsail).
  2. Verifying extraction performance (CPU and memory consumption) on a shared 1 vCPU / 512 MB – 1 GB RAM instance.
  3. Validating lease reclamation (`FOR UPDATE SKIP LOCKED`) across distributed workers in a cloud environment.

### D. Production Deployment Protection & Security Containment (Pending)
- **Current State:** Commit `58e3193` (Security RC1) is frozen locally. Production database connectivity remains disabled.
- **What Remains Pending:**
  1. James Lake must independently verify that Vercel Deployment Protection is active across all production hostnames (`brik-by-brik-engine-chi.vercel.app` and `brik-by-brik-engine.vercel.app`).
  2. Separate written authorization from James Lake is required prior to applying migration `20261021_task5a_operator_sessions.sql` and deploying `58e3193` to Production.
