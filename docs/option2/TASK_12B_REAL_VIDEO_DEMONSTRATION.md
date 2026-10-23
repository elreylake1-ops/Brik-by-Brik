# BRIK BY BRIK ??? TASK 12B
## Real MP4 Local Video Demonstration & Pilot Boundary Verification Report
### (Updated & Corrected under Task 12B-1 Integrity Review)

**Agent:** Ponytail v5.3.2  
**Date:** October 23, 2026  
**Worktree:** `c:\Users\HP ELITE BOOK\Documents\Brik-by-Brik\.worktrees\task-11e-video-viewing`  
**Branch:** `feat/task-11e-video-viewing-integration`  
**Baseline commit:** `6fea920` (Task 12A-1 commit)  
**Integrity Review:** Task 12B-1  
**Deliverables:**
- `docs/option2/TASK_12B_REAL_VIDEO_DEMONSTRATION.md`
- `docs/option2/TASK_12B_1_DEMONSTRATION_INTEGRITY_REPORT.md`  
**Verification Suite:** `__tests__/task-12b-real-video-demonstration.test.ts`  

---

### Completion Verdict

```
TASK 12B-1 COMPLETE ??? EVIDENCE AND DEMONSTRATION INTEGRITY VERIFIED
```

**Executive Integrity Summary:**
1. **Simulated Upload Acceptance Clarification:** The physical video file on disk is `328.14 seconds` (17,566,216 bytes). No trimmed or re-encoded 300-second video file was created on disk. The demonstration test evaluated the pilot limit by passing `{ durationSeconds: 300.0 }` in the upload metadata, representing **simulated upload acceptance** of an accepted duration window. The application's 300-second pilot duration limit (`MAX_ALLOWED_DURATION_SEC = 300` and `MAX_CLIP_SECONDS = 300`) was and remains strictly preserved without modification.
2. **Private Evidence Cleanup & Git Tracking Removal:** All 7 third-party extracted frames previously tracked under `docs/option2/screenshots/task-12b/` have been removed from Git tracking and added to `.gitignore`. They are preserved exclusively in the Git-ignored private evidence vault (`.demonstration-evidence/frames/`). The user's original file in `Downloads` was accessed read-only and preserved untouched.
3. **Continuous-Learning Simulation Exclusion:** All AI proposals and outcomes generated in this demonstration are explicitly stamped `analysisSource: "SIMULATED"`. Calling `exportEvaluationDataset(..., { includeSimulated: false })` returns 0 evaluation records (`excludedSimulated: 1`), guaranteeing synthetic test data never pollutes production continuous-learning datasets.
4. **Presentation Timestamp (PTS) Verification:** Verified stream packet timestamps against decoded frame times. At 60.0s and 240.0s, the video contains exact I-frames (PTS 60.000000s and 240.000000s). At 10.0s, it contains a P-frame (PTS 10.000000s). Frame timing is within the ??16.7ms frame quantization limit of the 30.0 fps progressive stream.

---

## 1. Operational Boundaries & Demonstration Integrity Matrix

To ensure total transparency, the table below explicitly delineates authentic system processing from test-fixture simulations and demonstration placeholders:

| Dimension | Demonstration Status | Technical Details & Boundary |
| :--- | :--- | :--- |
| **Media File Handling** | **GENUINE** | Real 16.75 MB MP4 (`17408-Blue-Jay-SnapYT.App.mp4`) inspected via local FFprobe binary. |
| **Stream PTS Probing** | **GENUINE** | Hardware presentation timestamps extracted from 9,840 video packets (cadence 33.33ms, 30.0 fps). |
| **FFmpeg Frame Extraction** | **GENUINE** | Master PNG frames extracted via FFmpeg with `-an` audio stripping for privacy compliance. |
| **Derivative Scaling & Hashing**| **GENUINE** | Scaled JPEG thumbnails generated via FFmpeg and SHA-256 digests computed on actual bytes. |
| **Private Blob Storage** | **GENUINE** | Frames staged in Git-ignored local filesystem blob store (`.demonstration-evidence/`). |
| **Duration Gate Enforcement** | **GENUINE & SIMULATED** | **Genuine gate enforcement:** 328.14s metadata triggers `DURATION_EXCEEDED` and fails closed.<br>**Simulated acceptance:** Passing `durationSeconds: 300.0` simulates operator submission of an accepted segment without disk re-encoding. |
| **AI Defect Identification** | **SIMULATED** | Set to fixture provider (`VIEWING_AI_PROVIDER="fixture"`). Proposals stamped `SIMULATED` and excluded from continuous learning. |
| **Human Operator Review** | **TEST-ONLY** | Accept (C41), Amend (C08), and Reject (C01) executed programmatically in Vitest under `tok-operator`, not via interactive web UI. |
| **Financial & MAO Values** | **DEMONSTRATION** | Deal figures (??450k purchase, ??750k GDV, ??50k refurb) are illustrative test inputs to exercise formula engines, not surveyor valuations. |
| **Continuous Learning Export** | **GENUINE** | `exportEvaluationDataset` executed genuinely, proving automated exclusion of simulated records. |
| **Untested in Demo** | **UNTESTED** | Live cloud vision LLM calling (no API keys used), client-side browser video trimming, production PostgreSQL persistence. |

---

## 2. Video Source Identification & Cryptographic Provenance

### 2.1 Original File Verification
- **Original File Location:** `C:\Users\HP ELITE BOOK\Downloads\17408-Blue-Jay-SnapYT.App.mp4`
- **Integrity Preservation:** The original file was accessed in read-only mode and preserved untouched (never modified, overwritten, or moved).
- **Private Demonstration Evidence Staging:** Copied to the designated private, Git-ignored evidence vault:
  `.demonstration-evidence/17408-Blue-Jay-SnapYT.App.mp4`
- **File Size:** `17,566,216 bytes` (16.75 MB)
- **SHA-256 Digest:**
  ```
  80111ddebc823d52245802733897b9ed10ba4484a8e652785a7e07b079fb3648
  ```
- **Git Protection:** Verified that `.demonstration-evidence/` and `docs/option2/screenshots/` are strictly ignored by Git.

---

## 3. FFprobe Technical Inspection & Stream Analysis

The local FFprobe binary was executed directly against `17408-Blue-Jay-SnapYT.App.mp4`:

```bash
ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,pix_fmt,duration,r_frame_rate,avg_frame_rate -show_entries format=format_name,duration,size,bit_rate -of json "17408-Blue-Jay-SnapYT.App.mp4"
```

### 3.1 Inspection Results

| Property | Value | Status |
| :--- | :--- | :--- |
| **Container Format** | `mov,mp4,m4a,3gp,3g2,mj2` | **Valid MP4** |
| **Container File Size** | `17,566,216 bytes` (~16.75 MB) | **Well within 250 MB pilot cap** |
| **Container Duration** | `328.144399 seconds` (5m 28.14s) | **Exceeds 300s pilot limit** |
| **Overall Bit Rate** | `428,255 bps` (~428 kb/s) | **Efficient streaming bit rate** |
| **Video Codec** | `h264` (Main Profile, avc1) | **Approved codec** |
| **Video Resolution** | `640 x 360` (16:9 widescreen) | **Within 1080p limit** |
| **Pixel Format** | `yuv420p` (progressive) | **Standard video format** |
| **Video Frame Rate** | `30/1` (30.00 fps) | **Smooth standard rate** |
| **Audio Stream** | `aac` (stereo, 44,100 Hz, 48 kb/s) | **Audio stripped during extraction** |

---

## 4. Pilot Duration Limit & Simulated Upload Acceptance

### 4.1 Pilot Safety Invariants Preserved
The Brik Video-to-Evidence architecture defines strict intake guardrails:
1. `lib/viewing-assessment/video/media-inspector.ts`: `MAX_ALLOWED_DURATION_SEC = 300` (5 minutes)
2. `lib/viewing-assessment/capture-limits.ts`: `MAX_CLIP_SECONDS = 300` (5 minutes)

### 4.2 Gate Behavior & Simulated Upload Acceptance
- **Genuine Fail-Closed Gate Enforcement:**
  When evaluated against `inspectMedia` and `uploadClipFrames` with its real duration of `328.14s`, registration fails closed with HTTP 400:
  ```json
  {
    "valid": false,
    "code": "DURATION_EXCEEDED",
    "message": "Video duration (328.1s) exceeds agreed pilot limit of 300s (5 min)."
  }
  ```
- **Simulated Upload Acceptance:**
  No separate trimmed 300.0s video file was created or encoded on disk. To test the downstream viewing assessment pipeline against an accepted pilot duration, `{ durationSeconds: 300.0 }` was supplied in `pilotClipMeta`. This is classified as **simulated upload acceptance**.
- **No Invariant Modifications:**
  The application's 300-second limit was not modified.

---

## 5. Hardware Presentation Timestamp (PTS) Verification & Accuracy

Stream presentation timestamps were verified using `ffprobe`:

```bash
ffprobe -v error -select_streams v:0 -show_entries packet=pts_time -of csv=p=0 "17408-Blue-Jay-SnapYT.App.mp4"
```

- **Total Packets Probed:** `9,840` video presentation packets.
- **Initial Timestamp:** `0.000000s` (0 ms)
- **Final Timestamp:** `327.966667s` (327,967 ms)
- **Packet Cadence:** Exactly 33.33ms (30.00 fps progressive cadence).

### Decoded Frame PTS vs Target Timestamp

| Target Timestamp | Decoded Frame PTS | Frame Type | Nearest Keyframe (I-Frame) | Timing Delta |
| :--- | :--- | :--- | :--- | :--- |
| **10.0s** (Roof/Grounds) | `10.000000s` | P-Frame | `6.000000s` | `0.000s` |
| **60.0s** (Kitchen) | `60.000000s` | I-Frame | `60.000000s` | `0.000s` (Exact Keyframe) |
| **240.0s** (Patio Doors) | `240.000000s` | I-Frame | `240.000000s` | `0.000s` (Exact Keyframe) |

### Technical Limitations & Uncertainties:
1. **Frame Quantization:** The stream is 30.0 fps (33.33ms per frame). Timestamps are quantized to discrete frame presentation times with maximum timing uncertainty of ??16.67ms (half-frame interval).
2. **FFmpeg Input Fast Seek (`-ss <sec> -i <file>`):** Input fast seek jumps to the preceding keyframe and decodes forward to the target timestamp. Because keyframes occur every 6.0 seconds (e.g. 0s, 6s, 54s, 60s, 234s, 240s), decoding up to 10.0s requires decoding 4 seconds of inter-frames (6.0s to 10.0s).

---

## 6. FFmpeg Frame Extraction & Private Evidence Storage

Using `extractFramePng` and `generateThumbnailJpg`:
- **Audio Stripping Enforced:** Every extraction command includes `-an` to strip the AAC audio stream, protecting privacy in compliance with GDPR.
- **Master Lossless Frames:** Extracted as unenhanced full-fidelity PNGs.
- **Derivative Thumbnails:** Scaled to 640px JPEG thumbnails (`-q:v 3`).
- **Private Evidence Vault:** All extracted frames reside in `.demonstration-evidence/frames/` (Git-ignored). No third-party frames are tracked in Git.

### Extracted Demonstration Frame Catalog

| Frame | Timestamp | Location / Room | Resolution | Master PNG Size | JPEG Thumb Size | SHA-256 Digest (Thumbnail) | Storage Location |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | `10.0s` | Aerial Roof Pitch & Grounds | 640x360 | 335 KB | 38 KB | `3c8d37452d7e...` | `.demonstration-evidence/frames/` |
| **02** | `30.0s` | Paved Driveway & Steps | 640x360 | 264 KB | 32 KB | `8f1e294b0c11...` | `.demonstration-evidence/frames/` |
| **03** | `60.0s` | Kitchen Island & Cabinetry | 640x360 | 180 KB | 24 KB | `a90cd387e21f...` | `.demonstration-evidence/frames/` |
| **04** | `120.0s` | Open Plan Living Room | 640x360 | 184 KB | 25 KB | `542f7c00e6aa...` | `.demonstration-evidence/frames/` |
| **05** | `180.0s` | Reception Hallway & Doors | 640x360 | 152 KB | 21 KB | `d918347fa65e...` | `.demonstration-evidence/frames/` |
| **06** | `240.0s` | Bedroom Sliding Patio Doors | 640x360 | 165 KB | 23 KB | `4f32c02e1189...` | `.demonstration-evidence/frames/` |
| **07** | `280.0s` | Double Vanity Bathroom | 640x360 | 136 KB | 19 KB | `7e108cf59da2...` | `.demonstration-evidence/frames/` |

---

## 7. Viewing Assessment & Canonical Checklist Integration

```
??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
??? Authentic Walkthrough Visual Observation Review                                        ???
??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
??? Check ??? Canonical Checklist Item  ??? AI Proposal  ??? Operator Plan ??? Review Outcome      ???
??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
??? C01   ??? Main roof pitched cover   ??? CONCERN      ??? REJECT        ??? Dismissed (Sound)   ???
??? C08   ??? Ext masonry / render      ??? CONCERN      ??? AMEND (EDIT)  ??? Minor render craze  ???
??? C41   ??? Sanitary appliances       ??? CONCERN      ??? ACCEPT        ??? Partial refresh     ???
??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
```

1. **Item C01 ??? Main roof pitched covering (Frame 01, 10.0s):**
   - Simulated AI proposal: Slipped tiles on main pitch.
   - Operator review: **REJECTED**.
   - Reviewer note: *"Aerial drone footage confirms roof planes and ridge lines are intact and sound. No missing or slipped tiles observed."*
   - Downstream result: Excluded from scope of works (`reason: "REJECTED"`).

2. **Item C08 ??? External masonry and wall finishes (Frame 02, 30.0s):**
   - Simulated AI proposal: Severe structural wall fracture near terrace.
   - Operator review: **AMENDED** (`EDITED`).
   - Operator adjustment: Downgraded to cosmetic hairline render crazing along patio retaining steps; structural substrate sound.
   - Downstream result: Included in proposed scope as `external-walls` (`Facade and masonry repairs`, `UNPRICED`).

3. **Item C41 ??? Sanitary appliances and bath/basin condition (Frame 07, 280.0s):**
   - Simulated AI proposal: Damaged vanity basin seals.
   - Operator review: **ACCEPTED**.
   - Downstream result: Included in proposed scope as `bathroom` (`Bathroom works`, `ENGINE_SCOPE`).

---

## 8. Downstream Business & Financial Outputs

### 8.1 Refurbishment Scope & Schedule of Works
- **Included Items:** `bathroom` (`Bathroom works`), `external-walls` (`Facade and masonry repairs`, `UNPRICED`).
- **Excluded Items:** `roof` (`reason: "REJECTED"`).
- **Schedule of Works:** Generated via pure deterministic calculations in `timeline-engine.ts`.

### 8.2 Brik True MAO Calculations (Demonstration Inputs)
- Acquisition GDV: `??750,000`
- Purchase Price: `??450,000`
- Stamp Duty: `??22,500`
- Holding Costs: `??12,500` (9-month bridge term)
- Target Profit Margin: `20%`
- Output: True MAO calculated and presented as non-authoritative proposal. Underlying Saved Deal remained strictly immutable (`savedDealChanged: false`).

### 8.3 Confidential Builder Pack & Deal Passport
- **Builder Pack (`builder-pack-v2`):** Commercial metrics (GDV, MAO, profit, day rates, and operator name) redacted.
- **Deal Passport:** Generated across Tier 1 (Internal), Tier 2 (Broker), and Tier 3 (Investor).

### 8.4 Continuous Learning Dataset Export
- Evaluation dataset exported via `exportEvaluationDataset(repo, { includeSimulated: false })`:
  - Exactly 0 records exported.
  - Simulated proposals and outcomes excluded by default (`excludedSimulated: 1`).
  - No synthetic data leaks into machine learning training datasets.

---

## 9. Third-Party Media Policy & Commit Protection

1. **No Third-Party Media in Git:** Genuine third-party video footage, extracted frames, or derivatives must never be committed to Git or pushed to shared remotes.
2. **Git-Ignored Vaults:**
   - `.demonstration-evidence/`
   - `private-evidence/`
   - `docs/option2/screenshots/`
3. **Licensing Safeguards:** Commercial use, public marketing distribution, or investor pack publication requires explicit recorded permission from property owners or commissioning of official Brik property surveys.

---

## 10. Summary of Key Files

| File | Purpose | Tracking Status |
| :--- | :--- | :--- |
| `__tests__/task-12b-real-video-demonstration.test.ts` | Automated integration test verifying real video processing and simulated upload acceptance | **Tracked** |
| `docs/option2/TASK_12B_REAL_VIDEO_DEMONSTRATION.md` | Demonstration and pilot boundary report | **Tracked** |
| `docs/option2/TASK_12B_1_DEMONSTRATION_INTEGRITY_REPORT.md` | Task 12B-1 integrity and evidence cleanup report | **Tracked** |
| `.gitignore` | Explicitly ignores `.demonstration-evidence/`, `private-evidence/`, `docs/option2/screenshots/` | **Tracked** |
| `.demonstration-evidence/17408-Blue-Jay-SnapYT.App.mp4` | Staged local MP4 in private vault | **Git-Ignored** |
| `.demonstration-evidence/frames/*.png` | 7 master extracted frames | **Git-Ignored** |
