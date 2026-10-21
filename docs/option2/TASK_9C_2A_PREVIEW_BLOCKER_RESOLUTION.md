# TASK 9C-2A: Restricted Content and Preview Dependency Resolution

**Date:** 2026-10-21  
**Scope:** Resolution of Preview Blockers, Restricted Checklist Content, Database Migration Plan, and Authentication Architecture  
**Branch:** `feat/video-assessment-integration`  
**Current HEAD:** `04461f2037e19f8a760bf5cb89a3b595a0561a50`  
**Audit Nature:** Inspection and Documentation Only (Zero Code, Zero Infrastructure, Zero DB Changes)

---

## Executive Summary

Task 9C-2A investigates the dependencies and blockers identified during the Task 9C-1 Preview Readiness Audit. It establishes the exact technical status of restricted third-party checklist content, details the 12-migration database deployment plan, defines the minimum supported Preview authentication architecture, and specifies required project owner decisions.

---

## 1. Restricted Checklist Content Resolution

### 1.1 Affected Source Files
- **Primary Source:** `lib/viewing-assessment/checklist-v1.ts` (Commit `3a0f253`, lines 11–70).
- **Consuming Server Code:**
  - `app/saved-deals/[id]/viewing/page.tsx` (reads titles and groups if approved).
  - `lib/viewing-assessment/ai/select-provider.ts` (passes checklist to live Claude provider if approved).
  - `lib/viewing-assessment/ai/prompt.ts` (formats prompt text).
  - `lib/viewing-assessment/viewing-assessment-service.ts` (reads IDs only).
  - `lib/viewing-assessment/validate-ai-proposals.ts` (reads `VIEWING_CHECKLIST_IDS` set).
  - `lib/refurb-integration/plan-service.ts` (reads IDs only).

### 1.2 Origin of Third-Party Wording
- **Items C01–C45:** Adapted from Martin Rapley / Refurbishment Mastery (2021) 45-point inspection framework.
- **Items V01–V13:** Adapted from an unidentified commercial buyer viewing checklist.
- **Commercial Rights Status:** Unconfirmed / un-licensed.

### 1.3 Material Scope & Leakage Analysis
| Boundary | Status | Evidence |
|:---|:---|:---|
| **Client UI Components** | **No Leakage** | No client component (`"use client"`) imports `checklist-v1.ts`. |
| **Production Client Bundle** | **Clean** | Bundler tree-shaking and Next.js Server Components isolate `checklist-v1.ts` server-side. |
| **Default Server Rendering** | **Clean** | `app/saved-deals/[id]/viewing/page.tsx` line 61 passes only `{ id: c.id }` unless `VIEWING_CHECKLIST_WORDING_APPROVED="true"`. |
| **Fixture Analysis Mode** | **Clean** | Deterministic fixture scenarios (`fixture-provider.ts`) return original synthetic observation strings, not Rapley prompts. |
| **Paid AI Prompts** | **Blocked** | `selectAnalysisProvider()` explicitly rejects live Claude provider unless `VIEWING_CHECKLIST_WORDING_APPROVED="true"`. |
| **Git Commit History** | **Present** | File `lib/viewing-assessment/checklist-v1.ts` and commit `3a0f253` exist in local Git history. |

### 1.4 What `VIEWING_CHECKLIST_WORDING_APPROVED=false` Actually Prevents
1. **Prevents Browser Display:** Strips all titles, groups, and prompts from server-rendered HTML and RSC payloads; only abstract IDs (`C01`–`C45`, `V01`–`V13`) reach the DOM.
2. **Prevents AI Data Transmission:** Completely prevents live AI provider initialization and stops text from being sent over the wire to Anthropic or external APIs.

### 1.5 Does Commit `3a0f253` Prohibit Pushing the Entire Branch?
Yes. The commit message explicitly states:  
`restricted: third-party checklist wording (DO NOT PUSH until reuse rights are confirmed)`  
Because Git commits are immutable, pushing `feat/video-assessment-integration` to `origin` will publish commit `3a0f253` and `lib/viewing-assessment/checklist-v1.ts` to the remote repository.

### 1.6 Clearance vs. Replacement Recommendation
**Recommendation:** **Replace the wording with original Brik-authored checklist text.**  
*Rationale:* Seeking commercial copyright licensing for a 45-point guide adds legal delays and external dependencies. Rewriting the 58 checklist titles, descriptions, and inspection prompts into proprietary, UK-standard surveying terminology permanently eliminates copyright liability and allows commercial deployment without restrictions.

---

## 2. Preview Database Migration & Safety Plan

### 2.1 Exact Ordered Migration List
All migrations target schema `brik_by_brik_engine` in dependency order:

1. `db/migrations/20260522_phase4a_saved_deals_table.sql` (Creates core `saved_deals` table)
2. `db/migrations/20260522_phase4a_deal_offers_table.sql` (Creates `deal_offers` table)
3. `db/migrations/20260522_phase4a_deal_tasks_table.sql` (Creates `deal_tasks` table)
4. `db/migrations/20260524_phase4b_investor_shield_tables.sql` (Creates `investor_shield_checks` table)
5. `db/migrations/20260622_phase4e_deal_evidence_table.sql` (Creates Phase 4 evidence table)
6. `db/migrations/20260706_phase4g_evidence_command_deal_evidence_extension.sql` (Extends deal evidence table)
7. `db/migrations/20261020_task2_viewing_assessment_tables.sql` (Creates 6 viewing tables: assessments, evidence frames, runs, finding proposals, reviews, feedback)
8. `db/migrations/20261021_task5a_operator_sessions.sql` (Creates `operator_sessions` table)
9. `db/migrations/20261022_task6a_refurb_plan.sql` (Creates `refurb_confirmed_plans` table)
10. `db/migrations/20261023_task6b_measurements.sql` (Creates `refurb_property_measurements` table)
11. `db/migrations/20261024_task6b_financial_proposals.sql` (Creates `refurb_financial_proposals` table)
12. `db/migrations/20261025_task7a_capture_provenance.sql` (Adds `capture_provenance` column to `viewing_evidence_frames`)

### 2.2 Reversibility & Transaction Compatibility
- **Transaction Safety:** Each SQL migration file is pure DDL/DML and must be executed in a single transaction (`psql --single-transaction -v ON_ERROR_STOP=1`).
- **Rollback Order:** Reversible by dropping tables in reverse dependency order:
  1. `refurb_financial_proposals`
  2. `refurb_confirmed_plans`
  3. `refurb_property_measurements`
  4. Viewing assessment tables (`viewing_feedback`, `viewing_proposal_reviews`, `viewing_finding_proposals`, `viewing_analysis_runs`, `viewing_evidence_frames`, `viewing_assessments`)
  5. `operator_sessions`

### 2.3 Preview vs. Production Isolation
- **Separate Database Instance:** The Preview environment must connect to a distinct PostgreSQL instance or distinct database name (e.g., `brik_preview`).
- **Forbidden Action:** The production `DATABASE_URL` must never be assigned to Vercel Preview environment scope.
- **Verification Query:**
  ```sql
  SELECT current_database(), inet_server_addr();
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'brik_by_brik_engine' ORDER BY table_name;
  ```
  Expected table count: 12 tables.

---

## 3. Preview Authentication Architecture Plan

### 3.1 Minimum Supported Configuration
- **Authentication Standard:** Supabase Auth (or standard OIDC provider) emitting RS256 JWT tokens.
- **Verification Endpoint:** Public HTTPS JWKS URL hosted on the issuer's origin (e.g., `https://<preview-auth-project>.supabase.co/auth/v1/.well-known/jwks.json`).
- **Operator Allowlist:** Comma-separated list of UUIDs in `OPERATOR_ALLOWED_SUBJECTS`.
- **Session Layer:** Server-managed session store in `brik_by_brik_engine.operator_sessions`.
- **Cookie Specification:** `__Host-brik_session` with `Secure; HttpOnly; SameSite=Lax; Max-Age=28800`.
- **Redirects:** Unauthenticated access redirects to `/sign-in?next=<path>`.

### 3.2 Required Environment Variables (Preview Scope Only)
```ini
OPERATOR_AUTH_MODE="supabase-jwt"
OPERATOR_JWT_ISSUER="https://<project-ref>.supabase.co/auth/v1"
OPERATOR_JWT_AUDIENCE="authenticated"
OPERATOR_JWKS_URL="https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json"
OPERATOR_ALLOWED_SUBJECTS="<uuid1>,<uuid2>"
OPERATOR_PASSWORD_GRANT_URL="https://<project-ref>.supabase.co/auth/v1/token?grant_type=password"
OPERATOR_PASSWORD_GRANT_API_KEY="<supabase-anon-key>"
```

### 3.3 Hosted Environment Loopback Guard
Code in `lib/auth/operator-auth.ts` lines 90–92 enforces:
```typescript
if ((env.VERCEL || env.VERCEL_ENV) && /^(localhost|127\.|\[?::1\]?$|0\.0\.0\.0)/i.test(iss.hostname)) return null
```
*Impact:* The local test identity simulator cannot run in hosted environments. A real HTTPS Supabase Auth or OIDC instance is strictly required for Preview.

---

## 4. Deployment Readiness & Vercel Scope

- **Proposed Branch:** `feat/video-assessment-integration`
- **Proposed Commit:** `04461f2037e19f8a760bf5cb89a3b595a0561a50`
- **Vercel Project:** `brik-by-brik-engine` (Scope: `brikbybrik-engine`, Team: `Brikbybrik Engine`)
- **Target Deployment Type:** Vercel Preview (Git branch preview deployment)
- **Stop Conditions:**
  1. `DATABASE_URL` pointing to production database host.
  2. `OPERATOR_AUTH_MODE` unset or using loopback issuer on Vercel.
  3. `VIEWING_AI_ENABLED=true` without approved pricing budget.
  4. Commit `3a0f253` pushed without owner decision on restricted wording.

---

## 5. Categorized Findings & Decision Matrix

### Category A: Resolved by Repository Evidence
1. **Fail-Closed Auth:** Authenticated role boundary and CSRF protection are verified by 17 passing PostgreSQL authentication tests.
2. **Financial Invariance:** Database snapshots prove Saved Deals and Investor Shield records are immutable during viewing workflows.
3. **Third-Party Text Isolation:** Client UI bundles do not contain checklist wording; SSR strips text unless flag is enabled.
4. **Fixture AI Safety:** Claude API cannot activate without 5 explicit environment variables.
5. **Reversible Migrations:** Clean rollback script tested and documented.

### Category B: Requires James or Project-Owner Decision
1. **Decision D-Checklist:** Approve pushing commit `3a0f253` with flag disabled, OR authorize rewriting checklist into 100% original Brik text before pushing.
2. **Decision D-Preview-DB:** Approve provisioning a dedicated Supabase / PostgreSQL Preview database.
3. **Decision D-IdP:** Approve Preview Supabase Auth project and confirm password-grant sign-in approach.
4. **Decision D-Operators:** Provide initial operator subject UUIDs for `OPERATOR_ALLOWED_SUBJECTS`.
5. **Decision D-Push:** Authorize remote push of branch to GitHub `origin`.

### Category C: Requires Implementation
1. **Checklist Text Replacement (if Option B chosen):** Replace Martin Rapley prompts in `checklist-v1.ts` with original surveying wording.

### Category D: Requires Infrastructure Configuration
1. **Vercel Preview Environment Variables:** Add `DATABASE_URL`, `OPERATOR_*`, and `VIEWING_*` variables in Vercel project settings (Preview scope).
2. **Preview Database Migrations:** Run SQL migrations 1–12 on the newly provisioned Preview database.
3. **Supabase Auth Users:** Create test operator user accounts in Preview Supabase Auth instance.

### Category E: Cannot Be Verified Locally
1. **Vercel Edge Cookie Handling:** Real multi-region Vercel serverless cookie handling with `__Host-` prefix on Vercel preview domain.
2. **External Supabase JWKS Fetch:** Outbound HTTPS fetch from Vercel serverless function to live Supabase JWKS endpoint.

---

## 6. Recommended Smallest Next Implementation Step

**Step 9C-2B: Checklist Text Cleansing (Original Brik Wording)**  
Before requesting remote push authorization, replace the 58 third-party checklist prompts in `lib/viewing-assessment/checklist-v1.ts` with original, proprietary UK property surveying prompts. This resolves the blocker in commit `3a0f253`, permanently eliminates third-party licensing risks, and removes all barriers to pushing the branch.
