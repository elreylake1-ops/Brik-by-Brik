# Phase 5E-17: Video Acceptance Evidence Pack

## Scope and classification

This pack consolidates accepted local-QA technical evidence. It does not rerun a browser test, change application behaviour, or authorize Production, hosted services, paid AI, or Mode B work.

| Acceptance | Status | Meaning |
|---|---|---|
| Technical video acceptance | **PASS** | Upload -> resumable storage -> confirm -> worker/extraction -> frames -> evidence association -> browser assertions -> normal return was accepted through Phase 5E-14L. Task 11E separately passed with normal terminal return. |
| Defining real-property video acceptance | **NOT YET EXECUTED** | The accepted asset is a synthetic technical fixture. A real property asset with approved provenance has not been supplied or executed. |

## Physical mobile production-mode QA

| Check | Result |
|---|---|
| Device | Samsung A07 / Android 16 |
| Browsers | Chrome: **PASS**; Brave: **PASS** |
| Operator login | **PASS** |
| Viewing, Refurb Plan, Summary, Passport | **PASS** |
| Video picker | **PASS** |
| Port 3002 cleanup | **PASS** |
| Temporary firewall rule removal | **PASS** |
| Final isolated-QA baseline | `42 | 3 | 63 | 81 | 0 | 0` |

This proves physical mobile navigation in the isolated local production-mode QA environment. It does not execute or replace the separate real-property video acceptance.

## A. Test asset identity

| Field | Evidence |
|---|---|
| Fixture | `__tests__/fixtures/synthetic-video.mp4` |
| Media type | MP4 container (`mov,mp4,m4a,3gp,3g2,mj2` as reported by `ffprobe`) |
| Video codec | H.264 |
| Duration | 3.000 seconds |
| Resolution | 320 x 240 |
| Size | 14,265 bytes |
| SHA-256 | `468E7EEC18DB2EE41C3628433B747B36878194B8D15778AC74C87D0F39D6C4B2` |
| Purpose | Deterministic isolated-QA upload, extraction, gallery, and evidence-association fixture |

This proves the technical upload/extraction chain only.
It does not satisfy the final "real property video" acceptance input.

## B-E. Upload, resumable storage, ownership, and confirmation

The accepted Chromium scenario is:

```text
Genuine Chrome video upload, local-fs TUS storage, worker extraction, gallery and frame attachment
```

The scenario creates a per-run deal ID (`deal-local-upload-<random suffix>`) and a new viewing assessment. The historical accepted result did not retain an individual dynamic deal, assessment, or job ID in a repository artifact; this pack does not invent one.

| Step | Accepted evidence | Retained implementation assertion / diagnostic |
|---|---|---|
| Upload intent | POST to the assessment video endpoint succeeds with HTTP 200 or 201 | Captures `intentData.jobId` and `sourcePath`; asserts `intentData.success === true` |
| Resumable upload | Isolated local-fs blob storage with the TUS uploader completes | `VIEWING_BLOB_STORE=local-fs`; test observes the successful intent response |
| Job ownership | Pre-confirm interception queries `video_jobs` by job ID and by `(deal_id, viewing_id, id)` | Requires the dynamic deal ID, assessment ID, and returned job ID to match, with `scopedTripleFound === true` |
| Confirmation | POST to `/confirm` succeeds | Asserts `confirmData.success === true`, `state === "queued"`, and `observedBytes === 14265` |

No database URL, credentials, certificate, token, or secret environment value is recorded here.

## F. Worker and extraction

The scenario invokes the isolated QA video-worker cycle and requires an HTTP 200 worker response with successful extraction. It reloads the browser and renders the frame gallery.

Accepted historical evidence from Phase 5E-14L/14K records:

```text
ready_for_review
5 frames
one reviewed frame
associated proposal evidence
```

The test additionally asserts a successful worker result, at least one extracted frame, and persisted frame dimensions of 320 x 240. The final real-property run must retain its exact worker result and frame count rather than relying on this historical technical-fixture result.

## G. Thumbnail and frame readability

The accepted browser evidence proves the extracted frame gallery rendered in Chrome, including `F00`, timestamps, and the unenhanced-lossless-PNG presentation. The UI renders a thumbnail when a `thumbnailUrl` is supplied.

**EVIDENCE GAP — needs explicit capture in final real-property run.** The retained technical evidence does not include a standalone HTTP/read assertion for a thumbnail URL or a saved response proving each thumbnail read succeeded.

## H. Evidence and proposal association

The accepted scenario opens the F00 attachment modal, submits `Attach as Suggestion`, requires HTTP 201 from `/attach`, observes the attachment message for checklist check `C01`, and queries PostgreSQL to confirm the frame is marked `is_reviewed_evidence = true`.

Phase 5E-14C records that attachment creates an unreviewed proposal and promotes the frame to reviewed evidence. The historical accepted run records associated proposal evidence. Dynamic proposal identifiers were not retained in a repository artifact and are intentionally not reconstructed here.

## I-J. Browser result and normal return

| Item | Accepted result |
|---|---|
| Browser project | Chromium / genuine Chrome |
| Upload scenario | `e2e/local-video-upload-acceptance.spec.ts` filtered to the genuine Chrome upload scenario |
| Technical acceptance | Phase 5E-14L: `1 passed` |
| Task 11E | `1 passed` after alignment to the approved current attachment-modal text |
| Process lifecycle | Both accepted runs returned normally to the terminal; the upload harness closes its owned app process, PostgreSQL pool, and ephemeral identity provider |
| No known product failure | No reproducible `VIDEO_JOB_NOT_FOUND`, upload-route 404, or append-only direct-delete error remains on the accepted path |

## K. Isolated-QA baseline recovery

The upload flow creates append-only evidence lineage. It must not use row-level `DELETE` cleanup for video frames, video jobs, viewing proposals, assessment, or the test deal.

Approved recovery is restoration of the disposable isolated QA endpoint. The harness removes only its random test-owned local media directory and explicitly reports that baseline recovery is required.

| State | Evidence |
|---|---|
| Canonical baseline | `42 | 3 | 63 | 81 | 0 | 0` — assessments, analysis runs, video jobs, video frames, financial proposals, AI usage |
| Prior contaminated state | `43 | 4 | 64 | 86 | 0 | 0` recorded before recovery in Phase 5E-14C |
| Approved recovery | Restore the verified disposable local-QA backup into `brik-viewing-qa-e2e-runtime`; do not manually delete append-only lineage |
| Accepted post-recovery result | Canonical baseline returned exactly to `42 | 3 | 63 | 81 | 0 | 0` |

## Final real-property run checklist

Before final James sign-off, execute one separately approved isolated local-QA run and retain:

1. approved real property video;
2. consent, ownership, and provenance record;
3. file SHA-256;
4. media metadata;
5. upload intent response;
6. resumable-upload completion;
7. exact video job ID;
8. confirm response and state;
9. worker/extraction response;
10. exact frame count;
11. thumbnail and frame-read proof;
12. evidence-linked findings;
13. proposal/attachment association;
14. complete Playwright terminal transcript;
15. normal process return;
16. approved baseline recovery;
17. canonical post-recovery counts: `42 | 3 | 63 | 81 | 0 | 0`.

No real-property media belongs in the repository.

## Decision

**GO** — treat James Priority #3 as technically closed for the synthetic-fixture upload/extraction path.

**NO-GO** — do not treat the defining real-property video acceptance as complete until the separate approved run and checklist above are recorded.

**PHASE 5E-17 COMPLETE — TECHNICAL VIDEO ACCEPTANCE EVIDENCE CONSOLIDATED; REAL-PROPERTY ACCEPTANCE RUN REMAINS PENDING**
