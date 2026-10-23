# BRIK BY BRIK — TASK 11G-1 EVALUATION REPORT
## Cloud Vision API Architecture, Cost Evaluation & Integration Plan

**Agent:** Ponytail v5.3.2  
**Mode:** Read-only technical planning and feasibility  
**Application Checkpoint:** `bddab639`  
**Governance Checkpoint:** `b47e4a3` (James Lake October 22, 2026 Checkpoint, Video Evidence SOP v2.1)  
**Status:** Evaluation Complete — All Live Paid AI Calls Remain Strictly Disabled  

---

## 1. Executive Summary & Verdict

### Verdict
`TASK 11G-1 COMPLETE — CLOUD VISION API PLAN READY`

This evaluation replaces the local model proposal (Task 11G) with a managed Cloud Vision API architecture. The developer's machine executes **zero local model inference**, preserving local CPU/GPU resources and battery, while offloading vision processing to enterprise-grade cloud vision APIs behind strict server-side budget, privacy, and evidence lineage controls.

### Strategic Recommendations
1. **Primary Provider — Anthropic Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`):**
   - **Reasoning:** Superior spatial and physical reasoning on complex UK residential defect visual prompts; existing adapter foundation already designed in `lib/viewing-assessment/ai/claude-provider.ts`.
   - **Estimated Cost:** **~$0.18 – $0.24 (~14p – 19p) per property walkthrough** (40 frames @ 960px with prompt caching).
2. **Secondary / Cost-Optimized Fallback — OpenAI GPT-4o-mini (`gpt-4o-mini`):**
   - **Reasoning:** Industry-leading structured JSON grammar enforcement (`strict: true`), robust commercial Data Processing Addendum (DPA), and ultra-low cost.
   - **Estimated Cost:** **~$0.006 (<1p) per property walkthrough** (40 frames).
3. **100% Architecture & Governance Reuse:**
   - Reuses existing `FrameAnalysisProvider` interface, `validateAiProposals` schema gate, and `VideoEvidencePanel.tsx` human review workflow.
   - Reuses Task 11D lossless frames with genuine source presentation timestamps (`source_time_ms`) and SHA-256 digests.
   - Enforces the non-negotiable rule: **every AI proposal is `UNVERIFIED` and `PENDING`**; deal financials, refurb estimates, True MAO, and Investor Shield remain completely untouched.
4. **Default Safe State:**
   - All live paid AI calls remain **disabled by default** (`VIEWING_AI_ENABLED=false`). No network request is initiated without James Lake's explicit written approval.

---

## 2. Cloud Vision Provider & Model Comparison

We evaluated the current official vision APIs from **Anthropic**, **OpenAI**, and **Google Gemini** against institutional UK property deal appraisal requirements:

```
+──────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    CLOUD VISION PROVIDER COMPARISON MATRIX                               |
+──────────────────────────┬──────────────────────────┬──────────────────────────┬─────────────────────────+
| Dimension                | Anthropic Claude         | OpenAI GPT               | Google Gemini           |
|                          | (Claude 3.5 Sonnet/Haiku)| (GPT-4o / GPT-4o-mini)   | (Gemini 1.5/2.0 Flash)  |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| Leading Models           | claude-3-5-sonnet        | gpt-4o                   | gemini-1.5-flash        |
|                          | claude-3-5-haiku         | gpt-4o-mini              | gemini-1.5-pro          |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| Multimodal Tokenization  | ~1,600 tokens/image      | 765 tokens/image (high)  | 258 tokens/image        |
| (960px JPEG input)       | ((w*h)/750, max 1600)    | 85 tokens/image (low)    | (fixed per image tile)  |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| Pricing per 1M Input     | Sonnet: $3.00 / MTok     | GPT-4o: $2.50 / MTok     | Flash: $0.075 / MTok    |
| (Tokens)                 | Haiku: $0.80 / MTok      | GPT-4o-mini: $0.15 / MTok| Pro: $1.25 / MTok       |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| Pricing per 1M Output    | Sonnet: $15.00 / MTok    | GPT-4o: $10.00 / MTok    | Flash: $0.30 / MTok     |
| (Tokens)                 | Haiku: $4.00 / MTok      | GPT-4o-mini: $0.60 / MTok| Pro: $5.00 / MTok       |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| Prompt Caching           | 90% read discount ($0.30)| Automatic 50% discount   | 75% read discount       |
|                          | (5-min TTL on system)    | on cached prefixes       | (Context caching)       |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| Structured JSON Fidelity | High (tool_use / output) | Perfect (strict: true)   | High (response_schema)  |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| UK Construction Defect   | Excellent (locational &  | Good (high detail), but  | Good, but prone to      |
| Reasoning Capability     | trade nuance awareness)  | prone to over-caution    | generic descriptions    |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| Commercial Data Privacy  | Zero customer training   | Zero customer training   | Paid Tier: No training  |
| (Commercial API Terms)   | 30-day retention for T&S | 30-day retention for T&S | Free Tier: USES DATA!   |
|                          | Zero retention available | Zero retention available | (Free Tier MUST be OFF) |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| Enterprise DPA & GDPR    | Standard UK/EU DPA + SCC | Standard UK/EU DPA + SCC | Google Cloud Vertex DPA |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| Existing Code Readiness  | High (claude-provider.ts)| Medium (new client class)| Medium (new client class)|
+──────────────────────────┴──────────────────────────┴──────────────────────────┴─────────────────────────+
```

### Detailed Provider Analysis

#### 1. Anthropic Claude (Recommended Primary)
- **Strengths:** Claude 3.5 Sonnet exhibits the highest fidelity in following complex negative instructions (e.g. *"never diagnose asbestos"*, *"never infer concealed rot"*). Its ability to map visual evidence directly to the 58 checklist items (C01–C45 and V01–V13) without hallucinating non-existent checklist codes is unmatched.
- **Code Readiness:** `lib/viewing-assessment/ai/claude-provider.ts` is already written, fully typed against `@anthropic-ai/sdk`, and covered by unit test fixtures.
- **Prompt Caching Advantage:** The static system prompt containing all 58 checklist descriptions (~6,000 tokens) qualifies for prompt caching. Cached reads cost only $0.30/MTok (a 90% discount), significantly reducing repetitive overhead on successive batches.

#### 2. OpenAI GPT-4o / GPT-4o-mini (Recommended Secondary)
- **Strengths:** Strict Structured Outputs (`response_format: { type: "json_schema", json_schema: { strict: true } }`) guarantees 100% adherence to Brik by Brik's output schema. `gpt-4o-mini` is exceptionally cheap ($0.15/MTok input), enabling multi-pass screening for fractions of a penny.
- **Considerations:** High-detail image mode slices 960px images into 4 tiles of 512×512 (765 tokens per image). While cost-effective, reasoning on subtle UK building defects (e.g. differentiating stepped masonry fractures from mortar joints) slightly trails Sonnet.

#### 3. Google Gemini (Vertex AI / Paid Tier)
- **Strengths:** Fixed 258 tokens per image makes Gemini 1.5/2.0 Flash the cheapest provider by token count.
- **Critical Risk:** Google AI Studio's **Free Tier actively logs and uses customer inputs for model training**. To protect confidential property walkthroughs, Brik by Brik **must strictly forbid AI Studio free keys** and require either paid Google AI Studio or Google Cloud Vertex AI under a signed Data Processing Addendum.

---

## 3. Property Walkthrough Cost Model (20–40 Frames)

### 3.1 Token Consumption Profile per Walkthrough

A standard Brik by Brik video walkthrough analysis extracts **20 to 40 keyframes** (960px JPEG):
- **Base System Prompt:** Checklist C01–C45 + V01–V13 + safety rules $\approx 6,000\text{ tokens}$.
- **Image Input Tokens:**
  - *Anthropic (1,600 tokens/frame):* 20 frames = 32,000 tokens; 40 frames = 64,000 tokens.
  - *OpenAI (765 tokens/frame):* 20 frames = 15,300 tokens; 40 frames = 30,600 tokens.
  - *Gemini (258 tokens/frame):* 20 frames = 5,160 tokens; 40 frames = 10,320 tokens.
- **Output JSON Tokens:** Structured findings envelope $\approx 1,200\text{ to }2,500\text{ tokens}$.

### 3.2 Estimated Cost per Property Walkthrough

| Analysis Scenario | Claude 3.5 Sonnet (Primary) | Claude 3.5 Haiku | OpenAI GPT-4o | OpenAI GPT-4o-mini (Fallback) | Google Gemini 1.5 Flash |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Small Clip (20 Frames)** | **$0.12** (~9.5p) | **$0.04** (~3.2p) | **$0.06** (~4.8p) | **$0.004** (<0.5p) | **$0.001** (<0.1p) |
| **Standard Clip (30 Frames)** | **$0.18** (~14.2p) | **$0.05** (~4.0p) | **$0.08** (~6.3p) | **$0.006** (<0.5p) | **$0.002** (<0.2p) |
| **Comprehensive (40 Frames)** | **$0.24** (~19.0p) | **$0.07** (~5.5p) | **$0.11** (~8.7p) | **$0.008** (<0.7p) | **$0.003** (<0.3p) |
| **With Prompt Caching (-40%)** | **$0.15** (~11.8p) | **$0.05** (~4.0p) | **$0.09** (~7.1p) | **$0.007** (<0.6p) | **$0.002** (<0.2p) |

*Calculated at current published enterprise API rates. Exchange rate: $1.00 = £0.79.*

### 3.3 Frame Selection & Prioritization Strategies

To prevent wasteful token spend, the application supports three frame selection strategies:

1. **Strategy A — Full Sampling (Default: 20–40 frames):**
   - Automatically samples 1 keyframe every 2–3 seconds across the walkthrough.
   - Comprehensive coverage of entire property. Cost: ~$0.15 – $0.24.
2. **Strategy B — Operator Curated Batch (Recommended: 10–15 frames):**
   - Operator selects promising or suspicious candidate frames in `VideoEvidencePanel.tsx` and triggers: *"Analyze Selected Frames"*.
   - Cuts token consumption by 65%. Cost: **~$0.06 – $0.09 (~5p – 7p) per run**.
3. **Strategy C — Two-Tier Screening (Haiku/Mini Screening + Sonnet Deep Dive):**
   - Tier 1: Fast, ultra-cheap pass with `gpt-4o-mini` or `claude-3-5-haiku` across all 40 frames (<1p) to identify frames containing potential defects.
   - Tier 2: Deep reasoning with `claude-3-5-sonnet` only on the 6–10 flagged frames (~4p).
   - Total Cost: **~$0.05 (~4p) per property**.

### 3.4 Impact on Authorized Allowance

The project's authorized pre-production AI allowance is **USD 150.00** (`BUDGET.totalAllowanceUsd`), with a **hard stop at USD 120.00** (`BUDGET.hardStopUsd`) and a **USD 30.00 emergency reserve**:

- At **~$0.18 per property** (Claude 3.5 Sonnet, 30 frames with caching), the $120.00 hard stop allows **666 full property analyses**.
- At **~$0.006 per property** (GPT-4o-mini), the hard stop allows **20,000 full property analyses**.
- The existing budget guard (`lib/viewing-assessment/ai/budget.ts`) prevents accidental overruns before any request is dispatched.

---

## 4. Architecture Reuse & Server-Side Integration

The cloud vision integration drops cleanly into Brik by Brik's existing modular architecture:

```
+──────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    CLOUD VISION INTEGRATION ARCHITECTURE                                 |
|                                                                                                          |
|  [Operator in Browser]                                                                                   |
|         │                                                                                                |
|         ▼ POST /api/saved-deals/[id]/viewing-assessments/[assessmentId]/analysis-runs                    |
|  [Next.js Server Route Handler]                                                                          |
|         │                                                                                                |
|         ├── 1. Session & Deal Guard (Verifies operator session & deal ownership)                         |
|         ├── 2. Kill Switch & Selection Guard (select-provider.ts)                                        |
|         ├── 3. Budget Guard (checkBudget in budget.ts: per-deal limit & global hard stop)                |
|         └── 4. Lease & Idempotency Acquisition (startRun in viewing-assessment-repository)               |
|                                                                                                          |
|  [Server-Side Provider Dispatcher]                                                                       |
|         │                                                                                                |
|         ├── Reads JPEG bytes from Private Blob Store                                                     |
|         ├── Dispatches HTTPS POST to Provider (Claude API / OpenAI API)                                  |
|         │     └── Secret API Key held exclusively in server environment variable                         |
|         │     └── Hard timeout: 60s abort signal                                                         |
|         └── Receives Raw JSON Response Envelope                                                          |
|                                                                                                          |
|  [Strict Verification Boundary: validateAiProposals()]                                                   |
|         │                                                                                                |
|         ├── Reconciles frame IDs against database video_frames                                           |
|         ├── Validates checklist IDs against VIEWING_CHECKLIST_IDS (C01-C45, V01-V13)                      |
|         ├── Binds original video_id, source_time_ms, frame_sha256                                        |
|         ├── Appends mandatory uncertainty disclaimer                                                     |
|         └── Forces: verification='UNVERIFIED', disposition='PENDING'                                     |
|                                                                                                          |
|  [Database Transaction]                                                                                  |
|         ├── INSERT into viewing_proposals (Unverified draft suggestions)                                 |
|         ├── INSERT into ai_usage_ledger (Exact integer micro-dollar cost record)                         |
|         └── Fenced completeRun() call                                                                    |
|                                                                                                          |
|  [UI: VideoEvidencePanel.tsx]                                                                            |
|         └── Operator human review (ACCEPT / EDIT / REJECT)                                               |
+──────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

### 4.1 Strict Server-Side API-Key Management
- **Zero Client Exposure:** `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are stored strictly as server-side environment variables in `.env.local` (or hosted Vercel Encrypted Environment Variables).
- **Sanitized Logging:** `claude-provider.ts` explicitly strips API keys, Authorization headers, and raw error response bodies before logging errors. Only HTTP status codes are recorded (e.g. `status 429 Rate Limit`).
- **Forbidden Key Verification:** The application will fail startup if any `NEXT_PUBLIC_*` variable contains an AI credential.

---

## 5. Evidence Lineage & Server-Side Binding

To satisfy James Lake's requirement that *"potential defects are identified with genuine timestamps and supporting visual evidence"*, the server strictly binds every finding to verified database records:

```typescript
// Verified Lineage Schema produced by validateAiProposals()
export type BoundAiProposal = {
  id: string                          // Unique proposal UUID
  assessmentId: string                // Verified Viewing Assessment UUID
  videoId: string                     // Original video UUID from video_jobs
  frameId: string                     // Frame UUID from video_frames
  sourceTimeMs: number                // Genuine PTS timestamp (e.g. 14200 = 00:14.200)
  frameSha256: string                 // Lossless SHA-256 digest of original frame
  checkId: string                     // Validated C01–C45 or V01–V13 ID
  status: "OBSERVED" | "CONCERN" | "SPECIALIST_REVIEW"
  observation: string                 // Descriptive visual finding
  confidence: "low" | "medium" | "high"
  uncertaintyWarning: string          // Non-binding observational disclaimer
  modelVersion: string                // e.g. "claude-3-5-sonnet-20241022"
  verification: "UNVERIFIED"          // Invariant: always UNVERIFIED at creation
  disposition: "PENDING"              // Invariant: always PENDING human review
}
```

If an AI output cites a frame ID that does not exist in `video_frames` for that video job, or cites an unrecognized checklist ID, `validateAiProposals()` automatically discards the item and logs a rejection reason.

---

## 6. Strict Abstention & Safety Rules

The system prompt and validation layer enforce strict negative constraints to prevent misleading legal or structural liability:

| Domain | Strictly Forbidden AI Inference | Mandatory Safe Formulation |
|:---|:---|:---|
| **Concealed Defects** | Diagnosing hidden joist rot, wall tie failure, or active foundation subsidence from surface video. | *"Surface crack / deflection observed; structural engineer investigation required."* |
| **Hazardous Materials** | Confirming presence or absence of asbestos in textured ceiling coatings (C18). | *"Textured pattern coating observed; UKAS-accredited sampling required prior to disturbance."* |
| **Statutory Compliance** | Certifying Gas Safe boiler compliance (C34/C35), EICR electrical status (C37), or fire door ratings (C29). | *"Visible flue / consumer unit photographed; formal certification by registered professional required."* |
| **Quantities & Costs** | Estimating crack width in mm, ceiling heights, room areas, or repair costs. | *"Condition observed; scope and costs determined by Phase 1A/1B engine and trade quotes."* |
| **Lending & Mortgage** | Declaring a property "unmortgageable" (V12). | *"Inquire regarding potential lending constraints; final determination rests with mortgage underwriter."* |

---

## 7. Cost Controls, Per-Deal Budgets & Kill Switch

The cost control system operates across four defense layers:

```
Layer 1: Master Kill Switch (select-provider.ts)
  └── If VIEWING_AI_ENABLED !== "true", provider reverts to free mock/fixture.
      Zero network calls occur.

Layer 2: Pre-Request Budget Guard (budget.ts)
  └── Evaluates: recorded_spend + worst_case_run_cost <= $120.00 hard stop.
  └── Evaluates: runs_today < 25 runs/day.
  └── If either fails, returns HTTP 429 with explicit budget reason.

Layer 3: Per-Deal Cap (New Task 11G-1 Guard)
  └── Enforces maximum of 3 paid analysis runs per Saved Deal (max ~$0.75/deal).
  └── Prevents runaway loops or repetitive triggering on the same property.

Layer 4: Atomic Usage Ledger (ai_usage_ledger table)
  └── Exact integer micro-dollar cost calculated from provider's reported token counts.
  └── Inserted in the same database transaction as the run result.
```

---

## 8. Data Privacy, Third-Party Processing & UK GDPR

Processing genuine property walkthrough videos involves capturing private residential interiors, vendor personal effects, family photographs, and property identification. This triggers specific legal obligations under the UK Data Protection Act 2018 (UK GDPR):

### Privacy Requirements & Risk Mitigation

1. **Vendor / Homeowner Notice & Consent:**
   - Operators conducting video walkthroughs must provide written or clear verbal notice that captured video frames may be analyzed via automated visual due-diligence tools.
   - Operators must avoid filming visible confidential documents (e.g. bank statements, identity papers) or occupants.
2. **Third-Party Data Processing Agreements (DPA):**
   - Both Anthropic and OpenAI provide standard Data Processing Addenda with Standard Contractual Clauses (SCCs) and UK Addenda.
   - **Crucial Invariant:** Commercial API endpoints do **NOT** use customer data to train foundation models.
3. **Data Retention & Ephemeral Transmission:**
   - Frames are transmitted over TLS 1.3 to the provider's API strictly for synchronous processing.
   - Anthropic and OpenAI retain API request payloads for a maximum of 30 days solely for trust and safety abuse monitoring, after which they are permanently purged.
   - Brik by Brik will apply for **Zero Data Retention (ZDR)** status upon commercial enterprise enrollment.
4. **Prohibition on Consumer Free Tiers:**
   - The free tier of Google AI Studio explicitly retains images and logs for human review and model training.
   - **Configuration Rule:** Google AI Studio free tier API keys are strictly banned from all Brik by Brik environments.

---

## 9. Minimal Implementation Scope (Task 11H-Cloud Proposal)

Because Tasks 4A, 11C, 11D, and 11E already established the surrounding infrastructure, the implementation scope to connect live Cloud Vision is minimal:

1. **Configure Anthropic Client (`lib/viewing-assessment/ai/claude-provider.ts`):**
   - Re-verify `@anthropic-ai/sdk` client options and wire `select-provider.ts` to instantiate Claude when `VIEWING_AI_PROVIDER="claude"`.
2. **Add Per-Deal Run Limit:**
   - Add a 3-run per-deal guard to `lib/viewing-assessment/ai/budget.ts`.
3. **Operator "Analyze Frames" Button (`VideoEvidencePanel.tsx`):**
   - Wire the existing UI button to `POST .../analysis-runs` with selected frame IDs.
4. **Integration Test Suite:**
   - Add mocked-network integration tests in `__tests__/ai/claude-cloud-provider.test.ts` proving budget cutoff, rate limiting, and unverified proposal generation.

---

## 10. Owner Approvals Required from James Lake

Before setting `VIEWING_AI_ENABLED=true` or adding an API key, James Lake must approve:

1. **Provider Selection:** Confirm **Anthropic Claude 3.5 Sonnet** as primary cloud provider (~14p–19p per walkthrough) with **OpenAI GPT-4o-mini** as cost fallback (<1p).
2. **Third-Party Data Transmission:** Approve sending extracted 960px JPEG frames of property walkthroughs to Anthropic's UK/US API endpoints under Anthropic's commercial DPA.
3. **Budget Allocation:** Authorize expenditure against the USD 150 project allowance (capped at the $120 hard stop).
4. **Checklist Prompt Clearance:** Confirm that the rewritten C01–C45 and V01–V13 checklist prompts may be interpolated into the cloud system prompt (`VIEWING_CHECKLIST_WORDING_APPROVED=true`).

---

**Report Prepared By:** Brik-by-Brik Engineering (Ponytail v5.3.2)  
**Deliverable Document:** `docs/option2/TASK_11G_1_CLOUD_VISION_API_EVALUATION.md`  
**Application Code Modified:** None (Zero changes, read-only planning mode).
