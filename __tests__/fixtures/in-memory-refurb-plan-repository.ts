import { randomUUID } from "node:crypto"
import type { RefurbPlanRepository } from "@/lib/refurb-integration/plan-repository"
import type { ConfirmedPlanRecord } from "@/types/refurb-integration"

// Behavioural double for the plan repository (same contract as the PostgreSQL implementation).
export function createInMemoryRefurbPlanRepository(): RefurbPlanRepository & { rows: Array<ConfirmedPlanRecord & { requestHash: string }> } {
  const rows: Array<ConfirmedPlanRecord & { requestHash: string }> = []
  const clone = <T,>(v: T): T => structuredClone(v)
  const strip = (r: ConfirmedPlanRecord & { requestHash: string }): ConfirmedPlanRecord => {
    const { requestHash, ...rest } = r
    void requestHash
    return clone(rest)
  }
  return {
    rows,
    async create(input) {
      const same = rows.find((r) => r.dealId === input.dealId && r.assessmentId === input.assessmentId && r.idempotencyKey === input.idempotencyKey)
      if (same) return same.requestHash === input.requestHash ? { status: "replayed", record: strip(same) } : { status: "key_reused" }
      const version = rows.filter((r) => r.dealId === input.dealId && r.assessmentId === input.assessmentId).length + 1
      const record = { ...clone(input), id: `plan-${randomUUID()}`, version }
      rows.push(record)
      return { status: "created", record: strip(record) }
    },
    async findByKey(dealId, assessmentId, key) {
      const r = rows.find((x) => x.dealId === dealId && x.assessmentId === assessmentId && x.idempotencyKey === key)
      return r ? { record: strip(r), requestHash: r.requestHash } : null
    },
    async getCurrent(dealId, assessmentId) {
      const mine = rows.filter((r) => r.dealId === dealId && r.assessmentId === assessmentId)
      return mine.length ? strip(mine.reduce((a, b) => (b.version > a.version ? b : a))) : null
    },
    async list(dealId, assessmentId) {
      return rows.filter((r) => r.dealId === dealId && r.assessmentId === assessmentId).sort((a, b) => b.version - a.version).map(strip)
    },
  }
}
