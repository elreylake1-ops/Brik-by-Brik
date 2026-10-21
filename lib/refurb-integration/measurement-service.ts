import type { MeasurementChange, MeasurementSetRecord } from "@/types/refurb-measurements"
import { canonicalJson, sha256 } from "./financial-proposal"
import { basicsFromMeasurements, diffMeasurementSets, type MeasurementRequest } from "./measurements"
import type { PlanDeps } from "./plan-service"

// Recording and reading operator-entered measurements. Recording changes nothing else: no plan, proposal, Saved Deal or
// governance state is touched. (A later plan is flagged stale by the plan service when a newer set exists.)

export type RecordMeasurementsOutcome =
  | { status: "not_found" }
  | { status: "stale_base"; currentVersion: number }
  | { status: "key_reused" }
  | { status: "ok"; replayed: boolean; record: MeasurementSetRecord }

export const hashMeasurementRequest = (r: Pick<MeasurementRequest, "basedOnVersion" | "changeNote" | "entries">) =>
  sha256(canonicalJson({ basedOnVersion: r.basedOnVersion, changeNote: r.changeNote, entries: r.entries }))

export async function recordMeasurements(deps: PlanDeps, dealId: string, assessmentId: string, actor: string, request: MeasurementRequest): Promise<RecordMeasurementsOutcome> {
  if (!(await deps.viewing.getAssessment(dealId, assessmentId))) return { status: "not_found" }
  const created = await deps.measurements.create({
    dealId,
    assessmentId,
    basedOnVersion: request.basedOnVersion,
    idempotencyKey: request.idempotencyKey,
    requestHash: hashMeasurementRequest(request),
    entries: request.entries,
    warnings: request.warnings,
    changeNote: request.changeNote,
    recordedBy: actor,
    recordedAt: deps.now().toISOString(),
  })
  if (created.status === "key_reused") return { status: "key_reused" }
  if (created.status === "stale_base") return { status: "stale_base", currentVersion: created.currentVersion }
  return { status: "ok", replayed: created.status === "replayed", record: created.record }
}

export type MeasurementState = {
  current: MeasurementSetRecord | null
  /** All versions, newest first, each with what changed from the one before it. */
  history: { record: MeasurementSetRecord; changesFromPrevious: MeasurementChange[] }[]
  /** How the current set maps onto the engine's quantities. */
  engineQuantities: ReturnType<typeof basicsFromMeasurements> | null
}

export async function getMeasurementState(deps: PlanDeps, dealId: string, assessmentId: string): Promise<MeasurementState | "not_found"> {
  if (!(await deps.viewing.getAssessment(dealId, assessmentId))) return "not_found"
  const versions = await deps.measurements.list(dealId, assessmentId) // newest first
  const history = versions.map((record, i) => ({ record, changesFromPrevious: diffMeasurementSets(versions[i + 1]?.entries ?? [], record.entries) }))
  const current = versions[0] ?? null
  return { current, history, engineQuantities: current ? basicsFromMeasurements(current.entries) : null }
}
