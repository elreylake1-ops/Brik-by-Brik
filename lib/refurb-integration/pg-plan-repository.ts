import { randomUUID } from "node:crypto"
import type { PoolClient, QueryResultRow } from "pg"
import { getPostgresPool, query } from "@/lib/db/postgres"
import type { ConfirmedPlanRecord } from "@/types/refurb-integration"
import type { RefurbPlanRepository } from "./plan-repository"

// PostgreSQL implementation (brik_by_brik_engine.refurb_plan_confirmations, migration 20261022). Append-only.
// An advisory lock per assessment serialises version numbering; the unique (deal, assessment, key) constraint
// settles concurrent submissions of the same idempotency key.

const S = "brik_by_brik_engine"
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v))

const FIELDS =
  "id, deal_id, assessment_id, version, idempotency_key, request_hash, source_fingerprint, analysis_source, accepted_items, excluded, property_basics, measurement_set_id, measurement_set_version, financial_assumptions, computation, confirmed_by, confirmed_at"

const map = (r: QueryResultRow): ConfirmedPlanRecord => ({
  id: r.id,
  dealId: r.deal_id,
  assessmentId: r.assessment_id,
  version: Number(r.version),
  idempotencyKey: r.idempotency_key,
  sourceFingerprint: r.source_fingerprint,
  analysisSource: r.analysis_source,
  acceptedItems: r.accepted_items,
  excluded: r.excluded,
  propertyBasics: r.property_basics,
  measurementSetId: r.measurement_set_id ?? null,
  measurementSetVersion: r.measurement_set_version === null || r.measurement_set_version === undefined ? null : Number(r.measurement_set_version),
  financialAssumptions: r.financial_assumptions,
  computation: r.computation,
  confirmedBy: r.confirmed_by,
  confirmedAt: iso(r.confirmed_at),
})

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export const pgRefurbPlanRepository: RefurbPlanRepository = {
  async create(input) {
    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`refurb-plan:${input.dealId}:${input.assessmentId}`])
      const existing = await client.query(
        `SELECT ${FIELDS} FROM ${S}.refurb_plan_confirmations WHERE deal_id = $1 AND assessment_id = $2 AND idempotency_key = $3`,
        [input.dealId, input.assessmentId, input.idempotencyKey]
      )
      if (existing.rows[0]) {
        return existing.rows[0].request_hash === input.requestHash
          ? { status: "replayed" as const, record: map(existing.rows[0]) }
          : { status: "key_reused" as const }
      }
      const next = await client.query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS v FROM ${S}.refurb_plan_confirmations WHERE deal_id = $1 AND assessment_id = $2`,
        [input.dealId, input.assessmentId]
      )
      const inserted = await client.query(
        `INSERT INTO ${S}.refurb_plan_confirmations
           (id, deal_id, assessment_id, version, idempotency_key, request_hash, source_fingerprint, analysis_source,
            accepted_items, excluded, property_basics, measurement_set_id, measurement_set_version, financial_assumptions, computation, confirmed_by, confirmed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14::jsonb,$15::jsonb,$16,$17)
         RETURNING ${FIELDS}`,
        [
          `plan-${randomUUID()}`,
          input.dealId,
          input.assessmentId,
          Number(next.rows[0].v),
          input.idempotencyKey,
          input.requestHash,
          input.sourceFingerprint,
          input.analysisSource,
          JSON.stringify(input.acceptedItems),
          JSON.stringify(input.excluded),
          JSON.stringify(input.propertyBasics),
          input.measurementSetId,
          input.measurementSetVersion,
          input.financialAssumptions ? JSON.stringify(input.financialAssumptions) : null,
          JSON.stringify(input.computation),
          input.confirmedBy,
          input.confirmedAt,
        ]
      )
      return { status: "created" as const, record: map(inserted.rows[0]) }
    })
  },

  async findByKey(dealId, assessmentId, key) {
    const { rows } = await query(
      `SELECT ${FIELDS} FROM ${S}.refurb_plan_confirmations WHERE deal_id = $1 AND assessment_id = $2 AND idempotency_key = $3`,
      [dealId, assessmentId, key]
    )
    return rows[0] ? { record: map(rows[0]), requestHash: rows[0].request_hash } : null
  },

  async getCurrent(dealId, assessmentId) {
    const { rows } = await query(
      `SELECT ${FIELDS} FROM ${S}.refurb_plan_confirmations WHERE deal_id = $1 AND assessment_id = $2 ORDER BY version DESC LIMIT 1`,
      [dealId, assessmentId]
    )
    return rows[0] ? map(rows[0]) : null
  },

  async list(dealId, assessmentId) {
    const { rows } = await query(
      `SELECT ${FIELDS} FROM ${S}.refurb_plan_confirmations WHERE deal_id = $1 AND assessment_id = $2 ORDER BY version DESC`,
      [dealId, assessmentId]
    )
    return rows.map(map)
  },
}
