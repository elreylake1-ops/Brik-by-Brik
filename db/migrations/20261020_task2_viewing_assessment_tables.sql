-- Option 2 / Task 2: viewing assessment persistence (PROPOSED - NOT APPLIED).
-- Scope: new tables only, all schema-qualified in brik_by_brik_engine. No change to any existing table.
-- Apply ONLY to an isolated non-Production QA database after the target, ownership and recovery
-- path are verified. This file is never executed by tests or the application.
--
-- Design notes
--   * Ownership: every row is scoped to saved_deals(id) via deal_id. saved_deals has no owner column;
--     access control is enforced in the API (requireSavedDealReadAccess). created_by is audit metadata
--     taken from the server-side principal, never from the client.
--   * No video binaries here. viewing_assets holds metadata only. storage_key is reserved for a future
--     PRIVATE object-store key and is never returned by any API response.
--   * Append-only: evidence, proposals, reviews and feedback reject UPDATE/DELETE via trigger.
--     The original AI prediction (viewing_proposals) and each human decision (viewing_reviews) are
--     therefore stored separately and cannot be rewritten. A new review is a new revision row.
--   * Mutable by design: viewing_analysis_runs only (processing status / attempt count).
--   * AI proposals carry verification = 'UNVERIFIED' (CHECK-enforced). Nothing here references the
--     finance engine or Investor Shield tables.
--
-- Apply with:  psql "$QA_URL" --single-transaction -v ON_ERROR_STOP=1 -f <this file>
--   (one transaction: a failure leaves nothing behind). Never against Production or a shared project
--   whose isolation from Production is unverified.
-- Not included on purpose (owner decision, Task 3A): RLS/GRANT/REVOKE. The application role is unknown,
--   so enabling RLS could lock the app out. Existing tables in this schema have no RLS either.
-- Integrity notes: composite foreign keys below force child rows to carry the SAME assessment_id as
--   their parent, so a row can never link across assessments (and so across deals) even via raw SQL.
--   Not enforceable in SQL: proposals.evidence_ids (array) existence and evidence timestamp <= clip
--   duration; those stay API-validated.
--
-- Rollback (reverse order; destroys all viewing-assessment data - export first if any QA data matters):
--   DROP TABLE IF EXISTS brik_by_brik_engine.viewing_ai_usage;
--   DROP TABLE IF EXISTS brik_by_brik_engine.viewing_evidence_blobs;
--   DROP TABLE IF EXISTS brik_by_brik_engine.viewing_feedback;
--   DROP TABLE IF EXISTS brik_by_brik_engine.viewing_reviews;
--   DROP TABLE IF EXISTS brik_by_brik_engine.viewing_proposals;
--   DROP TABLE IF EXISTS brik_by_brik_engine.viewing_analysis_runs;
--   DROP TABLE IF EXISTS brik_by_brik_engine.viewing_evidence;
--   DROP TABLE IF EXISTS brik_by_brik_engine.viewing_assets;
--   DROP TABLE IF EXISTS brik_by_brik_engine.viewing_assessments;
--   DROP FUNCTION IF EXISTS brik_by_brik_engine.viewing_reject_mutation();
-- Recovery: take a pg_dump of the QA schema (or a provider snapshot) before applying. Because the
-- migration only adds objects, rollback never touches saved_deals, deal_evidence or Investor Shield data.

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.viewing_assessments (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  checklist_version TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_viewing_assessments_deal_id
    FOREIGN KEY (deal_id) REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE,
  CONSTRAINT uq_viewing_assessments_idempotency UNIQUE (deal_id, idempotency_key),
  CONSTRAINT uq_viewing_assessments_deal_id_id UNIQUE (deal_id, id)
);

CREATE INDEX IF NOT EXISTS idx_viewing_assessments_deal_id
  ON brik_by_brik_engine.viewing_assessments (deal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.viewing_assets (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  duration_seconds NUMERIC NOT NULL CHECK (duration_seconds > 0),
  content_sha256 TEXT NULL,
  storage_key TEXT NULL, -- reserved: private object key; never exposed by the API
  source TEXT NOT NULL DEFAULT 'DECLARED_METADATA' CHECK (source IN ('DECLARED_METADATA')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_viewing_assets_assessment_id
    FOREIGN KEY (assessment_id) REFERENCES brik_by_brik_engine.viewing_assessments(id) ON DELETE CASCADE,
  CONSTRAINT uq_viewing_assets_id_assessment UNIQUE (id, assessment_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_viewing_assets_assessment_sha
  ON brik_by_brik_engine.viewing_assets (assessment_id, content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.viewing_evidence (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  timestamp_seconds NUMERIC NOT NULL CHECK (timestamp_seconds >= 0),
  room TEXT NULL,
  -- Submission position within the clip. Rows of one clip are inserted in one transaction and share
  -- created_at, so ordering must never fall back to the (random) id.
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_viewing_evidence_asset_ordinal UNIQUE (asset_id, ordinal),
  CONSTRAINT uq_viewing_evidence_id_assessment UNIQUE (id, assessment_id),
  CONSTRAINT fk_viewing_evidence_assessment_id
    FOREIGN KEY (assessment_id) REFERENCES brik_by_brik_engine.viewing_assessments(id) ON DELETE CASCADE,
  CONSTRAINT fk_viewing_evidence_asset_id
    FOREIGN KEY (asset_id, assessment_id) REFERENCES brik_by_brik_engine.viewing_assets(id, assessment_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_viewing_evidence_assessment_id
  ON brik_by_brik_engine.viewing_evidence (assessment_id);

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.viewing_analysis_runs (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mock', 'fixture', 'claude')),
  model_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'READY_FOR_REVIEW', 'PARTIAL', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  proposals_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_viewing_analysis_runs_assessment_id
    FOREIGN KEY (assessment_id) REFERENCES brik_by_brik_engine.viewing_assessments(id) ON DELETE CASCADE,
  CONSTRAINT uq_viewing_analysis_runs_idempotency UNIQUE (assessment_id, idempotency_key),
  CONSTRAINT uq_viewing_analysis_runs_id_assessment UNIQUE (id, assessment_id)
);

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.viewing_proposals (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  check_id TEXT NOT NULL CHECK (check_id ~ '^(C(0[1-9]|[1-3][0-9]|4[0-5])|V(0[1-9]|1[0-3]))$'),
  status TEXT NOT NULL CHECK (status IN ('OBSERVED', 'CONCERN', 'SPECIALIST_REVIEW')),
  observation TEXT NOT NULL CHECK (char_length(observation) BETWEEN 1 AND 1000),
  evidence_ids TEXT[] NOT NULL CHECK (cardinality(evidence_ids) >= 1),
  -- Position within its run, as returned by the analysis. Ordering must not depend on id format.
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  room TEXT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  suggested_work TEXT NULL,
  model_version TEXT NOT NULL,
  verification TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification = 'UNVERIFIED'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_viewing_proposals_assessment_id
    FOREIGN KEY (assessment_id) REFERENCES brik_by_brik_engine.viewing_assessments(id) ON DELETE CASCADE,
  CONSTRAINT fk_viewing_proposals_run_id
    FOREIGN KEY (run_id, assessment_id) REFERENCES brik_by_brik_engine.viewing_analysis_runs(id, assessment_id) ON DELETE CASCADE,
  CONSTRAINT uq_viewing_proposals_id_assessment UNIQUE (id, assessment_id),
  CONSTRAINT uq_viewing_proposals_run_ordinal UNIQUE (run_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_viewing_proposals_assessment_id
  ON brik_by_brik_engine.viewing_proposals (assessment_id, created_at);

-- One row per human decision. Current state of a proposal = highest revision.
CREATE TABLE IF NOT EXISTS brik_by_brik_engine.viewing_reviews (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  disposition TEXT NOT NULL CHECK (disposition IN ('ACCEPTED', 'EDITED', 'REJECTED')),
  edited_status TEXT NULL CHECK (edited_status IN (
    'NOT_ASSESSED', 'OBSERVED', 'CONCERN', 'SPECIALIST_REVIEW', 'NOT_ACCESSIBLE', 'NOT_APPLICABLE'
  )),
  edited_observation TEXT NULL CHECK (edited_observation IS NULL OR char_length(edited_observation) BETWEEN 1 AND 1000),
  reason TEXT NULL,
  reviewer_id TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_viewing_reviews_proposal_id
    FOREIGN KEY (proposal_id, assessment_id) REFERENCES brik_by_brik_engine.viewing_proposals(id, assessment_id) ON DELETE CASCADE,
  CONSTRAINT fk_viewing_reviews_assessment_id
    FOREIGN KEY (assessment_id) REFERENCES brik_by_brik_engine.viewing_assessments(id) ON DELETE CASCADE,
  CONSTRAINT uq_viewing_reviews_revision UNIQUE (proposal_id, revision),
  CONSTRAINT uq_viewing_reviews_id_proposal UNIQUE (id, proposal_id),
  CONSTRAINT chk_viewing_reviews_edit_fields CHECK (
    (disposition = 'EDITED') = (edited_status IS NOT NULL AND edited_observation IS NOT NULL)
  ),
  CONSTRAINT chk_viewing_reviews_reject_reason CHECK (disposition <> 'REJECTED' OR reason IS NOT NULL)
);

-- Append-only feedback history. REVIEW rows are written in the same transaction as a review;
-- ACTUAL_OUTCOME rows are appended later (survey / quote / completed works) and never edit earlier rows.
CREATE TABLE IF NOT EXISTS brik_by_brik_engine.viewing_feedback (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  review_id TEXT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('REVIEW', 'ACTUAL_OUTCOME')),
  model_version TEXT NOT NULL,
  original_json JSONB NOT NULL,
  human_correction_json JSONB NULL,
  disposition TEXT NULL CHECK (disposition IN ('ACCEPTED', 'EDITED', 'REJECTED')),
  outcome_note TEXT NULL CHECK (outcome_note IS NULL OR char_length(outcome_note) BETWEEN 1 AND 1000),
  -- Structured actual outcome (ACTUAL_OUTCOME rows only): what really turned out, and where that came from.
  outcome_result TEXT NULL CHECK (outcome_result IN ('CONFIRMED', 'PARTIALLY_CONFIRMED', 'NOT_CONFIRMED', 'UNDETERMINED')),
  outcome_source TEXT NULL CHECK (outcome_source IN ('SURVEY', 'CONTRACTOR_QUOTE', 'WORKS_COMPLETED', 'VENDOR_DISCLOSURE', 'OTHER')),
  outcome_observed_status TEXT NULL CHECK (outcome_observed_status IN (
    'NOT_ASSESSED', 'OBSERVED', 'CONCERN', 'SPECIALIST_REVIEW', 'NOT_ACCESSIBLE', 'NOT_APPLICABLE'
  )),
  recorded_by TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_viewing_feedback_proposal_id
    FOREIGN KEY (proposal_id, assessment_id) REFERENCES brik_by_brik_engine.viewing_proposals(id, assessment_id) ON DELETE CASCADE,
  CONSTRAINT fk_viewing_feedback_assessment_id
    FOREIGN KEY (assessment_id) REFERENCES brik_by_brik_engine.viewing_assessments(id) ON DELETE CASCADE,
  CONSTRAINT fk_viewing_feedback_review_id
    FOREIGN KEY (review_id, proposal_id) REFERENCES brik_by_brik_engine.viewing_reviews(id, proposal_id) ON DELETE CASCADE,
  -- A REVIEW row carries a decision and no outcome fields; an ACTUAL_OUTCOME row carries a result, a source and a note,
  -- plus a snapshot of the prediction (original_json) and of the latest human decision at the time (review_id,
  -- disposition, human_correction_json), so the three can always be compared later.
  CONSTRAINT chk_viewing_feedback_shape CHECK (
    (kind = 'REVIEW' AND review_id IS NOT NULL AND disposition IS NOT NULL
       AND outcome_result IS NULL AND outcome_source IS NULL AND outcome_note IS NULL AND outcome_observed_status IS NULL)
    OR (kind = 'ACTUAL_OUTCOME' AND outcome_note IS NOT NULL AND outcome_result IS NOT NULL AND outcome_source IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_viewing_feedback_assessment_id
  ON brik_by_brik_engine.viewing_feedback (assessment_id, recorded_at);

-- Append-only enforcement. Direct UPDATE/DELETE is rejected. A DELETE reached through a referential
-- cascade (parent deal/assessment removed) runs at trigger depth > 1 and is allowed so deal deletion
-- is not blocked. UNVERIFIED on a live database: confirm in the QA target before relying on it.
CREATE OR REPLACE FUNCTION brik_by_brik_engine.viewing_reject_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD; -- allow referential cascade from a parent delete
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_viewing_evidence_append_only ON brik_by_brik_engine.viewing_evidence;
CREATE TRIGGER trg_viewing_evidence_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.viewing_evidence
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_viewing_assets_append_only ON brik_by_brik_engine.viewing_assets;
CREATE TRIGGER trg_viewing_assets_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.viewing_assets
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_viewing_proposals_append_only ON brik_by_brik_engine.viewing_proposals;
CREATE TRIGGER trg_viewing_proposals_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.viewing_proposals
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_viewing_reviews_append_only ON brik_by_brik_engine.viewing_reviews;
CREATE TRIGGER trg_viewing_reviews_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.viewing_reviews
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_viewing_feedback_append_only ON brik_by_brik_engine.viewing_feedback;
CREATE TRIGGER trg_viewing_feedback_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.viewing_feedback
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

-- TRUNCATE does not fire row-level triggers, so guard it at statement level too. A TRUNCATE ... CASCADE
-- from saved_deals is also refused while any history exists (intentional; use DELETE of specific deals).
-- Table owners and superusers can still DISABLE TRIGGER or set session_replication_role = replica;
-- that cannot be prevented in SQL and is covered by access control, not by this migration.
DROP TRIGGER IF EXISTS trg_viewing_assets_no_truncate ON brik_by_brik_engine.viewing_assets;
CREATE TRIGGER trg_viewing_assets_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.viewing_assets
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_viewing_evidence_no_truncate ON brik_by_brik_engine.viewing_evidence;
CREATE TRIGGER trg_viewing_evidence_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.viewing_evidence
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_viewing_proposals_no_truncate ON brik_by_brik_engine.viewing_proposals;
CREATE TRIGGER trg_viewing_proposals_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.viewing_proposals
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_viewing_reviews_no_truncate ON brik_by_brik_engine.viewing_reviews;
CREATE TRIGGER trg_viewing_reviews_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.viewing_reviews
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_viewing_feedback_no_truncate ON brik_by_brik_engine.viewing_feedback;
CREATE TRIGGER trg_viewing_feedback_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.viewing_feedback
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

-- ---------------------------------------------------------------------------------------------------------
-- Task 4A: private frame objects and the AI usage ledger
-- ---------------------------------------------------------------------------------------------------------

-- One IMMUTABLE row per evidence frame once its image bytes are stored. storage_key is a server-generated
-- private object key; no API response ever includes it. Bytes live in the private blob store, never here.
CREATE TABLE IF NOT EXISTS brik_by_brik_engine.viewing_evidence_blobs (
  evidence_id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE CHECK (storage_key ~ '^blob_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 2097152),
  mime_type TEXT NOT NULL CHECK (mime_type = 'image/jpeg'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_viewing_evidence_blobs_evidence
    FOREIGN KEY (evidence_id, assessment_id) REFERENCES brik_by_brik_engine.viewing_evidence(id, assessment_id) ON DELETE CASCADE
);

-- Append-only AI usage ledger: one row per finished analysis attempt, written in the same transaction as the
-- run result. cost_micros is USD * 1,000,000 (integers, no float drift). Simulated (fixture) rows cost zero by
-- constraint, so they can never consume the paid allowance. The budget guard sums non-simulated rows.
CREATE TABLE IF NOT EXISTS brik_by_brik_engine.viewing_ai_usage (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  provider TEXT NOT NULL CHECK (provider IN ('fixture', 'claude')),
  model_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  frame_count INTEGER NOT NULL CHECK (frame_count >= 0),
  input_tokens BIGINT NOT NULL CHECK (input_tokens >= 0),
  output_tokens BIGINT NOT NULL CHECK (output_tokens >= 0),
  cache_read_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cache_read_tokens >= 0),
  cache_write_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cache_write_tokens >= 0),
  cost_micros BIGINT NOT NULL CHECK (cost_micros >= 0),
  simulated BOOLEAN NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('OK', 'PARTIAL', 'REFUSAL', 'TIMEOUT', 'MALFORMED', 'PROVIDER_ERROR', 'BUDGET')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_viewing_ai_usage_simulated_is_free CHECK (NOT simulated OR cost_micros = 0),
  CONSTRAINT uq_viewing_ai_usage_run_attempt UNIQUE (run_id, attempt),
  CONSTRAINT fk_viewing_ai_usage_run
    FOREIGN KEY (run_id, assessment_id) REFERENCES brik_by_brik_engine.viewing_analysis_runs(id, assessment_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_viewing_ai_usage_created_at
  ON brik_by_brik_engine.viewing_ai_usage (created_at) WHERE NOT simulated;

DROP TRIGGER IF EXISTS trg_viewing_evidence_blobs_append_only ON brik_by_brik_engine.viewing_evidence_blobs;
CREATE TRIGGER trg_viewing_evidence_blobs_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.viewing_evidence_blobs
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();
DROP TRIGGER IF EXISTS trg_viewing_evidence_blobs_no_truncate ON brik_by_brik_engine.viewing_evidence_blobs;
CREATE TRIGGER trg_viewing_evidence_blobs_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.viewing_evidence_blobs
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_viewing_ai_usage_append_only ON brik_by_brik_engine.viewing_ai_usage;
CREATE TRIGGER trg_viewing_ai_usage_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.viewing_ai_usage
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();
DROP TRIGGER IF EXISTS trg_viewing_ai_usage_no_truncate ON brik_by_brik_engine.viewing_ai_usage;
CREATE TRIGGER trg_viewing_ai_usage_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.viewing_ai_usage
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();
