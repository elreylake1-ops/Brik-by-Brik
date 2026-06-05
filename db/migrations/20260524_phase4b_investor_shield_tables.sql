-- Phase 4B-2 Investor Shield migration draft
-- Scope: draft only Investor Shield schema tables
-- Runtime/staging security policy application is deferred to a later proof step.

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.investor_shield_checks (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE,
  gate_key TEXT NOT NULL,
  sub_gate_key TEXT,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence TEXT NOT NULL,
  required_evidence TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.evidence_items (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE,
  gate_key TEXT NOT NULL,
  sub_gate_key TEXT,
  evidence_type TEXT NOT NULL,
  source TEXT NOT NULL,
  label TEXT NOT NULL,
  notes TEXT,
  file_url TEXT,
  advisory_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.risk_flags (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE,
  gate_key TEXT,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.manual_overrides (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE,
  gate_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.builder_proposals (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE,
  builder_name TEXT,
  quoted_amount NUMERIC,
  scope_summary TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.builder_contract_checks (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE,
  builder_proposal_id TEXT REFERENCES brik_by_brik_engine.builder_proposals(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  has_signed_contract BOOLEAN NOT NULL DEFAULT false,
  has_payment_schedule BOOLEAN NOT NULL DEFAULT false,
  has_scope_of_works BOOLEAN NOT NULL DEFAULT false,
  has_start_date BOOLEAN NOT NULL DEFAULT false,
  has_insurance_evidence BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_shield_checks_deal_id
  ON brik_by_brik_engine.investor_shield_checks (deal_id);

CREATE INDEX IF NOT EXISTS idx_investor_shield_checks_deal_id_gate_key
  ON brik_by_brik_engine.investor_shield_checks (deal_id, gate_key);

CREATE INDEX IF NOT EXISTS idx_evidence_items_deal_id
  ON brik_by_brik_engine.evidence_items (deal_id);

CREATE INDEX IF NOT EXISTS idx_evidence_items_deal_id_gate_key
  ON brik_by_brik_engine.evidence_items (deal_id, gate_key);

CREATE INDEX IF NOT EXISTS idx_risk_flags_deal_id
  ON brik_by_brik_engine.risk_flags (deal_id);

CREATE INDEX IF NOT EXISTS idx_risk_flags_deal_id_severity
  ON brik_by_brik_engine.risk_flags (deal_id, severity);

CREATE INDEX IF NOT EXISTS idx_manual_overrides_deal_id
  ON brik_by_brik_engine.manual_overrides (deal_id);

CREATE INDEX IF NOT EXISTS idx_builder_proposals_deal_id
  ON brik_by_brik_engine.builder_proposals (deal_id);

CREATE INDEX IF NOT EXISTS idx_builder_contract_checks_deal_id
  ON brik_by_brik_engine.builder_contract_checks (deal_id);

CREATE INDEX IF NOT EXISTS idx_builder_contract_checks_builder_proposal_id
  ON brik_by_brik_engine.builder_contract_checks (builder_proposal_id);
