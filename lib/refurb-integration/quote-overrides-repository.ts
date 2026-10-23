import { randomUUID } from "node:crypto"
import type { PoolClient, QueryResultRow } from "pg"
import { getPostgresPool, query } from "@/lib/db/postgres"
import type { CostOverride } from "@/types/overrides"

const S = "brik_by_brik_engine"
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v))

export type VatBasis = "GROSS" | "NET_PLUS_VAT" | "EXEMPT"
export type QuoteType = "VERIFIED_CONTRACTOR_QUOTE" | "OPERATOR_PROVISIONAL_ESTIMATE"

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
  vatBasis: VatBasis
  quoteType: QuoteType
  scopeVerified: boolean
}

export type CreateQuoteOverrideInput = {
  itemId: string
  taskId: string
  quoteEvidenceId?: string | null
  quoteRef: string
  approvedAmount: number
  approvedBy: string
  vatBasis?: VatBasis
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
  vatBasis: (r.vat_basis ?? "GROSS") as VatBasis,
  quoteType: (r.quote_type ?? "OPERATOR_PROVISIONAL_ESTIMATE") as QuoteType,
  scopeVerified: Boolean(r.scope_verified),
})

const FIELDS =
  "id, deal_id, assessment_id, item_id, task_id, quote_evidence_id, quote_ref, approved_amount, approved_by, approved_at, status, superseded_by, vat_basis, quote_type, scope_verified"

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
    if (!Number.isFinite(input.approvedAmount) || input.approvedAmount < 0 || input.approvedAmount > 10_000_000) {
      throw new Error("approvedAmount must be between 0 and 10,000,000")
    }

    const vatBasis: VatBasis = input.vatBasis ?? "GROSS"

    return withTransaction(async (client) => {
      let quoteType: QuoteType = "OPERATOR_PROVISIONAL_ESTIMATE"
      let scopeVerified = false

      if (input.quoteEvidenceId) {
        // Enforce evidence integrity & cross-deal protection
        const evRes = await client.query(
          `SELECT id, deal_id, evidence_type FROM ${S}.deal_evidence WHERE id = $1`,
          [input.quoteEvidenceId]
        )
        if (evRes.rows.length === 0) {
          throw new Error(`Invalid quoteEvidenceId: evidence record "${input.quoteEvidenceId}" not found`)
        }
        const ev = evRes.rows[0]
        if (ev.deal_id !== dealId) {
          throw new Error(`Cross-deal quotation evidence reference forbidden: evidence belongs to deal "${ev.deal_id}", not "${dealId}"`)
        }
        if (ev.evidence_type !== "BUILDER_QUOTE" && ev.evidence_type !== "BUILDER_PROPOSAL" && ev.evidence_type !== "BUILDER_CONTRACT") {
          throw new Error(`Invalid quote evidence type: expected BUILDER_QUOTE, got "${ev.evidence_type}"`)
        }
        quoteType = "VERIFIED_CONTRACTOR_QUOTE"
        scopeVerified = true
      }

      // Lock and find existing active approved overrides for this specific task
      const existing = await client.query(
        `SELECT id FROM ${S}.contractor_quote_overrides WHERE deal_id = $1 AND assessment_id = $2 AND task_id = $3 AND status = 'APPROVED' FOR UPDATE`,
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
          id, deal_id, assessment_id, item_id, task_id, quote_evidence_id, quote_ref, approved_amount, approved_by, approved_at, status, vat_basis, quote_type, scope_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'APPROVED', $10, $11, $12)
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
          vatBasis,
          quoteType,
          scopeVerified,
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
      if (!Number.isFinite(input.approvedAmount) || input.approvedAmount < 0 || input.approvedAmount > 10_000_000) {
        throw new Error("approvedAmount must be between 0 and 10,000,000")
      }
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
      const vatBasis: VatBasis = input.vatBasis ?? "GROSS"
      const quoteType: QuoteType = input.quoteEvidenceId ? "VERIFIED_CONTRACTOR_QUOTE" : "OPERATOR_PROVISIONAL_ESTIMATE"
      const scopeVerified = Boolean(input.quoteEvidenceId)

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
        vatBasis,
        quoteType,
        scopeVerified,
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
      reason: `${r.quoteRef} (${r.quoteType === "VERIFIED_CONTRACTOR_QUOTE" ? "Verified quotation" : "Provisional estimate"}, VAT: ${r.vatBasis}): approved £${r.approvedAmount} by ${r.approvedBy}`,
    }))
}
