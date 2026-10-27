import type { VatBasis } from "./quote-overrides-repository"
import type { RefurbishmentCoverageState } from "./refurb-pricing-coverage"

export const REFURBISHMENT_APPROVAL_SNAPSHOT_STATUSES = ["DRAFT", "APPROVED", "REJECTED", "SUPERSEDED"] as const
export type RefurbishmentApprovalSnapshotStatus = typeof REFURBISHMENT_APPROVAL_SNAPSHOT_STATUSES[number]
export type TaskPriceEvidenceMappingStatus = "APPROVED" | "REJECTED" | "SUPERSEDED"

/** Future persistence shape only. It performs no database operation. */
export type TaskPriceEvidenceMappingRow = Readonly<{
  id: string; deal_id: string; assessment_id: string; plan_fingerprint: string; work_item_id: string; task_id: string
  evidence_id: string; approved_amount: string; vat_basis: VatBasis | null; status: TaskPriceEvidenceMappingStatus
  reviewed_by: string | null; reviewed_at: string | null; created_at: string; superseded_by: string | null
}>

export type MappedTaskPriceEvidence = Readonly<{
  id: string; dealId: string; assessmentId: string; planFingerprint: string; workItemId: string; taskId: string
  evidenceId: string; approvedAmount: number; vatBasis: VatBasis | null; reviewedBy: string; reviewedAt: string
}>

type MappingContext = Readonly<{ dealId: string; assessmentId: string; planFingerprint: string; evidenceDealById: Readonly<Record<string, string | undefined>> }>
export type MappingResult = { ok: true; mappings: readonly MappedTaskPriceEvidence[]; total: number } | { ok: false; reasons: readonly string[] }

const present = (value: string | null | undefined): value is string => typeof value === "string" && value.trim().length > 0
const timestamp = (value: string | null) => {
  if (!present(value)) return false
  return Number.isFinite(Date.parse(value))
}
const amount = (value: string): number | null => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 && Number.isSafeInteger(Math.round(parsed * 100)) ? parsed : null
}
const equalMoney = (left: number, right: number) => Math.abs(left - right) < 0.000001

export function mapTaskPriceEvidenceRows(rows: readonly TaskPriceEvidenceMappingRow[], context: MappingContext): MappingResult {
  const reasons: string[] = []
  const activeByTask = new Map<string, number>()
  const mappings: MappedTaskPriceEvidence[] = []
  for (const row of rows) {
    const parsedAmount = amount(row.approved_amount)
    if (!present(row.id) || !present(row.deal_id) || row.deal_id !== context.dealId) reasons.push("DEAL_OWNERSHIP_REQUIRED")
    if (!present(row.assessment_id) || row.assessment_id !== context.assessmentId) reasons.push("ASSESSMENT_OWNERSHIP_REQUIRED")
    if (!present(row.plan_fingerprint) || row.plan_fingerprint !== context.planFingerprint) reasons.push("PLAN_FINGERPRINT_STALE")
    if (!present(row.work_item_id) || !present(row.task_id)) reasons.push("TASK_IDENTITY_REQUIRED")
    if (!present(row.evidence_id) || context.evidenceDealById[row.evidence_id] !== context.dealId) reasons.push("CROSS_DEAL_OR_MISSING_EVIDENCE")
    if (parsedAmount === null) reasons.push("APPROVED_AMOUNT_INVALID")
    if (row.status !== "APPROVED") reasons.push("ACTIVE_APPROVAL_REQUIRED")
    if (!present(row.reviewed_by) || !timestamp(row.reviewed_at)) reasons.push("APPROVED_REVIEWER_AND_TIMESTAMP_REQUIRED")
    if (row.status === "APPROVED" && row.superseded_by === null) activeByTask.set(row.task_id, (activeByTask.get(row.task_id) ?? 0) + 1)
    if (parsedAmount !== null && present(row.reviewed_by) && row.reviewed_at) {
      mappings.push({ id: row.id, dealId: row.deal_id, assessmentId: row.assessment_id, planFingerprint: row.plan_fingerprint, workItemId: row.work_item_id, taskId: row.task_id, evidenceId: row.evidence_id, approvedAmount: parsedAmount, vatBasis: row.vat_basis, reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at })
    }
  }
  if (rows.length === 0) reasons.push("TASK_PRICE_MAPPINGS_REQUIRED")
  if ([...activeByTask.values()].some((count) => count > 1)) reasons.push("DUPLICATE_ACTIVE_TASK_MAPPING")
  return reasons.length ? { ok: false, reasons: [...new Set(reasons)] } : { ok: true, mappings, total: mappings.reduce((total, mapping) => total + mapping.approvedAmount, 0) }
}

export type RefurbishmentApprovalSnapshotRow = Readonly<{
  id: string; deal_id: string; assessment_id: string; confirmed_plan_id: string; plan_fingerprint: string; measurement_fingerprint: string
  task_price_mapping_ids: readonly string[]; pricing_fingerprint: string; coverage_state: RefurbishmentCoverageState; reconciled_total: string
  status: RefurbishmentApprovalSnapshotStatus; approved_by: string | null; approved_at: string | null; created_at: string; superseded_by: string | null
}>

export type CurrentRefurbishmentBasis = Readonly<{ planFingerprint: string; measurementFingerprint: string; mappingSetFingerprint: string; reconciledTotal: string }>
export type SnapshotAssessment = { state: "CURRENT" | "STALE" | "INVALID"; reasons: readonly string[] }

export function assessRefurbishmentApprovalSnapshot(snapshot: RefurbishmentApprovalSnapshotRow, current: CurrentRefurbishmentBasis): SnapshotAssessment {
  const reasons: string[] = []
  const reconciledTotal = amount(snapshot.reconciled_total)
  const currentTotal = amount(current.reconciledTotal)
  if (!present(snapshot.id) || !present(snapshot.deal_id) || !present(snapshot.assessment_id) || !present(snapshot.confirmed_plan_id) || !snapshot.task_price_mapping_ids.length || reconciledTotal === null || currentTotal === null || !equalMoney(reconciledTotal ?? 0, currentTotal ?? 0) || snapshot.coverage_state !== "COVERED" || (snapshot.status === "APPROVED" && (!present(snapshot.approved_by) || !timestamp(snapshot.approved_at)))) reasons.push("SNAPSHOT_INVALID")
  if (reasons.length) return { state: "INVALID", reasons }
  if (snapshot.status === "SUPERSEDED" || snapshot.superseded_by !== null || snapshot.plan_fingerprint !== current.planFingerprint || snapshot.measurement_fingerprint !== current.measurementFingerprint || snapshot.pricing_fingerprint !== current.mappingSetFingerprint) return { state: "STALE", reasons: ["SNAPSHOT_BASIS_STALE"] }
  return { state: "CURRENT", reasons: [] }
}

type SnapshotMaterialFields = Pick<RefurbishmentApprovalSnapshotRow, "confirmed_plan_id" | "plan_fingerprint" | "measurement_fingerprint" | "task_price_mapping_ids" | "pricing_fingerprint" | "reconciled_total">
export function proposeRefurbishmentSnapshotEdit(snapshot: RefurbishmentApprovalSnapshotRow, change: Partial<SnapshotMaterialFields>): { state: "EDITABLE" | "NEW_SNAPSHOT_REQUIRED" } {
  if (snapshot.status !== "APPROVED") return { state: "EDITABLE" }
  const changed = Object.entries(change).some(([key, value]) => JSON.stringify(snapshot[key as keyof SnapshotMaterialFields]) !== JSON.stringify(value))
  return { state: changed ? "NEW_SNAPSHOT_REQUIRED" : "EDITABLE" }
}

export const REFURBISHMENT_APPLICATION_POLICY_DEPENDENCIES = ["APPLY_ACTOR_POLICY_REQUIRED", "APPROVAL_SEPARATION_POLICY_REQUIRED", "SAVED_DEAL_WRITE_BACK_AUTHORIZATION_REQUIRED"] as const
export type FutureApplicationState = "NOT_APPROVED" | "STALE" | "ELIGIBLE" | "ALREADY_APPLIED_IDENTICALLY" | "CONFLICTING_APPLICATION"
export function futureRefurbishmentApplicationEligibility(snapshot: RefurbishmentApprovalSnapshotRow, current: CurrentRefurbishmentBasis, existing?: Readonly<{ snapshotId: string; snapshotFingerprint: string }>): { state: FutureApplicationState; policyDependencies: readonly string[] } {
  if (snapshot.status !== "APPROVED") return { state: snapshot.status === "SUPERSEDED" ? "STALE" : "NOT_APPROVED", policyDependencies: REFURBISHMENT_APPLICATION_POLICY_DEPENDENCIES }
  if (assessRefurbishmentApprovalSnapshot(snapshot, current).state !== "CURRENT") return { state: "STALE", policyDependencies: REFURBISHMENT_APPLICATION_POLICY_DEPENDENCIES }
  if (!existing) return { state: "ELIGIBLE", policyDependencies: REFURBISHMENT_APPLICATION_POLICY_DEPENDENCIES }
  return { state: existing.snapshotId === snapshot.id && existing.snapshotFingerprint === snapshot.pricing_fingerprint ? "ALREADY_APPLIED_IDENTICALLY" : "CONFLICTING_APPLICATION", policyDependencies: REFURBISHMENT_APPLICATION_POLICY_DEPENDENCIES }
}
