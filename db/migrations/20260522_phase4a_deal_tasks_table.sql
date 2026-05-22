-- Phase 4A Step 7B deal_tasks schema addition
-- Scope: add only MVP deal_tasks table

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.deal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE,
  task_title TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'DUE_DILIGENCE',
  task_status TEXT NOT NULL DEFAULT 'OPEN',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  due_date DATE,
  blocker_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
