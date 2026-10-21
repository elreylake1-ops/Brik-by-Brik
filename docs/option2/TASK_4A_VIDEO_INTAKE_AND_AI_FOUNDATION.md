# Option 2 / Task 4A: video intake and AI processing foundation

Status: implemented and tested locally on `feat/video-assessment-integration`. Uncommitted. No Production, Preview or remote
database was touched. No paid API call was made and no API key exists in this environment.

## 1. What now exists

```
browser (phone)                          server (Next.js route handlers, behind the real access guard)        local QA
---------------                          ---------------------------------------------------------           --------
choose / record video  ─ preview original (never uploaded)
capture frames (960px JPEG, exact timestamps)
save ──► POST  .../evidence                 metadata + frame timestamps ───────────────────────────────────► Postgres (viewing_evidence)
     ──► PUT   .../evidence/:id/image       JPEG bytes ─► policy + checksum ─► private blob store ──────────► tmp dir (QA) / future object store
                                            record ─► viewing_evidence_blobs (immutable; storage key stays server-side)
analyse ──► POST .../analysis-runs          startRun(lease) ─► limits ─► budget ─► frames from private store (checksum re-verified)
                                            ─► provider (fixture | disabled live) under a hard deadline
                                            ─► validateAiProposals ─► completeRun(attempt) + usage ledger row (one transaction)
review  ──► POST .../proposals/:id/review   unchanged from Task 2: accept / edit / reject, append-only, feedback preserved
```

Key files: `components/viewing-assessment/VideoCapture.tsx` (+ `lib/viewing-assessment/capture/*`), `lib/viewing-assessment/storage/*`,
`lib/viewing-assessment/ai/*`, the new image route under `app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/[evidenceId]/image/`,
migration additions in `db/migrations/20261020_task2_viewing_assessment_tables.sql` (applied only to the disposable local database).

## 2. Testing a real video on a real device (before login exists)

The full flow needs login, which does not exist yet (decision D1), so the web UI cannot authenticate in any environment and was not bypassed.
To test an actual clip on an actual handset today there is a client-only page, `/viewing-capture-check`. It makes no API call, reads no data and
saves nothing, so it is not a route around the guard. It is hidden (404) in a deployed environment unless `VIEWING_CAPTURE_CHECK_PAGE=true`.

1. `npm run dev`, open `http://<computer-ip>:3000/viewing-capture-check` on the phone (same network), or enable the flag on a Preview.
2. Choose James's original `IMG_8329_6169.mp4` (and, separately, record a short clip with "Record a video").
3. Confirm: the preview plays; "Capture this frame" produces a thumbnail with the right time; "Sample evenly" gives 12 frames; scrubbing and re-capturing works.
4. Record: device, browser and version, file size and codec if known, and any message shown. An iPhone HEVC clip may show "picture cannot be decoded".

## 3. Authenticated local harness (what was actually run)

`__tests__/contracts/viewing-video-flow.ts` drives the real browser upload code against the real route handlers with the real guard
(test identity plus operator membership), a temporary private blob store, and the fixture provider. It runs against the in-memory repository on
every test run, and against real PostgreSQL with `node scripts/qa/local-postgres.mjs test` (container `brik-viewing-qa-pg`, 127.0.0.1:54339).
It proves: upload, private storage, byte-exact retrieval, simulated analysis, validated UNVERIFIED proposals with merged sources, human review with
the AI prediction preserved beside the correction, denial of anonymous and non-member callers, cross-deal isolation, honest failure on refusal,
and byte-identical finance and Investor Shield output before and after.

## 4. What is simulated, and what is real

| Real and tested | Simulated or fixture-backed |
|---|---|
| Frame capture logic, upload orchestration, retry, error mapping (against a simulated video element and the real route handlers) | The AI findings: a deterministic fixture that never looks at pixels; every result is labelled simulated in the API and the UI |
| Private storage policy, checksums, immutability, isolation, purge, tamper detection | Decoding a real video: not exercised here; needs a human on a device (section 2) |
| Validation, review, feedback, lease, fencing, ledger, budget guard (also on real Postgres) | The live Claude adapter: built and unit-tested against a fake client; never constructed by any running path; has never made a network call |

## 5. Processing: what can run in a request, and what cannot be assumed

- **Fixture analysis** is instant and runs inside the request.
- **A live model call over up to 40 images** has an unmeasured duration (plausibly tens of seconds to a few minutes). Whether a Vercel function can run that long depends on the project's plan and `maxDuration` setting: **unverified**.
- **Not relied on:** running work after the HTTP response (`after()` / `waitUntil`). It is unproven on this deployment, so the route runs the provider call synchronously and records the result before answering.
- **Supported strategies, in order of preference once a live provider is approved:**
  A. *Synchronous within the request* with a route `maxDuration` at the plan maximum and `RUN_LEASE_SECONDS` above it. A call that is cut off leaves a `RUNNING` run that is reclaimed by retrying the same idempotency key after the lease, or by `recoverAbandonedRuns`. Needs: confirmed function duration.
  B. *Message Batches API plus a poller*: about half the token cost, no long request, but a scheduler must invoke `recoverAbandonedRuns` or a poll route. Needs: a scheduler and a machine credential (the guard authenticates people; a cron caller needs its own mechanism, undecided).
  C. *Separate worker host*: new paid infrastructure; not proposed for the allowance.
- **Already built for B and C:** `recoverAbandonedRuns` (lease expiry discovery, provider-matched re-drive, atomic reclaim so exactly one caller wins, fenced completion), and the `listAbandonedRuns` repository operation, both tested on real Postgres.

## 6. Security findings for storage and processing

- No storage key, path or URL reaches a client: the image list is column-restricted, responses are tested for `blob_`/`storage`, and images are served only through an authenticated route that looks the frame up by (deal, assessment, evidence).
- Cross-deal and cross-assessment access is denied at the route and at the database (composite foreign keys). A frame id from another deal cannot read or plant bytes.
- Uploads are validated three times: declared type and size, JPEG magic bytes (a header saying `image/jpeg` over HTML is refused), and a recomputed SHA-256 against any client checksum. Stored frames are immutable; an identical re-upload is a replay; a different image is a 409.
- Served bytes are re-hashed against the recorded checksum; a tampered file returns an integrity error and is never served. A purged file returns 410.
- Same-origin check on state-changing requests (cookie-ready); body-size limits before and after reading; per-assessment caps of 5 clips and 120 frames.
- The local file store refuses to run in a deployed environment (`NODE_ENV=production` or Vercel), refuses a root under `public`, creates files owner-only, never overwrites, and writes atomically. Its default directory is under the git-ignored `.qa-local/`.
- **Original-video retention is explicitly disabled** (`OBJECT_POLICIES.original_video.enabled = false`) with its reason recorded, and the UI says the original stays on the device. Enabling it needs an approved retention policy, a table for original assets, and a provider.
- **Open:** the app has no login yet, so `Authorization` headers are the only credential and `<img src>` cannot load persisted frames in the browser. The UI therefore shows "image stored privately" rather than thumbnails after save; thumbnails of saved frames wait for the login mechanism (decision D1).

## 7. Cost controls (all visible in `lib/viewing-assessment/ai/budget.ts` and `pricing.ts`)

- Paid processing is **off by default**. The live provider is selected only if `VIEWING_AI_PROVIDER=claude`, `VIEWING_AI_ENABLED=true`, an API key is present, `VIEWING_AI_MODEL` has a verified price, and `VIEWING_CHECKLIST_WORDING_APPROVED=true`. Unmet requirements are reported by name, never by value.
- Allowance USD 150: hard stop 120 (prompt/evaluation 40, acceptance 20, contingency 60) plus 30 never spent; at most 25 paid runs per UTC day; at most 40 frames and 16,000 output tokens per run; 120 s deadline. A test asserts the figures stay within 150.
- Before any frame is loaded or sent: model must be priced; worst-case run cost is estimated and checked against recorded spend and the daily cap. Cost is then computed exactly from the provider's reported tokens (integer micro-dollars) and appended to an immutable ledger **in the same transaction** as the run result. A timed-out paid request is accounted at its worst case, not as free. Simulated usage is free by database constraint.
- The price table and the per-frame token assumption are labelled as unverified planning data: re-verify prices and measure real tokens with the free `count_tokens` endpoint before the first paid run.

## 8. Third-party checklist boundary

The Rapley-derived (C01–C45) and unidentified-source (V01–V13) wording lives only in `lib/viewing-assessment/checklist-v1.ts`. It is now used only by the server page (when `VIEWING_CHECKLIST_WORDING_APPROVED=true`) and by the live provider's prompt (same switch). No UI component imports it, so it is not in the client bundle by default, and it is not sent to any service until rights are confirmed.
