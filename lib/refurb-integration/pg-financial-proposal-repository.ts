import { randomUUID } from "node:crypto"
import type { PoolClient, QueryResultRow } from "pg"
import { getPostgresPool, query } from "@/lib/db/postgres"
import type { FinancialDecisionEvent, FinancialProposalRecord } from "@/types/refurb-financial"
import type { FinancialProposalRepository } from "./financial-proposal-repository"

// PostgreSQL implementation (brik_by_brik_engine.refurb_financial_proposals / refurb_financial_decisions, migration 20261024).
// Append-only. Advisory lock per assessment serialises version numbering and the one-decision-per-proposal rule.

const S = "brik_by_brik_engine"
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v))
const PFIELDS = "id, deal_id, assessment_id, plan_id, version, content_hash, idempotency_key, content, created_by, created_at"
const DFIELDS = "id, deal_id, assessment_id, proposal_id, decision, actor, note, idempotency_key, request_hash, acknowledged, baseline_fingerprint, same_operator_as_scope_confirmer, occurred_at"

const mapProposal = (r: QueryResultRow): FinancialProposalRecord => ({
  id: r.id,
  dealId: r.deal_id,
  assessmentId: r.assessment_id,
  planId: r.plan_id,
  version: Number(r.version),
  contentHash: r.content_hash,
  idempotencyKey: r.idempotency_key,
  content: r.content,
  createdBy: r.created_by,
  createdAt: iso(r.created_at),
})

const mapDecision = (r: QueryResultRow): FinancialDecisionEvent => ({
  id: r.id,
  dealId: r.deal_id,
  assessmentId: r.assessment_id,
  proposalId: r.proposal_id,
  decision: r.decision,
  actor: r.actor,
  note: r.note,
  idempotencyKey: r.idempotency_key,
  requestHash: r.request_hash,
  acknowledged: r.acknowledged,
  baselineFingerprint: r.baseline_fingerprint,
  sameOperatorAsScopeConfirmer: r.same_operator_as_scope_confirmer,
  occurredAt: iso(r.occurred_at),
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

export const pgFinancialProposalRepository: FinancialProposalRepository = {
  async createProposal(input) {
    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`refurb-proposal:${input.dealId}:${input.assessmentId}`])
      const same = await client.query(`SELECT ${PFIELDS} FROM ${S}.refurb_financial_proposals WHERE plan_id = $1 AND content_hash = $2 AND deal_id = $3 AND assessment_id = $4`, [input.planId, input.contentHash, input.dealId, input.assessmentId])
      if (same.rows[0]) return { status: "replayed" as const, record: mapProposal(same.rows[0]) }
      const next = await client.query(`SELECT COALESCE(MAX(version), 0) + 1 AS v FROM ${S}.refurb_financial_proposals WHERE deal_id = $1 AND assessment_id = $2`, [input.dealId, input.assessmentId])
      const inserted = await client.query(
        `INSERT INTO ${S}.refurb_financial_proposals (id, deal_id, assessment_id, plan_id, version, content_hash, idempotency_key, content, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING ${PFIELDS}`,
        [`fprop-${randomUUID()}`, input.dealId, input.assessmentId, input.planId, Number(next.rows[0].v), input.contentHash, input.idempotencyKey, JSON.stringify(input.content), input.createdBy, input.createdAt]
      )
      return { status: "created" as const, record: mapProposal(inserted.rows[0]) }
    })
  },

  async getProposal(dealId, assessmentId, proposalId) {
    const { rows } = await query(`SELECT ${PFIELDS} FROM ${S}.refurb_financial_proposals WHERE deal_id = $1 AND assessment_id = $2 AND id = $3`, [dealId, assessmentId, proposalId])
    return rows[0] ? mapProposal(rows[0]) : null
  },

  async listProposals(dealId, assessmentId) {
    const { rows } = await query(`SELECT ${PFIELDS} FROM ${S}.refurb_financial_proposals WHERE deal_id = $1 AND assessment_id = $2 ORDER BY version DESC`, [dealId, assessmentId])
    return rows.map(mapProposal)
  },

  async getDecision(dealId, assessmentId, proposalId) {
    const { rows } = await query(`SELECT ${DFIELDS} FROM ${S}.refurb_financial_decisions WHERE deal_id = $1 AND assessment_id = $2 AND proposal_id = $3`, [dealId, assessmentId, proposalId])
    return rows[0] ? mapDecision(rows[0]) : null
  },

  async appendDecision(input) {
    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`refurb-proposal:${input.dealId}:${input.assessmentId}`])
      const existing = await client.query(`SELECT ${DFIELDS} FROM ${S}.refurb_financial_decisions WHERE deal_id = $1 AND assessment_id = $2 AND proposal_id = $3`, [input.dealId, input.assessmentId, input.proposalId])
      if (existing.rows[0]) {
        const event = mapDecision(existing.rows[0])
        if (event.idempotencyKey !== input.idempotencyKey) return { status: "already_decided" as const, event }
        return event.requestHash === input.requestHash ? { status: "replayed" as const, event } : { status: "key_reused" as const }
      }
      const inserted = await client.query(
        `INSERT INTO ${S}.refurb_financial_decisions (id, deal_id, assessment_id, proposal_id, decision, actor, note, idempotency_key, request_hash, acknowledged, baseline_fingerprint, same_operator_as_scope_confirmer, occurred_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13) RETURNING ${DFIELDS}`,
        [`fdec-${randomUUID()}`, input.dealId, input.assessmentId, input.proposalId, input.decision, input.actor, input.note, input.idempotencyKey, input.requestHash, JSON.stringify(input.acknowledged), input.baselineFingerprint, input.sameOperatorAsScopeConfirmer, input.occurredAt]
      )
      return { status: "created" as const, event: mapDecision(inserted.rows[0]) }
    })
  },
}
