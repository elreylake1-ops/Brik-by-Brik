import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("phase 4a migration consistency", () => {
  it("creates brik_by_brik_engine schema and keeps FK type alignment", () => {
    const savedDealsSql = readFileSync(
      path.resolve(process.cwd(), "db/migrations/20260522_phase4a_saved_deals_table.sql"),
      "utf8"
    )
    const dealOffersSql = readFileSync(
      path.resolve(process.cwd(), "db/migrations/20260522_phase4a_deal_offers_table.sql"),
      "utf8"
    )
    const dealTasksSql = readFileSync(
      path.resolve(process.cwd(), "db/migrations/20260522_phase4a_deal_tasks_table.sql"),
      "utf8"
    )

    expect(savedDealsSql).toContain("CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;")
    expect(savedDealsSql).toContain("CREATE TABLE IF NOT EXISTS brik_by_brik_engine.saved_deals")
    expect(savedDealsSql).toContain("id TEXT PRIMARY KEY")

    expect(dealOffersSql).toContain("CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;")
    expect(dealOffersSql).toContain("CREATE TABLE IF NOT EXISTS brik_by_brik_engine.deal_offers")
    expect(dealOffersSql).toContain(
      "deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE"
    )

    expect(dealTasksSql).toContain("CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;")
    expect(dealTasksSql).toContain("CREATE TABLE IF NOT EXISTS brik_by_brik_engine.deal_tasks")
    expect(dealTasksSql).toContain(
      "deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE"
    )
  })

  it("does not introduce extra offer fields", () => {
    const dealOffersSql = readFileSync(
      path.resolve(process.cwd(), "db/migrations/20260522_phase4a_deal_offers_table.sql"),
      "utf8"
    )

    for (const expected of [
      "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
      "deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE",
      "offer_amount NUMERIC NOT NULL",
      "offer_type TEXT NOT NULL DEFAULT 'INITIAL'",
      "offer_status TEXT NOT NULL DEFAULT 'DRAFT'",
      "offer_rationale TEXT",
      "seller_response TEXT",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    ]) {
      expect(dealOffersSql).toContain(expected)
    }

    for (const forbidden of [
      "aiProvider",
      "scraping",
      "crm",
      "webhook",
      "runtimeWrite",
      "task_",
      "note_",
      "command_",
      "engine_result_json",
    ]) {
      expect(dealOffersSql).not.toContain(forbidden)
    }
  })
})
