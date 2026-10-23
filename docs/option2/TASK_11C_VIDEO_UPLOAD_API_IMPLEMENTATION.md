# TASK 11C, 11C-1 & 11C-2 — Secure Video Upload Intent, Confirmation and Job Status APIs
## Implementation, Security Audit, Protocol Verification and Checkpoint Report

**Agent:** Ponytail v5.3.2<br>
**Date:** October 23, 2026<br>
**Worktree:** `.worktrees/task-11c-video-upload-api`<br>
**Branch:** `feat/task-11c-video-upload-api` (derived from Task 11B checkpoint `4ce0c12`)<br>
**Mode:** Isolated local development and verification only<br>
**Production status:** Strictly prohibited (No push, no merge, no Vercel deployment, no hosted Supabase migration)

---

## Executive Summary

Tasks 11C, 11C-1, and 11C-2 deliver, audit, harden, and preserve the minimum authenticated API layer required to upload original property walkthrough videos directly to private Supabase Storage and manage their processing lifecycle under James Lake's Video-to-Evidence architecture (Governance Checkpoint `b47e4a3`).

The system adheres strictly to the following architectural and security invariants:
1. **Decoupled Payload Transfer:** Video binary payloads never proxy through Next.js / Vercel serverless functions.
2. **Path-Bound Scoped Authorization:** Upload tokens issued to clients are path-bound signature tokens tied specifically to `video-evidence/{dealId}/{jobId}/original.{mp4|mov}` in the private `deal-evidence` bucket. Privileged service role keys and database credentials never leave trusted server code.
3. **Supabase Resumable TUS Compliance:** The intent response specifies the exact TUS endpoint, `x-signature` header, minimum 6 MB chunk size, and pre-formatted base64 metadata parameters.
4. **Fail-Closed Confirmation:** Because storage edge nodes verify HMAC tokens without querying live session state during the 15-minute TTL, application security is guaranteed at the confirmation boundary: if an operator session is revoked or unauthorized, `POST .../confirm` fails closed (HTTP 401/403/404), ensuring the video job remains in `upload_pending` and can never be queued or processed.
5. **Zero Financial Mutation:** Saved Deal authoritative values (`purchase_price`, `rehab_cost`, `true_mao`, `capital_protection_state`) are verified unmodified.

All 150 local PostgreSQL tests, ESLint, TypeScript, and Next.js production builds pass cleanly.

---

## TUS Credential Scope & Protocol Verification (Task 11C-2)

### 1. Credential Nature & Scoping
- **Credential Type:** Path-bound signed upload token (`data.token`) generated via Supabase Storage's `createSignedUploadUrl` endpoint with `upsert: false`.
- **Privilege Scope:** Restricted strictly to an HTTP upload of a single object at the predetermined server-generated path. It grants **zero** read access to other deals, **zero** deletion capabilities, and **zero** access to the PostgreSQL database or service-role administrative endpoints.
- **Leakage Prevention:** `SupabaseRestVideoStorageService` contains an explicit runtime guard:
  ```ts
  if (this.serviceKey && token === this.serviceKey) {
    throw new Error("Security violation: privileged service key cannot be used as client upload token")
  }
  ```
  Negative test assertions confirm that neither the `uploadToken` nor `signatureToken` contain database strings or server secrets.

### 2. Client TUS Contract & Header Mapping
When using TUS (e.g. `tus-js-client` or native Android TUS clients), the client configures:
- **Endpoint:** `https://<PROJECT_ID>.storage.supabase.co/storage/v1/upload/resumable`
- **Headers:**
  - `x-signature`: The path-bound upload token (`signatureToken`).
  - `x-upsert`: `"false"` (overwriting existing evidence is prohibited).
- **Metadata:**
  - `bucketName`: `"deal-evidence"`
  - `objectName`: `sourcePath`
  - `contentType`: `contentType`
- **Chunk Size:** `6291456` bytes (6 MB minimum chunk size required by Supabase Storage).

### 3. Fail-Closed Handling of Revoked Operator Sessions
- **Limitation Acknowledged:** Signed upload tokens issued by Supabase Storage are verified cryptographically at the storage edge without real-time database lookups.
- **Enforced Safeguard:** The application prevents unconfirmed or unauthorized uploads from entering the processing pipeline. The confirmation route (`POST .../confirm`) verifies the active operator session against the database. If revoked:
  - `confirm` rejects the request with HTTP 401 (`AUTHENTICATION_REQUIRED` / `REVOKED_SESSION`).
  - The job remains locked in `upload_pending` state.
  - The offline worker only queries jobs with `state = 'queued'`. It will never process, inspect, or extract frames from the orphaned video.
  - The unconfirmed object is safely purged by Task 11B-1 retention policies for abandoned uploads.

---

## Route Specifications

### 1. Upload Intent API
- **Endpoint:** `POST /api/saved-deals/:id/viewing-assessments/:assessmentId/videos`
- **Authentication:** Operator session verified via `auth_token` cookie or Bearer header (`verifyOperatorSession`).
- **CSRF Protection:** Origin / Sec-Fetch-Site validated on state-changing requests.
- **Access Control:** Operator must own or be assigned to the Viewing Assessment and Saved Deal; returns `404 ASSESSMENT_NOT_FOUND` on mismatch to prevent ID enumeration.
- **Input Validation:**
  - MIME type: `video/mp4`, `video/quicktime` (whitelist only).
  - Extension: `.mp4`, `.mov` (whitelist only).
  - Size: 1 byte to 500 MB (`524,288,000` bytes). Rejects invalid or oversized uploads with `400 INVALID_CONTENT_TYPE` or `400 FILE_TOO_LARGE`.
- **Operator Concurrency Limit:** Maximum 3 active (`upload_pending`, `queued`, `processing`) video jobs per operator/viewing. Rejects with `429 ACTIVE_UPLOAD_LIMIT_EXCEEDED`.
- **Duplicate Upload Protection:** Checks for identical filename and byte size in `upload_pending` created within the last 15 minutes; returns existing job intent if still pending.
- **Server Path Binding:** Object path is generated strictly on the server:
  `video-evidence/{dealId}/{jobId}/original.{mp4|mov}`
- **Storage Target:** Private bucket `deal-evidence`. Issues path-bound private signed upload URL / TUS upload token valid for 900 seconds (15 minutes).
- **Initial Job State:** `upload_pending`.

### 2. Video Job Confirmation API
- **Endpoint:** `POST /api/saved-deals/:id/viewing-assessments/:assessmentId/videos/:jobId/confirm`
- **Authentication:** Operator session verified.
- **Access Control:** Verifies deal, viewing, and job lineage.
- **State Transition Guard:** Atomic conditional SQL update (`WHERE state = 'upload_pending'`) only transitions from `upload_pending` to `queued`. Duplicate confirmation calls return `409 ALREADY_CONFIRMED`.
- **Storage Verification (Zero Client Trust):**
  - Calls private Supabase Storage metadata / HEAD endpoint.
  - Verifies object actually exists (`400 STORAGE_OBJECT_NOT_FOUND`).
  - Verifies object byte size matches declared bytes (`400 SIZE_MISMATCH`).
  - Verifies object storage path matches the server-generated path.
- **Result:** Successfully confirmed jobs transition to `queued` ready for background worker pickup.

### 3. Video Job Status API
- **Endpoint:** `GET /api/saved-deals/:id/viewing-assessments/:assessmentId/videos/:jobId`
- **Authentication:** Operator session verified.
- **Access Control:** Verifies deal, viewing, and job lineage.
- **Safe Response:** Returns sanitized `SafeVideoJob` projection:
  - Excludes raw database IDs, internal service tokens, or private bucket credentials.
  - Safe progress indicators (`processedFrames`, `progressPct`, `workerStage`).
  - Frame list with frame indices, room tags, defect tags, and confidence scores.
  - Short-lived signed download URLs (300 seconds) for frames and contact sheets only when status is `ready_for_review` or `processing`.
  - Generic, non-sensitive error messages (`errorMessage`, `errorCode`).

---

## Test Verification Summary

### 1. Dedicated PostgreSQL API Suite (`video-upload-api.pg.test.ts`)
```
 ✓ __tests__/postgres/video-upload-api.pg.test.ts (12 tests) 172ms
   ✓ denies anonymous requests with 401 across all video endpoints
   ✓ denies unapproved operator token with fail-closed 404 (saving deal existence privacy)
   ✓ denies access to wrong deal or wrong viewing assessment
   ✓ denies state-changing POST requests with cross-origin Origin headers
   ✓ rejects oversized bytes, invalid MIME, and malformed container extensions
   ✓ creates upload intent with server-generated path and protects against duplicate pending intents
   ✓ rejects confirmation if storage object is missing or actual byte size mismatches
   ✓ transitions job from upload_pending to queued upon confirmation, and rejects duplicate confirmation
   ✓ enforces cross-deal boundary: Job A cannot be accessed under Deal B
   ✓ returns safe frame metadata and signed URLs when ready_for_review without exposing credentials
   ✓ guarantees Saved Deal financial values, True MAO, and governance state are completely unmodified
   ✓ verifies TUS credential scope, x-signature contract, and enforces fail-closed confirmation if operator session revoked
```

### 2. Full Local PostgreSQL Test Suite
```
 Test Files  8 passed (8)
      Tests  150 passed (150)
   Duration  27.03s
```

### 3. Code Quality & Linting
Run command: `npm run lint`
```
> deal-analyzer@0.1.0 lint
> eslint
Exit code: 0 (Clean, 0 errors, 0 warnings)
```

### 4. Production Next.js Build
Run command: `npm run build`
```
▲ Next.js 16.2.4 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully in 7.4s
  Running TypeScript ...
  Finished TypeScript in 13.5s ...
✓ Generating static pages using 11 workers (8/8) in 272ms
Exit code: 0
```

---

## Tripartite Classification

| Classification | Verification Scope |
|:---|:---|
| **Verified Locally** | • Upload intent creation with standard HTTP & TUS resumable protocols.<br>• Path containment to server-generated path in private bucket.<br>• Atomic confirmation and transition to `queued` state.<br>• Size verification, duplicate detection, and concurrency limit (<= 3).<br>• Fail-closed confirmation on session revocation.<br>• Safe job status projection with expiring signed read URLs.<br>• Zero financial mutations on Saved Deals, True MAO, or Investor Shield.<br>• 150 PostgreSQL tests, TypeScript, ESLint, and Next.js build. |
| **Mocked but Unverified Against Hosted Supabase** | • Live chunk streaming over active cellular connections with disconnect/resume cycles.<br>• Edge node token expiration timing under hosted Supabase Storage. |
| **Blocked by Owner-Controlled Infrastructure** | • Staging/production deployment to hosted Supabase project and Vercel.<br>• Physical Android camera testing with native hardware HEVC encoding and EXIF rotation tags.<br>• Storage completion webhook triggers (pending James Lake approval). |

---

## Baseline & Isolation Assurance

- **Branch:** `feat/task-11c-video-upload-api` in `.worktrees/task-11c-video-upload-api`.
- **Clean Option 2 Candidate (`92d2066`):** Untouched and clean in `.worktrees/clean-publication`.
- **Security Candidate (`58e3193`):** Untouched in `Documents/Brik-by-Brik-security-rc`.
- **Governance Checkpoint (`b47e4a3`):** Strictly respected.

---

## Verdict

`TASK 11C-2 COMPLETE — VIDEO UPLOAD API CHECKPOINT PRESERVED`
