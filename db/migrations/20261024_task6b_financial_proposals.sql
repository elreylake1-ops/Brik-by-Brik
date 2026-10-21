-- Option 2 / Task 6B: financial-impact proposals, their decisions, and the plan-to-measurement link
-- (PROPOSED - NOT APPLIED to any shared database).
-- Scope: two new tables, plus two additive columns and two additive constraints on refurb_plan_confirmations (a Task 6A
-- table that has only ever existed in the local QA database). No Saved Deal, Investor Shield, governance or pipeline table
-- is read or written by anything here, and none gains a column.
-- Depends on: 20261022_task6a_refurb_plan.sql and 20261023_task6b_measurements.sql.
-- Apply ONLY to an isolated non-Production QA/Preview database:
--   psql "$TARGET" --single-transaction -v ON_ERROR_STOP=1 -f <this file>
--
-- Design
--   * A proposal is the engine's figures for a confirmed scope, frozen with the Saved Deal figures it was compared with.
--     Rows are immutable; a changed deal, plan, finding or measurement produces a NEW proposal version.
--   * A decision (CONFIRMED / DECLINED) is a separate append-only event naming the operator. At most one decision per proposal.
--     Recording it writes nothing to the Saved Deal: there is deliberately no column or function that could.
--
-- Rollback (reverse order; the added plan columns disappear with the Task 6A table, or can be dropped individually:
--   ALTER TABLE brik_by_brik_engine.refurb_plan_confirmations DROP CONSTRAINT IF EXISTS fk_refurb_plan_measurements;
--   ALTER TABLE brik_by_brik_engine.refurb_plan_confirmations DROP COLUMN IF EXISTS measurement_set_id, DROP COLUMN IF EXISTS measurement_set_version;)
--   DROP TABLE IF EXISTS brik_by_brik_engine.refurb_financial_decisions;
--   DROP TABLE IF EXISTS brik_by_brik_engine.refurb_financial_proposals;

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

ALTER TABLE brik_by_brik_engine.refurb_plan_confirmations
  ADD COLUMN IF NOT EXISTS measurement_set_id TEXT,
  ADD COLUMN IF NOT EXISTS measurement_set_version INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_refurb_plan_scope') THEN
    ALTER TABLE brik_by_brik_engine.refurb_plan_confirmations
      ADD CONSTRAINT uq_refurb_plan_scope UNIQUE (deal_id, assessment_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_refurb_plan_measurements') THEN
    ALTER TABLE brik_by_brik_engine.refurb_plan_confirmations
      ADD CONSTRAINT fk_refurb_plan_measurements
      FOREIGN KEY (deal_id, assessment_id, measurement_set_id)
      REFERENCES brik_by_brik_engine.refurb_measurement_sets (deal_id, assessment_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_refurb_plan_measurement_pair') THEN
    ALTER TABLE brik_by_brik_engine.refurb_plan_confirmations
      ADD CONSTRAINT ck_refurb_plan_measurement_pair
      CHECK ((measurement_set_id IS NULL) = (measurement_set_version IS NULL));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.refurb_financial_proposals (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  content JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_refurb_proposal_plan
    FOREIGN KEY (deal_id, assessment_id, plan_id)
    REFERENCES brik_by_brik_engine.refurb_plan_confirmations (deal_id, assessment_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_refurb_proposal_content UNIQUE (plan_id, content_hash),
  CONSTRAINT uq_refurb_proposal_version UNIQUE (deal_id, assessment_id, version),
  CONSTRAINT uq_refurb_proposal_scope UNIQUE (deal_id, assessment_id, id),
  CONSTRAINT ck_refurb_proposal_version CHECK (version >= 1),
  CONSTRAINT ck_refurb_proposal_hash CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ck_refurb_proposal_nonauth CHECK (COALESCE(content ->> 'nonAuthoritative', '') = 'true')
);

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.refurb_financial_decisions (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  acknowledged JSONB NOT NULL,
  baseline_fingerprint TEXT NOT NULL,
  same_operator_as_scope_confirmer BOOLEAN NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_refurb_decision_proposal
    FOREIGN KEY (deal_id, assessment_id, proposal_id)
    REFERENCES brik_by_brik_engine.refurb_financial_proposals (deal_id, assessment_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_refurb_decision_one_per_proposal UNIQUE (proposal_id),
  CONSTRAINT ck_refurb_decision_value CHECK (decision IN ('CONFIRMED', 'DECLINED')),
  CONSTRAINT ck_refurb_decision_hashes CHECK (request_hash ~ '^[a-f0-9]{64}$' AND baseline_fingerprint ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ck_refurb_decision_ack CHECK (decision = 'DECLINED' OR COALESCE(acknowledged ->> 'notWriteBack', '') = 'true')
);

DROP TRIGGER IF EXISTS trg_refurb_proposals_append_only ON brik_by_brik_engine.refurb_financial_proposals;
CREATE TRIGGER trg_refurb_proposals_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.refurb_financial_proposals
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_refurb_decisions_append_only ON brik_by_brik_engine.refurb_financial_decisions;
CREATE TRIGGER trg_refurb_decisions_append_only
  BEFORE UPDATE OR DELETE ON brik_by_brik_engine.refurb_financial_decisions
  FOR EACH ROW EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_refurb_proposals_no_truncate ON brik_by_brik_engine.refurb_financial_proposals;
CREATE TRIGGER trg_refurb_proposals_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.refurb_financial_proposals
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();

DROP TRIGGER IF EXISTS trg_refurb_decisions_no_truncate ON brik_by_brik_engine.refurb_financial_decisions;
CREATE TRIGGER trg_refurb_decisions_no_truncate
  BEFORE TRUNCATE ON brik_by_brik_engine.refurb_financial_decisions
  FOR EACH STATEMENT EXECUTE FUNCTION brik_by_brik_engine.viewing_reject_mutation();
