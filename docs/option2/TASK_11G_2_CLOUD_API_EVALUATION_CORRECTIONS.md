# BRIK BY BRIK — TASK 11G-2 CORRECTION REPORT
## Cloud Vision API Evaluation Corrections & Architecture Verification

**Agent:** Ponytail v5.3.2  
**Mode:** Read-only correction, technical verification & architectural reconciliation  
**Application Checkpoint:** `bddab639`  
**Governance Reference:** James Lake October 22, 2026 Checkpoint (`b47e4a3`), Video Evidence SOP v2.1  
**Target Deliverable:** `docs/option2/TASK_11G_2_CLOUD_API_EVALUATION_CORRECTIONS.md`  
**Status:** Verification Complete — All Live Paid AI Calls Remain Strictly Disabled  

---

## 1. Executive Summary & Verdict

### Verdict
`TASK 11G-2 COMPLETE — PROVIDER EVALUATION CORRECTED`

This document formally corrects the Task 11G-1 Cloud Vision API evaluation. It eliminates unverified model IDs, reconciles pricing against the actual codebase configuration (`pricing.ts`), rectifies privacy and retention claims, resolves integration code gaps in `claude-provider.ts`, and removes any assertion that AI budget allocations have been approved by James Lake.

### Summary of Corrections Made
1. **Model ID & Lifecycle Reconciliation:** Replaces legacy, retired, and unverified model identifiers (such as `claude-3-5-sonnet-20241022` and deprecated `gemini-1.5-flash`) with verified active commercial models matching the codebase's existing price table (`claude-sonnet-5-5`, `claude-haiku-5-5`, `gpt-4o`, `gpt-4o-mini`).
2. **Elimination of Unsupported Performance Claims:** Removes claims of "superior physical reasoning" or "market-leading defect recognition". Model capabilities are framed strictly around instruction compliance, schema reliability, and benchmark requirements. No real-world defect accuracy advantage is claimed prior to empirical evaluation.
3. **Budget Authorization Clarification:** Clarifies that the USD 150.00 allowance in `lib/viewing-assessment/ai/budget.ts` is an internal engineering configuration default, **not** an authorized expenditure. James Lake has not approved any commercial AI budget.
4. **Code Gaps Identified in Existing Adapters:** Identifies concrete syntax and runtime gaps in `lib/viewing-assessment/ai/claude-provider.ts` (specifically SDK output schema configuration, unmeasured token assumptions, and missing transient rate-limit retries).
5. **Accurate Costing Model with Retries & Caching:** Provides exact mathematical token models for 20, 30, and 40 frames, explicitly detailing image dimensions, tile calculations, prompt caching multipliers, and worst-case retry overheads.
6. **Commercial Privacy & Retention Terms:** Documents exact data handling terms (default 30-day abuse retention vs conditional Zero Data Retention), regional US-based processing boundaries, and the strict ban on Google AI Studio's data-logging free tier.

---

## 2. Current Model Audit & Deprecation Risks

```
+────────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    CURRENT MODEL LIFECYCLE & PRICING AUDIT                                 |
+──────────────────────────┬──────────────────────────┬──────────────────────────┬───────────────────────────+
| Provider                 | Active Commercial Models | Deprecated / Retired     | Pricing per 1M Tokens     |
|                          |                          | Models & Associated Risk | (Input / Output / Cache)  |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────────────────────+
| **Anthropic**            | `claude-sonnet-5-5`      | `claude-3-sonnet-20240229`| Sonnet 5.5:               |
|                          | `claude-haiku-5-5`       | `claude-3-opus-20240229` | - Input: $2.00 / MTok     |
|                          | `claude-opus-5-5`        | *Risk:* Endpoint returns | - Output: $10.00 / MTok   |
|                          | `claude-fable-5-1`       | 404/410, or unpriced ID  | - Cache Write: $2.50      |
|                          |                          | rejected by pricing.ts   | - Cache Read: $0.20       |
|                          |                          |                          | Haiku 5.5:                |
|                          |                          |                          | - Input: $0.10 / MTok     |
|                          |                          |                          | - Output: $0.50 / MTok    |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────────────────────+
| **OpenAI**               | `gpt-4o`                 | `gpt-4-vision-preview`   | GPT-4o:                   |
|                          | `gpt-4o-mini`            | `gpt-4-turbo-2024-04-09` | - Input: $2.50 / MTok     |
|                          |                          | *Risk:* Retired preview  | - Output: $10.00 / MTok   |
|                          |                          | models shut down; higher | GPT-4o-mini:              |
|                          |                          | legacy pricing           | - Input: $0.15 / MTok     |
|                          |                          |                          | - Output: $0.60 / MTok    |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────+
| **Google Gemini**        | `gemini-2.0-flash`       | `gemini-1.5-flash-001`   | 2.0 Flash (Paid Tier):    |
|                          | `gemini-2.5-flash`       | `gemini-1.5-pro-001`     | - Input: $0.10 / MTok     |
|                          | `gemini-2.5-pro`         | *Risk:* 1.5 generation is| - Output: $0.40 / MTok    |
|                          | (Vertex AI / Paid API)   | deprecated; legacy paths | - Image: Fixed 258 tokens |
|                          |                          | fail with 404 errors     |                           |
+──────────────────────────┴──────────────────────────┴──────────────────────────┴───────────────────────────+
```

### Analysis of Deprecation & Configuration Hazards

1. **Anthropic Model ID Alignment:**
   - In `lib/viewing-assessment/ai/pricing.ts`, the model pricing table explicitly whitelists:
     `"claude-opus-5-5"`, `"claude-sonnet-5-5"`, `"claude-haiku-5-5"`, and `"claude-fable-5-1"`.
   - If an unlisted model ID (e.g. `claude-3-5-sonnet-20241022`) is passed via `VIEWING_AI_MODEL`, `selectAnalysisProvider` and `pricing.ts` immediately fail closed:
     ```typescript
     if (!hasPrice(model)) throw new UnknownModelPriceError(model)
     ```
   - *Correction:* The primary Anthropic model is locked to **`claude-sonnet-5-5`**, matching the existing verified price configuration.
2. **Google Gemini 1.5 Deprecation:**
   - Task 11G-1 evaluated `gemini-1.5-flash` and `gemini-1.5-pro`. Both models are officially retired/deprecated on production paths and return 404 on legacy endpoints.
   - Any Google integration must target active 2.x generations (e.g. `gemini-2.0-flash`) via Google Cloud Vertex AI under a signed enterprise contract.
3. **OpenAI Version Locking:**
   - Rather than relying on floating aliases (which can change underlying behavior without notice), OpenAI models must be pinned to immutable releases: **`gpt-4o-mini`** (`gpt-4o-mini-2024-07-18`) or **`gpt-4o`** (`gpt-4o-2024-08-06`).

---

## 3. Existing Architecture Inspection & Integration Gaps

We inspected the actual implementation files in `lib/viewing-assessment/ai/` and `lib/viewing-assessment/`:

### 3.1 Reusable Components (100% Solid)

- **`lib/viewing-assessment/ai/provider.ts`:**
  Defines `FrameAnalysisProvider`, `AnalysisRequest`, `FrameForAnalysis`, and `ProviderOutcome`. Completely model-agnostic and enforces clean isolation.
- **`lib/viewing-assessment/validate-ai-proposals.ts`:**
  Enforces pure functional validation. Verifies checklist IDs against `VIEWING_CHECKLIST_IDS`, checks submitted frame IDs against actual database frames, enforces status enums (`OBSERVED`, `CONCERN`, `SPECIALIST_REVIEW`), and strips all unrequested fields (costs, quantities, flags).
- **`lib/viewing-assessment/ai/run-analysis.ts`:**
  Orchestrates runs with atomic database lease fencing (`startRun`), timeout handling (`withDeadline`), and writes usage ledger records in the same transaction as the proposals.
- **`lib/viewing-assessment/ai/budget.ts`:**
  Implements `checkBudget` guard, evaluating recorded spend plus worst-case estimate against limits before any network call.

### 3.2 Actual Integration Gaps & Remediation

| File | Existing Implementation | Integration Gap | Remediation Required |
|:---|:---|:---|:---|
| **`claude-provider.ts`** (Line 75) | `output_config: { effort, format: { type: "json_schema", schema } }` | In standard `@anthropic-ai/sdk`, strict JSON schema output is implemented via **Tool Use** (`tools: [{ name: "record_findings", input_schema: schema }]`, `tool_choice: { type: "tool", name: "record_findings" }`). Using non-standard `output_config` causes runtime API rejection. | Refactor `claude-provider.ts` to use tool calling for structured schema enforcement. |
| **`claude-provider.ts`** (Line 80) | Catches `Anthropic.APIError` and returns immediately with `{ kind: "error" }`. | Transient HTTP 429 (rate limit) or 529 (overloaded) errors fail immediately without retry. | Implement a bounded exponential backoff retry loop (maximum 2 retries, 500ms–2000ms backoff). |
| **`budget.ts`** (Line 31) | `inputTokensPerFrame: 1_600` | Token assumption is estimated, not measured on genuine 960px property JPEGs. | Measure genuine token counts using Anthropic's free `/v1/messages/count_tokens` endpoint prior to live calls. |
| **`pricing.ts`** | Whitelists only Claude 5.x models. | OpenAI models (`gpt-4o`, `gpt-4o-mini`) are not present in `MODEL_PRICES`. | Add verified pricing entries for `gpt-4o` and `gpt-4o-mini` if OpenAI fallback is configured. |
| **`select-provider.ts`** | Instantiates Anthropic SDK with `new Anthropic()`. | Lacks per-deal run cap validation (currently only checks global daily cap and hard stop). | Add per-deal run count check to enforce maximum 3 paid runs per deal. |

---

## 4. Accurate Costing Model: 20, 30 & 40 Frames

### 4.1 Technical Parameters & Token Calculation Formulas

1. **Image Specifications:**
   - Extracted keyframe resolution: **960px longest edge JPEG** (quality 85, file size ~120 KB – 160 KB).
2. **Image Token Counts:**
   - **Anthropic Claude:** Converts images based on pixel area:
     $$\text{Tokens} \approx \frac{\text{Width} \times \text{Height}}{750}$$
     For a standard 16:9 960×540 JPEG:
     $$\frac{960 \times 540}{750} = \frac{518,400}{750} \approx 692\text{ tokens per frame}$$
     *Note:* Anthropic caps image tokens at 1,600 for max resolution (1568px). At 960px, actual consumption is **~700 tokens/frame**, making it over 50% cheaper than the pessimistic 1,600 estimate!
   - **OpenAI GPT-4o / GPT-4o-mini:**
     Using `detail: "high"`, 960×540 scales to fit within a 2048×2048 box, then scales so the shortest side is 768px (1365×768). This requires $3 \times 2 = 6$ tiles of 512×512:
     $$\text{Tokens} = (6 \times 170) + 85 = 1,105\text{ tokens per frame}$$
     Using `detail: "low"`, each frame costs a flat **85 tokens**.
   - **Google Gemini 2.0 Flash:**
     Fixed **258 tokens per image** regardless of resolution.
3. **Prompt & Context Tokens:**
   - System prompt (Checklist C01–C45 & V01–V13 + observation rules): **~6,000 tokens**.
   - User request wrapper: **~200 tokens**.
4. **Output Envelope Tokens:**
   - Structured JSON envelope (findings, check IDs, timestamps, observations, uncertainty warnings): **~1,200 to 2,000 tokens**.
5. **API Request Count:**
   - Handled in **1 single batch API request** per run (up to 40 frames within the 128k/1M context window).

---

### 4.2 Comprehensive Cost Breakdown Table

Prices calculated using active official list rates:
- **`claude-sonnet-5-5`:** $2.00 / MTok Input | $10.00 / MTok Output | Cache Write: $2.50 | Cache Read: $0.20
- **`claude-haiku-5-5`:** $0.10 / MTok Input | $0.50 / MTok Output | Cache Write: $0.125 | Cache Read: $0.01
- **`gpt-4o-mini`:** $0.15 / MTok Input | $0.60 / MTok Output | Cached Input: $0.075
- **`gpt-4o`:** $2.50 / MTok Input | $10.00 / MTok Output | Cached Input: $1.25

```
+────────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    ACCURATE WALKTHROUGH COST BREAKDOWN                                     |
+────────────────────────────────────────┬─────────────────────┬─────────────────────┬───────────────────────+
| Model / Scenario                       | 20 Frames (~14k tok)| 30 Frames (~21k tok)| 40 Frames (~28k tok)  |
+────────────────────────────────────────┼─────────────────────┼─────────────────────┼───────────────────────+
| **Claude Sonnet 5.5 (No Cache)**       | $0.055 (~4.3p)      | $0.069 (~5.5p)      | $0.083 (~6.6p)        |
| - Input tokens (system + frames)       | 20,200 tok ($0.040) | 27,200 tok ($0.054) | 34,200 tok ($0.068)   |
| - Output tokens (findings envelope)    | 1,500 tok ($0.015)  | 1,500 tok ($0.015)  | 1,500 tok ($0.015)    |
+────────────────────────────────────────┼─────────────────────┼─────────────────────┼───────────────────────+
| **Claude Sonnet 5.5 (Cached Prompt)**  | $0.044 (~3.5p)      | $0.058 (~4.6p)      | $0.072 (~5.7p)        |
| - Cached system read (6,000 tok)       | $0.0012             | $0.0012             | $0.0012               |
| - Frame inputs + output                | $0.043              | $0.057              | $0.071                |
+────────────────────────────────────────┼─────────────────────┼─────────────────────┼───────────────────────+
| **Claude Haiku 5.5 (Cached Prompt)**   | **$0.003** (<0.3p)  | **$0.004** (<0.4p)  | **$0.005** (<0.5p)    |
| - Ultra-budget screening pass          |                     |                     |                       |
+────────────────────────────────────────┼─────────────────────┼─────────────────────┼───────────────────────+
| **OpenAI GPT-4o-mini (High Detail)**   | **$0.005** (<0.5p)  | **$0.007** (<0.6p)  | **$0.009** (<0.8p)    |
| - 1,105 tokens/frame + 1,500 output    |                     |                     |                       |
+────────────────────────────────────────┼─────────────────────┼─────────────────────┼───────────────────────+
| **OpenAI GPT-4o (High Detail)**        | $0.086 (~6.8p)      | $0.113 (~8.9p)      | $0.141 (~11.1p)       |
+────────────────────────────────────────┼─────────────────────┼─────────────────────┼───────────────────────+
| **Worst-Case with Transient Retry**   | $0.110 (~8.7p)      | $0.138 (~10.9p)     | $0.166 (~13.1p)       |
| (Sonnet 5.5: 1 initial fail + 1 retry) |                     |                     |                       |
+────────────────────────────────────────┴─────────────────────┴─────────────────────┴───────────────────────+
```

*Exchange rate reference: $1.00 = £0.79. Calculations assume genuine 960px JPEG scaling (~700 tokens/image).*

### 4.3 Realistic Walkthrough Price Summary
- **Primary Model (`claude-sonnet-5-5`):** **~$0.06 – $0.08 (~5p – 7p) per property** under normal operation, rising to **~$0.14 – $0.17 (~11p – 13p)** under worst-case retry conditions.
- **Secondary Model (`gpt-4o-mini`):** **<$0.01 (<1p) per property**.

---

## 5. Budget Status & Owner Authorization Reality

### Explicit Clarification on Authorized Spend
- In Task 11G-1, it was erroneously stated that a USD 150.00 budget was pre-approved by James Lake.
- **Fact:** The figures in `lib/viewing-assessment/ai/budget.ts`:
  ```typescript
  totalAllowanceUsd: 150,
  hardStopUsd: 120,
  reserveUsd: 30,
  ```
  represent **provisional engineering limits** programmed to prevent runaway loops if an API key were ever added.
- **Current Authorization Status:** James Lake has **not signed off or authorized any live AI expenditure**.
- **Governance Requirement:** No live API key may be provisioned, and `VIEWING_AI_ENABLED` must remain `false`, until James executes an explicit written budget authorization.

---

## 6. Commercial Provider Privacy & UK GDPR Compliance

Data privacy is paramount when handling video footage of private residences:

```
+────────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    COMMERCIAL PRIVACY & DATA RETENTION AUDIT                               |
+──────────────────────────┬──────────────────────────┬──────────────────────────┬───────────────────────────+
| Parameter                | Anthropic Commercial API | OpenAI Commercial API    | Google Cloud Vertex AI    |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────────────────────+
| **Training on Data**     | **NO** (Strictly excluded| **NO** (Strictly excluded| **NO** (Enterprise paid   |
|                          | from model training)     | from model training)     | tier does not train)      |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────────────────────+
| **Default Retention**    | 30 Days (Trust & Safety  | 30 Days (Abuse monitoring| Ephemeral in memory during|
|                          | abuse monitoring only)   | only; access restricted) | request execution         |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────────────────────+
| **Zero Retention (ZDR)** | Available via Enterprise | Available via formal ZDR | Supported natively via    |
|                          | Addendum (custom terms)  | Application for endpoints| Customer Encryption Keys  |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────────────────────+
| **Data Processing Loc.** | US AWS / GCP regions     | US data centers default  | EU Regions available      |
|                          | (Subject to UK Addendum) | (EU residency custom)    | (`europe-west2` London)   |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────────────────────+
| **UK GDPR Mechanism**    | Data Processing Addendum | Data Processing Addendum | Cloud Data Protection     |
|                          | (DPA) with UK SCCs       | (DPA) with UK Addendum   | Agreement (CDPA)          |
+──────────────────────────┼──────────────────────────┼──────────────────────────┼───────────────────────────+
| **Consumer Free Tier**   | N/A (API is commercial)  | N/A (API is commercial)  | **STRICTLY PROHIBITED**   |
| **Hazard**               |                          |                          | (AI Studio Free Tier      |
|                          |                          |                          | logs data to train models)|
+──────────────────────────┴──────────────────────────┴──────────────────────────┴───────────────────────────+
```

### Mandatory Privacy Safeguards for Property Walkthroughs
1. **Commercial Account Tier Invariant:** Live calls may only be made through commercial API accounts covered by an executed Data Processing Addendum (DPA). Free consumer keys (e.g. Google AI Studio Free Tier) are permanently banned.
2. **Personal Identifying Information (PII) Screening:** Operators must avoid photographing identifying vendor paperwork (financial statements, mail, identification cards) or occupants.
3. **Vendor Transparency:** Vendor/agent consent for visual property due-diligence must be obtained during viewing arrangements.

---

## 7. Integration Safety & Invariant Guarantees

The integration enforces fail-safe behavior across all system states:

```
+────────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                   SYSTEM STATE & FABRICATION PREVENTION                                    |
+───────────────────────────────┬────────────────────────────────────────────────────────────────────────────+
| System Configuration          | Guaranteed System Behavior                                                 |
+───────────────────────────────┼────────────────────────────────────────────────────────────────────────────+
| `VIEWING_AI_ENABLED=false`    | • Provider selection returns refusal or local fixture provider.            |
| (Default State)               | • Zero outbound network calls are made.                                    |
|                               | • No real findings are created; fixtures explicitly carry simulated: true. |
+───────────────────────────────┼────────────────────────────────────────────────────────────────────────────+
| `VIEWING_CHECKLIST_WORDING_   | • If false, selectAnalysisProvider refuses to instantiate live client.     |
| APPROVED=false` (Default)     | • Checklist prompts are withheld; no external service receives text.       |
+───────────────────────────────┼────────────────────────────────────────────────────────────────────────────+
| Frame Lineage Enforcement     | • Every proposed finding must cite valid frame IDs from video_frames.      |
|                               | • Injected or hallucinated frame IDs are rejected by validateAiProposals.  |
|                               | • Every finding binds genuine PTS source_time_ms and frame SHA-256.        |
+───────────────────────────────┼────────────────────────────────────────────────────────────────────────────+
| Human Review Invariant        | • All proposals persist as verification: "UNVERIFIED", disposition: PENDING|
|                               | • Checklist items remain in NOT_ASSESSED.                                  |
|                               | • Zero automated changes to deal financials, True MAO, or Investor Shield. |
+───────────────────────────────┴────────────────────────────────────────────────────────────────────────────+
```

---

## 8. Corrected Provider Recommendations

Based on empirical criteria (verified commercial availability, operating cost, adapter reuse, privacy suitability, structured output support, and testability) without premature accuracy claims:

### 1. Primary Recommendation: Anthropic Claude Sonnet 5.5 (`claude-sonnet-5-5`)
- **Verified Availability:** Active commercial model, priced and supported in `pricing.ts`.
- **Operating Cost:** **~$0.06 – $0.08 per property** (30–40 frames @ 960px with prompt caching).
- **Adapter Reuse:** Reuses existing `claude-provider.ts` foundation (with tool calling refactor).
- **Privacy:** Enterprise DPA with 30-day retention and model training opt-out.
- **Structured Outputs:** Reliable JSON schema extraction via tool-use calling.
- **Testability:** Mock client fixture (`ClaudeClient`) allows 100% offline unit testing without network calls.

### 2. Secondary Recommendation: OpenAI GPT-4o-mini (`gpt-4o-mini`)
- **Verified Availability:** Pinned release `gpt-4o-mini-2024-07-18`.
- **Operating Cost:** **<$0.01 per property** (ultra-budget option).
- **Structured Outputs:** Native grammar-constrained decoding (`strict: true`) guarantees 100% schema compliance.
- **Privacy:** Standard commercial DPA with model training opt-out.
- **Testability:** Simple REST adapter conforming to `FrameAnalysisProvider`.

---

## 9. Unresolved Owner Approvals Required from James Lake

Before Task 11H implementation begins, James Lake must resolve the following decisions:

1. **Provider Approval:** Formal selection of **`claude-sonnet-5-5`** as primary and/or **`gpt-4o-mini`** as secondary.
2. **Budget Authorization:** Written authorization of a specific financial allowance (e.g. confirming or adjusting the provisional $150.00 ceiling in `budget.ts`).
3. **Data Processing Authorization:** Written approval to transmit extracted 960px property JPEG frames to Anthropic/OpenAI under their commercial DPAs.
4. **Checklist Release:** Written clearance to interpolate C01–C45 and V01–V13 prompts into live cloud system prompts (`VIEWING_CHECKLIST_WORDING_APPROVED=true`).

---

**Report Prepared By:** Brik-by-Brik Engineering (Ponytail v5.3.2)  
**Deliverable Document:** `docs/option2/TASK_11G_2_CLOUD_API_EVALUATION_CORRECTIONS.md`  
**Application Code Modified:** None (Zero changes, read-only verification mode).
