-- Phase 4A Step 6B deal_offers schema addition
-- Scope: add only MVP deal_offers table

CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;

CREATE TABLE IF NOT EXISTS brik_by_brik_engine.deal_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE,
  offer_amount NUMERIC NOT NULL,
  offer_type TEXT NOT NULL DEFAULT 'INITIAL',
  offer_status TEXT NOT NULL DEFAULT 'DRAFT',
  offer_rationale TEXT,
  seller_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
