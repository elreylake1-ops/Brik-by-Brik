-- Work Package 4B: Persistent Contractor Quote Overrides (isolated QA / local only).
-- Schema for persisting operator-approved contractor quote prices mapped to refurbishment tasks.
-- Depends on: 20260522_phase4a_saved_deals_table.sql and 20261020_task2_viewing_assessment_tables.sql.

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.contractor_quote_overrides (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  quote_evidence_id TEXT,
  quote_ref TEXT NOT NULL,
  approved_amount NUMERIC NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'APPROVED',
  superseded_by TEXT,
  CONSTRAINT fk_quote_override_assessment
    FOREIGN KEY (deal_id, assessment_id)
    REFERENCES brik_by_brik_engine.viewing_assessments (deal_id, id) ON DELETE CASCADE,
  CONSTRAINT ck_quote_override_amount CHECK (approved_amount >= 0),
  CONSTRAINT ck_quote_override_status CHECK (status IN ('APPROVED', 'SUPERSEDED', 'DECLINED'))
);

CREATE INDEX IF NOT EXISTS idx_quote_overrides_lookup
  ON brik_by_brik_engine.contractor_quote_overrides (deal_id, assessment_id, status);

CREATE INDEX IF NOT EXISTS idx_quote_overrides_task
  ON brik_by_brik_engine.contractor_quote_overrides (deal_id, task_id, status);
