import { randomUUID } from "node:crypto"
import type { PoolClient, QueryResultRow } from "pg"
import { getPostgresPool, query } from "@/lib/db/postgres"
import type { MeasurementSetRecord } from "@/types/refurb-measurements"
import type { MeasurementRepository } from "./measurement-repository"

// PostgreSQL implementation (brik_by_brik_engine.refurb_measurement_sets, migration 20261023). Append-only.

const S = "brik_by_brik_engine"
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v))
const FIELDS = "id, deal_id, assessment_id, version, based_on_version, idempotency_key, request_hash, entries, warnings, change_note, recorded_by, recorded_at"

const map = (r: QueryResultRow): MeasurementSetRecord => ({
  id: r.id,
  dealId: r.deal_id,
  assessmentId: r.assessment_id,
  version: Number(r.version),
  basedOnVersion: Number(r.based_on_version),
  idempotencyKey: r.idempotency_key,
  entries: r.entries,
  warnings: r.warnings,
  changeNote: r.change_note,
  recordedBy: r.recorded_by,
  recordedAt: iso(r.recorded_at),
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

export const pgMeasurementRepository: MeasurementRepository = {
  async create(input) {
    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`refurb-measurements:${input.dealId}:${input.assessmentId}`])
      const existing = await client.query(`SELECT ${FIELDS} FROM ${S}.refurb_measurement_sets WHERE deal_id = $1 AND assessment_id = $2 AND idempotency_key = $3`, [input.dealId, input.assessmentId, input.idempotencyKey])
      if (existing.rows[0]) {
        return existing.rows[0].request_hash === input.requestHash ? { status: "replayed" as const, record: map(existing.rows[0]) } : { status: "key_reused" as const }
      }
      const cur = await client.query(`SELECT COALESCE(MAX(version), 0) AS v FROM ${S}.refurb_measurement_sets WHERE deal_id = $1 AND assessment_id = $2`, [input.dealId, input.assessmentId])
      const currentVersion = Number(cur.rows[0].v)
      if (input.basedOnVersion !== currentVersion) return { status: "stale_base" as const, currentVersion }
      const inserted = await client.query(
        `INSERT INTO ${S}.refurb_measurement_sets (id, deal_id, assessment_id, version, based_on_version, idempotency_key, request_hash, entries, warnings, change_note, recorded_by, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12) RETURNING ${FIELDS}`,
        [`meas-${randomUUID()}`, input.dealId, input.assessmentId, currentVersion + 1, currentVersion, input.idempotencyKey, input.requestHash, JSON.stringify(input.entries), JSON.stringify(input.warnings), input.changeNote, input.recordedBy, input.recordedAt]
      )
      return { status: "created" as const, record: map(inserted.rows[0]) }
    })
  },

  async findByKey(dealId, assessmentId, key) {
    const { rows } = await query(`SELECT ${FIELDS} FROM ${S}.refurb_measurement_sets WHERE deal_id = $1 AND assessment_id = $2 AND idempotency_key = $3`, [dealId, assessmentId, key])
    return rows[0] ? { record: map(rows[0]), requestHash: rows[0].request_hash } : null
  },

  async getCurrent(dealId, assessmentId) {
    const { rows } = await query(`SELECT ${FIELDS} FROM ${S}.refurb_measurement_sets WHERE deal_id = $1 AND assessment_id = $2 ORDER BY version DESC LIMIT 1`, [dealId, assessmentId])
    return rows[0] ? map(rows[0]) : null
  },

  async getById(dealId, assessmentId, id) {
    const { rows } = await query(`SELECT ${FIELDS} FROM ${S}.refurb_measurement_sets WHERE deal_id = $1 AND assessment_id = $2 AND id = $3`, [dealId, assessmentId, id])
    return rows[0] ? map(rows[0]) : null
  },

  async list(dealId, assessmentId) {
    const { rows } = await query(`SELECT ${FIELDS} FROM ${S}.refurb_measurement_sets WHERE deal_id = $1 AND assessment_id = $2 ORDER BY version DESC`, [dealId, assessmentId])
    return rows.map(map)
  },
}
