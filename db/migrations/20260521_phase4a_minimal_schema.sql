-- Phase 4A Step 4B minimal schema migration
-- Scope: operator command tables only
-- Boundary: schema/migration only, no behavior wiring

CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  source_url TEXT,
  pipeline_state TEXT NOT NULL,
  governance_state TEXT NOT NULL,
  classification TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ
);

CREATE TABLE deal_snapshots (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  engine_snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_deal_snapshots_deal_id FOREIGN KEY (deal_id) REFERENCES deals(id)
);

CREATE TABLE pipeline_events (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT,
  blocked BOOLEAN NOT NULL,
  block_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_pipeline_events_deal_id FOREIGN KEY (deal_id) REFERENCES deals(id)
);

CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  offer_amount NUMERIC NOT NULL,
  offer_type TEXT NOT NULL,
  offer_rationale TEXT,
  response_status TEXT NOT NULL,
  counter_offer_amount NUMERIC,
  negotiation_notes TEXT,
  next_negotiation_action TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_offers_deal_id FOREIGN KEY (deal_id) REFERENCES deals(id)
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  blocking BOOLEAN NOT NULL,
  created_by TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_tasks_deal_id FOREIGN KEY (deal_id) REFERENCES deals(id)
);

CREATE TABLE evidence_items (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT,
  notes TEXT,
  file_placeholder TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_evidence_items_deal_id FOREIGN KEY (deal_id) REFERENCES deals(id)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_audit_events_deal_id FOREIGN KEY (deal_id) REFERENCES deals(id)
);
