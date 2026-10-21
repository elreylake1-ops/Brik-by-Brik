# TASK 9C-1: Preview Readiness and Release Safety Audit

**Date:** 2026-10-21  
**Audit Scope:** Option 2 Viewing Assessment Integration, Operator UI, Refurbishment Integration, and Deal Documents  
**Branch:** `feat/video-assessment-integration`  
**Current HEAD:** `04461f2037e19f8a760bf5cb89a3b595a0561a50`  
**Integration Base:** `main` (`6d0981b4de7097b36e3995ff1733784a0c0fdaa5`)  
**Audit Nature:** Read-Only Audit and Release Safety Determination

---

## Final Verdict

### `CONDITIONALLY READY — SPECIFIC REQUIREMENTS OUTSTANDING`

The codebase, test suite, fail-closed security boundary, and financial invariants are fully verified and hardened locally. However, deployment to a hosted Preview environment cannot proceed until four specific owner/infrastructure prerequisites are satisfied:
1. **Isolated Preview Database Provisioning:** Target database instance verified separate from Production and migrations applied.
2. **Hosted Identity Provider Credentials:** Configuration of a real Supabase Auth project or OIDC provider (the ephemeral loopback simulator is intentionally refused on Vercel).
3. **Third-Party Checklist Clearance:** Owner sign-off on commit `3a0f253` regarding third-party checklist wording (`VIEWING_CHECKLIST_WORDING_APPROVED=false` enforcement).
4. **Operator Allowlist Definition:** Population of `OPERATOR_ALLOWED_SUBJECTS` with authorized operator UUIDs.

---

## 1. Repository Identity & Feature Branch Audit

| Field | Audit Finding |
|:---|:---|
| **Repository Origin** | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| **Current Feature Branch** | `feat/video-assessment-integration` |
| **HEAD Commit** | `04461f2037e19f8a760bf5cb89a3b595a0561a50` |
| **Working Tree State** | Clean (`git status --short` returns empty) |
| **Integration Base** | `main` at `6d0981b` (PR #3 `phase5a-4b-professional-gateway-visible-proof`) |
| **Branch Divergence** | 32 commits ahead of `main` |
| **Remote Tracking** | Local branch only; no push, merge, or deployment has been executed |
| **Frozen Branches** | `phase5b-postapproval-preview-work` remains frozen at `b668aff`; untouched |

### Historical Commit Notice
Commit `3a0f253` in the branch history is titled:  
`restricted: third-party checklist wording (DO NOT PUSH until reuse rights are confirmed)`  
*Safety Check:* The runtime code isolates this text server-side and guards it behind `VIEWING_CHECKLIST_WORDING_APPROVED === "true"`. When unset (default), only abstract IDs (`C01`–`C45`, `V01`–`V13`) reach client bundles or AI providers. However, before pushing this branch to a public or team-shared remote, owner clearance on this commit is mandatory.

---

## 2. Security Assessment

### 2.1 Operator Authentication & Session Validation
- **Authentication Mode:** Supabase JWT with RS256 signature verification (`lib/auth/operator-auth.ts`).
- **Fail-Closed Design:** Missing configuration, malformed headers, invalid signatures, or expired tokens immediately return `401 Unauthorized`.
- **Session Tokens:** Server-side hashed sessions (`token_hash`) stored in `brik_by_brik_engine.operator_sessions`. Raw session tokens never reach server logs or database tables.
- **Cookie Security:** Hardened session cookies marked `__Host-brik_session`, `HttpOnly`, `SameSite=Lax`, and `Secure` with an 8-hour maximum age and idle timeout.

### 2.2 Deal-Level Authorization & Tenant Isolation
- **Role Model:** Trusted internal operator identity (`lib/operator-command/trusted-internal-operator-identity.ts`).
- **Tenant Scope:** Every active operator on the allowlist has access to all saved deals (`saved_deals` has no per-deal owner column; deal ownership is intentionally organization-wide in v1).
- **Non-Operator / Unauthorized Principal Handling:** Fails closed with `404 SAVED_DEAL_NOT_FOUND` to prevent deal enumeration.
- **CSRF Defense:** State-changing requests (`POST`, `PATCH`, `DELETE`) with session cookies enforce `isSameOrigin()` and return `403 CROSS_ORIGIN_REJECTED` on cross-origin calls.

### 2.3 Route & Document Protection
- **Saved Deal Pages:** `/saved-deals/[id]/viewing`, `/saved-deals/[id]/builder-pack`, and `/saved-deals/[id]/passport` invoke `requireOperatorPage()`. Unauthenticated requests redirect to `/sign-in?next=...`.
- **API Endpoints:** `/api/saved-deals/[id]/viewing-assessments/**` enforce `guardSavedDealApi()` on every request.
- **Development Bypass Protection:** `isDevelopmentOpen()` strictly checks `!env.VERCEL && !env.VERCEL_ENV && !env.CI && env.NODE_ENV === "development"`. In any Vercel Preview or CI deployment, the bypass is permanently inactive.

---

## 3. Deployment Architecture & Hosting

| Tier | Component | Preview Architecture |
|:---|:---|:---|
| **Edge / App Server** | Vercel Serverless / Node.js Runtime | Next.js 16.2.4 with Turbopack, dynamic SSR routes (`force-dynamic`). |
| **Database** | PostgreSQL 16 (Supabase) | Dedicated Preview database instance. Must NOT share schema or instance with Production. |
| **Authentication** | Supabase Auth (or compatible OIDC) | Dedicated Auth project providing JWKS endpoint over HTTPS. |
| **Storage** | Private Blob Storage | Private evidence frame storage in database blobs or S3-compatible private bucket. |
| **AI Inference** | Claude 3.5 Sonnet (Anthropic) | Disabled by default. Deterministic fixture provider used for safe Preview QA. |

---

## 4. Database Readiness & Migration Inventory

### 4.1 Migration Order (Preview Database Only)
The Preview database requires 12 migrations applied in single-transaction dependency order:

1. `20260522_phase4a_saved_deals_table.sql`
2. `20260522_phase4a_deal_offers_table.sql`
3. `20260522_phase4a_deal_tasks_table.sql`
4. `20260524_phase4b_investor_shield_tables.sql`
5. `20260622_phase4e_deal_evidence_table.sql`
6. `20260706_phase4g_evidence_command_deal_evidence_extension.sql`
7. `20261020_task2_viewing_assessment_tables.sql` *(Option 2: viewing assessments & evidence)*
8. `20261021_task5a_operator_sessions.sql` *(Option 2: server-side operator sessions)*
9. `20261022_task6a_refurb_plan.sql` *(Option 2: confirmed refurbishment plans)*
10. `20261023_task6b_measurements.sql` *(Option 2: operator property measurements)*
11. `20261024_task6b_financial_proposals.sql` *(Option 2: financial-impact proposals & decisions)*
12. `20261025_task7a_capture_provenance.sql` *(Option 2: frame extraction provenance)*

### 4.2 Migration Rollback Strategy
Rollback migrations exist and run in exact reverse dependency order:
`20261024_task6b_financial_proposals.sql` → `20261022_task6a_refurb_plan.sql` → `20261023_task6b_measurements.sql` → `20261020_task2_viewing_assessment_tables.sql` → `20261021_task5a_operator_sessions.sql`.

---

## 5. Required Environment Variable Matrix

The following environment variables must be configured in Vercel **Preview Scope Only**:

| Variable Name | Required Value / Purpose | Sensitivity |
|:---|:---|:---:|
| `DATABASE_URL` | PostgreSQL connection string for the isolated Preview database | Secret |
| `OPERATOR_AUTH_MODE` | Must be `supabase-jwt` | Config |
| `OPERATOR_JWT_ISSUER` | HTTPS issuer URL of the Preview auth project | Config |
| `OPERATOR_JWT_AUDIENCE` | Expected audience (e.g. `authenticated`) | Config |
| `OPERATOR_JWKS_URL` | Public JWKS keyset URL (must match issuer origin) | Config |
| `OPERATOR_ALLOWED_SUBJECTS` | Comma-separated list of operator UUIDs allowed to access the system | Secret |
| `OPERATOR_PASSWORD_GRANT_URL` | Password exchange endpoint for `/sign-in` | Config |
| `OPERATOR_PASSWORD_GRANT_API_KEY` | Provider public (anon) key for password exchange | Secret |
| `VIEWING_AI_ALLOW_FIXTURE_IN_PRODUCTION` | `true` (enables deterministic fixture AI in hosted Preview build) | Config |
| `VIEWING_AI_PROVIDER` | `fixture` (preserves zero-cost deterministic mock AI) | Config |
| `VIEWING_AI_ENABLED` | Leave unset or `false` | Config |
| `VIEWING_CHECKLIST_WORDING_APPROVED` | Leave unset or `false` until commercial clearance is granted | Config |

*Critical Restriction:* `SAVED_DEALS_AUTH_ENFORCEMENT` must NOT be set in Preview.

---

## 6. AI and Evidence Safeguards

- **Paid AI Guard:** `selectAnalysisProvider()` requires `VIEWING_AI_ENABLED=true`, `VIEWING_AI_PROVIDER=claude`, `ANTHROPIC_API_KEY`, a priced model name, and approved wording. Unless all 5 are present, paid calls are completely blocked.
- **Video Privacy Boundary:** Video files are never transmitted to server endpoints. Only still JPEG frames extracted locally by the browser are transmitted.
- **Evidence Provenance:** Every frame retains timestamp, source method (`video-frame-callback` or `seeked-canvas`), and verification confidence.
- **Human Review Authority:** AI outputs are unverified drafts (`READY_FOR_REVIEW`). No AI proposal can affect refurbishment scope or financial proposals without human acceptance/editing.

---

## 7. Financial & Governance Integrity Proof

- **Saved Deal Immutability:** Authoritative purchase price, realistic GDV, and baseline refurb cost are read-only during viewing workflows.
- **Investor Shield Invariance:** Shield gate statuses (`FLOOD_RISK`, etc.) cannot be modified by viewing assessment findings.
- **Proposed Adjustments Separation:** Proposed figures are computed in memory as deltas and presented alongside authoritative figures; they never overwrite stored deal values.
- **Builder Pack Redaction:** Internal profit targets, MAO, GDV, and trade day-rates are completely absent from `/saved-deals/[id]/builder-pack`.
- **Deal Passport Structure:** Enforces three discrete non-merged sections: (1) Authoritative Saved Deal, (2) Confirmed Scope, (3) Proposed Financial Adjustment.

---

## 8. Validation Results

| Test Suite | Result | Execution Time | Notes |
|:---|:---:|:---:|:---|
| **Playwright E2E** | **6 / 6 PASS** | 22.8s | Desktop Chromium & Mobile Pixel 7 across all 16 stages |
| **ESLint** | **PASS** | 5.2s | 0 errors, 0 warnings |
| **Production Build** | **PASS** | 18.6s | Turbopack production build compiled cleanly |
| **Vitest Non-Postgres** | **2,227 / 2,227 PASS** | 18.2s | 164 files passed, 129 skipped |
| **Local PostgreSQL** | **128 / 128 PASS** | 24.2s | 6 contract/integration files passed |
| **TypeScript Diagnostics** | **37 baseline diagnostics** | — | Restricted to pre-existing `__tests__` fixtures; 0 in runtime or E2E |

---

## 9. Outstanding Blockers for Preview Deployment

| Item Code | Blocker Description | Resolution Path | Owner Action Required |
|:---:|:---|:---|:---:|
| **B-1** | Target Preview database not provisioned | Provision clean PostgreSQL 16 database | Approve & provision |
| **B-2** | Preview migrations not yet run | Execute migrations 1–12 in single transaction | Run migrations on Preview DB |
| **B-3** | Hosted Identity Provider unconfigured | Set up Supabase Auth project & copy JWKS config | Configure provider & set env |
| **B-4** | Operator allowlist empty | Determine initial authorized operator subjects | Populate `OPERATOR_ALLOWED_SUBJECTS` |
| **B-5** | Commit `3a0f253` restricted notice | Confirm checklist reuse policy or approve default flag | Review and clear commit notice |

---

## 10. Rollback & Recovery Readiness

1. **Vercel Deployment Rollback:** Revert deployment alias to last known good deployment commit (`6d0981b` on `main`).
2. **Database Rollback:** If Preview database schema requires reversion, run `local-postgres.mjs rollback` sequence against the Preview DB.
3. **Emergency Access Lock-Out:** Set `OPERATOR_ALLOWED_SUBJECTS=""` in Vercel environment variables and trigger redeploy; invalid allowlist immediately denies all users access.

---

## 11. Recommended Task 9C-2 Scope

Once the owner approves the prerequisites above, Task 9C-2 should proceed with:
1. **Remote Push Authorization:** Push `feat/video-assessment-integration` to `origin`.
2. **Preview Environment Provisioning:** Verification of Preview database connection and environment variables.
3. **Migration Verification:** Apply migrations 1–12 to Preview database.
4. **Staging Smoke Test:** Run authenticated smoke verification against deployed Vercel Preview URL.
5. **Operator Sign-Off:** Execute manual operator acceptance walkthrough on Preview.
