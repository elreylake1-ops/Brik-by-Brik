# Android phone test: `/viewing-capture-check`

Status: **Samsung Galaxy A07 frame extraction reliability (build `45bd44a`) and visual-comparison quality review (build `7cb6756`) PASSED for Chrome 155 with the genuine 23.941-second MP4 clip. Pixel freshness for fallback frames and live decoder-stall recovery on hardware remain pending / unexercised.**

The page is client-side only: it reads a video from the phone, extracts frames in the browser, and shows size/timing figures. It makes no API calls, stores nothing and uploads nothing.

## What the launcher guarantees (verified on this computer)

`node scripts/qa/capture-check.mjs` was run and checked:

- Listens on `127.0.0.1` only (verified with `netstat`: `127.0.0.1:3400` and `127.0.0.1:3401`). Never `0.0.0.0`; no tunnel.
- The real app runs with every database, API-key and auth variable blanked, so there is nothing to read or write.
- A front door allows only `GET`/`HEAD` of `/viewing-capture-check` and `/_next/static/*`. Everything else returned 404 (`/`, `/api/saved-deals`, `/saved-deals/*`, `/_next/data/*`, path-traversal variants); `POST` returned 405; a wrong `Host` returned 421.
- Page returned 200 with its static assets 200.

## Steps (USB, nothing on the network)

1. On the phone: Settings → About phone → tap Build number 7 times → Developer options → enable **USB debugging**.
2. Install Android platform-tools (`adb`) on the computer. Connect the phone by USB and accept the prompt on the phone.
3. `adb devices` must list the phone as `device`.
4. Stop any previous capture-check process with Ctrl+C. Confirm ports `3400` and `3401` are free. The launcher refuses to start a duplicate.
5. In the project folder run exactly: `node scripts/qa/capture-check.mjs`. It rebuilds only when the Git commit or capture source files changed. Wait for "Capture check is running" and record the printed build commit.
6. In a second terminal run: `adb reverse tcp:3400 tcp:3400`.
7. In Chrome on the phone open `http://localhost:3400/viewing-capture-check`. Reload once after the launcher starts. (`localhost` is treated as a secure context, so no certificate is needed.)
8. Confirm the page shows **Local diagnostic report**. Record the device, Android version, Chrome version and source-video details below.
9. Choose the genuine 23-second viewing video. Set **Frames to sample** to `12`, then select **Sample evenly**.
10. Wait until the extraction outcome is `completed`, `partial` or `failed`. Never treat `captured 1` as completion.
11. Check every thumbnail's requested time, actual time, capture method and confidence. `seeked-canvas` / `seek-timestamp-verified` means the seek position and decoder readiness passed, but pixel freshness was not callback-confirmed.
12. Select **Copy diagnostic report**. Paste it into a local text file or directly into the private task response. If clipboard access fails, tap the report field, select all and copy manually.
13. Review the pasted report before sharing. It must not contain a filename, path, room label, credential, frame image or video data.
14. Preserve the report. Use **Clear diagnostic report** only before another controlled attempt.
15. Repeat twice with the same MP4. Record failed slots, retries, visible slowdown, memory warnings, tab reloads, crashes and overheating.
16. Stop with Ctrl+C. Remove the forward: `adb reverse --remove tcp:3400`.

## Optional: Wi-Fi instead of USB

`node scripts/qa/capture-check.mjs --lan` binds to this computer's private address only (10.x, 172.16-31.x, 192.168.x), still serving only the capture page over plain http. Anyone on that Wi-Fi can open that one page. Use only on a trusted private network. Camera/secure-context features may be limited over plain http; USB is the recommended route.

## Test record

Copy this checklist for each genuine clip. Keep the footage on the phone; the page performs no upload.

- Test date and operator:
- Device manufacturer and model:
- Android version and security-patch level:
- Browser name and exact version:
- Video container/extension (for example MP4):
- Video codec, if shown by the device or a local metadata tool:
- Duration:
- File size:
- Preview decoded successfully: yes / no
- Manual frame capture: requested timestamp / presented timestamp / absolute difference:
- Attempt 1 outcome: status / requested / attempted / captured:
- Attempt 1 frames: requested / actual / absolute difference / method / confidence for all 12 slots:
- Attempt 2 outcome: status / requested / attempted / captured:
- Attempt 2 frames: requested / actual / absolute difference / method / confidence for all 12 slots:
- Attempt 3 outcome: status / requested / attempted / captured:
- Attempt 3 frames: requested / actual / absolute difference / method / confidence for all 12 slots:
- Failed timestamps and exact browser messages:
- Total extraction time:
- Browser memory warning, tab reload, crash, visible slowdown or overheating:
- Thumbnail quality sufficient for human review: yes / no, with reason:
- Result: pass / pass with limitations / fail:

Timestamp accuracy must be checked for all 12 frames. Do not mark this test passed if the video does not decode, any attempt captures fewer than 12 distinct frames, frames silently disappear, or the tab reloads under memory pressure.

## Acceptance and diagnostic decision

Pass only when all three attempts capture 12 distinct frames from the selected clip with explicit `completed` outcomes. A successful retry does not erase the original partial result; record both.

When `requestVideoFrameCallback` is available, the paused-seek fallback gives it a nominal 250 ms grace, then allows one render turn with a 50 ms backup timer. Browsers without that API skip the 250 ms callback grace. Busy or throttled browsers may deliver timers later than this nominal 300 ms budget. The fallback requires a completed seek, decoded-data readiness, valid video dimensions and an actual `currentTime` within 0.5 seconds of the request before attempting canvas extraction. It records lower `seek-timestamp-verified` confidence and never claims callback-confirmed pixel freshness. Do not convert or upload genuine footage. Do not fabricate missing frames.

## Recorded result: Samsung Galaxy A07, build `45bd44a`

Three controlled runs on a Samsung Galaxy A07 in Chrome 155 against build `45bd44a` (Task 7B diagnostics and Task 7C bounded decoder-stall recovery), using the same 23.941-second MP4 (60,431,349 bytes). Earlier runs on the pre-recovery build captured 12/12 once and 9/12 once, with decoder stalls at 8.98, 10.97 and 12.97 seconds; those results are not erased.

| Run | Outcome | Extraction time | Failures | Preview restore |
|---|---|---|---|---|
| 1 | 12/12 completed | 10,343 ms | 0 | succeeded |
| 2 | 12/12 completed | 8,882 ms | 0 | succeeded |
| 3 | 12/12 completed | 9,182 ms | 0 | succeeded |

Observations:

- No `decoder.stall` or `decoder-reload.*` event occurred in any run.
- Every captured frame used the `seeked-canvas` fallback and kept `seek-timestamp-verified` provenance. None was `presented-frame-confirmed`.
- Each run produced 12 unique SHA-256 fingerprints of the encoded JPEGs. Fingerprints matched across the three runs at corresponding timestamps.

Gate status:

| Gate | Status |
|---|---|
| Samsung A07 three-run frame extraction reliability (12/12, three runs, explicit `completed`) | **Passed** for this device, browser, build (`45bd44a`) and clip |
| Visual comparison of captured frames with the original video (Task 7D 12/12 match review) | **Passed** for this device, browser, build (`7cb6756`) and clip (`automaticFrames=12`, `reviewed=12`, `match=12`, `mismatch=0`, `uncertain=0`, `unreviewed=0`, `result=PASS`, `manualFramesExcluded=0`) |
| Pixel-freshness verification | **Pending.** Visual match, tight timestamp alignment (max delta 0.023s), unique fingerprints and cross-run fingerprint agreement are consistent with fresh frames, but do not mathematically prove generalized callback confirmation for fallback captures. |
| Live decoder-stall recovery on a real device | **Not exercised.** Covered by automated tests only. Remains unproven on hardware until a stall occurs and the reload path is observed. |

## Recorded result: Samsung Galaxy A07 visual quality acceptance, build `7cb6756`

Real-device visual QA performed on Samsung Galaxy A07, Chrome 155 against build `7cb6756` (visual comparison controls with pressed styling, status confirmation, and diagnostic telemetry), using the same genuine 23.941-second MP4 (60,431,349 bytes).

Verified review summary:

- `automaticFrames`: 12
- `reviewed`: 12
- `match`: 12
- `mismatch`: 0
- `uncertain`: 0
- `unreviewed`: 0
- `result`: PASS
- `manualFramesExcluded`: 0

Capture provenance and timestamp alignment:

- 2 frames used `video-frame-callback` with `presented-frame-confirmed`.
- 10 frames used `seeked-canvas` with `seek-timestamp-verified`.
- Maximum absolute requested-vs-actual timestamp difference: 0.023 seconds.

Visual review evaluation:

- All 12 automatically sampled frames were compared against the paused source video at their requested timestamps using local in-browser comparison controls.
- Every frame visually matched the source video at that moment in time; no stale frames, lagged frames, or visual discrepancies were observed.
- The Samsung A07 visual-comparison acceptance gate is **PASSED** for this specific build, browser, and test clip.

Retained limitations and boundaries:

- **No other device or browser validation:** Validated solely on Samsung Galaxy A07, Chrome 155. Performance on other Android devices, iOS, or alternative browsers is not established by this test.
- **No real-device decoder-stall recovery observation:** No `decoder.stall` event occurred during this test clip. Recovery logic remains validated by automated unit/integration test suites only and is not proven on physical hardware under live stall conditions.
- **No proof of generalized pixel freshness for fallback captures:** While human visual review confirmed 10/10 `seeked-canvas` frames matched the video, this does not mathematically prove generalized pixel freshness for fallback captures across arbitrary codecs, frame rates, or devices where `requestVideoFrameCallback` is unavailable.
- **No claim of AI accuracy, full video-evidence acceptance, or production readiness:** This milestone confirms only browser frame-extraction reliability and visual fidelity. It makes no claims regarding AI assessment accuracy, end-to-end viewing acceptance, or production deployment readiness.

## Task 7D: Visual evidence quality validation procedure

Task 7D provides a local, in-browser comparison interface on `/viewing-capture-check` (active only in `dryRun && diagnosticMode`). It allows the tester to compare each captured thumbnail directly against the source video paused at the requested timestamp.

### Comparison procedure (per frame)

1. Extract the 12 automatic frames using **Sample evenly**.
2. For each thumbnail card:
   - Note the **requested timestamp** and **actual timestamp** (displayed separately).
   - Tap **Show source at this time**. The source video will pause and seek to the requested timestamp. Wait until the status confirms: `"Source ready at requested ... s. Compare it with the thumbnail."`
   - Compare the source video display with the extracted thumbnail image to ensure the thumbnail represents the requested moment in the footage and is not a stale or blank frame.
   - Select the verdict:
     - **Match**: The thumbnail accurately matches the source video frame at that timestamp. (Disabled until source comparison is successfully ready).
     - **Mismatch**: The thumbnail depicts a different scene or stale frame. A short explanation is mandatory.
     - **Uncertain**: Glare, lighting, motion blur or other ambiguity prevents confident verification. A short explanation is mandatory.
   - If **Mismatch** or **Uncertain** is selected, enter a concise QA reason in the note field (maximum 140 characters). Do not enter addresses, room labels, personal names, links, or filenames. Obvious identifiers and links are automatically redacted.
3. Once all 12 frames are evaluated, inspect the **Visual comparison summary** section below the frames.
4. Select **Copy visual review summary** and paste the result into the QA acceptance record.

### Review grading rules

The summary calculator evaluates the review against the following rules:

- **PASS**: Exactly 12 automatic frames, all 12 source comparisons completed (`ready`), all 12 marked `Match` (0 Mismatch, 0 Uncertain, 0 Unreviewed).
- **CONDITIONAL**: Exactly 12 automatic frames, all comparisons completed, 0 Mismatch, and 1 or 2 frames marked `Uncertain` with documented reasons. Not full acceptance; indicates acceptable edge cases.
- **FAIL**: Any `Mismatch` recorded, or more than 2 `Uncertain` frames, or a source comparison failed/stalled.
- **INCOMPLETE**: Any frame remains unreviewed, a required note is missing, or fewer than 12 automatic frames exist.

### Scope boundaries and non-negotiable rules

- **Local only**: Verdicts and notes remain in component memory; nothing is uploaded, sent to Supabase, or persisted remotely.
- **Automatic frames only**: Any manually captured frames (`Capture this frame`) are excluded from the automatic comparison report and do not count toward the 12-frame acceptance threshold.
- **Provenance preserved**: Human verdicts are local QA observations. A `Match` verdict **never** alters the capture method or confidence, and **never** upgrades `seek-timestamp-verified` frames to `presented-frame-confirmed`.
- **Privacy and redaction**: The summary text explicitly excludes video binary data, images, hashes, file names, room names, and credentials.

Limits of this record:

- It covers one device, one browser version and one clip. It is not evidence for other phones, browsers or videos.
- It is not complete video-evidence acceptance, not production readiness and not evidence of AI-analysis accuracy.
- Fingerprints are diagnostic only. A match or mismatch is never used to accept or reject a frame.
- The restrictions in this document still apply: local-only operation, no upload, no public tunnel, no `0.0.0.0` bind, no exposure of `/api` or private frames, and no deployment, push or merge.

## When to stop

If testing seems to need a public tunnel, a `0.0.0.0` bind, or exposing `/api` or private frames, do not proceed; that is outside this design.
