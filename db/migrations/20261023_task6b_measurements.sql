-- Option 2 / Task 6B: operator-entered measurement sets (PROPOSED - NOT APPLIED to any shared database).
-- Scope: one new table in brik_by_brik_engine. No change to any existing table.
-- Depends on: 20261020_task2_viewing_assessment_tables.sql (composite key and the viewing_reject_mutation() trigger function).
-- Apply ONLY to an isolated non-Production QA/Preview database after the target, ownership and recovery path are verified:
--   psql "$TARGET" --single-transaction -v ON_ERROR_STOP=1 -f <this file>
--
-- Design
--   * Append-only versions. A correction is a new row (version + 1) that must say what was wrong; earlier rows are never edited.
--   * Bound to its assessment and deal by a composite foreign key.
--   * Values are entered by a person. The application has no source value for video and this table has no frame reference.
--   * Optimistic concurrency: a new version must be based on the previous one (based_on_version = version - 1), so two
--     operators cannot silently overwrite each other.
--
-- Rollback (measurement history only; run AFTER dropping refurb_plan_confirmations, which references it):
--   DROP TABLE IF EXISTS brik_by_brik_engine.refurb_measurement_sets;

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.refurb_measurement_sets (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  based_on_version INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  entries JSONB NOT NULL,
  warnings JSONB NOT NULL,
  change_note TEXT,
  recorded_by TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_refurb_measurements_assessment
    FOREIGN KEY (deal_id, assessment_id)
    REFERENCES brik_by_brik_engine.viewing_assessments (deal_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_refurb_measurements_idempotency UNIQUE (deal_id, assessment_id, idempotency_key),
  CONSTRAINT uq_refurb_measurements_version UNIQUE (deal_id, assessment_id, version),
  CONSTRAINT uq_refurb_measurements_scope UNIQUE (deal_id, assessment_id, id),
  CONSTRAINT ck_refurb_measurements_version CHECK (version >= 1 AND based_on_version = version - 1),
  CONSTRAINT ck_refurb_measurements_hash CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ck_refurb_measurements_entries CHECK (jsonb_typeof(entries) = 'array' AND jsonb_array_length(entries) BETWEEN 1 AND 60),
  CONSTRAINT ck_refurb_measurements_correction CHECK (version = 1 OR (change_note IS NOT NULL AND char_length(btrim(change_note)) >= 5))
);

CREATE INDEX IF NOT EXISTS idx_refurb_measurements_current
  ON brik_by_brik_engine.refurb_measurement_sets (deal_id, assessment_id, version DESC);

DROP TRIGGER IF EXISTS trg_refurb_measurements_append_only ON brik_by_brik_engine.refurb_measurement_sets;
CREATE TRIGGER trg_refurb_measurements_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.refurb_measurement_sets
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_refurb_measurements_no_truncate ON brik_by_brik_engine.refurb_measurement_sets;
CREATE TRIGGER trg_refurb_measurements_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.refurb_measurement_sets
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();
