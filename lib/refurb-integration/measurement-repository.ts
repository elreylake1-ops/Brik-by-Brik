import type { MeasurementSetRecord } from "@/types/refurb-measurements"

// Persistence boundary for operator-entered measurement sets. Append-only; every read is keyed by deal AND assessment.
// One behavioural contract (__tests__/contracts/refurb-measurement-repository-contract.ts) runs against the in-memory
// double and the real PostgreSQL implementation.

export type NewMeasurementSet = Omit<MeasurementSetRecord, "id" | "version"> & {
  /** Hash of the submitting request, so a replay can be told apart from a reused key. */
  requestHash: string
}

export type CreateMeasurementResult =
  | { status: "created"; record: MeasurementSetRecord }
  | { status: "replayed"; record: MeasurementSetRecord }
  | { status: "key_reused" }
  | { status: "stale_base"; currentVersion: number } // basedOnVersion is not the current version: someone else changed it

export type MeasurementRepository = {
  create(input: NewMeasurementSet): Promise<CreateMeasurementResult>
  findByKey(dealId: string, assessmentId: string, idempotencyKey: string): Promise<{ record: MeasurementSetRecord; requestHash: string } | null>
  getCurrent(dealId: string, assessmentId: string): Promise<MeasurementSetRecord | null>
  getById(dealId: string, assessmentId: string, id: string): Promise<MeasurementSetRecord | null>
  /** All versions, newest first. */
  list(dealId: string, assessmentId: string): Promise<MeasurementSetRecord[]>
}
