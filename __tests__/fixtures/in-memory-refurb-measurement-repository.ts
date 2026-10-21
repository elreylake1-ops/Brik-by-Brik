import { randomUUID } from "node:crypto"
import type { MeasurementRepository } from "@/lib/refurb-integration/measurement-repository"
import type { MeasurementSetRecord } from "@/types/refurb-measurements"

// Behavioural double for the measurement repository (same contract as the PostgreSQL implementation).
export function createInMemoryMeasurementRepository(): MeasurementRepository & { rows: Array<MeasurementSetRecord & { requestHash: string }> } {
  const rows: Array<MeasurementSetRecord & { requestHash: string }> = []
  const clone = <T,>(v: T): T => structuredClone(v)
  const strip = (r: MeasurementSetRecord & { requestHash: string }): MeasurementSetRecord => {
    const { requestHash, ...rest } = r
    void requestHash
    return clone(rest)
  }
  const mine = (d: string, a: string) => rows.filter((r) => r.dealId === d && r.assessmentId === a)
  return {
    rows,
    async create(input) {
      const same = mine(input.dealId, input.assessmentId).find((r) => r.idempotencyKey === input.idempotencyKey)
      if (same) return same.requestHash === input.requestHash ? { status: "replayed", record: strip(same) } : { status: "key_reused" }
      const currentVersion = mine(input.dealId, input.assessmentId).length
      if (input.basedOnVersion !== currentVersion) return { status: "stale_base", currentVersion }
      const record = { ...clone(input), id: `meas-${randomUUID()}`, version: currentVersion + 1 }
      rows.push(record)
      return { status: "created", record: strip(record) }
    },
    async findByKey(d, a, key) {
      const r = mine(d, a).find((x) => x.idempotencyKey === key)
      return r ? { record: strip(r), requestHash: r.requestHash } : null
    },
    async getCurrent(d, a) {
      const m = mine(d, a)
      return m.length ? strip(m[m.length - 1]) : null
    },
    async getById(d, a, id) {
      const r = mine(d, a).find((x) => x.id === id)
      return r ? strip(r) : null
    },
    async list(d, a) {
      return mine(d, a).map(strip).reverse()
    },
  }
}
