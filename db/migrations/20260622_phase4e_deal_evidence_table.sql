-- Phase 4E-2 Evidence Lite table migration
-- Scope: create the canonical text-note evidence table only.
-- Rollback plan:
--   1. Drop idx_deal_evidence_deal_id_linked_gate.
--   2. Drop idx_deal_evidence_deal_id.
--   3. Drop brik_by_brik_engine.deal_evidence.
-- This migration is deterministic, schema-qualified, and does not execute automatically in tests.

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.deal_evidence (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  linked_gate TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MISSING',
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_deal_evidence_evidence_type
    CHECK (evidence_type IN (
      'SOLD_COMP',
      'TITLE_REVIEW',
      'LEASEHOLD_REVIEW',
      'PLANNING_BUILDING_CONTROL',
      'REFURB_NOTE',
      'BUILDER_QUOTE',
      'SURVEY_NOTE',
      'LENDER_NOTE',
      'RENTAL_DEMAND',
      'SOLICITOR_REVIEW',
      'OTHER'
    )),
  CONSTRAINT chk_deal_evidence_linked_gate
    CHECK (linked_gate IN (
      'SOLD_COMPS',
      'TITLE',
      'LEASEHOLD',
      'PLANNING_BUILDING_CONTROL',
      'REFURB_CERTAINTY',
      'BUILDER_PROPOSAL_CONTRACT',
      'DAMP_STRUCTURAL',
      'LENDER_CRITERIA',
      'RENTAL_DEMAND',
      'SOLICITOR_REVIEW'
    )),
  CONSTRAINT chk_deal_evidence_status
    CHECK (status IN (
      'MISSING',
      'RECORDED',
      'REVIEWED',
      'VERIFIED',
      'REJECTED'
    )),
  CONSTRAINT fk_deal_evidence_deal_id
    FOREIGN KEY (deal_id)
    REFERENCES brik_by_brik_engine.saved_deals(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deal_evidence_deal_id
  ON brik_by_brik_engine.deal_evidence (deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_evidence_deal_id_linked_gate
  ON brik_by_brik_engine.deal_evidence (deal_id, linked_gate);
