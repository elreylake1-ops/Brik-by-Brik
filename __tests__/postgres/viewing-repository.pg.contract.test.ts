import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { defineViewingRepositoryContract } from "../contracts/viewing-repository-contract"
import { qaGate } from "./qa-gate"

// Postgres leg of the repository contract, plus database-enforced rules (triggers, constraints, cascades,
// concurrency). Gated by qa-gate.ts: runs only against the confirmed disposable local QA database, and writes only
// rows it creates (saved_deals ids prefixed "qa-contract-"), deleting them afterwards.

const gate = qaGate("Postgres viewing repository")

type Db = typeof import("@/lib/db/postgres")
let db: Db
const S = "brik_by_brik_engine"

async function makeDeal(): Promise<string> {
  const id = `qa-contract-${randomUUID()}`
  await db.query(
    `INSERT INTO ${S}.saved_deals (id, address, classification, governance_state, capital_protection_state, pipeline_state, engine_result_json, risk_summary_json)
     VALUES ($1, 'QA contract test', 'QA', 'QA', 'QA', 'UNDER_ANALYSIS', '{}'::jsonb, '{}'::jsonb)`,
    [id]
  )
  return id
}

describe.skipIf(!gate.enabled)("Postgres viewing repository (isolated QA only)", () => {
  let repo: import("@/lib/viewing-assessment/viewing-assessment-repository").ViewingAssessmentRepository

  beforeAll(async () => {
    process.env.DATABASE_URL = gate.url // this test process only; never the shell's Production value
    db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()
    repo = (await import("@/lib/viewing-assessment/pg-viewing-assessment-repository")).pgViewingAssessmentRepository
    const who = await db.query<{ db: string }>("SELECT current_database() AS db")
    console.info(`Viewing contract tests running against database "${who.rows[0].db}"`)
  })
  afterAll(async () => {
    await db?.getPostgresPool().end()
  })

  defineViewingRepositoryContract("postgres", async () => {
    const dealA = await makeDeal()
    const dealB = await makeDeal()
    return {
      repo,
      dealA,
      dealB,
      // Deleting the deals cascades through every viewing_* table (triggers must allow cascades).
      cleanup: async () => {
        await db.query(`DELETE FROM ${S}.saved_deals WHERE id = ANY($1)`, [[dealA, dealB]])
      },
    }
  })

  describe("database-enforced rules", () => {
    async function seed() {
      const dealId = await makeDeal()
      const { record } = await repo.createAssessment({ dealId, idempotencyKey: "pg-key-0001-abc", checklistVersion: "v1", createdBy: "op" })
      const added = await repo.addAsset(dealId, record.id, {
        asset: { filename: "a.mp4", mimeType: "video/mp4", sizeBytes: 5, durationSeconds: 30, contentSha256: null },
        frames: [{ timestampSeconds: 1 }],
        createdBy: "op",
      })
      if (added?.status !== "ok") throw new Error("seed failed")
      const run = (await repo.startRun(dealId, record.id, { idempotencyKey: "pg-run-0001-abc", modelVersion: "m", createdBy: "op" }))!.run
      const proposalId = `${run.id}:P1`
      await repo.completeRun(run.id, {
        attempt: 1,
        status: "READY_FOR_REVIEW",
        rejectedCount: 0,
        proposals: [{ id: proposalId, assessmentId: record.id, checkId: "C08", status: "CONCERN", observation: "x", evidenceIds: [added.evidence[0].id], confidence: "low", modelVersion: "m", verification: "UNVERIFIED", disposition: "PENDING" }],
      })
      return { dealId, assessmentId: record.id, runId: run.id, proposalId, evidenceId: added.evidence[0].id, assetId: added.asset.id }
    }
    const drop = (dealId: string) => db.query(`DELETE FROM ${S}.saved_deals WHERE id = $1`, [dealId])

    it("rejects direct UPDATE, DELETE and TRUNCATE on append-only tables", async () => {
      const s = await seed()
      try {
        await expect(db.query(`UPDATE ${S}.viewing_proposals SET observation = 'tampered' WHERE id = $1`, [s.proposalId])).rejects.toThrow(/append-only/)
        await expect(db.query(`UPDATE ${S}.viewing_evidence SET room = 'tampered' WHERE id = $1`, [s.evidenceId])).rejects.toThrow(/append-only/)
        await expect(db.query(`DELETE FROM ${S}.viewing_evidence WHERE id = $1`, [s.evidenceId])).rejects.toThrow(/append-only/)
        // TRUNCATE: tables nothing references reach our trigger; referenced tables are refused by Postgres itself;
        // and CASCADE (which skips that FK rule) from either parent still hits the trigger on the child tables.
        for (const unreferenced of ["viewing_feedback", "viewing_evidence_blobs", "viewing_ai_usage"]) {
          await expect(db.query(`TRUNCATE ${S}.${unreferenced}`)).rejects.toThrow(/append-only/)
        }
        await expect(db.query(`TRUNCATE ${S}.viewing_evidence`)).rejects.toThrow(/cannot truncate|append-only/)
        await expect(db.query(`TRUNCATE ${S}.viewing_proposals`)).rejects.toThrow(/cannot truncate|append-only/)
        await expect(db.query(`TRUNCATE ${S}.viewing_assessments CASCADE`)).rejects.toThrow(/append-only/)
        await expect(db.query(`TRUNCATE ${S}.saved_deals CASCADE`)).rejects.toThrow(/append-only/)
        const still = await db.query(`SELECT count(*)::int AS n FROM ${S}.viewing_evidence WHERE id = $1`, [s.evidenceId])
        expect(still.rows[0].n).toBe(1) // nothing was wiped by any of the attempts
      } finally {
        await drop(s.dealId)
      }
    })

    it("lets a parent deal delete cascade through append-only tables", async () => {
      const s = await seed()
      await drop(s.dealId)
      const left = await db.query(`SELECT (SELECT count(*) FROM ${S}.viewing_proposals WHERE assessment_id = $1) AS p, (SELECT count(*) FROM ${S}.viewing_evidence WHERE assessment_id = $1) AS e`, [s.assessmentId])
      expect(left.rows[0]).toEqual({ p: "0", e: "0" })
    })

    it("enforces CHECK and composite-FK integrity", async () => {
      const a = await seed()
      const b = await seed()
      try {
        const insertProposal = (id: string, checkId: string, verification: string) =>
          db.query(
            `INSERT INTO ${S}.viewing_proposals (id, assessment_id, run_id, check_id, status, observation, evidence_ids, confidence, model_version, verification)
             VALUES ($1, $2, $3, $4, 'CONCERN', 'x', ARRAY['f'], 'low', 'm', $5)`,
            [id, a.assessmentId, a.runId, checkId, verification]
          )
        await expect(insertProposal("bad-1", "C46", "UNVERIFIED")).rejects.toThrow()
        await expect(insertProposal("bad-2", "C01", "VERIFIED")).rejects.toThrow()
        // a run from another assessment cannot parent this assessment's proposal
        await expect(
          db.query(
            `INSERT INTO ${S}.viewing_proposals (id, assessment_id, run_id, check_id, status, observation, evidence_ids, confidence, model_version)
             VALUES ('bad-3', $1, $2, 'C01', 'CONCERN', 'x', ARRAY['f'], 'low', 'm')`,
            [a.assessmentId, b.runId]
          )
        ).rejects.toThrow()
        // an asset from another assessment cannot back this assessment's evidence
        await expect(
          db.query(
            `INSERT INTO ${S}.viewing_evidence (id, assessment_id, asset_id, timestamp_seconds) VALUES ('bad-4', $1, $2, 1)`,
            [a.assessmentId, b.assetId]
          )
        ).rejects.toThrow()
        await expect(
          db.query(
            `INSERT INTO ${S}.viewing_evidence (id, assessment_id, asset_id, timestamp_seconds, requested_timestamp_seconds, ordinal)
             VALUES ('bad-provenance', $1, $2, 1, 1, 99)`,
            [a.assessmentId, a.assetId]
          )
        ).rejects.toThrow()
      } finally {
        await drop(a.dealId)
        await drop(b.dealId)
      }
    })

    it("enforces the image-record and usage-ledger rules in the database itself", async () => {
      const a = await seed()
      const b = await seed()
      try {
        const insertBlob = (evidenceId: string, assessmentId: string, storageKey: string, sha = "a".repeat(64), size = 100, mime = "image/jpeg") =>
          db.query(
            `INSERT INTO ${S}.viewing_evidence_blobs (evidence_id, assessment_id, storage_key, sha256, size_bytes, mime_type, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, 'op')`,
            [evidenceId, assessmentId, storageKey, sha, size, mime]
          )
        const goodKey = `blob_${randomUUID()}`
        await expect(insertBlob(a.evidenceId, a.assessmentId, "../../etc/passwd")).rejects.toThrow() // storage key must be a server-generated key
        await expect(insertBlob(a.evidenceId, a.assessmentId, goodKey, "xyz")).rejects.toThrow() // sha256 shape
        await expect(insertBlob(a.evidenceId, a.assessmentId, goodKey, "a".repeat(64), 0)).rejects.toThrow() // empty
        await expect(insertBlob(a.evidenceId, a.assessmentId, goodKey, "a".repeat(64), 2097153)).rejects.toThrow() // over the policy size
        await expect(insertBlob(a.evidenceId, a.assessmentId, goodKey, "a".repeat(64), 100, "text/html")).rejects.toThrow() // only JPEG
        await expect(insertBlob(a.evidenceId, b.assessmentId, goodKey)).rejects.toThrow() // frame cannot be linked to another assessment (composite FK)
        await insertBlob(a.evidenceId, a.assessmentId, goodKey)
        await expect(insertBlob(a.evidenceId, a.assessmentId, `blob_${randomUUID()}`)).rejects.toThrow() // one image per frame
        await expect(db.query(`UPDATE ${S}.viewing_evidence_blobs SET sha256 = $1 WHERE evidence_id = $2`, ["b".repeat(64), a.evidenceId])).rejects.toThrow(/append-only/)
        await expect(db.query(`DELETE FROM ${S}.viewing_evidence_blobs WHERE evidence_id = $1`, [a.evidenceId])).rejects.toThrow(/append-only/)

        const insertUsage = (runId: string, assessmentId: string, attempt: number, over: { simulated?: boolean; cost?: number; input?: number; provider?: string } = {}) =>
          db.query(
            `INSERT INTO ${S}.viewing_ai_usage (id, run_id, assessment_id, attempt, provider, model_version, prompt_version, frame_count, input_tokens, output_tokens, cost_micros, simulated, outcome)
             VALUES ($1, $2, $3, $4, $5, 'm', 'p', 1, $6, 1, $7, $8, 'OK')`,
            [randomUUID(), runId, assessmentId, attempt, over.provider ?? "claude", over.input ?? 1, over.cost ?? 10, over.simulated ?? false]
          )
        await expect(insertUsage(a.runId, a.assessmentId, 1, { simulated: true, cost: 1 })).rejects.toThrow() // simulated usage must be free
        await expect(insertUsage(a.runId, a.assessmentId, 1, { input: -1 })).rejects.toThrow()
        await expect(insertUsage(a.runId, a.assessmentId, 1, { provider: "mock" })).rejects.toThrow() // ledger covers fixture and claude only
        await expect(insertUsage(a.runId, b.assessmentId, 1)).rejects.toThrow() // a run from another assessment cannot be charged here
        await insertUsage(a.runId, a.assessmentId, 1)
        await expect(insertUsage(a.runId, a.assessmentId, 1)).rejects.toThrow() // one ledger row per run attempt
        await expect(db.query(`UPDATE ${S}.viewing_ai_usage SET cost_micros = 0 WHERE run_id = $1`, [a.runId])).rejects.toThrow(/append-only/)
      } finally {
        await drop(a.dealId)
        await drop(b.dealId)
      }
    })

    it("enforces the outcome-record shape in the database itself", async () => {
      const a = await seed()
      try {
        const insert = (cols: Record<string, unknown>) => {
          const base: Record<string, unknown> = {
            id: randomUUID(), proposal_id: a.proposalId, assessment_id: a.assessmentId, kind: "ACTUAL_OUTCOME", model_version: "m",
            original_json: "{}", recorded_by: "op", outcome_note: "n", outcome_result: "CONFIRMED", outcome_source: "SURVEY", ...cols,
          }
          const names = Object.keys(base).filter((k) => base[k] !== undefined)
          return db.query(
            `INSERT INTO ${S}.viewing_feedback (${names.join(", ")}) VALUES (${names.map((_, i) => "$" + (i + 1)).join(", ")})`,
            names.map((k) => base[k])
          )
        }
        await expect(insert({ outcome_result: undefined })).rejects.toThrow() // an outcome needs a result
        await expect(insert({ outcome_source: undefined })).rejects.toThrow() // ... and a source
        await expect(insert({ outcome_note: undefined })).rejects.toThrow() // ... and a note
        await expect(insert({ outcome_result: "GREAT" })).rejects.toThrow() // closed vocabulary
        await expect(insert({ outcome_source: "A FRIEND" })).rejects.toThrow()
        await expect(insert({ outcome_observed_status: "PASS" })).rejects.toThrow() // there is no "pass" state
        await expect(insert({ outcome_note: "x".repeat(1001) })).rejects.toThrow()
        await expect(insert({ kind: "REVIEW", review_id: null, disposition: "ACCEPTED" })).rejects.toThrow() // a review row needs its review
        await expect(insert({ kind: "REVIEW", review_id: "nope", disposition: "ACCEPTED", outcome_result: "CONFIRMED" })).rejects.toThrow() // and carries no outcome fields
        await insert({ outcome_observed_status: "SPECIALIST_REVIEW" }) // a well-formed one is accepted
        await insert({}) // and outcomes are append-only history: a second one for the same proposal is fine
        await expect(db.query(`UPDATE ${S}.viewing_feedback SET outcome_result = 'NOT_CONFIRMED' WHERE proposal_id = $1`, [a.proposalId])).rejects.toThrow(/append-only/)
        await expect(db.query(`DELETE FROM ${S}.viewing_feedback WHERE proposal_id = $1`, [a.proposalId])).rejects.toThrow(/append-only/)
      } finally {
        await drop(a.dealId)
      }
    })

    it("lets exactly one of two concurrent reviews win, and one of two concurrent run starts create", async () => {
      const s = await seed()
      try {
        const proposal = (await repo.listProposals(s.dealId, s.assessmentId))![0].proposal
        const d = { disposition: "ACCEPTED", reviewerId: "op", reviewedAt: "2026-10-20T10:00:00.000Z" } as const
        const fb = { proposalId: proposal.id, assessmentId: proposal.assessmentId, checkId: proposal.checkId, modelVersion: "m", original: { status: proposal.status, observation: proposal.observation, confidence: proposal.confidence }, disposition: "ACCEPTED" as const, humanCorrection: null, reviewerId: "op", reviewedAt: d.reviewedAt, actualOutcome: null }
        const results = await Promise.all([
          repo.recordReview(s.dealId, s.assessmentId, proposal.id, { expectedRevision: 0, decision: d, feedback: fb }),
          repo.recordReview(s.dealId, s.assessmentId, proposal.id, { expectedRevision: 0, decision: d, feedback: fb }),
        ])
        expect(results.map((r) => r?.status).sort()).toEqual(["ok", "stale_revision"])

        const starts = await Promise.all([
          repo.startRun(s.dealId, s.assessmentId, { idempotencyKey: "pg-race-key-0001", modelVersion: "m", createdBy: "op" }),
          repo.startRun(s.dealId, s.assessmentId, { idempotencyKey: "pg-race-key-0001", modelVersion: "m", createdBy: "op" }),
        ])
        expect(starts.map((r) => r?.created).sort()).toEqual([false, true])
      } finally {
        await drop(s.dealId)
      }
    })
  })
})
