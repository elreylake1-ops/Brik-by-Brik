# Phase 4 Completion Block 2A Evidence Lite Schema and Persistence Plan

## Purpose
Define an implementation-ready, planning-only Evidence Lite persistence design that fits the current `brik_by_brik_engine` database conventions, stays separate from Investor Shield runtime behavior, and can be executed later in small controlled phases after the James Vercel production database retest passes.

## Current Database Conventions
- Database access uses `lib/db/postgres.ts` with `pg.Pool` and a required `DATABASE_URL`.
- The canonical application schema is `brik_by_brik_engine`.
- Primary records use mixed ID conventions:
  - `saved_deals.id` is `TEXT PRIMARY KEY`.
  - `deal_offers.id` and `deal_tasks.id` are `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
  - Investor Shield tables use `TEXT PRIMARY KEY` IDs.
- Foreign keys on child tables use `deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE`.
- Timestamp convention is `TIMESTAMPTZ NOT NULL DEFAULT NOW()` for created timestamps, and `updated_at` is used where mutation tracking is needed.
- Archive behavior is soft-delete style on `saved_deals` via `archived_at` and `pipeline_state = 'ARCHIVED'`, not hard delete.
- Test strategy is local and mocked:
  - repository tests mock `@/lib/db/postgres`
  - migration consistency tests read the SQL files directly
  - no live production mutation is used in unit tests
- Existing Investor Shield persistence already proves the repo prefers separate read/write tables instead of overloading `saved_deals`.

## Proposed Evidence Lite Schema
Use a new table named `brik_by_brik_engine.deal_evidence`.

Proposed columns:
- `id TEXT PRIMARY KEY`
- `deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE`
- `evidence_type TEXT NOT NULL`
- `linked_gate TEXT NOT NULL`
- `title TEXT NOT NULL`
- `note TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'MISSING'`
- `reviewed BOOLEAN NOT NULL DEFAULT false`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Mapping from the requested planning fields:
- `created_date` -> `created_at`
- `updated_date` -> `updated_at`
- `reviewed_yes_no` -> `reviewed`

Implementation note:
- Do not reuse `brik_by_brik_engine.evidence_items` for Evidence Lite.
- `evidence_items` is already an Investor Shield-specific table with `source`, `file_url`, and `advisory_only`, which are not part of this Evidence Lite scope.

## Evidence Types
Phase 4 Evidence Lite types should be stored exactly as the phase requires:
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

Do not add upload-only or document-storage-only types in this phase.
Do not add `UPLOADED`, because Phase 4 has no evidence upload UI and no file-storage flow in scope.

## Evidence Statuses
Use the following status values:
- `MISSING`
- `RECORDED`
- `REVIEWED`
- `VERIFIED`
- `REJECTED`

`UPLOADED` should not be added at this stage because there is no upload workflow to support it.

## Investor Shield Gate Mapping
The current repo gate contract in `types/investor-shield.ts` uses:
- `SOLD_COMPS`
- `TITLE`
- `LEASEHOLD`
- `PLANNING_BUILDING_CONTROL`
- `REFURB_CERTAINTY`
- `BUILDER_PROPOSAL_CONTRACT`
- `DAMP_STRUCTURAL`
- `LENDER_CRITERIA`
- `RENTAL_DEMAND`
- `SOLICITOR_FEEDBACK`

The requested Evidence Lite planning set includes `SOLICITOR_REVIEW`, but the current repository contract uses `SOLICITOR_FEEDBACK`.

Planned validation rule:
- store the canonical repo gate key in `linked_gate`
- accept `SOLICITOR_REVIEW` only as a future input alias if needed
- normalize that alias to `SOLICITOR_FEEDBACK` instead of changing the current Investor Shield contract in this planning step

This keeps the new Evidence Lite layer aligned with the existing Investor Shield logic instead of creating a second, conflicting gate vocabulary.

## Persistence Rules
- One evidence row belongs to one saved deal through `deal_id`.
- Evidence rows are appendable records, not automatic gate satisfiers.
- Creating or updating evidence does not change saved deal classification, True MAO, finance logic, capital protection, or governance thresholds.
- Evidence rows may be reviewed later, but the reviewed flag is only metadata.
- The presence of a note does not imply verification.
- A recorded note does not mean the related gate is satisfied.
- Deleting evidence later must not silently preserve a gate as satisfied if the implementation eventually derives status from rows.
- Existing Investor Shield enforcement remains the source of truth for hard gates.

## Deterministic Safety Rules
- Evidence Lite cannot override deterministic NO-GO.
- Evidence Lite cannot override True MAO failure.
- Evidence Lite cannot override capital protection failure.
- Evidence Lite cannot change classifications.
- Evidence Lite cannot soften governance thresholds.
- Advisory evidence cannot satisfy hard gates by itself.
- `RECORDED` is not `VERIFIED`.
- A reviewed checkbox is not an approval mechanism.
- This feature must remain subordinate to current Investor Shield enforcement rules.

## Repository and API Plan
Minimum repository operations for a later implementation phase:
- list evidence rows for a deal
- create an evidence note
- update evidence note text and/or status
- optionally delete evidence, only if repository conventions and product rules later justify it

Minimum API surface for a later implementation phase:
- `GET /api/saved-deals/[id]/evidence`
- `POST /api/saved-deals/[id]/evidence`
- `PATCH /api/saved-deals/[id]/evidence/[evidenceId]`
- optional `DELETE /api/saved-deals/[id]/evidence/[evidenceId]` if deletion is explicitly approved

No implementation is added in this task.

## Validation Rules
- The deal must exist before evidence can be created or updated.
- `linked_gate` must be one of the accepted gate keys.
- `title` is required and length-limited.
- `note` is required and length-limited.
- `status` must be one of the approved Evidence Lite statuses.
- `evidence_type` must be one of the approved Evidence Lite types.
- `reviewed` must be boolean.
- No arbitrary gate names are allowed.
- No automatic gate satisfaction is allowed.

Recommended validation details:
- enforce non-empty trimmed text for `title` and `note`
- reject unknown `evidence_type` and `linked_gate` values at the API boundary
- keep the table schema itself simple, with validation primarily in the repository/API layer

## Indexes and Constraints
- Foreign key: `deal_id` -> `brik_by_brik_engine.saved_deals(id)` with `ON DELETE CASCADE`
- Index: `deal_id`
- Optional composite index: `deal_id, linked_gate`
- Timestamp columns: `created_at`, `updated_at`
- Duplicate notes: allowed unless a later product rule requires uniqueness
- Cleanup strategy: deleting a saved deal removes dependent evidence rows through cascade

Suggested DDL shape:
```sql
CREATE TABLE IF NOT EXISTS brik_by_brik_engine.deal_evidence (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  linked_gate TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MISSING',
  reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Suggested indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_deal_evidence_deal_id
  ON brik_by_brik_engine.deal_evidence (deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_evidence_deal_id_linked_gate
  ON brik_by_brik_engine.deal_evidence (deal_id, linked_gate);
```

## Migration and Rollback Plan
Planned migration filename:
- `db/migrations/20260622_phase4e_deal_evidence_table.sql`

Expected schema change:
- create `brik_by_brik_engine.deal_evidence`
- add the `deal_id` foreign key
- add the evidence indexes
- keep all existing tables unchanged

Rollback plan:
- drop the indexes created by the migration
- drop `brik_by_brik_engine.deal_evidence`
- confirm the remaining schema is unchanged

Pre-migration verification:
- James Vercel production `DATABASE_URL` must work
- Block 1B production retest must pass
- migration SQL must be reviewed
- rollback procedure must be recorded

Post-migration verification:
- confirm the table exists
- confirm `deal_id` is text and references `saved_deals(id)`
- confirm the indexes exist
- confirm no existing rows were modified
- confirm runtime read routes still behave deterministically

No production migration should run until explicit approval and database connection verification are complete.

## Controlled Implementation Subphases
- Block 2B1 — Evidence Lite contracts and validation only
- Block 2B2 — Migration file and repository layer locally only
- Block 2B3 — API routes and tests locally only
- Block 2B4 — Minimal saved-deal Evidence Lite UI locally only
- Block 2B5 — Reviewed migration execution on James Supabase
- Block 2B6 — Production persistence proof and cleanup

## Production Preconditions
Implementation and migration cannot proceed until:
- James Vercel `DATABASE_URL` works
- Block 1B production retest passes
- the migration is reviewed
- the rollback plan is recorded

## Explicit Non-Implementation
- No migration was run.
- No schema was changed.
- No API was added.
- No UI was added.
- No production mutation occurred.
- No deterministic logic was changed.
- No Investor Shield runtime behavior was changed.
- No Evidence Lite data rows were created.

## Result
EVIDENCE LITE PLAN READY — IMPLEMENTATION BLOCKED BY PRODUCTION RETEST

## Recommended Next Step
Resume James Vercel database connection verification when James confirms the password update.

In parallel, the next planning-only step may be:
Block 2A-2 Investor Summary View Data Contract Audit
