# Phase 4E-2 Evidence Lite Migration Local Only

## Purpose
Phase 4E-2 prepared the Evidence Lite migration locally so the schema contract could be reviewed and validated without executing it in any database.

## Files Added or Changed
- `db/migrations/20260622_phase4e_deal_evidence_table.sql`
- `__tests__/phase4e-migration-consistency.test.ts`

## Table Contract
- table: `brik_by_brik_engine.deal_evidence`
- `id TEXT PRIMARY KEY`
- `deal_id TEXT NOT NULL`
- foreign key to `brik_by_brik_engine.saved_deals(id)`
- `ON DELETE CASCADE`
- `evidence_type TEXT NOT NULL`
- `linked_gate TEXT NOT NULL`
- `title TEXT NOT NULL`
- `note TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'MISSING'`
- `reviewed BOOLEAN NOT NULL DEFAULT FALSE`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

## Evidence Types
Approved canonical values from `types/evidence-lite.ts`:
- `SOLD_COMP`
- `TITLE_REVIEW`
- `LEASEHOLD_REVIEW`
- `PLANNING_BUILDING_CONTROL`
- `REFURB_NOTE`
- `BUILDER_QUOTE`
- `SURVEY_NOTE`
- `LENDER_NOTE`
- `RENTAL_DEMAND`
- `SOLICITOR_REVIEW`
- `OTHER`

## Evidence Statuses
- `MISSING`
- `RECORDED`
- `REVIEWED`
- `VERIFIED`
- `REJECTED`

Gate-like scaffold statuses were excluded.

## Canonical Linked Gates
- `SOLD_COMPS`
- `TITLE`
- `LEASEHOLD`
- `PLANNING_BUILDING_CONTROL`
- `REFURB_CERTAINTY`
- `BUILDER_PROPOSAL_CONTRACT`
- `DAMP_STRUCTURAL`
- `LENDER_CRITERIA`
- `RENTAL_DEMAND`
- `SOLICITOR_REVIEW`

Confirmation:
- `SOLICITOR_FEEDBACK` is not stored
- `SOLICITOR_REVIEW` is canonical
- `GENERAL` is invalid

## Constraints
- non-blank deal ID
- non-blank title
- title maximum 200 characters
- non-blank note
- note maximum 5,000 characters
- canonical evidence-type constraint
- canonical linked-gate constraint
- canonical status constraint

## Indexes
- index on `deal_id`
- composite index on `(deal_id, linked_gate)`

## Updated-At Decision
- no custom trigger or global function was introduced
- repository update statements will later set `updated_at = NOW()`

## Idempotency and Safety
- no destructive alterations
- no table drops
- no backfill
- no seed evidence
- no task creation
- no pipeline movement
- no gate evaluation
- no permission or role expansion

## Rollback Plan
Conceptual rollback:

```sql
DROP TABLE IF EXISTS brik_by_brik_engine.deal_evidence;
```

This must not be executed without:
- explicit approval
- production backup
- row-count review
- dependency review

## Execution Block
The migration was prepared but was not executed in any local, Supabase, preview, or production database.

Execution remains prohibited until:
- Vercel contains the exact Production key `DATABASE_URL`
- a deployment created after that configuration is `READY`
- `/api/saved-deals` returns `200`
- missing routes return safe `404`
- no environment, authentication, or `500` errors remain
- full production runtime retest passes
- migration and rollback receive final approval

## Deterministic Safety Confirmation
No changes were made to:
- True MAO
- finance calculations
- capital protection
- classification logic
- governance thresholds
- deterministic NO-GO
- Investor Shield hard-gate dominance

## Explicit Non-Implementation
- no migration execution
- no repository layer
- no API
- no UI
- no production access or mutation
- no Investor Summary implementation

## Validation
- build passed
- lint passed
- full tests passed: 89 files / 865 tests

## Result
PHASE 4E-2 EVIDENCE LITE MIGRATION PREPARED — NOT EXECUTED

## Recommended Next Step
Phase 4E-3 — Evidence Lite Repository Layer with Mocked Database Tests Only
