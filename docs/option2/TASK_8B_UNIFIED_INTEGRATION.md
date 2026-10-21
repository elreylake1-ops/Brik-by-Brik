# Task 8B: Unified End-to-End Viewing Assessment Integration

**Status:** Local QA and CI only. Zero paid AI calls, zero external video uploads, zero public blob exposure. Isolated local PostgreSQL and in-memory test coverage.

## Overview

Task 8B closes the integration gap identified in Task 8A by proving a continuous, unbroken, authorized workflow connecting all Option 2 subsystems:

```
Synthetic JPEG Evidence (Client)
        │
        ▼ (Authenticated Upload via /api/.../evidence)
Private Local Blob Storage (SHA-256 Verified, Encrypted/FS Isolated)
        │
        ▼ (POST /api/.../analysis-runs with VIEWING_AI_FIXTURE_SCENARIO="complete_flow")
Fixture AI Analysis (Deterministic, Zero Paid Calls, UNVERIFIED status)
        │
        ▼ (POST /api/.../proposals/[id]/review with operator corrections)
Append-Only Human Review Audit Trail
        │
        ▼ (Automatic Mapping via findWorkItemsForFinding)
Scope Derivation (C01 -> roof, C41 -> bathroom, C08 -> unpriced facade)
        │
        ▼ (POST /api/.../measurements - manual entry only, video source rejected)
Operator Measurements Recorded with Source Attribution
        │
        ▼ (POST /api/.../refurb-plan with verified planFingerprint)
Confirmed Refurbishment Scope (Versioned, Idempotent)
        │
        ▼ (POST /api/.../financial-proposal)
Financial-Impact Proposal (Deterministic Brik Engine Delta)
        │
        ▼ (POST /api/.../financial-proposal/[id]/decision)
Operator Financial Decision (Explicit Human Decision, Non-Authoritative)
        │
        ├──► Confidential Builder Pack (GET /api/.../builder-pack)
        │    - Proprietary rates, estimates, profit targets, and internal engine terms redacted
        │
        └──► Three-Layer Deal Passport (GET /api/saved-deals/[id]/deal-passport)
             - Layer 1: Authoritative Saved Deal (UNMODIFIED)
             - Layer 2: Confirmed Viewing Refurb Scope
             - Layer 3: Proposed Financial Adjustments (non-authoritative)
```

---

## 1. Dedicated Fixture Scenario (`complete_flow`)

Added to `lib/viewing-assessment/ai/fixture-provider.ts` and enabled via `VIEWING_AI_FIXTURE_SCENARIO="complete_flow"` in `lib/viewing-assessment/ai/select-provider.ts`:
- **Isolation:** The default fixture (`"default"`) remains completely untouched and is the default when no scenario is specified.
- **Evidence Binding:** Observations dynamically bind to genuinely submitted `frameIds` (ordered by timestamp).
- **Checklist Items Verified:**
  1. `C01` (Roof Covering): Defective roof tiles observed on frame 0 $\rightarrow$ maps to `ENGINE_SCOPE` item `roof_replacement_tiles`.
  2. `C41` (Bathroom Condition): Outdated and damaged sanitaryware observed on frame 1 $\rightarrow$ maps to `ENGINE_SCOPE` item `bathroom_full_replacement`.
  3. `C08` (External Wall / Facade Condition): Minor pointing degradation observed on frame 2 $\rightarrow$ maps to `UNPRICED` item `masonry_repointing`.
- **Labeling & Provenance:** Every observation begins with `"Synthetic observation: "` ensuring synthetic findings are never confused with live detections.
- **Status:** All generated proposals initialize strictly as `UNVERIFIED` and require human operator review.

---

## 2. Checklist-to-Engine Mapping Verification

Verified directly from production mapping rules in `lib/data/finding-work-mapping.ts` and `types/finding-work-mapping.ts`:

| Checklist ID | Area | Work Item ID | Category | Implementation Type | Handled By Engine |
|---|---|---|---|---|---|
| `C01` | Roof | `roof_replacement_tiles` | `roof` | `ENGINE_SCOPE` | Yes (scaled by property baseline / sqm) |
| `C41` | Bathroom | `bathroom_full_replacement` | `bathroom` | `ENGINE_SCOPE` | Yes (scaled by bathroom count) |
| `C08` | External Wall / Facade | `masonry_repointing` | `external_walls` | `UNPRICED` | Flagged as unpriced work; excluded from engine calculation |

---

## 3. Continuous Integration Test Suite

The test suite is structured as a shared behavioral contract with two execution runners:

1. **Shared Contract:** `__tests__/contracts/viewing-unified-e2e-flow.ts`
   - Executes the complete 10-stage integration through the actual Next.js App Router route handlers.
   - Enforces 15 explicit assertions covering authentication, authorization, storage privacy, idempotent scope confirmation, operator decisions, rate redactions, three-layer passport structure, and deal immutability.
2. **In-Memory Runner:** `__tests__/viewing-unified-e2e-flow.test.ts`
   - Runs under Vitest with the in-memory viewing repository.
   - Ideal for rapid local test loops and continuous integration without external dependencies.
3. **PostgreSQL Runner:** `__tests__/postgres/viewing-unified-e2e-flow.pg.test.ts`
   - Runs against the isolated local QA PostgreSQL database (`127.0.0.1:54339`, container `brik-viewing-qa-pg`).
   - Validates multi-tenant row-level locking, foreign key integrity, schema migrations, and persistent audit records.

---

## 4. Security, Governance, and Safety Invariants Verified

- **No Paid AI Invocation:** Paid AI gates remain unconfigured (`VIEWING_AI_ENABLED=false`).
- **No Remote Database Access:** Verified targeting isolated local PostgreSQL container only. Production and Preview databases are untouched.
- **Authoritative Deal Immutability:** Asserted that `purchasePrice`, `askingPrice`, `refurbCost`, and other core deal attributes on `saved_deals` remain strictly identical before, during, and after financial decisions.
- **Investor Shield Immutability:** Asserted that `investor_shield_checks` records are never overwritten or altered by viewing assessment flows.
- **Redaction of Commercial Data:** Builder pack output is verified to strip out all internal day rates, trade breakdowns, contractor margins, and internal calculation tokens.
- **Measurement Validation:** Measurements reject video or AI as primary source (`video` source strictly rejected with 400 validation error; `operator_measured` accepted).
- **Tenant Isolation:** Operator session belonging to one member is rejected with 404 when attempting to access a deal belonging to another operator.

---

## 5. Verification Results (21 October 2026)

- **In-Memory Unified E2E Test:** 1/1 passed (`__tests__/viewing-unified-e2e-flow.test.ts`).
- **Local PostgreSQL Unified E2E Test:** 1/1 passed (`__tests__/postgres/viewing-unified-e2e-flow.pg.test.ts`).
- **Full Local PostgreSQL Suite:** 6/6 test files passed, 128/128 tests passed (`node scripts/qa/local-postgres.mjs test`).
- **Full Non-PostgreSQL Suite:** 163 passed, 6 skipped, 2,222/2,222 tests passed.
- **TypeScript Check (`npx tsc --noEmit`):** 80 baseline diagnostic errors in pre-existing test files; 0 errors in new or modified files.
- **ESLint (`npm run lint`):** Exited clean (code 0).
- **Next.js Production Build (`npm run build`):** Compiled successfully in 16.2s, 8 static pages generated, all routes optimized.
