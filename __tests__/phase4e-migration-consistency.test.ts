import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("phase 4e evidence lite migration consistency", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "db/migrations/20260622_phase4e_deal_evidence_table.sql"
  )

  function readMigration(): string {
    return readFileSync(migrationPath, "utf8")
  }

  it("matches the canonical evidence lite table contract", () => {
    const sql = readMigration()

    expect(sql).toContain("CREATE SCHEMA IF NOT EXISTS brik_by_brik_engine;")
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS brik_by_brik_engine.deal_evidence")
    expect(sql).toContain("id TEXT PRIMARY KEY")
    expect(sql).toContain("deal_id TEXT NOT NULL")
    expect(sql).toContain("evidence_type TEXT NOT NULL")
    expect(sql).toContain("linked_gate TEXT NOT NULL")
    expect(sql).toContain("title TEXT NOT NULL")
    expect(sql).toContain("note TEXT NOT NULL")
    expect(sql).toContain("status TEXT NOT NULL DEFAULT 'MISSING'")
    expect(sql).toContain("reviewed BOOLEAN NOT NULL DEFAULT FALSE")
    expect(sql).toContain("reviewer_note TEXT NULL")
    expect(sql).toContain("created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
    expect(sql).toContain("updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
    expect(sql).toContain("FOREIGN KEY (deal_id)")
    expect(sql).toContain("REFERENCES brik_by_brik_engine.saved_deals(id)")
    expect(sql).toContain("ON DELETE CASCADE")
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_deal_evidence_deal_id")
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_deal_evidence_deal_id_linked_gate")
  })

  it("avoids rejected scaffold conventions and unsafe contract drift", () => {
    const sql = readMigration()
    const lowered = sql.toLowerCase()

    for (const forbidden of [
      "uuid primary key default gen_random_uuid()",
      "saved_deal_id",
      "requeste",
      "received",
      "satisfied",
      "waived",
      "general",
      "set_updated_at",
      "create trigger",
      "create function",
      "future_ai_extracted",
      "future_integration",
      "file_url",
      "advisory_only",
    ]) {
      expect(lowered).not.toContain(forbidden)
    }
  })

  it("preserves rollback guidance and remains read-only by design", () => {
    const sql = readMigration()

    expect(sql).toContain("Rollback plan:")
    expect(sql).toContain("Drop idx_deal_evidence_deal_id_linked_gate.")
    expect(sql).toContain("Drop idx_deal_evidence_deal_id.")
    expect(sql).toContain("Drop brik_by_brik_engine.deal_evidence.")
    expect(sql).toContain("does not execute automatically in tests")
  })

  it("keeps the migration aligned to the Evidence Lite contract and not Investor Shield", () => {
    const sql = readMigration()

    for (const expected of [
      "MISSING",
      "RECORDED",
      "REVIEWED",
      "VERIFIED",
      "REJECTED",
      "SOLD_COMPS",
      "TITLE",
      "LEASEHOLD",
      "PLANNING_BUILDING_CONTROL",
      "REFURB_CERTAINTY",
      "BUILDER_PROPOSAL_CONTRACT",
      "DAMP_STRUCTURAL",
      "LENDER_CRITERIA",
      "RENTAL_DEMAND",
      "SOLICITOR_REVIEW",
    ]) {
      expect(sql).toContain(expected)
    }

    expect(sql).not.toContain("SOLICITOR_FEEDBACK")
    expect(sql).not.toContain("GENERAL")
  })
})
