# BRIK BY BRIK ??? TASK 12C
## Browser-Based Working Demonstration & Evidence Verification Report

**Agent:** Ponytail v5.3.2  
**Date:** October 23, 2026  
**Worktree:** `c:\Users\HP ELITE BOOK\Documents\Brik-by-Brik\.worktrees\task-11e-video-viewing`  
**Branch:** `feat/task-11e-video-viewing-integration`  
**Checkpoint:** `4f87f5d`  
**Host Application:** Next.js 16.2.4 (Turbopack) on `http://localhost:3000`  
**Database:** Disposable local QA PostgreSQL on loopback tmpfs (`127.0.0.1:54339`)  
**Deliverable:** `docs/option2/TASK_12C_BROWSER_DEMONSTRATION_REPORT.md`  

---

### Completion Verdict

```
TASK 12C COMPLETE ??? BROWSER DEMONSTRATION VERIFIED
```

---

## 1. Executive Summary

A complete, live end-to-end browser working demonstration was successfully executed on local Google Chrome against the running application in the isolated development worktree. The demonstration verified:

1. **Local Architecture Isolation:** Run entirely on localhost (Port 3000) using the disposable local QA PostgreSQL container on tmpfs (`127.0.0.1:54339`). No production databases, credentials, or live external endpoints were accessed.
2. **Strict Pilot Duration Compliance & Derivative Clip Creation:** The original 328.14s footage was preserved untouched in `Downloads`. A dedicated, clearly labelled 240.03s derivative MP4 clip (`17408-Blue-Jay-240s-demo-clip.mp4`) was created via lossless FFmpeg stream-copy, strictly respecting the 2???5 minute requirement and preserving the application's 300-second limit.
3. **Genuine Media Processing & Extracted Frames:** Valid 240s clip metadata and authentic extracted frames (10s Roof pitch, 60s Kitchen joinery, 240s Patio sliding doors) were registered into private blob storage and displayed with their respective evidence IDs in the browser UI.
4. **Transparent AI Simulation Labeling:** All visible condition suggestions were prominently badged with the simulated AI banner, confirming that no live cloud vision inference was misrepresented.
5. **Human Review Workflow:** Operator review actions were exercised on the canonical checklist:
   - **C41 (Sanitary appliances):** **ACCEPTED** for partial refurbishment.
   - **C08 (External walls render):** **AMENDED** to minor cosmetic hairline render crazing near patio steps.
   - **C01 (Main roof pitch):** **REJECTED** based on drone inspection confirming sound roof planes.
6. **Downstream Refurbishment & Financial Engine:**
   - Scope of works generated: `bathroom` (Engine Scope) and `external-walls` (Unpriced); `roof` excluded (`REJECTED`).
   - Verified physical measurements recorded: 4 bedrooms, 3 bathrooms, 240 sqm gross internal area.
   - Schedule of Works and Brik True MAO calculated (20% target margin) and confirmed by operator without mutating the underlying Saved Deal.
7. **Document & Passport Generation:**
   - **Confidential Builder Pack (`/builder-pack`):** Successfully rendered with contractor-facing scope; all commercial rates, GDV, and MAO strictly redacted.
   - **Three-Layer Deal Passport (`/passport`):** Rendered with Tier 1 (Internal Analysis), Tier 2 (Broker Loan Security), and Tier 3 (Investor Pack).
   - **Investor Summary (`/summary`):** Rendered with complete deal formulation and visual observations.
8. **Private Evidence & Git Hygiene:** Full-page screenshots captured and stored in `.demonstration-evidence/screenshots/` (Git-ignored). The local branch history was audited for publication safety.

---

## 2. Derivative Clip Provenance & Video Integrity

In accordance with Actions 4 & 5, the original video was preserved untouched, and an authentic derivative test clip was produced:

| Attribute | Original Source Footage | Derivative Demonstration Clip |
| :--- | :--- | :--- |
| **Filename** | `17408-Blue-Jay-SnapYT.App.mp4` | `17408-Blue-Jay-240s-demo-clip.mp4` |
| **Location** | `C:\Users\HP ELITE BOOK\Downloads\` | `.demonstration-evidence/` (Git-ignored) |
| **Container / Codec** | MP4 (`mov,mp4,m4a`) / H.264 (avc1) | MP4 / H.264 (avc1) |
| **Audio Stream** | AAC stereo (44.1 kHz, 48 kb/s) | AAC stereo (44.1 kHz, 48 kb/s) |
| **Duration** | `328.144399 seconds` (5m 28.14s) | `240.033333 seconds` (4m 0.03s) |
| **File Size** | `17,566,216 bytes` (~16.75 MB) | `13,473,247 bytes` (~12.85 MB) |
| **SHA-256 Digest** | `80111ddebc823d52245802733897b9ed10ba4484a8e652785a7e07b079fb3648` | `396824ea288b1c028544a35ce6a8fef33021c14d1f14d855e790c81c49b93ac1` |
| **Trimming Method** | None (Original Master) | Lossless FFmpeg stream copy (`-ss 00:00:00 -to 00:04:00 -c copy -avoid_negative_ts make_zero`) |
| **Pilot Compliance**| **Exceeds 300s hard cap** (Fails closed) | **Valid pilot duration** (240s <= 300s, 4 minutes) |

---

## 3. End-to-End Application Workflow Execution

### Step 1: Saved Deal Selection & Viewing Assessment Interface
- **Deal Reference:** `deal-17408-blue-jay` ("17408 Blue Jay Way, Leeds LS1 4AB")
- **Initial State:** Saved Deal loaded from local PostgreSQL; Viewing Assessment created with ID `981cc4d6-de6e-4732-969c-fbe97e1d2095`.
- **UI Stepper:** Rendered Operator Workflow stages: `1. Evidence` ??? `2. Review` ??? `3. Scope & Measurements` ??? `4. Financial Impact & Passport`.

### Step 2: Valid Video Evidence Ingestion & Genuine Extracted Frames
- **Clip Registration:** Valid 240s clip metadata submitted to `/api/saved-deals/:id/viewing-assessments/:assessmentId/evidence`.
- **Frame Thumbnails:** High-resolution unenhanced JPEG derivatives uploaded to private local filesystem blob storage (`.qa-local/evidence/`):
  1. `10.0s`: Aerial Roof Pitch & Grounds (`frame_10s.png`, 335 KB)
  2. `60.0s`: Kitchen Island & Joinery (`frame_60s.png`, 180 KB)
  3. `240.0s`: Bedroom Patio Sliding Doors (`frame_240s.png`, 165 KB)
- **UI Verification:** Viewing assessment summary updated to `Evidence frames: 3 (3 with a stored image)`.

### Step 3: Simulated AI Proposal Generation
- **Execution:** Triggered via `POST .../analysis-runs` with fixture scenario `complete_flow`.
- **Simulation Banner:** Displayed prominently in amber:
  > *"Simulated AI findings. Unless a live provider has been enabled, findings below come from a deterministic fixture, not real AI video analysis. Original videos are never uploaded; only the still frames you save are stored, privately. All findings are unverified drafts until a person reviews them; accepting one does not certify condition."*
- **Generated Proposals:** 3 unverified draft findings flagged for human operator review:
  - `C01`: Main roof pitched covering (Slipped tiles)
  - `C08`: External masonry and wall finishes (Wall fracture)
  - `C41`: Sanitary appliances and bath/basin condition (Defective basin seals)

### Step 4: Operator Human Review (Accept, Amend, Reject)
The operator exercised all three review dispositions through the canonical checklist review interface:
1. **Item C41 ??? Sanitary appliances:**
   - Disposition: **ACCEPTED**
   - Decision note: *"Partial bathroom sanitaryware refresh accepted based on observed seal deterioration."*
2. **Item C08 ??? External masonry & render:**
   - Disposition: **AMENDED** (`EDITED`)
   - Operator observation: *"Cosmetic hairline render crazing near patio steps; structural substrate sound."*
3. **Item C01 ??? Main roof pitched covering:**
   - Disposition: **REJECTED**
   - Reason: *"Aerial drone footage confirms roof planes and ridge lines are intact and sound. No missing tiles observed."*

### Step 5: Refurbishment Scope & Physical Measurements
- **Scope Categorization:**
  - `bathroom`: Included as `ENGINE_SCOPE` (Bathroom works).
  - `external-walls`: Included as `UNPRICED` (Facade and masonry repairs).
  - `roof`: Strictly excluded (`REJECTED`).
- **Verified Operator Measurements:**
  - Bedrooms: `4` (source: `FLOOR_PLAN`, unit: `count`, confidence: `high`)
  - Bathrooms: `3` (source: `FLOOR_PLAN`, unit: `count`, confidence: `high`)
  - Total Floor Area: `240 sqm` (source: `FLOOR_PLAN`, unit: `sqm`, confidence: `high`)
- **Plan Confirmation:** Refurbishment plan `plan-7441c8bc-deb8-4eab-a7e4-0d0fb50bf2d3` confirmed by `local-dev-operator`.

### Step 6: Brik True MAO Calculation & Financial Decision
- **Acquisition Inputs:** Purchase Price: `??450,000`, Realistic GDV: `??750,000`.
- **Financial Proposal:** `fprop-fccf1924-3cac-4483-8f61-28dddad6b19a` generated by calculation engine.
- **True MAO Calculated:** Calculated for 20% target profit margin.
- **Financial Decision:** Confirmed by operator (`fdec-564d797d-c8bb-474c-9cc1-91e25b3c7af2`) with mandatory acknowledgements (`notWriteBack: true`, `exclusions: true`, `unresolvedQuantities: true`).
- **Saved Deal Immutability:** Verified `savedDealChanged: false`. The underlying deal record remained unchanged.

### Step 7: Confidential Builder Quotation Pack
- **Route:** `http://localhost:3000/saved-deals/deal-17408-blue-jay/builder-pack?assessmentId=981cc4d6-de6e-4732-969c-fbe97e1d2095`
- **Verification:** Version `builder-pack-v2` loaded in browser.
- **Redaction Enforced:** Commercial rates, trade day rates, acquisition GDV, profit targets, and operator names strictly omitted. Displays solely work items, physical tasks, and tender specifications.

### Step 8: Three-Layer Deal Passport
- **Route:** `http://localhost:3000/saved-deals/deal-17408-blue-jay/passport?assessmentId=981cc4d6-de6e-4732-969c-fbe97e1d2095`
- **Verification:** Deal passport loaded in browser across all 3 governance tiers:
  - **Tier 1 (Internal):** Detailed trade schedules and engineering scope.
  - **Tier 2 (Broker):** Acquisition figures, bridge term (9 months), and loan security metrics.
  - **Tier 3 (Investor):** Visual evidence photos, milestones, and safety checklists.

### Step 9: Continuous-Learning Outcome Feedback
- Ground-truth survey outcome recorded on C41 (`CONFIRMED` by sanitary surveyor).
- Evaluated via `exportEvaluationDataset(repo, { includeSimulated: false })`: Exactly 0 records exported (`excludedSimulated: 1`). Simulated outcomes are completely isolated.

---

## 4. Screenshot Evidence Catalog

Full-page screenshots of the actual running application were captured in Chrome and are preserved in the Git-ignored private evidence vault (`.demonstration-evidence/screenshots/`):

| Screenshot File | Interface View & Page | Key Information Displayed |
| :--- | :--- | :--- |
| `01_saved_deal_summary.png` | `/saved-deals/deal-17408-blue-jay/summary` | Saved Deal Investor Summary, deal formulation, financial metrics, and observation history. |
| `02_viewing_assessment_full.png` | `/saved-deals/deal-17408-blue-jay/viewing` | Full Viewing Assessment interface: Operator Stepper, summary counters, simulation banner, 3 stored evidence frames, human reviews (C41 Accept, C08 Amend, C01 Reject), confirmed Refurb Plan, physical measurements, and True MAO decision. |
| `03_builder_pack_full.png` | `/saved-deals/deal-17408-blue-jay/builder-pack` | Contractor quotation tender pack: Work items (bathroom, external walls), unpriced scopes, and commercial redaction. |
| `04_deal_passport_full.png` | `/saved-deals/deal-17408-blue-jay/passport` | Three-layer Deal Passport: Governance status, confirmed refurbishment schedule, broker summary, and visual evidence ledger. |

---

## 5. Implementation & Verification Modality Breakdown (Action 12)

| Demonstration Step | Completed via Browser | Completed via API / Script | Test Harness / Mocked | Technical Details |
| :--- | :---: | :---: | :---: | :--- |
| **Deal Navigation & Page Load** | **YES (Chrome)** | ??? | ??? | Loaded in local Chrome at `http://localhost:3000/saved-deals/...`. |
| **Viewing Assessment Creation** | **YES (Chrome)** | ??? | ??? | Created via browser button click and verified via API. |
| **Video Duration Intake Gate** | **YES (Chrome)** | ??? | ??? | Hard 300s limit enforced. Oversized metadata rejected; 240s clip accepted. |
| **Derivative Clip Creation** | ??? | **YES (FFmpeg)** | ??? | Lossless FFmpeg stream copy produced 240.03s derivative clip. |
| **Frame Extraction & Ingestion**| ??? | **YES (Worker/Blob)** | ??? | Extracted via FFmpeg (`-an`, `-ss`, `-vframes 1`), stored in `.qa-local/evidence/`. |
| **Frame Display in UI** | **YES (Chrome)** | ??? | ??? | Decoded frame thumbnails rendered in Viewing Assessment UI with evidence metadata. |
| **Simulated AI Proposal Run** | **YES (Chrome)** | ??? | ??? | Initiated in UI with fixture provider (`complete_flow`); stamped `SIMULATED`. |
| **Operator Human Review** | **YES (Chrome)** | **YES (API sync)** | ??? | Accept (C41), Amend (C08), and Reject (C01) executed and reflected in UI. |
| **Measurements & Scope Confirm** | **YES (Chrome)** | **YES (API sync)** | ??? | 4 beds, 3 baths, 240 sqm recorded; Refurb Plan confirmed in UI. |
| **True MAO Financial Decision** | **YES (Chrome)** | **YES (API sync)** | ??? | Engine calculated True MAO (20% margin); confirmed by operator. |
| **Confidential Builder Pack** | **YES (Chrome)** | ??? | ??? | Rendered in Chrome at `/builder-pack` with full commercial rate redaction. |
| **Three-Layer Deal Passport** | **YES (Chrome)** | ??? | ??? | Rendered in Chrome at `/passport` with Tier 1/2/3 governance breakdown. |
| **Continuous Learning Export** | ??? | **YES (Service)** | ??? | Verified programmatic exclusion of simulated findings (`includeSimulated: false`). |
| **Cloud Vision Inference** | ??? | ??? | **MOCKED (Fixture)** | Live Claude API calls not executed (no paid credentials / sandbox safety). |

---

## 6. Git Hygiene & Publication Safety Audit (Action 11)

1. **Current Working Tree & HEAD Commit:**
   - Working tree contains **zero** tracked third-party video frames or screenshots.
   - All screenshots are stored exclusively in `.demonstration-evidence/screenshots/`, which is ignored by `.gitignore`.
2. **Historical Commits Audit:**
   - Commit `387d204` added 7 PNG frames to `docs/option2/screenshots/task-12b/`.
   - Commit `4f87f5d` deleted those files from Git tracking.
   - **Publication Caution:** The Git object database for branch `feat/task-11e-video-viewing-integration` retains historical blob references in commit `387d204`. In accordance with Action 11, **this branch must not be pushed to a public remote or merged without a separately reviewed squash/filter-repo publication strategy**.
3. **Third-Party Media Rule:** Genuine third-party video files and extracted frames must never be committed to Git. Commercial distribution requires an official Brik-by-Brik commissioned survey.
