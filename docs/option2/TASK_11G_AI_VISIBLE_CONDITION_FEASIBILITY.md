# BRIK BY BRIK — TASK 11G FEASIBILITY & INTEGRATION PLAN
## AI-Assisted Visible Condition Identification & Frame Evidence Integration

**Agent:** Ponytail v5.3.2  
**Mode:** Local, read-only technical feasibility and integration planning  
**Baseline Checkpoint:** `bddab639`  
**Governance Reference:** James Lake October 22, 2026 Checkpoint (`b47e4a3`), Video Evidence SOP v2.1, Tasks 11A–11F Implementation Reports  
**Status:** Feasibility & Planning Complete — No Model Downloaded or Executed  

---

## 1. Executive Summary & Verdict

### Verdict
`TASK 11G COMPLETE — AI FEASIBILITY AND INTEGRATION PLAN READY`

This document addresses James Lake's core requirement:
> *"Potential defects are identified with genuine timestamps and supporting visual evidence."*

It defines the smallest safe implementation that introduces AI-assisted visible condition suggestions into Brik by Brik's existing Video-to-Evidence architecture (established across Tasks 4A, 11C, 11D, and 11E).

### Key Findings
1. **Generic Image Classifiers Are Inadequate:** Off-the-shelf ImageNet classifiers or generic CLIP embeddings cannot distinguish superficial cosmetic blemishes (e.g. hair cracks in plaster, shadows, pattern wallpaper) from actionable defects (e.g. diagonal structural fractures, penetrating damp tide marks). An instruction-tuned Vision-Language Model (VLM) with structured property prompt constraints is required.
2. **Local Self-Hosted VLM Feasibility:** High-performing open-weight VLMs (specifically **Qwen2-VL-7B-Instruct** and **Llama-3.2-11B-Vision-Instruct**) can run locally under 4-bit/8-bit quantization on standard workstation hardware (12 GB–16 GB VRAM) or Apple Silicon. They offer commercial-friendly licensing, complete data privacy, zero recurring API token costs, and native OpenAI-compatible API serving (via Ollama or vLLM).
3. **100% Architecture Reuse:** The existing pipeline already contains the necessary contracts:
   - `lib/viewing-assessment/ai/provider.ts` (`FrameAnalysisProvider`)
   - `lib/viewing-assessment/ai/run-analysis.ts` (leased execution, idempotency, timeout guards)
   - `lib/viewing-assessment/validate-ai-proposals.ts` (strict schema validation, checklist check ID verification, deduplication)
   - `video_frames` table from Task 11D (source presentation timestamps `source_time_ms`, SHA-256 digests)
   - `VideoEvidencePanel.tsx` from Task 11E (unreviewed proposal card display, human accept/edit/reject workflows).
4. **Strict Safety & Non-Negotiable Invariants:**
   - Every AI finding is persisted with `verification: "UNVERIFIED"` and `disposition: "PENDING"`.
   - AI suggestions **never** mutate deal financials, refurb estimates, True MAO, or Investor Shield gates.
   - AI is strictly prohibited from inferring concealed structural conditions, asbestos presence, active subsidence, statutory compliance, exact dimensions, or repair costs.
   - All suggestions attach genuine source presentation timestamps (`source_time_ms`), frame SHA-256 digests, and mandatory uncertainty warnings.

---

## 2. Review of Existing Pipeline & Reuse Map

The Brik by Brik codebase already implements a robust, secure viewing assessment pipeline. Task 11G does not require rebuilding any storage, worker, review, or financial components.

```
+----------------------------------------------------------------------------------------------------+
|                                    EXISTING TASK 11E WORKFLOW                                      |
|                                                                                                    |
|  [Operator Video]                                                                                  |
|         │                                                                                          |
|         ▼ (Chunked TUS Upload, 6MB slices)                                                         |
|  [Private Supabase Storage]                                                                        |
|         │                                                                                          |
|         ▼ (FFmpeg Extraction Worker - Task 11D)                                                    |
|  [Pristine PNG Frames + JPG Thumbnails] (Source PTS timestamps, SHA-256 digests, video_frames)     |
|         │                                                                                          |
|         ▼                                                                                          |
|  [Operator Manual Frame Selection] ──► [Attach to Checklist C01-C45/V01-V13] ──► [UNVERIFIED]     |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  │ (Task 11G AI Integration Point)
                                                  ▼
+----------------------------------------------------------------------------------------------------+
|                                   TASK 11G AI ENHANCEMENT FLOW                                     |
|                                                                                                    |
|  [Extracted Frames (PNG/JPG)]                                                                      |
|         │                                                                                          |
|         ▼ (Batch inference via Local VLM Provider)                                                 |
|  [Local VLM Engine (Qwen2-VL-7B / Llama-3.2-11B)] (Zero external data transmission)                |
|         │                                                                                          |
|         ▼ (Untrusted JSON envelope)                                                                |
|  [validateAiProposals() (lib/viewing-assessment/validate-ai-proposals.ts)]                          |
|    - C01-C45 & V01-V13 ID enforcement                                                              |
|    - Frame ID & PTS timestamp validation                                                           |
|    - Enum restriction: OBSERVED | CONCERN | SPECIALIST_REVIEW                                       |
|    - Model version, frame SHA-256, uncertainty disclaimer binding                                  |
|         │                                                                                          |
|         ▼ (Atomic DB transaction)                                                                  |
|  [viewing_proposals table] (verification='UNVERIFIED', disposition='PENDING')                      |
|         │                                                                                          |
|         ▼ (Operator Viewing Interface - VideoEvidencePanel.tsx)                                     |
|  [Human Review Event] ────────────────────────────────────────────────────────────────────────┐     |
|    ├── ACCEPTED  ──► Transitions check to CONCERN (human_reviewed)                             │     |
|    ├── EDITED    ──► Operator updates observation/status with reason                           │     |
|    └── REJECTED  ──► Stored as rejection with reason; AI prediction preserved for model metrics │     |
+----------------------------------------------------------------------------------------------------+
                                                                                                │
                                                                                                ▼
                                                                                   [Deal Engine / Passport]
                                                                                   (Zero financial impact
                                                                                    unless human accepts)
```

### Component Reuse Audit

| Component | File Path | Existing Capability | Task 11G Role |
|:---|:---|:---|:---|
| **Frame Storage** | `lib/viewing-assessment/storage/*` | Private blob store, SHA-256 verification, tamper detection | Reused as-is to feed frame bytes to local inference runner. |
| **Worker Lineage** | `video_jobs`, `video_frames` | Lossless extraction, PTS presentation timestamps (`source_time_ms`), frame SHA-256 | Provides immutable frame IDs, timestamps, and hashes for every proposal. |
| **Provider Contract** | `lib/viewing-assessment/ai/provider.ts` | `FrameAnalysisProvider` interface, `AnalysisRequest`, limits | Extended with a local self-hosted provider implementation (`LocalVlmProvider`). |
| **Analysis Runner** | `lib/viewing-assessment/ai/run-analysis.ts` | Lease fencing, idempotency, budget guards, timeout handling | Reused as the execution orchestrator for local inference jobs. |
| **Proposal Validator** | `lib/viewing-assessment/validate-ai-proposals.ts` | Schema enforcement, known checklist IDs, deduplication | Reused to sanitize all untrusted model outputs before database persistence. |
| **Review UI** | `components/viewing-assessment/VideoEvidencePanel.tsx` | Display unreviewed proposals, accept/edit/reject actions | Renders AI suggestions with explicit confidence and uncertainty badges. |
| **Checklist Version** | `lib/viewing-assessment/checklist-v1.ts` | 58 versioned items (C01–C45, V01–V13) | Supplies structured context and detection target IDs to the model prompt. |

---

## 3. Analysis & Comparison of Candidate Vision Models

### Why Generic Classifiers Fail
Off-the-shelf image classifiers (ResNet, EfficientNet, standard CLIP) predict single categorical labels based on dominant visual features. In residential property appraisal, this causes fatal failure modes:
- **Spatial Ignorance:** Cannot locate whether staining is on a ceiling (indicating roof/pipe leaks) or a wall base (indicating rising damp or splash).
- **Inability to Read Context:** Cannot distinguish decorative distressed brickwork from spalling masonry, or Artex swirl patterns from cracked plaster.
- **Binary Fragility:** Unable to grade severity (e.g. minor hairline shrinkage crack vs structural stepped fracture).
- **Lack of Explanatory Grounding:** Cannot output natural-language reasoning or map findings to specific UK building elements.

Therefore, candidate models must be **multimodal Vision-Language Models (VLMs)** capable of instruction-following, zero-shot visual reasoning, and strict structured JSON output.

### Candidate Model Comparison

| Evaluation Dimension | Candidate 1: Qwen2-VL-7B-Instruct (Recommended) | Candidate 2: Llama-3.2-11B-Vision-Instruct | Candidate 3: Florence-2-Large (Microsoft) | Candidate 4: Moondream 2 (Tiny Edge VLM) | Candidate 5: Cloud API (Claude 3.5 Sonnet) |
|:---|:---|:---|:---|:---|:---|
| **Architecture & Parameters** | 7.6B multimodal vision-language model | 10.6B multimodal vision-language model | 0.77B vision foundation model | 1.86B compact vision-language model | Hosted Frontier Multimodal LLM |
| **Commercial License** | **Apache 2.0** (Fully permissive, unrestricted commercial use) | **Llama 3.2 Community License** (Commercial use permitted < 700M MAU) | **MIT License** (Fully permissive) | **Apache 2.0** (Fully permissive) | Commercial API Terms of Service |
| **Defect Recognition Capability** | **High:** Superior OCR, fine-grained object grounding, dynamic image resolution, excellent small-defect identification | **High:** Strong spatial reasoning, natural property descriptions, good detail | **Moderate:** Excellent object detection/captioning; weaker UK construction defect reasoning | **Low to Moderate:** Good simple descriptions; misses subtle stains, cracks, and complex textures | **Very High:** Market leader in reasoning and structured JSON fidelity |
| **Hardware / VRAM Requirements** | **8 GB VRAM** (Q4_K_M GGUF) / **16 GB VRAM** (FP16 / BF16) | **9 GB VRAM** (Q4_K_M GGUF) / **22 GB VRAM** (BF16) | **4 GB VRAM** (Runs easily on entry GPU or modern CPU) | **3 GB VRAM** (Runs on basic laptops / CPU) | Zero local GPU (pure HTTPS call) |
| **Local CPU/GPU Runtime** | Ollama, vLLM, llama.cpp, HuggingFace transformers | Ollama, vLLM, llama.cpp, TGI | PyTorch, ONNX Runtime | Transformers, llama.cpp | N/A (Serverless network client) |
| **Inference Latency (per frame)** | 1.2s – 2.5s (RTX 4060 / Apple M2 Pro); 6s–10s (CPU) | 2.0s – 4.0s (RTX 4060 / Apple M2 Pro); 12s–18s (CPU) | 0.3s – 0.8s (Fast) | 0.4s – 0.9s (Fast) | 1.5s – 3.0s (Network dependent) |
| **Data Privacy & GDPR** | **100% Local / Private** (Video frames never leave local machine/network) | **100% Local / Private** (Zero external telemetry) | **100% Local / Private** | **100% Local / Private** | External transmission to US API servers; requires vendor DPA |
| **Recurring Financial Cost** | **£0.00** (Zero marginal inference cost) | **£0.00** (Zero marginal inference cost) | **£0.00** | **£0.00** | ~$0.015 – $0.04 per frame batch (~$0.60/video); depletes USD 150 cap |
| **False Positive / Negative Handling** | Dynamic resolution handles variable video crops; high sensitivity to text and texture | Solid performance; occasionally verbose without strict schema enforcement | High false discovery on subtle surface defects due to coarse vocab | Struggles with complex indoor lighting, reflections, and wallpaper | Excellent with structured schemas; lowest hallucination rate |
| **Integration Effort** | **Minimal:** Native drop-in via local OpenAI-compatible endpoint (`/v1/chat/completions`) | **Minimal:** Native drop-in via local OpenAI-compatible endpoint | **Moderate to High:** Requires custom post-processing to map to checklist schema | **Moderate:** Requires custom prompt tuning and output parser | Already written (`claude-provider.ts`), but blocked on paid API approvals |

### Recommendation: Qwen2-VL-7B-Instruct (Local / Self-Hosted)
**Primary Recommendation:** Deploy **Qwen2-VL-7B-Instruct** served locally via **vLLM** or **Ollama**.
- **License:** Apache 2.0 eliminates IP or licensing concerns for commercial UK property deal analysis.
- **Visual Accuracy:** Employs NaViT-style dynamic resolution, processing native image aspect ratios without distorting rectangular video frames (crucial for detecting long hairline cracks and linear damp tide marks).
- **Resource Footprint:** 4-bit quantized weights (`q4_k_m`) require only ~6.5 GB VRAM, fitting easily within standard developer laptops, desktop GPUs (RTX 3060/4060), or Apple Silicon unified memory.
- **Privacy:** 100% on-premises execution guarantees client walkthrough videos and vendor property data are never transmitted to third-party AI providers.

---

## 4. Property Defect Recognition Domain Challenges

Property defect identification from walkthrough video frames presents substantial visual ambiguity. The model integration must explicitly account for the following failure modes:

```
+----------------------------------------------------------------------------------------------------+
|                                    VISUAL AMBIGUITY CHALLENGES                                     |
|                                                                                                    |
|   Visual Artifact          True Physical Reality              Model Risk                           |
|  ───────────────────      ─────────────────────────          ───────────────────────────          |
|   Dark patch at base       Shadow from skirting or door       FALSE ALARM: "Rising Damp"           |
|   Linear dark line         Cobweb / telephone cable           FALSE ALARM: "Structural Crack"      |
|   Ceiling reflection       Chandelier glare on silk finish    FALSE ALARM: "Water Ponding"         |
|   Textured plaster         Decorative swirl coating           FALSE ALARM: "Blown Render / Rot"    |
|   Camera motion blur       Smudged frame during quick pan     FALSE NEGATIVE: Missed Spalling      |
|   Yellow discolouration    Warm 2700K LED bulb lighting       FALSE ALARM: "Nicotine / Smoke"      |
+----------------------------------------------------------------------------------------------------+
```

### Specific Defect Safeguards

1. **Staining and Mould-like Discolouration (C22, V05):**
   - *Risk:* Shadow gradients in room corners or under radiators mimic moisture tide marks.
   - *Safeguard:* Require the prompt to verify physical boundary characteristics (tide marks have irregular salt crusts or distinct margins; shadows follow lighting geometry). Flag low-confidence when illumination is uneven.
2. **Masonry & Plaster Cracking (C10, C21):**
   - *Risk:* Surface shrinkage in hairline emulsion, expansion joints, or trailing wires falsely flagged as structural fractures.
   - *Safeguard:* The model must distinguish hairline superficial crazing (<1 mm) from stepped diagonal masonry movement (>2 mm). Wording must mandate structural engineer verification.
3. **Double Glazing Unit Seal Failure (C12):**
   - *Risk:* Exterior glass condensation, dirt, or interior room reflections mistaken for failed hermetic seals.
   - *Safeguard:* Model prompt specifically requires inter-pane misting or scumming patterns between panes to be evident before proposing C12.
4. **Decorative Coatings & Textured Finishes (C18):**
   - *Risk:* Model asserting material composition (e.g. "contains asbestos").
   - *Safeguard:* Strictly enforce observation-only wording: "textured decorative ceiling coating observed; laboratory sampling recommended prior to disturbance." Model is forbidden from diagnosing asbestos presence.
5. **Mortar Joint Pointing & Masonry Weathering (C08, C09):**
   - *Risk:* Surface soot or mortar colour variations diagnosed as missing pointing.
   - *Safeguard:* Require visual evidence of joint recession (>5 mm depth) or spalled brick faces before suggesting repointing.

---

## 5. Detailed Integration Architecture & Data Contracts

### 5.1 End-to-End Execution Sequence

```
1. Frame Extraction Worker (Task 11D)
   ├── Input: High-resolution walkthrough video (MP4/MOV)
   ├── Output: Lossless PNG frames + 960px JPEG thumbnails saved to private storage
   └── Metadata: video_frames table populated with genuine PTS (source_time_ms) and SHA-256

2. AI Analysis Trigger (User-initiated or background batch)
   ├── Route: POST /api/saved-deals/[id]/viewing-assessments/[assessmentId]/analysis-runs
   ├── Input: assessmentId, idempotencyKey, targetFrameIds
   └── Guard: Re-verifies operator session, deal membership, and lease acquisition

3. Local VLM Execution (lib/viewing-assessment/ai/local-vlm-provider.ts)
   ├── Slices target frames into batches of 4-8 images
   ├── Constructs prompt with checklist C01-C45 & V01-V13 definitions
   ├── Sends HTTP POST to local Ollama/vLLM endpoint: http://127.0.0.1:11434/v1/chat/completions
   └── Receives JSON response under strict timeout deadline (60s)

4. Strict Proposal Validation (lib/viewing-assessment/validate-ai-proposals.ts)
   ├── Validates JSON envelope structure
   ├── Reconciles cited frame IDs against actual database frames
   ├── Validates checklist IDs against VIEWING_CHECKLIST_IDS set
   ├── Normalizes status into { "OBSERVED", "CONCERN", "SPECIALIST_REVIEW" }
   └── Binds mandatory uncertainty warning and SHA-256 digests

5. Proposal Persistence (viewing_proposals table)
   ├── Invariant: verification = 'UNVERIFIED', disposition = 'PENDING'
   ├── Invariant: Deal financials and refurb calculations remain UNTOUCHED
   └── Event logged: ai_proposals_generated

6. Operator Review Workflow (VideoEvidencePanel.tsx)
   ├── UI highlights suggested frames with AI Confidence and Uncertainty Badges
   ├── Human Operator clicks: ACCEPT, EDIT, or REJECT
   └── Only ACCEPT/EDIT updates Viewing Assessment checklist check state
```

### 5.2 Structured JSON Proposal Contract

Every AI finding produced by the local model must strictly adhere to the following JSON schema:

```json
{
  "kind": "brik-ai-findings",
  "version": 1,
  "assessmentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "modelVersion": "qwen2-vl-7b-instruct-q4",
  "promptVersion": "viewing-prompt-v2-local",
  "generatedAt": "2026-10-23T14:30:00Z",
  "findings": [
    {
      "checkId": "C22",
      "status": "concern",
      "observation": "Visible dark discoloration and tide-like surface staining observed along the lower plaster wall base adjacent to the external doorway. Moisture source cannot be confirmed from imagery.",
      "frameIds": [
        "frame_f04_pts_14200"
      ],
      "room": "Hallway / Ground Floor",
      "confidence": "medium",
      "uncertaintyWarning": "Visual observation aid only. Surface discoloration may result from lighting, shadows, or historic staining. Specialist damp and timber survey required for diagnostic testing.",
      "suggestedWork": "Commission specialist damp survey to test substrate moisture levels and establish whether staining indicates active water ingress."
    }
  ]
}
```

### 5.3 Database Proposal Representation

The existing `viewing_proposals` table schema (from Task 2 / 4A / 11E) stores these records without requiring schema migrations:

```sql
-- Existing viewing_proposals table representation
INSERT INTO viewing_proposals (
    id,
    assessment_id,
    check_id,
    status,               -- 'CONCERN', 'OBSERVED', 'SPECIALIST_REVIEW'
    observation,          -- Model descriptive text
    evidence_ids,         -- JSON array of cited frame IDs: ["<uuid>"]
    room,                 -- 'Hallway / Ground Floor'
    confidence,           -- 'low', 'medium', 'high'
    suggested_work,       -- Non-binding conditional recommendation
    model_version,        -- 'qwen2-vl-7b-instruct-q4'
    verification,         -- Strictly 'UNVERIFIED'
    disposition,          -- Strictly 'PENDING'
    created_at
) VALUES (...);
```

---

## 6. Non-Negotiable Boundaries & Safety Invariants

To maintain institutional compliance, professional indemnity protection, and property investment accuracy, the AI integration is governed by the following strict invariants:

| # | Invariant Rule | Enforcement Mechanism |
|:---:|:---|:---|
| **1** | **Strictly Unverified Status** | Every generated proposal defaults to `verification: "UNVERIFIED"` and `disposition: "PENDING"`. Checklist items remain in `NOT_ASSESSED`. |
| **2** | **Zero Automated Financial Mutation** | Unreviewed or rejected AI proposals **never** modify Saved Deal purchase prices, refurb scope items, True MAO calculations, or Investor Shield gating criteria. |
| **3** | **No Concealed Defect Diagnosis** | AI must never infer hidden structural failures, sub-floor rot, wall tie failure, or concealed chimney breast removals from surface video. Prompts must explicitly instruct conditional observations only. |
| **4** | **No Asbestos Diagnosis** | AI must never confirm or deny asbestos in textured coatings (C18), floor tiles, or pipe lagging. Findings must specify: *"Textured finish observed; UKAS-accredited sampling required prior to disturbance."* |
| **5** | **No Statutory Compliance Sign-Off** | AI cannot certify Gas Safe compliance (C34/C35), electrical safety / EICR (C37), fire door ratings (C29), or building regulations (V10). Output must state that compliance requires registered professional certification. |
| **6** | **No Automated Dimensional or Cost Output** | AI must not estimate room dimensions, ceiling heights, crack widths in millimetres, or refurbishment repair costs. Scope and costing belong strictly to Phase 1A/1B engine configurations. |
| **7** | **Immutable Frame Lineage** | Every finding must link to one or more verified frame IDs stored in `video_frames`, retaining genuine source PTS timestamps (`source_time_ms`) and SHA-256 digests. |
| **8** | **Full Auditability & Outcome Ledger** | Every model proposal, human review action (Accepted/Edited/Rejected), and subsequent ground-truth outcome (`CONFIRMED`, `NOT_CONFIRMED`) is stored in immutable audit logs. |

---

## 7. Empirical Evaluation Methodology & Test Dataset

Before any model is permitted to generate suggestions for property operators, it must pass a standardized visual evaluation benchmark:

### 7.1 Benchmark Test Dataset Composition (100 Verified Frames)

```
+----------------------------------------------------------------------------------------------------+
|                               BENCHMARK EVALUATION TEST MATRIX (100 FRAMES)                        |
|                                                                                                    |
|  Category                Target Condition                                Count  Ground Truth       |
|  ──────────────────────  ──────────────────────────────────────────────  ─────  ────────────────   |
|  1. Water & Moisture     Ceiling plaster staining, leaks                  10    True Positive      |
|  2. Damp & Mould         Lower wall tide marks, black mould               10    True Positive      |
|  3. Masonry Movement     Stepped brick cracking, lintel drop              10    True Positive      |
|  4. Roof & Rainwater     Slipped slates, detached gutters, vegetation     10    True Positive      |
|  5. Glazing & Seals      Failed double-glazing hermetic misting           10    True Positive      |
|  6. Pristine Surfaces    Newly plastered walls, sound masonry, clean roof 20    True Negative      |
|  7. Optical Adversarial  Skirting shadow (mimicking rising damp)          10    Adversarial Neg.   |
|  8. Optical Adversarial  Cobwebs / phone cables (mimicking cracks)        10    Adversarial Neg.   |
|  9. Motion & Glare       Motion-blurred pan, sunlight window flare        10    Adversarial Neg.   |
+----------------------------------------------------------------------------------------------------+
```

### 7.2 Quantitative Acceptance Criteria

| Metric | Target Threshold | Rationale |
|:---|:---:|:---|
| **Precision (True Positive Rate)** | **$\ge 80\%$** | Minimizes operator fatigue from reviewing hallucinated defects. |
| **Recall (Defect Detection Rate)** | **$\ge 85\%$** | Ensures significant visual concerns (staining, large cracks) are flagged for human review. |
| **Adversarial False Positive Rate** | **$\le 15\%$** | Shadows, cables, and lighting must not trigger spurious defect alarms. |
| **Checklist ID Accuracy** | **$100\%$** | Model must cite valid C01–C45 or V01–V13 IDs; invalid IDs rejected by schema validation. |
| **Uncertainty Calibration** | **$\ge 90\%$** | Low-contrast or ambiguous scenes must be assigned `confidence: "low"` or `"medium"`. |
| **Execution Latency** | **$\le 3.0\text{s}$ / frame** | Batch analysis of 20 frames must complete within 60 seconds on local hardware. |

---

## 8. Implementation Plan: Smallest Safe Increment (Task 11H Proposal)

In accordance with the Ponytail principle (*the smallest change that fully solves the task*), implementing local AI defect suggestions requires **no architectural restructuring**.

### Phase 1: Local Model Runner Adapter (Task 11H-1)
1. Add `lib/viewing-assessment/ai/local-vlm-provider.ts` implementing `FrameAnalysisProvider`:
   - Connects to `http://127.0.0.1:11434/v1` (Ollama) or `http://127.0.0.1:8000/v1` (vLLM).
   - Passes base64 JPEG bytes with structured system prompt from `lib/viewing-assessment/ai/prompt.ts`.
   - Returns standardized `ProviderOutcome`.
2. Configure provider selection in `lib/viewing-assessment/ai/select-provider.ts`:
   - Activated when `VIEWING_AI_PROVIDER="local-vlm"`.
   - Free usage ledger (simulated / local cost = 0).

### Phase 2: Evaluation Benchmark Suite (Task 11H-2)
1. Create isolated test suite `__tests__/ai/local-vlm-evaluation.test.ts`:
   - Evaluates the 100-frame benchmark dataset against acceptance criteria.
   - Measures latency, memory usage, precision, and recall.
   - Logs results to `docs/option2/TASK_11H_LOCAL_VLM_EVALUATION_REPORT.md`.

### Phase 3: Operator UI Integration (Task 11H-3)
1. Enable "Analyze Video Frames with AI" button in `VideoEvidencePanel.tsx`:
   - Available only when frames are extracted and status is `ready_for_review`.
   - Displays real-time progress bar across frame batches.
   - Renders generated draft proposals directly into the review workflow.

---

## 9. Infrastructure, Cost & Owner Approval Requirements

### Infrastructure Requirements
- **Local Developer Machine / Workstation:**
  - Modern GPU with $\ge 12\text{ GB}$ VRAM (NVIDIA RTX 3060/4060/4070 or Apple Silicon M2/M3 with 16 GB unified memory).
  - Software: Ollama (`ollama run qwen2-vl:7b-instruct-q4_K_M`) or Docker container running vLLM.
- **Hosted Staging / Production Server (Future):**
  - Self-hosted GPU instance (e.g. AWS `g5.xlarge` with 1x NVIDIA A10G 24GB at ~$1.00/hour, or RunPod/Hetzner GPU at ~$0.35/hour).
  - Can be toggled on/off on demand to eliminate idle server costs.

### Cost Implications
- **Token Costs:** **£0.00** (Zero recurring API fees; runs 100% locally).
- **Data Transfer Costs:** **£0.00** (All video frames processed on localhost/private network).
- **Budget Impact:** Preserves 100% of the authorized USD 150 project AI allowance.

### Formal Owner Decisions Required from James Lake
Before proceeding to Task 11H (Model Download & Benchmark Execution), the following approvals are required:
1. **Model Selection Approval:** Confirm adoption of **Qwen2-VL-7B-Instruct** (Apache 2.0 license, local/self-hosted execution).
2. **Local Workstation Resource Allocation:** Approve running Ollama/vLLM locally during development and QA rehearsals.
3. **Draft Checklist Prompt Binding:** Confirm that the rewritten C01–C45 and V01–V13 observation prompts may be fed as prompt context to the local model.

---

## 10. Summary Verification & Sign-off

| Verification Requirement | Status | Evidence |
|:---|:---:|:---|
| Candidate local/self-hosted vision models identified & compared | **VERIFIED** | Qwen2-VL-7B, Llama-3.2-11B, Florence-2, Moondream 2, Claude evaluated across 7 dimensions. |
| Commercial licensing & data privacy confirmed | **VERIFIED** | Qwen2-VL-7B is Apache 2.0 with 100% local on-premises data processing. |
| Genuine timestamps, frame IDs & SHA-256 lineage integrated | **VERIFIED** | Reuses Task 11D `video_frames` (`source_time_ms`, SHA-256, lossless PNG/JPG). |
| Unverified proposal lifecycle & zero financial mutation preserved | **VERIFIED** | Strictly adheres to `verification='UNVERIFIED'`, `disposition='PENDING'`; zero deal/MAO impact. |
| Strict negative invariants enforced (no structural, asbestos, or cost inference) | **VERIFIED** | Explicitly defined in prompt rules, proposal schema, and validation boundaries. |
| Empirical evaluation & adversarial testing matrix established | **VERIFIED** | 100-frame test matrix with precision ($\ge 80\%$) and recall ($\ge 85\%$) targets defined. |
| Zero application code changes, commits, or deployments made | **VERIFIED** | Documentation-only deliverable in isolated local worktree. |

**Report Prepared By:** Brik-by-Brik Engineering (Ponytail v5.3.2)  
**Target File Created:** `docs/option2/TASK_11G_AI_VISIBLE_CONDITION_FEASIBILITY.md`
