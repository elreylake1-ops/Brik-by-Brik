import { randomUUID } from "node:crypto"
import type { PoolClient, QueryResultRow } from "pg"
import { getPostgresPool, query } from "@/lib/db/postgres"
import type { CostOverride } from "@/types/overrides"

const S = "brik_by_brik_engine"
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v))

export type ContractorQuoteOverrideRecord = {
  id: string
  dealId: string
  assessmentId: string
  itemId: string
  taskId: string
  quoteEvidenceId: string | null
  quoteRef: string
  approvedAmount: number
  approvedBy: string
  approvedAt: string
  status: "APPROVED" | "SUPERSEDED" | "DECLINED"
  supersededBy: string | null
}

export type CreateQuoteOverrideInput = {
  itemId: string
  taskId: string
  quoteEvidenceId?: string | null
  quoteRef: string
  approvedAmount: number
  approvedBy: string
}

export interface QuoteOverridesRepository {
  list(dealId: string, assessmentId: string, activeOnly?: boolean): Promise<ContractorQuoteOverrideRecord[]>
  createAndApprove(dealId: string, assessmentId: string, input: CreateQuoteOverrideInput): Promise<ContractorQuoteOverrideRecord>
}

const mapRow = (r: QueryResultRow): ContractorQuoteOverrideRecord => ({
  id: r.id,
  dealId: r.deal_id,
  assessmentId: r.assessment_id,
  itemId: r.item_id,
  taskId: r.task_id,
  quoteEvidenceId: r.quote_evidence_id ?? null,
  quoteRef: r.quote_ref,
  approvedAmount: Number(r.approved_amount),
  approvedBy: r.approved_by,
  approvedAt: iso(r.approved_at),
  status: r.status as ContractorQuoteOverrideRecord["status"],
  supersededBy: r.superseded_by ?? null,
})

const FIELDS =
  "id, deal_id, assessment_id, item_id, task_id, quote_evidence_id, quote_ref, approved_amount, approved_by, approved_at, status, superseded_by"

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

export const pgQuoteOverridesRepository: QuoteOverridesRepository = {
  async list(dealId: string, assessmentId: string, activeOnly: boolean = false): Promise<ContractorQuoteOverrideRecord[]> {
    const where = activeOnly
      ? `WHERE deal_id = $1 AND assessment_id = $2 AND status = 'APPROVED'`
      : `WHERE deal_id = $1 AND assessment_id = $2`
    const res = await query<QueryResultRow>(
      `SELECT ${FIELDS} FROM ${S}.contractor_quote_overrides ${where} ORDER BY approved_at DESC`,
      [dealId, assessmentId]
    )
    return res.rows.map(mapRow)
  },

  async createAndApprove(
    dealId: string,
    assessmentId: string,
    input: CreateQuoteOverrideInput
  ): Promise<ContractorQuoteOverrideRecord> {
    return withTransaction(async (client) => {
      // Find existing active approved override for this specific task
      const existing = await client.query(
        `SELECT id FROM ${S}.contractor_quote_overrides WHERE deal_id = $1 AND assessment_id = $2 AND task_id = $3 AND status = 'APPROVED'`,
        [dealId, assessmentId, input.taskId]
      )

      const newId = `cvr-${randomUUID()}`

      if (existing.rows.length > 0) {
        for (const row of existing.rows) {
          await client.query(
            `UPDATE ${S}.contractor_quote_overrides SET status = 'SUPERSEDED', superseded_by = $1 WHERE id = $2`,
            [newId, row.id]
          )
        }
      }

      const inserted = await client.query(
        `INSERT INTO ${S}.contractor_quote_overrides (
          id, deal_id, assessment_id, item_id, task_id, quote_evidence_id, quote_ref, approved_amount, approved_by, approved_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'APPROVED')
        RETURNING ${FIELDS}`,
        [
          newId,
          dealId,
          assessmentId,
          input.itemId,
          input.taskId,
          input.quoteEvidenceId ?? null,
          input.quoteRef,
          input.approvedAmount,
          input.approvedBy,
        ]
      )

      return mapRow(inserted.rows[0])
    })
  },
}

export function createInMemoryQuoteOverridesRepository(
  seed: ContractorQuoteOverrideRecord[] = []
): QuoteOverridesRepository {
  const records = [...seed]
  return {
    async list(dealId: string, assessmentId: string, activeOnly: boolean = false) {
      return records
        .filter(
          (r) =>
            r.dealId === dealId &&
            r.assessmentId === assessmentId &&
            (!activeOnly || r.status === "APPROVED")
        )
        .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))
    },
    async createAndApprove(dealId: string, assessmentId: string, input: CreateQuoteOverrideInput) {
      const newId = `cvr-${randomUUID()}`
      for (const r of records) {
        if (
          r.dealId === dealId &&
          r.assessmentId === assessmentId &&
          r.taskId === input.taskId &&
          r.status === "APPROVED"
        ) {
          r.status = "SUPERSEDED"
          r.supersededBy = newId
        }
      }
      const newRecord: ContractorQuoteOverrideRecord = {
        id: newId,
        dealId,
        assessmentId,
        itemId: input.itemId,
        taskId: input.taskId,
        quoteEvidenceId: input.quoteEvidenceId ?? null,
        quoteRef: input.quoteRef,
        approvedAmount: input.approvedAmount,
        approvedBy: input.approvedBy,
        approvedAt: new Date().toISOString(),
        status: "APPROVED",
        supersededBy: null,
      }
      records.unshift(newRecord)
      return { ...newRecord }
    },
  }
}

export function toCostOverrides(records: readonly ContractorQuoteOverrideRecord[]): CostOverride[] {
  return records
    .filter((r) => r.status === "APPROVED")
    .map((r) => ({
      id: r.id,
      type: "contractor_quote" as const,
      targetTaskId: r.taskId,
      value: r.approvedAmount,
      reason: `${r.quoteRef}: approved £${r.approvedAmount} by ${r.approvedBy}`,
    }))
}
