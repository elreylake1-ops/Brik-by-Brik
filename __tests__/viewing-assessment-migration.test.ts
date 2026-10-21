import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "..")
const sql = readFileSync(path.join(root, "db/migrations/20261020_task2_viewing_assessment_tables.sql"), "utf8")
const code = sql.replace(/--.*$/gm, "") // executable statements only
const provenanceSql = readFileSync(path.join(root, "db/migrations/20261025_task7a_capture_provenance.sql"), "utf8")

describe("viewing assessment migration (proposed, not applied)", () => {
  it("only adds viewing_* objects and never alters or drops existing ones", () => {
    const tables = [...code.matchAll(/CREATE TABLE IF NOT EXISTS brik_by_brik_engine\.(\w+)/g)].map((m) => m[1])
    expect(tables).toEqual([
      "viewing_assessments",
      "viewing_assets",
      "viewing_evidence",
      "viewing_analysis_runs",
      "viewing_proposals",
      "viewing_reviews",
      "viewing_feedback",
      "viewing_evidence_blobs",
      "viewing_ai_usage",
    ])
    expect(code).not.toMatch(/\b(ALTER TABLE|DROP TABLE|(?<!BEFORE )TRUNCATE|DELETE FROM|UPDATE\s+brik)/i)
    expect(code).not.toMatch(/REFERENCES brik_by_brik_engine\.(?!saved_deals|viewing_)/)
  })

  it("makes evidence, proposals, reviews and feedback append-only and AI proposals UNVERIFIED", () => {
    for (const t of ["viewing_assets", "viewing_evidence", "viewing_proposals", "viewing_reviews", "viewing_feedback", "viewing_evidence_blobs", "viewing_ai_usage"]) {
      expect(code).toMatch(new RegExp(`BEFORE UPDATE OR DELETE ON brik_by_brik_engine\\.${t}`))
    }
    for (const t of ["viewing_assets", "viewing_evidence", "viewing_proposals", "viewing_reviews", "viewing_feedback", "viewing_evidence_blobs", "viewing_ai_usage"]) {
      expect(code).toMatch(new RegExp(`BEFORE TRUNCATE ON brik_by_brik_engine\\.${t}\\s+FOR EACH STATEMENT`))
    }
    expect(code).toContain("verification = 'UNVERIFIED'")
  })

  it("binds every child row to the same assessment as its parent (composite foreign keys)", () => {
    for (const fk of ["fk_viewing_evidence_asset_id", "fk_viewing_proposals_run_id", "fk_viewing_reviews_proposal_id", "fk_viewing_feedback_proposal_id", "fk_viewing_feedback_review_id", "fk_viewing_evidence_blobs_evidence", "fk_viewing_ai_usage_run"]) {
      expect(code).toMatch(new RegExp(`CONSTRAINT ${fk}\\s+FOREIGN KEY \\(\\w+, \\w+\\)`))
    }
  })

  it("documents rollback and has no secrets or public storage", () => {
    expect(sql).toMatch(/Rollback/)
    expect(sql).toMatch(/NOT APPLIED/)
    expect(code).not.toMatch(/https?:\/\/|password|secret/i)
  })

  it("keeps private storage keys server-side: only the internal location lookup reads one", () => {
    const repo = readFileSync(path.join(root, "lib/viewing-assessment/pg-viewing-assessment-repository.ts"), "utf8")
    const codeOnly = repo.replace(/^\s*\/\/.*$/gm, "")
    // the reserved viewing_assets.storage_key column is never read
    expect(codeOnly).not.toMatch(/viewing_assets[^`]*storage_key/)
    // storage_key appears only in the blob-table insert and in getEvidenceBlobLocation (internal, never serialised)
    const readers = codeOnly.split("\n").filter((l) => /SELECT[^\n]*storage_key|b\.storage_key/.test(l))
    expect(readers).toHaveLength(1)
    // the client-safe list selects explicit non-secret columns
    expect(codeOnly).toMatch(/SELECT evidence_id, sha256, size_bytes, mime_type FROM/)
  })

  it("adds only nullable capture-provenance columns to viewing evidence", () => {
    const executable = provenanceSql.replace(/--.*$/gm, "")
    expect(executable).toMatch(/ALTER TABLE brik_by_brik_engine\.viewing_evidence/)
    expect(executable).toContain("requested_timestamp_seconds")
    expect(executable).toContain("capture_method")
    expect(executable).toContain("capture_confidence")
    expect(executable).not.toMatch(/DROP|TRUNCATE|DELETE FROM|UPDATE\s+/i)
    expect(executable).not.toMatch(/saved_deals|investor|refurb|financial/i)
  })
})
