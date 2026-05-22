-- Phase 4A Step 6B deal_offers schema addition
-- Scope: add only MVP deal_offers table

CREATE SCHEMA IF NOT EXISTS lake_views_property;

CREATE TABLE IF NOT EXISTS lake_views_property.deal_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL REFERENCES lake_views_property.saved_deals(id) ON DELETE CASCADE,
  offer_amount NUMERIC NOT NULL,
  offer_type TEXT NOT NULL DEFAULT 'INITIAL',
  offer_status TEXT NOT NULL DEFAULT 'DRAFT',
  offer_rationale TEXT,
  seller_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
