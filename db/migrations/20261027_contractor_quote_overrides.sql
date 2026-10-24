-- Work Package 4B: Persistent Contractor Quote Overrides (isolated QA / local only).
-- Schema for persisting operator-approved contractor quote prices mapped to refurbishment tasks.
-- Depends on: 20260522_phase4a_saved_deals_table.sql, 20260622_phase4e_deal_evidence_table.sql, and 20261020_task2_viewing_assessment_tables.sql.

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
  vat_basis TEXT NOT NULL DEFAULT 'GROSS',
  quote_type TEXT NOT NULL DEFAULT 'OPERATOR_PROVISIONAL_ESTIMATE',
  scope_verified BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_quote_override_assessment
    FOREIGN KEY (deal_id, assessment_id)
    REFERENCES brik_by_brik_engine.viewing_assessments (deal_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_quote_override_evidence
    FOREIGN KEY (quote_evidence_id)
    REFERENCES brik_by_brik_engine.deal_evidence (id) ON DELETE SET NULL,
  CONSTRAINT ck_quote_override_amount CHECK (approved_amount > 0 AND approved_amount <= 10000000),
  CONSTRAINT ck_quote_override_status CHECK (status IN ('APPROVED', 'SUPERSEDED', 'DECLINED')),
  CONSTRAINT ck_quote_override_vat_basis CHECK (vat_basis IN ('GROSS', 'NET_PLUS_VAT', 'EXEMPT')),
  CONSTRAINT ck_quote_override_quote_type CHECK (quote_type IN ('VERIFIED_CONTRACTOR_QUOTE', 'OPERATOR_PROVISIONAL_ESTIMATE'))
);

CREATE INDEX IF NOT EXISTS idx_quote_overrides_lookup
  ON brik_by_brik_engine.contractor_quote_overrides (deal_id, assessment_id, status);

CREATE INDEX IF NOT EXISTS idx_quote_overrides_task
  ON brik_by_brik_engine.contractor_quote_overrides (deal_id, task_id, status);

CREATE INDEX IF NOT EXISTS idx_quote_overrides_evidence
  ON brik_by_brik_engine.contractor_quote_overrides (quote_evidence_id);

-- Enforce exactly one active approved quote per task on a viewing assessment
CREATE UNIQUE INDEX IF NOT EXISTS uq_contractor_quote_active_task
  ON brik_by_brik_engine.contractor_quote_overrides (deal_id, assessment_id, task_id)
  WHERE status = 'APPROVED';
