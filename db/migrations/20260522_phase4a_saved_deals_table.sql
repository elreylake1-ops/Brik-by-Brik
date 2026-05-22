-- Phase 4A Step 4L-B saved_deals schema adjustment
-- Scope: add only MVP saved_deals table

CREATE SCHEMA IF NOT EXISTS lake_views_property;

CREATE TABLE IF NOT EXISTS lake_views_property.saved_deals (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  address TEXT NOT NULL,
  listing_url TEXT,
  purchase_price NUMERIC,
  gdv_realistic NUMERIC,
  refurb_cost NUMERIC,
  classification TEXT NOT NULL,
  governance_state TEXT NOT NULL,
  capital_protection_state TEXT NOT NULL,
  pipeline_state TEXT NOT NULL,
  engine_result_json JSONB NOT NULL,
  risk_summary_json JSONB NOT NULL,
  next_action TEXT
);
