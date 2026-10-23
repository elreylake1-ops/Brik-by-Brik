# BRIK BY BRIK ??? OWNER ACCEPTANCE SUMMARY & APPROVALS
**Review for:** James Lake  
**Prepared by:** Ponytail v5.3.2  
**Baseline Checkpoint:** `1ee2fdb`  
**Date:** October 23, 2026  
**Environment:** Local Isolated QA (Node.js + PostgreSQL container)

---

## 1. Features Demonstrated Locally (Working & Verified)

1. **Saved Deal & Viewing Assessment Workflow:**
   - Saved Deal browsing, deal classification (`GO`), and baseline financials (??450k purchase, ??750k GDV, ??50k refurb).
   - Viewing Assessment initialization with C01???C45 checklist items and V01???V13 video capture protocols.
2. **Actual Browser Video Upload:**
   - Real chunked TUS upload in Google Chrome using genuine 4-minute demonstration MP4 (13.47 MB).
   - Client-side file type and duration validation (safe rejection of unsupported formats).
   - Local-filesystem blob storage driver (`LocalFsVideoStorageService`) with strict path traversal prevention.
3. **FFmpeg Frame Extraction & Provenance:**
   - 40 genuine unenhanced PNG master frames (640x360 native pixels) extracted with exact presentation timestamps.
   - 320x180 JPEG thumbnails and contact sheet generation.
   - Cryptographic SHA-256 provenance tracking per frame in PostgreSQL.
4. **Human Review & Evidence Attachment:**
   - High-resolution frame inspection modal in the browser.
   - Frame attachment to checklist item **C41** with qualified visual observation notes.
   - Human triage of simulated AI suggestions: **C01 (Rejected)**, **C41 (Accepted)**, **C08 (Amended)**.
5. **Refurbishment Plan & Schedule of Works:**
   - Operator measurement confirmation (4 bed, 3 bath, 240 sqm GIA).
   - Refurbishment plan generation with itemized works, unpriced line items, and trade allocations.
   - 3-phase project sequencing with 20% delay contingency.
6. **Financial Evaluation & Investor Shield:**
   - Calculation engine evaluation yielding a True MAO (20% Target) of **??500,875**.
   - Deal immutability: Authoritative Saved Deal fields remain 100% untouched.
   - Investor Shield capital protection status: `ADEQUATE`.
7. **Downstream Documents & Continuous Learning:**
   - **Confidential Builder Pack:** Contractor quotation scope with financial caps strictly redacted.
   - **Three-Layer Deal Passport:** Auditable snapshot of Baseline Deal, Viewing Evidence, and Financial Decision.
   - **Continuous Learning Audit:** Strict isolation ensuring zero simulated records enter AI training exports.

---

## 2. Features Not Yet Demonstrated (Honest System Boundaries)

- **Live Cloud AI Inference:** No live API calls were made to Anthropic or OpenAI. AI proposals were generated via the isolated fixture provider (`SIMULATED`).
- **Hosted Cloud Storage:** Uses local-filesystem storage (`VIEWING_BLOB_STORE=local-fs`); Supabase S3 bucket upload was not used.
- **Hosted Enterprise SSO:** Local authentication simulator and development guard used; production IdP (WorkOS/Okta) not yet connected.
- **PDF Binary Downloads:** Downstream documents rendered and verified in browser HTML/CSS; binary PDF compiler deferred to Phase 2.
- **Live Supplier Catalog Feeds:** Refurbishment costs derived from internal config libraries (`trade-rates.ts`, `task-cost-library.ts`), not live scraping.

---

## 3. Outstanding Owner Approvals Required

Before proceeding to remote deployment or live testing, the following approvals are required:

| Approval Item | Scope / Context | Status |
| :--- | :--- | :---: |
| **1. Live Cloud AI Vision Pilot** | Authorization to activate Anthropic Claude Sonnet 3.5/3.7 adapter for automated frame inspection, with agreed token/cost expenditure caps. | **PENDING OWNER APPROVAL** |
| **2. Inspection Checklist Sign-Off** | Formal approval of the 45 building inspection prompts (C01???C45) and 13 video capture requirements (V01???V13). | **PENDING OWNER APPROVAL** |
| **3. Financial Calculation Model** | Decision whether to retain the current purchase-price-based finance model or transition to an LTV-based finance model for True MAO. | **PENDING OWNER APPROVAL** |
| **4. Security Architecture Decision** | Confirmation on whether to merge Security RC1 (`security/saved-deals-auth-rc1`) or retain the current unified session guard. | **PENDING OWNER APPROVAL** |
| **5. Hosted Infrastructure Deployment** | Authorization to apply PostgreSQL database migrations and deploy to Vercel/Supabase staging environments. | **PENDING OWNER APPROVAL** |

---

## 4. Media Usage Rights & Demonstration Assets

- **Third-Party Footage:** Demonstration footage was processed strictly within isolated local storage (`.demonstration-evidence/`).
- **Git Hygiene:** No third-party video footage, extracted frames, or application screenshots containing third-party imagery have been committed or pushed to Git.
- **Shareable Artifacts:** The walkthrough script and documentation contain only qualified, synthetic, or schematic representations suitable for distribution.
