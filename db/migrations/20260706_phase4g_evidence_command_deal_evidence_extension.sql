-- Phase 4G-R1-2 Evidence Command migration draft
-- Scope: extend the existing evidence table with command-friendly columns only.
-- Validation note: this draft is file-only and is not executed by the test suite.
-- Rollback plan:
--   1. Remove code references that depend on the added columns.
--   2. Drop the added columns in reverse order after rollout approval.

ALTER TABLE brik_by_brik_engine.deal_evidence
  ADD COLUMN IF NOT EXISTS linked_investor_shield_gate TEXT NULL,
  ADD COLUMN IF NOT EXISTS evidence_command_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS evidence_summary TEXT NULL,
  ADD COLUMN IF NOT EXISTS evidence_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS evidence_strength TEXT NULL,
  ADD COLUMN IF NOT EXISTS review_state TEXT NULL,
  ADD COLUMN IF NOT EXISTS blocker_impact TEXT NULL,
  ADD COLUMN IF NOT EXISTS linked_professional_gate TEXT NULL,
  ADD COLUMN IF NOT EXISTS recommended_next_action TEXT NULL,
  ADD COLUMN IF NOT EXISTS expiry_or_update_date TEXT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NULL,
  ADD COLUMN IF NOT EXISTS mobile_capture_note TEXT NULL;
