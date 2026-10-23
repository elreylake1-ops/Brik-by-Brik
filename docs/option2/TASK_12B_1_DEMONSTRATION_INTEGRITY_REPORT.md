# BRIK BY BRIK ??? TASK 12B-1
## Real Video Demonstration Integrity & Private Evidence Cleanup Report

**Agent:** Ponytail v5.3.2  
**Date:** October 23, 2026  
**Worktree:** `c:\Users\HP ELITE BOOK\Documents\Brik-by-Brik\.worktrees\task-11e-video-viewing`  
**Branch:** `feat/task-11e-video-viewing-integration`  
**Current Checkpoint:** `387d204` (Task 12B commit)  
**Deliverables:**
- `docs/option2/TASK_12B_1_DEMONSTRATION_INTEGRITY_REPORT.md`
- `docs/option2/TASK_12B_REAL_VIDEO_DEMONSTRATION.md` (Updated)
- `__tests__/task-12b-real-video-demonstration.test.ts` (Updated)
- `.gitignore` (Updated)

---

### Completion Verdict

```
TASK 12B-1 COMPLETE ??? EVIDENCE AND DEMONSTRATION INTEGRITY VERIFIED
```

---

## 1. Executive Summary & Verification of Demonstration Segment

### 1.1 Physical File Existence Verification
- **Investigation:** A comprehensive filesystem audit of the repository, worktrees, and `.demonstration-evidence/` vault was conducted to determine whether a 300-second demonstration video segment existed as a separately encoded or losslessly trimmed MP4 file.
- **Finding:** **No separate trimmed or re-encoded 300-second video file exists on disk.**
  - The only physical video file on disk is the full untrimmed recording:
    `C:\Users\HP ELITE BOOK\Downloads\17408-Blue-Jay-SnapYT.App.mp4` (and its local replica in `.demonstration-evidence/17408-Blue-Jay-SnapYT.App.mp4`).
  - Size: `17,566,216 bytes` (~16.75 MB).
  - Exact Duration: `328.144399 seconds` (5 min 28.14s).
  - SHA-256 Digest: `80111ddebc823d52245802733897b9ed10ba4484a8e652785a7e07b079fb3648`.

### 1.2 Classification: Simulated Upload Acceptance
- In `__tests__/task-12b-real-video-demonstration.test.ts`, the pilot upload was executed with:
  ```typescript
  const pilotClipMeta = {
    filename: "17408-Blue-Jay-SnapYT.App.mp4",
    mimeType: "video/mp4",
    sizeBytes: videoBytes.length,
    durationSeconds: 300.0, // Simulated accepted metadata duration
    contentSha256: videoSha256,
  }
  ```
- **Formal Classification:** This verification step represents **simulated upload acceptance**, confirming that the intake endpoint accepts valid metadata within the pilot limit (<= 300s) while having genuinely rejected the raw clip metadata when evaluated at 328.14s (`upload.status === "registration_failed"`).
- **Application Limit Preserved:** The application's 300-second pilot duration limit (`MAX_ALLOWED_DURATION_SEC = 300` in `media-inspector.ts` and `MAX_CLIP_SECONDS = 300` in `capture-limits.ts`) is strictly preserved without modification.

---

## 2. Third-Party Media Git Tracking Removal & Evidence Vaulting

### 2.1 Identification of Tracked Third-Party Frames
The following 7 extracted video frames from `17408-Blue-Jay-SnapYT.App.mp4` were committed in checkpoint `387d204`:
1. `docs/option2/screenshots/task-12b/frame_01_roof_10s.png` (335,112 bytes)
2. `docs/option2/screenshots/task-12b/frame_02_grounds_30s.png` (264,096 bytes)
3. `docs/option2/screenshots/task-12b/frame_03_kitchen_60s.png` (180,458 bytes)
4. `docs/option2/screenshots/task-12b/frame_04_living_120s.png` (184,628 bytes)
5. `docs/option2/screenshots/task-12b/frame_05_hallway_180s.png` (152,679 bytes)
6. `docs/option2/screenshots/task-12b/frame_06_bedroom_patio_240s.png` (165,085 bytes)
7. `docs/option2/screenshots/task-12b/frame_07_bathroom_280s.png` (136,468 bytes)

### 2.2 Removal and Preservation Actions
- **Git Removal:** Removed all 7 files from Git tracking using `git rm -r docs/option2/screenshots/task-12b`.
- **Private Evidence Vaulting:** Preserved all 7 master frames in the designated, Git-ignored private evidence vault:
  `.demonstration-evidence/frames/`
- **Original Media Untouched:** The user's original video in `C:\Users\HP ELITE BOOK\Downloads\17408-Blue-Jay-SnapYT.App.mp4` was accessed strictly read-only and preserved untouched.
- **Git History Integrity:** No shared Git history was rewritten. The removal is cleanly committed as a targeted local corrective commit on branch `feat/task-11e-video-viewing-integration`.
- **Git Protection Rules:** Added `docs/option2/screenshots/` to `.gitignore` to prevent any future accidental commits of extracted frames.

### 2.3 Third-Party Media Commitment
- **Policy:** Genuine third-party video footage, extracted frames, or derivatives must never be committed to Git or published in public documentation without express written permission from property owners.
- **Client Facing Demonstration Requirement:** For external marketing or client-facing investor packs, an authorized property walkthrough must be commissioned on an official Brik-by-Brik pipeline property.

---

## 3. Continuous-Learning Simulation Exclusion

All AI suggestions and recorded outcomes used in this demonstration are confirmed to be strictly isolated:
- **Simulation Stamping:** In `runsRoute.POST`, the fixture provider labels all generated proposals with `analysisSource: "SIMULATED"`.
- **Scope Propagation:** In `refurbPlanRoute.GET`, the proposed refurbishment plan inherits `analysisSource: "SIMULATED"`.
- **Dataset Export Protection:** The continuous-learning export service `exportEvaluationDataset(repo, { includeSimulated: false })` filters out simulated proposals and outcomes by default:
  ```typescript
  const dataset = await exportEvaluationDataset(h.repo as never, {
    dealId: DEAL_ID,
    includeSimulated: false,
  })
  expect(dataset.records).toHaveLength(0) // 0 records exported
  expect(dataset.excludedSimulated).toBeGreaterThanOrEqual(1)
  ```
- **Conclusion:** Synthetic demonstration proposals and outcomes will never contaminate machine-learning continuous-learning training datasets.

---

## 4. Hardware Presentation Timestamp (PTS) Verification & Accuracy

Using `ffprobe -show_entries frame=pts_time,key_frame,pict_type`:

```bash
ffprobe -v error -select_streams v:0 -show_entries frame=pts_time,key_frame,pict_type -of csv .demonstration-evidence/17408-Blue-Jay-SnapYT.App.mp4
```

### 4.1 Frame PTS Inspection Results

| Target Timestamp | Decoded Frame PTS | Frame Pict Type | Nearest Keyframe (I-Frame) | Timing Delta |
| :--- | :--- | :--- | :--- | :--- |
| **10.0s** (Roof/Grounds) | `10.000000s` | P-Frame | `6.000000s` | `0.000s` |
| **60.0s** (Kitchen) | `60.000000s` | I-Frame | `60.000000s` | `0.000s` (Exact Keyframe) |
| **240.0s** (Patio Doors) | `240.000000s` | I-Frame | `240.000000s` | `0.000s` (Exact Keyframe) |

### 4.2 Stream Timing Characteristics & Limitations
- **Stream Structure:** Progressive H.264 stream at 30.00 fps (cadence of `0.033333s` / 33.33ms per packet). Keyframes are inserted every 6.00 seconds (180 frames).
- **Exact I-Frame Alignment:** Both 60.0s and 240.0s coincide exactly with encoded I-frames (PTS 60.000000s and 240.000000s).
- **FFmpeg Input Fast Seek (`-ss <sec> -i <file>`):**
  - Input fast-seeking seeks to the nearest keyframe preceding the timestamp and decodes forward to the requested timestamp.
  - Decoded PNG frames accurately match presentation timestamps without drift.
- **Uncertainty & Limitations:**
  - **Frame Quantization:** Maximum timing uncertainty is ??16.67ms (half of one 33.33ms frame interval).
  - **Variable Frame Rate (VFR) Note:** In mobile recordings where frame durations vary, `selectExtractionTimestamps` derives timestamps directly from probed hardware packet presentation timestamps (`pts_time`), ensuring resilience against timestamp drift.

---

## 5. Delineation of Operational Boundaries

| Operational Area | Operational Nature | Verified Behavior & Scope |
| :--- | :--- | :--- |
| **Media Processing** | **GENUINE** | Real 16.75 MB MP4 inspected via local FFprobe; 9,840 packet PTS probed; lossless PNG frames extracted via FFmpeg with audio stripped (`-an`); JPEG thumbnails scaled and hashed. |
| **Upload Gate Enforcement** | **GENUINE & SIMULATED** | **Genuine:** Clip metadata at 328.14s fails closed (`DURATION_EXCEEDED`).<br>**Simulated:** Pilot registration at 300.0s exercises accepted pilot window without physical trimming. |
| **AI Defect Identification** | **SIMULATED** | Configured to test fixture provider (`complete_flow`). Proposals stamped `SIMULATED` and excluded from continuous learning. |
| **Human Review Workflow** | **TEST-ONLY** | Accept (C41), Amend (C08), and Reject (C01) executed programmatically in Vitest using mock operator identity `james-lake-operator`, not via interactive browser session. |
| **Financial Values & MAO** | **DEMONSTRATION** | Deal figures (??450,000 purchase price, ??750,000 GDV, ??50,000 refurb) are illustrative fixtures to verify financial formula engines. |
| **Security & Multi-Tenancy** | **GENUINE** | Authenticated outsider operator requesting assessment receives HTTP 404; underlying Saved Deal is byte-immutable (`savedDealChanged: false`). |
| **Untested in Demo** | **UNTESTED** | Live cloud vision API calls (Claude / OpenAI / Gemini), client-side browser video trimming, production PostgreSQL database. |

---

## 6. Regression Testing & Verification

The complete regression suite was executed across the viewing assessment and demonstration test suites:

```bash
npx vitest run __tests__/task-12b-real-video-demonstration.test.ts __tests__/checklist-mapping-integrity.test.ts __tests__/task-12a-video-demonstration.test.ts __tests__/task-12-e2e-demonstration.test.ts
```

### Results Summary
- `task-12b-real-video-demonstration.test.ts`: **1 passed** (100% genuine FFprobe/FFmpeg pipeline passing, simulated upload acceptance documented).
- `checklist-mapping-integrity.test.ts`: **4 passed** (C01 roof, C08 external walls, C41 bathroom canonical mappings).
- `task-12a-video-demonstration.test.ts`: **1 passed**.
- `task-12-e2e-demonstration.test.ts`: **1 passed**.
- **Total Test Status:** All 7 integration and regression tests passed cleanly with 0 failures.

---

## 7. Local Git Diff & File Tracking Status

### Tracked Files Modified / Removed:
```
 M .gitignore
 M __tests__/task-12b-real-video-demonstration.test.ts
 M docs/option2/TASK_12B_REAL_VIDEO_DEMONSTRATION.md
 A docs/option2/TASK_12B_1_DEMONSTRATION_INTEGRITY_REPORT.md
 D docs/option2/screenshots/task-12b/frame_01_roof_10s.png
 D docs/option2/screenshots/task-12b/frame_02_grounds_30s.png
 D docs/option2/screenshots/task-12b/frame_03_kitchen_60s.png
 D docs/option2/screenshots/task-12b/frame_04_living_120s.png
 D docs/option2/screenshots/task-12b/frame_05_hallway_180s.png
 D docs/option2/screenshots/task-12b/frame_06_bedroom_patio_240s.png
 D docs/option2/screenshots/task-12b/frame_07_bathroom_280s.png
```

All 7 PNG frames are completely removed from Git tracking while safely preserved in the Git-ignored private evidence folder `.demonstration-evidence/frames/`.
