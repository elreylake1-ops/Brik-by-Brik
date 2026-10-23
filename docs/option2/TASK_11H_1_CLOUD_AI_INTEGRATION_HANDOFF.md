# BRIK BY BRIK — TASK 11H-1 HANDOFF REPORT
## Cloud AI Integration Hardening and Local Development Handoff

**Agent:** Ponytail v5.3.2  
**Mode:** Isolated local implementation and verification  
**Worktree:** `.worktrees/task-11e-video-viewing`  
**Branch:** `feat/task-11e-video-viewing-integration`  
**Owner Governance:** James Lake, October 22, 2026 Checkpoint (`b47e4a3`), Video Evidence SOP v2.1  
**Target Deliverable:** `docs/option2/TASK_11H_1_CLOUD_AI_INTEGRATION_HANDOFF.md`  
**Execution Date:** October 23, 2026  

---

## 1. Executive Summary & Verdict

### Final Task Verdict
`TASK 11H-1 COMPLETE — LOCAL AI INTEGRATION FROZEN FOR REVIEW`

Following the completion of Task 11H, Task 11H-1 performed targeted hardening of the mocked cloud vision integration adapter (`claude-provider.ts`) and expanded the automated verification suite (`claude-vision-mock-integration.test.ts`). 

All required safety audits and hardening items have been implemented and verified locally:
1. **SDK Compatibility & Schema Stability:** Verified that `@anthropic-ai/sdk` v0.135.0 fully supports `output_config.format` with `{ type: "json_schema", schema }`. Preserved the schema-constrained design without replacing it with unneeded tool calls.
2. **Provider Retry Guidance Parsing (`retry-after` / `retry-after-ms`):** Hardened retry logic to inspect `Anthropic.APIError.headers` and parse both `retry-after` (seconds) and `retry-after-ms` (milliseconds) headers.
3. **Bounded Backoff & Deadline Enforcement:** Capped retry delays by `maxRetryDelayMs` (default 5,000ms), and attached abort event listeners to cancel sleeps immediately if the execution deadline (`AbortSignal`) expires during a delay.
4. **Expanded Transient Error Spectrum:** Added explicit transient detection for HTTP 408, 429, 500, 502, 503, 504, 529 (Anthropic/Cloudflare overloaded), `Anthropic.APIConnectionError`, and network disruption exceptions (`ECONNRESET`, `ETIMEDOUT`, `fetch failed`).
5. **Cost & Expenditure Accounting Distinction:** Formally verified the boundary between:
   - **Pre-flight budget reservation** (`worstCaseCostMicros` evaluated via pure `checkBudget` guard against the USD 120 hard stop).
   - **Estimated unconfirmed cost on timeout** (recorded with `outcome: "TIMEOUT"`, zero tokens, holding reserved budget without asserting confirmed provider billing).
   - **Confirmed billed provider expenditure** (recorded with `outcome: "OK" | "PARTIAL"` with exact input, output, and cache token tallies priced via model rate formulas).
6. **Proposal Safety & Idempotency:** Confirmed that failed runs (`FAILED`, `PROVIDER_ERROR`, `PROVIDER_TIMEOUT`, `PROVIDER_REFUSAL`, `PROVIDER_MALFORMED`, `BUDGET_HARD_STOP`) write **zero proposals** to the database, cannot overwrite active leases, and cannot mark incomplete runs as completed.
7. **Zero-Outbound Disabled State:** Re-confirmed that default configuration (`VIEWING_AI_ENABLED=false`) performs **0 network calls** and refuses fixture usage in production unless explicitly permitted.
8. **Preservation of Financial Boundaries:** Zero coupling or interaction with refurbishment costs, True MAO, Investor Shield, Builder Pack, or Deal Passport.

---

## 2. Hardening Details & Code Changes

### 2.1 File: `lib/viewing-assessment/ai/claude-provider.ts`

- **Added `extractRetryAfterMs(error: unknown): number | null`:** Safely extracts provider retry recommendations from standard `Headers` instances or plain header record dictionaries. Supports both `retry-after` (converted from seconds to milliseconds) and `retry-after-ms`. Safely catches any malformed values.
- **Enhanced `isTransientError(error: unknown): boolean`:**
  - Treats `Anthropic.APIConnectionError` as transient network disruption.
  - Treats HTTP 408, 429, 500, 502, 503, 504, and 529 as transient server/rate-limiting errors.
  - Treats network reset strings (`ECONNRESET`, `ETIMEDOUT`, `fetch failed`, `network`) as transient.
- **Configurable and Bounded Backoff (`ClaudeProviderOptions`):**
  - Added `maxRetryDelayMs` (default `5000` ms) to enforce an upper bound on single-attempt backoffs.
  - Extended `retryDelayMs` signature to `(attempt: number, retryAfterMs?: number | null) => number`, defaulting to provider guidance if provided, exponential backoff in production, or 0ms in test environments.
  - Bounded actual sleep by `Math.min(rawDelay, maxRetryDelayMs)`.
  - Added immediate abort cancellation listener inside the retry sleep promise, with checks for `signal.aborted` before, during, and after sleeping to guarantee prompt return of `{ kind: "timeout" }`.
- **Sanitized Fail-Closed Diagnostics:** Preserved status-only error reporting (e.g., `provider API error (status 429)`); raw messages, authorization tokens, request bodies, and sensitive URLs are never echoed.

### 2.2 File: `__tests__/claude-vision-mock-integration.test.ts`

Added **Scenarios 11A–11D** covering the hardened retry lifecycle:
- **Scenario 11A (Provider Retry Guidance in Seconds):** Verifies that an HTTP 429 error with header `retry-after: 1` parses to 1,000ms delay and successfully retries.
- **Scenario 11B (Retry-After-MS and Bounded Ceiling):** Verifies that `retry-after-ms: 8500` is parsed and capped by `maxRetryDelayMs: 2500`.
- **Scenario 11C (HTTP 529 & APIConnectionError Transient Retries):** Simulates a sequence of HTTP 529 (overloaded) followed by `Anthropic.APIConnectionError` (connection reset), recovering cleanly on the 3rd attempt.
- **Scenario 11D (Abort During Retry Delay):** Asserts that an `AbortSignal` triggered during a backoff sleep immediately cancels the sleep timer and returns `{ kind: "timeout" }` without delay.

---

## 3. Test Verification & Safety Audit

### 3.1 Focused Integration Suite (`claude-vision-mock-integration.test.ts`)

All 15 tests passed cleanly in **202 ms**:

```
 RUN  v4.1.5 C:/Users/HP ELITE BOOK/Documents/Brik-by-Brik/.worktrees/task-11e-video-viewing

 ✓ __tests__/claude-vision-mock-integration.test.ts (15 tests) 202ms
   ✓ Scenario 1 (Valid Response): processes Claude Sonnet 5.5 response, creating UNVERIFIED/PENDING proposals with micro-dollar ledger entry
   ✓ Scenario 2 (Malformed Response): handles non-JSON or cut-off payload safely without crashing
   ✓ Scenario 3 (Irrelevant / Hallucinated IDs): rejects unknown checklist IDs and invalid statuses
   ✓ Scenario 4 (Unsupported Diagnoses & Negative Invariants): strips extra fields and ignores cost/quantity inferences
   ✓ Scenario 5 (Timeouts & Cancellation): terminates promptly on AbortSignal and charges worst-case cost
   ✓ Scenario 6A (Rate Limit Transient Retry): recovers from transient HTTP 429 error on retry
   ✓ Scenario 6B (Rate Limit Exhaustion): fails cleanly after exhausting max retries without leaking keys
   ✓ Scenario 7 (Missing Evidence / Corrupted Storage): halts before calling provider if frame image is missing or tampered
   ✓ Scenario 8 (Cross-Deal Frame References): rejects proposal citing frame from another deal
   ✓ Scenario 9 (Authorization Failures): denies unauthenticated and cross-deal access at the boundary
   ✓ Scenario 10 (Disabled AI & Zero Outbound Calls): disabled state produces no genuine findings and performs 0 provider calls
   ✓ Scenario 11A (Provider Retry Guidance): respects retry-after headers and bounds backoff
   ✓ Scenario 11B (Retry-After-MS and Bounded Ceiling): parses milliseconds and caps excessive delays
   ✓ Scenario 11C (HTTP 529 and APIConnectionError Transient Retries): recovers from overloaded or network drops
   ✓ Scenario 11D (Abort During Retry Delay): halts immediately if signal aborts during backoff

 Test Files  1 passed (1)
      Tests  15 passed (15)
```

### 3.2 Core Viewing AI Suite (`viewing-ai-analysis.test.ts`)
- **34 of 34 tests passed** (including lease re-driving, budget limits, recovery workers, and prompt schemas).

---

## 4. Multi-Layer Security & Invariance Matrix

```
+──────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────+
| Verification Area                | Confirmed Implementation Behavior                                             |
+──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────+
| 1. Authentication & Scoping      | Every API route validates operator auth, dealId, and assessmentId ownership.  |
| 2. Frame Provenance              | Storage keys are internal-only; images re-verified by SHA-256 before call.    |
| 3. Fail-Closed Boundaries        | Missing evidence, auth failure, or budget cap returns 401/404/409/503.        |
| 4. Budget Reservations           | Pre-flight check against USD 120 hard stop; aborts before dispatching calls.  |
| 5. Confirmed vs Reserved Cost    | Timeout holds conservative reservation; confirmed spend requires OK outcome.  |
| 6. Proposal Isolation            | Failed runs yield 0 proposals. Proposals are strictly UNVERIFIED / PENDING.   |
| 7. Zero-Outbound Disabled State  | Default flag state makes 0 calls to Claude and refuses fixture in prod.       |
| 8. Core Financial Invariance     | Refurb, True MAO, Investor Shield, and Deal Passport remain 100% untouched.   |
+──────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────+
```

---

## 5. Changed Files & Git Handoff

### Exact Files Modified / Added
- `lib/viewing-assessment/ai/claude-provider.ts`
- `__tests__/claude-vision-mock-integration.test.ts`
- `docs/option2/TASK_11H_1_CLOUD_AI_INTEGRATION_HANDOFF.md`

### Single Local Git Commit
- **Branch:** `feat/task-11e-video-viewing-integration`
- **Worktree:** `.worktrees/task-11e-video-viewing`
- **Action:** Ready for staging and atomic commit.

---

## 6. Remaining Live Acceptance Requirements (Owner Governance)

Before cloud vision integration can be activated against live provider endpoints in production or preview environments, the following governance decisions from James Lake are required:
1. **Model Selection Approval:** Formal sign-off on `claude-sonnet-5-5`.
2. **Budget Hard-Stop Authorization:** Written approval of the USD 150 total allowance / USD 120 hard-stop threshold in `budget.ts`.
3. **Data Privacy Sign-Off:** Confirmation of Anthropic commercial terms and 30-day Trust & Safety retention policy for residential inspection walkthrough frames.
4. **Checklist Prompt Clearance:** Clearance of the rewritten C01–C45 and V01–V13 inspection checklist items for inclusion in production cloud prompts (`VIEWING_CHECKLIST_WORDING_APPROVED=true`).
