# BRIK BY BRIK ??? OWNER DEMONSTRATION SCRIPT
## End-to-End Walkthrough: Saved Deal to Verified Evidence & Downstream Outputs

**Audience:** Owner Review (James Lake)  
**System State:** Local isolated QA environment (Next.js + QA PostgreSQL)  
**Test Deal ID:** `deal-17408-blue-jay`  
**Data Notice:** *All property addresses, financial figures, measurements, AI suggestions, and operator triage decisions in this walkthrough are demonstration data for validation purposes.*  
**Media Rights Notice:** *Footage processed during local testing originates from third-party demonstration media. Extracted video frames and full-resolution frame captures are retained strictly in private, Git-ignored local storage (`.demonstration-evidence/`) and are not distributed in shared artifacts without verified rights.*

---

## Prerequisites & Starting the Local Environment

Open PowerShell in the repository worktree:

```powershell
# 1. Ensure isolated QA PostgreSQL container is running
node scripts/qa/local-postgres.mjs start

# 2. Start the local Next.js development server
npm run dev -- -p 3000
```

Open Google Chrome to `http://localhost:3000`.

---

## Demonstration Navigation Sequence

### Step 1: Saved Deal Selection & Pipeline Overview

- **Action:** Navigate to `http://localhost:3000/saved-deals/deal-17408-blue-jay/summary`.
- **Expected Screen State:**
  - Deal Header: **17408 Blue Jay Way** (Demonstration Property).
  - Status Pills: `Classification: GO`, `Governance: APPROVED`, `Investor Shield: ADEQUATE`.
  - Authoritative Baseline Figures:
    - Purchase Price: **??450,000**
    - GDV (Realistic): **??750,000**
    - Initial Refurbishment Allowance: **??50,000**
    - True MAO (20% Target): **??450,875**
  - Action Button: Click **"Open Viewing Assessment"** (or navigate to `/saved-deals/deal-17408-blue-jay/viewing`).

---

### Step 2: Viewing Assessment & Video Upload Control

- **Action:** Open `http://localhost:3000/saved-deals/deal-17408-blue-jay/viewing`.
- **Expected Screen State:**
  - Assessment Workspace loaded with Deal Context banner and Checklist categories (C01???C45, V01???V13).
  - **Video Evidence Panel** displayed at the top:
    - Upload Dropzone supporting MP4/MOV files up to 300 seconds.
    - Pilot Duration Limit notice: `Maximum duration 5 minutes (300 seconds)`.
- **Upload Interaction:**
  1. Click **"Choose File"** and select the demonstration video (`.demonstration-evidence/17408-Blue-Jay-240s-demo-clip.mp4`).
  2. Click **"Upload & Queue Extraction"**.
  3. Real-time progress bar advances through 6 MB TUS chunk uploads until reaching 100% (13.47 MB).
  4. Banner transitions to: `Upload Complete: video job vj_... queued for frame extraction`.

---

### Step 3: Media Worker Extraction & Genuine Evidence Gallery

- **Action:** Click **"Run Media Worker"** in the panel (or run via background worker).
- **Expected Screen State:**
  - FFmpeg executes genuine frame extraction on the uploaded video (240.03s duration).
  - Evidence Gallery dynamically updates to display **40 genuine unenhanced frames** (640x360 native pixels):
    - Each frame displays its exact presentation timestamp (`0.00s`, `6.15s`, `12.30s`, ..., `239.85s`).
    - Cryptographic SHA-256 hash preview (`vfe_...`).
    - Provenance badge: `Unenhanced Source Frame`.
  - Click any thumbnail to open the **High-Resolution Inspection Modal**:
    - Full-resolution frame preview.
    - Timestamp, frame index, and complete 64-character SHA-256 digest.

---

### Step 4: Evidence Attachment to Inspection Checklist

- **Action:** On frame index 3 (timestamp `18.45s` showing bathroom basin area):
  1. Click **"Attach to Checklist"**.
  2. Select Checklist Item: **C41 ??? Sanitary appliances & fittings**.
  3. Enter Qualified Observation Note:
     > *"Visible cosmetic discoloration beneath vanity basin observed in demonstration footage; physical plumbing inspection required."*
  4. Click **"Confirm Attachment"**.
- **Expected Screen State:**
  - Modal closes; badge appears on C41 showing `1 Frame Attached`.
  - Frame hash and timestamp are cryptographically linked to C41 in PostgreSQL.

---

### Step 5: Simulated AI Proposals & Human Review Triage

- **Action:** Scroll to the AI Suggestions section.
- **Expected Screen State:**
  - Three simulated defect suggestions appear, each bearing a prominent orange **`SIMULATED`** pill:
    - **C01 (Main roof pitch):** Slippage suggestion.
    - **C41 (Sanitary appliances):** Basin waste suggestion.
    - **C08 (External masonry & render):** Hairline cracking suggestion.
- **Human Triage Actions:**
  1. **C01 ??? REJECT:** Click *Reject*. Rationale: *"No obvious missing tiles or sagging visible on roof slope in demonstration footage; formal condition subject to professional survey."*
  2. **C41 ??? ACCEPT:** Click *Accept*. Rationale: *"Accepted visual observation of basin area from demonstration footage frame; physical plumbing inspection required."*
  3. **C08 ??? AMEND / EDIT:** Click *Amend*. Edit observation to: *"Visible cosmetic hairline surface crazing on exterior render near patio steps; no structural assessment implied."* Set status to `CONCERN`.
- **Expected Screen State:**
  - Status pills update to `REJECTED`, `ACCEPTED`, and `AMENDED`.
  - Human reviewer ID (`local-dev-operator`) and revision count recorded in audit history.

---

### Step 6: Refurbishment Scope & Schedule of Works Confirmation

- **Action:** Scroll to the **Refurbishment Plan & Quantities** section.
- **Expected Screen State:**
  - Property Basics / Measurements:
    - Bedrooms: **4** (Basis: Floor Plan, high confidence)
    - Bathrooms: **3** (Basis: Floor Plan, high confidence)
    - Gross Internal Area: **240 sqm** (Basis: Floor Plan, high confidence)
  - Confirmed Scope Items from Reviewed Findings:
    - **Bathroom works (partial):** Unpriced line item requiring contractor quotation.
    - **Facade and masonry repairs:** External wall cosmetic patching.
  - Calculation Engine Schedule of Works:
    - Phase 1: Strip & Structural
    - Phase 2: First & Second Fix
    - Phase 3: Finishing
    - Delays & sequencing contingency buffer: **20%**.
  - Click **"Confirm Scope & Refurb Plan"**.
  - Plan confirms with unique plan ID (e.g. `plan-eaed56e8...`).

---

### Step 7: Financial Impact Evaluation & True MAO

- **Action:** Scroll to **Financial Proposal & Decision**.
- **Expected Screen State:**
  - Comparison Table (Non-authoritative proposal vs Authoritative Saved Deal):
    - **Baseline Refurbishment Cost:** ??50,000 (Saved Deal baseline)
    - **Proposed Refurbishment Cost:** ??0 (Engine base; builder quotation pending for unpriced items)
    - **Baseline 20% True MAO:** ??450,875
    - **Proposed 20% True MAO:** **??500,875**
  - Safety Warning: *"This proposal is non-authoritative. The Saved Deal record remains unchanged until explicitly updated."*
  - Operator Decision: Click **"Confirm Financial Proposal"** with required acknowledgments (Exclusions, Unresolved Quantities, Non-Write-Back).
  - Decision recorded idempotently without modifying the baseline deal.

---

### Step 8: Downstream Document Generation

#### 8.1 Confidential Builder Quotation Pack
- **Navigation:** Navigate to `http://localhost:3000/saved-deals/deal-17408-blue-jay/builder-pack?assessmentId=...`
- **Expected Screen State:**
  - Clean contractor-facing document.
  - Contains: Property dimensions, room breakdown, itemized works, unpriced items schedule, and evidence attachments.
  - **Confidentiality Protection:** Completely excludes purchase price, GDV, investor profit targets, and MAO figures.

#### 8.2 Three-Layer Deal Passport
- **Navigation:** Navigate to `http://localhost:3000/saved-deals/deal-17408-blue-jay/passport?assessmentId=...`
- **Expected Screen State:**
  - Layer 1: Authoritative Saved Deal Snapshot (??450k purchase, ??750k GDV, GO classification).
  - Layer 2: Reviewed Viewing Findings & Evidence Trail (C01 rejected, C41 accepted with frame hash, C08 amended).
  - Layer 3: Financial Decision & Governance Audit Log (Operator decision event, timestamps, acknowledgments).

#### 8.3 Saved Deal Summary & Investor Shield
- **Navigation:** Navigate to `http://localhost:3000/saved-deals/deal-17408-blue-jay/summary`
- **Expected Screen State:**
  - Authoritative Saved Deal values remain intact.
  - Confirmed viewing assessment attached under "Viewing Assessments" table.
  - Investor Shield capital protection status: `ADEQUATE`.

---

### Step 9: Continuous-Learning Feedback Verification

- **Action:** Query the evaluation export endpoint:
  ```powershell
  Invoke-RestMethod -Uri "http://localhost:3000/api/saved-deals/deal-17408-blue-jay/viewing-assessments/evaluation-export"
  ```
- **Expected Screen State:**
  - `exportData.dataset.records`: Count is `0`.
  - **Integrity Rule:** Simulated demonstration records are strictly quarantined and never exported into AI training datasets.
