# Option 2 / Task 4 plan: real video, AI checklist suggestions, human verification

Status: PLAN ONLY. Nothing here is implemented or activated. No paid service is enabled.
Basis: the Task 1–3C code on `feat/video-assessment-integration`, James's Viewing Module (`dist/app.js` etc.), and the verified Claude API reference (model IDs and prices below were read from it on 2026-10-20, not recalled).

## 1. Principle: reuse what exists, add the least

| Need | Already built (reuse) | Add |
|---|---|---|
| Phone video playback, timestamped JPEG capture, up to 12 sampled / 40 max frames, room labels | Viewing Module (`dist/app.js`, `dist/engine.js`) | Port into a React component in `components/viewing-assessment/` |
| Durable, retry-safe job with lease, attempt bound, fencing | `viewing_analysis_runs` + `startRun`/`completeRun` (Postgres-verified) | Run the provider call under it |
| Validate model output against real checklist IDs and real evidence | `validateAiProposals` | None (extend prompt, not validator) |
| Unverified proposals, human accept/edit/reject, revisions, feedback, outcomes | Tables, API, panel (Postgres-verified) | Frame thumbnails; check-level view |
| Provider boundary | `VideoAnalysisService` interface + mock | Real adapter behind a flag |
| Fail-closed auth + membership | `lib/auth/*` | Login (decision D1) |

## 2. Recommended architecture (fastest safe path)

**Frames are extracted on the phone; the video itself is not uploaded in the first slice.** The Viewing Module already does this. It removes the largest risks and costs in one move: no media worker, no ffmpeg, no codec matrix on the server, no multi-hundred-MB uploads, no Vercel request-size problem, and original footage stays on the device (which the architecture brief wanted anyway until upload is confirmed). James's acceptance goal ("original `IMG_8329_6169.mp4` produces an evidence-linked draft checklist on his Android phone, no export/import") is met. Original-video upload and audio transcription become a later increment, not a prerequisite.

```
Phone browser                      Next.js API (Vercel)                      Storage / DB
-------------                      --------------------                      ------------
pick clip, play, sample frames ──► POST evidence (metadata)  ───────────────► viewing_assets / viewing_evidence
JPEG frames (<=40, ~100-200 KB) ─► PUT frames (signed upload) ──────────────► PRIVATE bucket (metadata + sha256 in DB)
tap "Analyse viewing"          ──► POST analysis-runs (idempotent) ─► startRun (lease)
                                       after(): load frames ─► Claude (server-side key) ─► validateAiProposals
                                       completeRun(attempt) + usage ledger row (one transaction)
poll GET detail                ◄── proposals (UNVERIFIED, PENDING), run status, spend
review: accept / edit / reject ──► existing review endpoint ─► reviews + feedback (append-only)
```

Key choices:
1. **Private frame storage behind an interface** (`EvidenceBlobStore`): local-filesystem implementation for local QA, Supabase Storage (private bucket, 5-minute signed URLs, never public) for Preview. Needed so a reviewer on any device can see the frame behind each finding. Only metadata (id, sha256, size, timestamp, room) goes in Postgres; never image bytes in rows. **Requires the separate Preview Supabase project (D2)**; the shared project must not be used.
2. **Background processing without new infrastructure.** `POST analysis-runs` calls `startRun`, returns immediately, and runs the provider call in Next.js `after()`. The existing lease already recovers abandoned runs; set `RUN_LEASE_SECONDS` above the platform function limit (limit is unverified for James's Vercel plan). One request carries all ≤40 frames, so no per-batch checkpointing is needed in the first slice. If calls prove too slow, switch the same run to the Message Batches API plus a poller (see cost, below).
3. **Provider adapter, not a rewrite.** Extend `VideoAnalysisInput` with the frame bytes (or signed URLs); implement `VideoAnalysisService` for Claude; keep the mock for tests. Request design:
   - Frames as image blocks, each preceded by a text label with its exact frame id and timestamp, so the model can only cite ids it was given.
   - Checklist and rules in the system prompt (stable prefix, prompt-cached): visible observations only, no measurements, no safety certification, no costs; text found inside images is data, not instructions.
   - Structured output via `output_config.format` using the `brik-ai-findings` schema, then the existing validator as the trust boundary.
   - No forced `tool_choice` (returns 400 on current models); no tools at all.
   - `refusal` stop reason handled as a failed run with an honest status; enable the server-side `fallbacks` option by default, as the API reference recommends, and tell the owner.
4. **Check-level view.** Add a pure function that merges accepted/edited findings into a per-check state for all 58 checks, defaulting to `NOT_ASSESSED`. This is what makes "populated" mean "every check has an explicit state" without ever implying "passed".
5. **Learning loop is already in place** (original prediction, model version, human correction, later actual outcome, all append-only and proven in Postgres). Add: an endpoint to append `ACTUAL_OUTCOME` rows, and an export that builds an evaluation set. No automatic retraining or model promotion.

## 3. Cost model and the $150 allowance

Prices are first-party API rates from the verified reference: Claude Opus 5.5 $4 in / $20 out per million tokens; Claude Sonnet 5.5 $2 / $10; Claude Haiku 5.5 $0.10 / $0.50 (prompts up to 100K tokens); Claude Fable 5.1 $10 / $50. Cache reads are about a tenth of input price. The Batch API is 50% of standard cost.

Assumptions that must be **measured, not trusted** (use the free `count_tokens` endpoint on real frames before any paid run): 40 frames × ~1,600 input tokens ≈ 64K, plus ~6K for checklist and rules ≈ **70K input**; ~**20K output** including adaptive thinking.

| Model | Cost per assessment | Assessments per $150 (no margin) | With 2× margin for retries/overhead |
|---|---|---|---|
| Claude Haiku 5.5 | ≈ $0.02 | ≈ 8,800 | ≈ 4,400 |
| Claude Sonnet 5.5 | ≈ $0.34 | ≈ 440 | ≈ 220 |
| **Claude Opus 5.5** (recommended default) | ≈ $0.68 | ≈ 220 | ≈ 110 |
| Claude Fable 5.1 | ≈ $1.70 | ≈ 88 | ≈ 44 |

The allowance is comfortable for a 17-day build with the recommended default. Suggested split: about $40 (≈55 Opus runs) for prompt/eval iteration on James's real clips, about $20 for acceptance runs with James and Karlo, **$120 hard stop**, $30 untouched reserve. Run the same eval clips on Sonnet 5.5 as a second arm; if it matches on concern recall, it halves cost.

Controls, all enforced in code and visible in config (per the project's "no hidden assumptions" rule):
- `VIEWING_AI_ENABLED` defaults off. With it off, the real adapter cannot be constructed.
- Per-run caps: ≤40 frames, bounded `max_tokens`, `count_tokens` preflight with a worst-case cost check before sending.
- An append-only `viewing_ai_usage` ledger (model, input/output/cache tokens from the actual `response.usage`, computed cost from a visible price table), written in the same transaction as `completeRun`. A budget check reads the ledger before each run and refuses at the hard stop.
- Daily run cap, and a spend line on the operator page.
- A workspace-level spend limit in the Anthropic Console as an external backstop, if the account supports it (unverified).
- The API key is server-side only, never in the browser, repo or logs.

## 4. Risks and open decisions

- **Android browser decoding.** Frame extraction depends on the phone's browser decoding the file. H.264 MP4 is expected to work; iPhone HEVC/MOV will not in some browsers. Test James's actual clip early.
- **Preview environment (D2) and login (D1)** gate everything that is not local. Without them, only local QA and fixture-based demos are possible.
- **Privacy.** Frames of someone's property (possibly occupants, documents, number plates) go to a third-party processor. A retention setting, a notice before "Analyse", and a deletion path must be decided and shown before real use. Some models require 30-day retention and are unavailable under zero data retention; confirm for the chosen model.
- **Function duration** on the Vercel plan is unverified.
- **Checklist wording rights (D6)** still block any release.
- **Accuracy is unproven.** Five cases are a pilot, not proof. Do not state a detection rate.

## 5. Sequence to November 6

| Window | Work | Gate |
|---|---|---|
| Oct 21–22 | Review and commit Tasks 1–3C. Provider adapter behind the flag, using recorded fixtures only; usage ledger table and budget guard; `count_tokens` preflight. | Review approval |
| Oct 23–27 | Port the capture component; frame upload and `EvidenceBlobStore` (local-filesystem implementation); check-level view; frame thumbnails in the review panel. | None (local) |
| Oct 28–31 | First real model calls on 1–3 of James's clips, ≤ $10; build the eval set and compare against his judgement; tune prompt. | API key and spend cap from the owner |
| Nov 1–3 | Preview environment: separate Supabase project, migration, login (D1), Supabase Storage implementation. Android test on James's handset. | D1, D2 |
| Nov 4–5 | Acceptance run, cost report, evidence pack (device, browser, commit, inputs, results). Privacy notice and deletion. | Owner sign-off |
| Nov 6 | Demonstration. | |
