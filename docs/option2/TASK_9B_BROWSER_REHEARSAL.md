# TASK 9B: Full Browser Walkthrough and Operator Acceptance Rehearsal

**Status:** PASSED — FULL BROWSER WORKFLOW VERIFIED  
**Date:** 2026-10-21  
**Branch:** `feat/video-assessment-integration`  
**Base Commit:** `320b954`  
**Test Framework:** Playwright Test (`@playwright/test` v1.58.2)

---

## 1. Executive Summary

Task 9B executed and verified the complete Viewing Assessment operator journey in a real Chromium browser against a production Next.js application server (`next start` in `NODE_ENV=production`), an ephemeral local HTTPS Identity Provider simulator (`idp-simulator.mjs`), and an isolated PostgreSQL database (`brik-viewing-qa-pg` on `127.0.0.1:54339/brik_viewing_qa_local`).

The walkthrough was executed and passed across both **Desktop Chromium** (1280×720) and **Mobile Chromium** (Pixel 7 emulation, 412×915), verifying responsive layout, interactive controls, form submission, and visual readability across devices.

Authoritative financial and governance protections were proven invariant: the authoritative Saved Deal purchase price, GDV, and refurbishment cost remained bitwise identical before and after the workflow, Investor Shield records were unchanged, internal commercial assumptions remained excluded from the Builder Quotation Pack, and the Deal Passport maintained its three distinct non-merged layers.

---

## 2. Environment & Tooling

| Component | Specification |
|:---|:---|
| **Operating System** | Windows 11 Enterprise (x64) |
| **Node.js Runtime** | Node.js v24.19.0 |
| **Test Runner** | `@playwright/test` v1.58.2 |
| **Browser Engine** | Chromium 156.0.8078.4 (Playwright build 1248) |
| **Application Server** | Next.js 16.2.4 (`NODE_ENV=production`, Turbopack build, ephemeral loopback port) |
| **Identity Provider** | Ephemeral loopback HTTPS IdP simulator (`idp-simulator.mjs`, RS256 JWT, self-signed CA) |
| **Database** | PostgreSQL 16 Alpine container (`127.0.0.1:54339/brik_viewing_qa_local`, schema `brik_by_brik_engine`) |
| **AI Provider** | Deterministic fixture provider (`VIEWING_AI_ENABLED=false`, `VIEWING_AI_PROVIDER=fixture`) |

---

## 3. Workflow Coverage Matrix (16 Stages)

| Stage | Step Description | UI / API Action Verified | Desktop | Mobile |
|:---|:---|:---|:---:|:---:|
| **1** | Operator Authentication | Unauthenticated request redirects to `/sign-in?next=...`; operator signs in with simulator credentials; session established. | PASSED | PASSED |
| **2** | Saved-Deal Navigation | Land on `/saved-deals/[id]/viewing`; verify deal address heading, Deal Ref, and empty assessment state. | PASSED | PASSED |
| **3** | Viewing Assessment Opening | Page initializes cleanly with empty-state prompt and "Create viewing assessment" action. | PASSED | PASSED |
| **4** | Assessment Selection / Creation | Operator clicks "Create viewing assessment"; API returns 201; assessment record created. | PASSED | PASSED |
| **5** | Evidence Upload / Registration | Operator registers 3 synthetic evidence frames (metadata & camera timestamps); API returns 201. | PASSED | PASSED |
| **6** | Thumbnail Inspection | Evidence summary toggled open; evidence list and thumbnail records inspected. | PASSED | PASSED |
| **7** | Fixture Analysis Execution | Operator clicks "Run analysis"; fixture AI evaluates frames deterministically; state reaches `READY_FOR_REVIEW` with 3 proposals. | PASSED | PASSED |
| **8** | Human Review of Findings | **Correction:** C01 edited with operator observation (`Review: EDITED`, Rev 1).<br>**Rejection & Re-review:** C08 rejected with reason (`Review: REJECTED`, Rev 1), then re-reviewed to accept (`Review: ACCEPTED`, Rev 2).<br>**Acceptance:** C41 accepted (`Review: ACCEPTED`, Rev 1). | PASSED | PASSED |
| **9** | Refurbishment Work Mapping | Server renders `RefurbPlanPanel`; mapped work items verified for Roof works, Bathroom works, and Facade/masonry repairs. | PASSED | PASSED |
| **10** | Measurement Entry | Operator enters measurements (`bedrooms=3`, `bathrooms=1`, `floorAreaSqm=85`); clicks "Save measurements"; API returns 201; measurements saved (version 1). | PASSED | PASSED |
| **11** | Refurbishment Scope Confirmation | Operator checks all 3 work items, fills transaction costs, requests preview (`Estimate: £4,600.00`; unpriced facade excluded); clicks "Confirm selected scope"; version 1 confirmed. | PASSED | PASSED |
| **12** | Financial Proposal Generation | Operator clicks "Create proposal from confirmed scope"; API returns 201; comparison table displays stored baseline, proposed adjustment, and delta. | PASSED | PASSED |
| **13** | Explicit Financial Decision | Operator checks acknowledgements (`notWriteBack`, `exclusions`, `unresolvedQuantities`), enters decision note, clicks "Confirm proposed adjustment"; status reaches `Decision: CONFIRMED`. | PASSED | PASSED |
| **14** | Builder Quotation Pack | Operator navigates to `/saved-deals/[id]/builder-pack`; verifies `DRAFT` status, confidentiality notice, blank contractor pricing sheet, and complete omission of internal margins, GDV, profit, and day-rates. | PASSED | PASSED |
| **15** | Deal Passport Three-Layer View | Operator navigates to `/saved-deals/[id]/passport`; verifies three distinct, non-merged sections: (1) Authoritative Saved Deal, (2) Confirmed Scope, (3) Proposed Financial Adjustment. | PASSED | PASSED |
| **16** | State Consistency & Refresh | Operator reloads Deal Passport (persists confirmed scope); navigates back to Viewing Assessment; confirms `Decision: CONFIRMED` persists across reloads. | PASSED | PASSED |

---

## 4. Financial & Governance Protections Proof

### 4.1 Authoritative Saved Deal Immutability

Before the walkthrough started, a baseline snapshot of the test deal in `brik_by_brik_engine.saved_deals` was captured. After completing all 16 stages (including measurement saves, scope confirmation, financial proposal generation, and operator decision confirmation), the deal record was re-queried and compared bitwise:

```sql
SELECT id, address, purchase_price, gdv_realistic, refurb_cost, 
       classification, governance_state, capital_protection_state, 
       pipeline_state, engine_result_json, risk_summary_json
FROM brik_by_brik_engine.saved_deals WHERE id = 'deal-walkthrough-playwright-1';
```

- **Baseline Values:**
  - `purchase_price`: `140000`
  - `gdv_realistic`: `225000`
  - `refurb_cost`: `20000`
  - `classification`: `'STRONG_DEAL'`
  - `governance_state`: `'GO'`
  - `capital_protection_state`: `'PROTECTED'`
- **Post-Walkthrough Values:**
  - Identical in every field (`expect(JSON.stringify(savedDealAfter.rows[0])).toBe(savedDealBaseline)` evaluated `true`).
  - The UI explicitly displayed: *"Proposed adjustment approved. The Saved Deal figures were not changed."*

### 4.2 Investor Shield Protection Invariance

The baseline `investor_shield_checks` record was queried before and after:

```sql
SELECT id, deal_id, gate_key, status, severity, confidence, summary
FROM brik_by_brik_engine.investor_shield_checks 
WHERE deal_id = 'deal-walkthrough-playwright-1' ORDER BY id;
```

- `status`: `'PASSED'`
- `severity`: `'LOW'`
- `confidence`: `'HIGH'`
- `summary`: `'Zone 1 low probability'`
- **Post-Walkthrough Integrity:** Bitwise identical (`expect(JSON.stringify(shieldAfter.rows)).toBe(shieldBaseline)` evaluated `true`).

### 4.3 Builder Quotation Pack Confidentiality

The rendered page text in `/saved-deals/[id]/builder-pack` was scanned with regex assertions:
- No internal profit targets (`\bprofit\b/i`): **Not present**
- No Maximum Allowable Offer (`\bMAO\b/i`): **Not present**
- No Gross Development Value (`\bGDV\b/i`): **Not present**
- No internal trade day-rates (`\bday-rate\b/i`): **Not present**
- Blank contractor pricing schedule presented with fill-in blanks (`£ ____________`).

---

## 5. Desktop and Mobile Test Execution

Both projects ran sequentially using 1 dedicated worker to maintain strict isolation:

```
Running 6 tests using 1 worker

  ok 1 [chromium] › e2e/operator-smoke.spec.ts:150:7 › 1. unauthenticated visit redirects to sign-in (744ms)
  ok 2 [chromium] › e2e/operator-smoke.spec.ts:159:7 › 2. authorized operator authenticates and page renders (800ms)
  ok 3 [chromium] › e2e/operator-workflow.spec.ts:171:7 › 16-stage operator viewing assessment journey (8.4s)
  ok 4 [mobile-chromium] › e2e/operator-smoke.spec.ts:150:7 › 1. unauthenticated visit redirects to sign-in (392ms)
  ok 5 [mobile-chromium] › e2e/operator-smoke.spec.ts:159:7 › 2. authorized operator authenticates and page renders (682ms)
  ok 6 [mobile-chromium] › e2e/operator-workflow.spec.ts:171:7 › 16-stage operator viewing assessment journey (10.2s)

  6 passed (23.5s)
```

### Visual Evidence Captured (`docs/option2/screenshots/`)

Total: 17 PNG images (1 authentication smoke proof + 8 desktop/mobile pairs).
- `task-9b-smoke-authenticated.png`: Operator authenticated landing page.
- `task-9b-01-assessment-created-desktop.png` / `-mobile.png`: Assessment created and ready for evidence.
- `task-9b-02-evidence-registered-desktop.png` / `-mobile.png`: Evidence frames registered and summary expanded.
- `task-9b-03-findings-reviewed-desktop.png` / `-mobile.png`: Findings reviewed (C01 edited, C08 rejected and re-reviewed, C41 accepted).
- `task-9b-04-measurements-saved-desktop.png` / `-mobile.png`: Operator measurements entered and saved (version 1).
- `task-9b-05-scope-confirmed-desktop.png` / `-mobile.png`: Scope confirmed with pricing preview and exclusions.
- `task-9b-06-financial-proposal-decided-desktop.png` / `-mobile.png`: Financial adjustment proposal decided (`CONFIRMED`).
- `task-9b-07-builder-pack-desktop.png` / `-mobile.png`: Confidential Builder Quotation Request Pack.
- `task-9b-08-deal-passport-desktop.png` / `-mobile.png`: Deal Passport three-layer view.

---

## 6. Fixture Cleanup Proof

Both test suites implement deterministic teardown in `afterAll`:
1. `DELETE FROM brik_by_brik_engine.investor_shield_checks WHERE deal_id = $1`
2. `DELETE FROM brik_by_brik_engine.saved_deals WHERE id = $1`
3. `DELETE FROM brik_by_brik_engine.operator_sessions WHERE subject LIKE 'sim-%'`
4. Close pool, kill Next.js server child process, and terminate HTTPS IdP simulator.

Post-test verification executed via query verified:
- `Playwright deals remaining:` **0**
- `Investor shield checks remaining:` **0**
- `Sim sessions remaining:` **0**

---

## 7. Full Repository Validation Suite

| Suite | Command | Result | Details |
|:---|:---|:---:|:---|
| **Playwright E2E** | `npx playwright test` | **PASS** | 6 passed (23.5s), desktop + mobile |
| **ESLint** | `npm run lint` | **PASS** | 0 errors, 0 warnings |
| **Next.js Build** | `npm run build` | **PASS** | Optimized production build, TypeScript compiled |
| **Vitest Non-Postgres** | `npm run test` | **PASS** | 164 test files passed, 2,227 tests passed, 129 skipped |
| **Local Postgres Contract** | `node scripts/qa/local-postgres.mjs test` | **PASS** | 6 test files passed, 128 tests passed |

---

## 8. Defect Log & Resolutions

1. **Custom CDP Prototype Deadlock (P1):**  
   - *Issue:* Custom navigation script deadlocked on CDP session lifecycle when switching contexts.
   - *Resolution:* Replaced with official `@playwright/test` harness in Task 9B-P1; fully eliminated custom CDP fragility.
2. **Production Fixture Environment Guard:**  
   - *Issue:* `select-provider.ts` disallowed fixture AI in production mode without explicit configuration.
   - *Resolution:* Configured child process environment `VIEWING_AI_ALLOW_FIXTURE_IN_PRODUCTION: "true"` ensuring deterministic local QA without paid AI calls.
3. **Checklist Accordion Disclosure:**  
   - *Issue:* Proposal action buttons are nested in native `<details>` elements that start closed.
   - *Resolution:* Test clicks the `<summary>` disclosure before clicking action buttons.
4. **Builder Pack Header Text Alignment:**  
   - *Issue:* Initial test draft expected `"Builder Quotation Pack"` whereas component renders `"Builder Quotation Request Pack"`.
   - *Resolution:* Aligned locator text to match component rendering.

---

## 9. Documented Limitations

1. **Synthetic Evidence in Automated Walkthrough:** The automated browser walkthrough registers 3 synthetic evidence frames via the operator UI's "Add simulated evidence" button. Full on-device camera extraction and canvas decoding were tested on physical hardware (Samsung Galaxy A07, Chrome 155, Task 7D) and are not simulated with large video files in the git repository.
2. **Deterministic AI Fixture:** AI analysis in this local workflow uses the deterministic fixture provider (`VIEWING_AI_PROVIDER=fixture`). Live paid Claude API invocation remains strictly disabled.

---

## 10. Conclusion & Task 9C Readiness

Task 9B acceptance criteria have been comprehensively audited and proven. All human review modalities (acceptance, correction, rejection, re-review) are verified in Chromium. Financial and Investor Shield invariance are proven via database snapshot comparisons.

**Verdict:** TASK 9B ACCEPTED — READY FOR PREVIEW READINESS REVIEW.  
**Recommendation:** Proceed to **Task 9C: Operator Acceptance Sign-Off and Final Hardening**.
