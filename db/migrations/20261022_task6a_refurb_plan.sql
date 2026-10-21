-- Option 2 / Task 6A: confirmed refurbishment plans (PROPOSED - NOT APPLIED to any shared database).
-- Scope: one new table in brik_by_brik_engine. No change to any existing table, and nothing here reads or writes
-- saved_deals financial columns, Investor Shield tables or pipeline state.
-- Depends on: 20260522_phase4a_saved_deals_table.sql and 20261020_task2_viewing_assessment_tables.sql
--   (it reuses viewing_assessments' composite key and the viewing_reject_mutation() trigger function).
-- Apply ONLY to an isolated non-Production QA/Preview database after the target, ownership and recovery path are verified:
--   psql "$TARGET" --single-transaction -v ON_ERROR_STOP=1 -f <this file>
--
-- Design
--   * Append-only: a plan is a human's confirmation of work scope at a moment in time. A later confirmation is a new row
--     (higher version); the earlier one is never edited. The computed estimate/schedule/financial snapshot is stored with it
--     so the figures a person confirmed can always be shown exactly as they were.
--   * Bound to its assessment and deal by a composite foreign key, so a plan cannot point at another deal's assessment.
--   * Idempotent: (deal_id, assessment_id, idempotency_key) is unique; request_hash lets the service tell a safe replay
--     from a reused key.
--
-- Rollback (confirmed plans only; viewing data, deals and Investor Shield are untouched):
--   DROP TABLE IF EXISTS brik_by_brik_engine.refurb_plan_confirmations;

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.refurb_plan_confirmations (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  analysis_source TEXT NOT NULL,
  accepted_items JSONB NOT NULL,
  excluded JSONB NOT NULL,
  property_basics JSONB NOT NULL,
  financial_assumptions JSONB,
  computation JSONB NOT NULL,
  confirmed_by TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_refurb_plan_assessment
    FOREIGN KEY (deal_id, assessment_id)
    REFERENCES brik_by_brik_engine.viewing_assessments (deal_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_refurb_plan_idempotency UNIQUE (deal_id, assessment_id, idempotency_key),
  CONSTRAINT uq_refurb_plan_version UNIQUE (deal_id, assessment_id, version),
  CONSTRAINT ck_refurb_plan_version CHECK (version >= 1),
  CONSTRAINT ck_refurb_plan_hash CHECK (request_hash ~ '^[a-f0-9]{64}$' AND source_fingerprint ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ck_refurb_plan_analysis_source CHECK (analysis_source IN ('NONE', 'SIMULATED', 'LIVE', 'MIXED')),
  CONSTRAINT ck_refurb_plan_has_items CHECK (jsonb_typeof(accepted_items) = 'array' AND jsonb_array_length(accepted_items) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_refurb_plan_current
  ON brik_by_brik_engine.refurb_plan_confirmations (deal_id, assessment_id, version DESC);

DROP TRIGGER IF EXISTS trg_refurb_plan_append_only ON brik_by_brik_engine.refurb_plan_confirmations;
CREATE TRIGGER trg_refurb_plan_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.refurb_plan_confirmations
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_refurb_plan_no_truncate ON brik_by_brik_engine.refurb_plan_confirmations;
CREATE TRIGGER trg_refurb_plan_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.refurb_plan_confirmations
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();
