import { describe, expect, it } from "vitest"
import {
  assessRefurbishmentApprovalSnapshot,
  futureRefurbishmentApplicationEligibility,
  mapTaskPriceEvidenceRows,
  proposeRefurbishmentSnapshotEdit,
  type RefurbishmentApprovalSnapshotRow,
  type TaskPriceEvidenceMappingRow,
} from "@/lib/refurb-integration/refurb-pricing-persistence-types"

const row = (patch: Partial<TaskPriceEvidenceMappingRow> = {}): TaskPriceEvidenceMappingRow => ({
  id: "mapping-1", deal_id: "deal-1", assessment_id: "assessment-1", plan_fingerprint: "plan-v1",
  work_item_id: "bathroom", task_id: "bathroom-fit", evidence_id: "evidence-1", approved_amount: "1000.00",
  vat_basis: "GROSS", status: "APPROVED", reviewed_by: "reviewer", reviewed_at: "2026-10-27T00:00:00Z",
  created_at: "2026-10-27T00:00:00Z", superseded_by: null, ...patch,
})

const snapshot = (patch: Partial<RefurbishmentApprovalSnapshotRow> = {}): RefurbishmentApprovalSnapshotRow => ({
  id: "snapshot-1", deal_id: "deal-1", assessment_id: "assessment-1", confirmed_plan_id: "plan-1",
  plan_fingerprint: "plan-v1", measurement_fingerprint: "measure-v1", task_price_mapping_ids: ["mapping-1"],
  pricing_fingerprint: "mapping-set-1", coverage_state: "COVERED", reconciled_total: "1000.00", status: "APPROVED", approved_by: "approver",
  approved_at: "2026-10-27T01:00:00Z", created_at: "2026-10-27T00:00:00Z", superseded_by: null, ...patch,
})

describe("refurbishment pricing persistence contracts", () => {
  it("maps a valid fully covered approved mapping set", () => {
    const result = mapTaskPriceEvidenceRows([row()], { dealId: "deal-1", assessmentId: "assessment-1", planFingerprint: "plan-v1", evidenceDealById: { "evidence-1": "deal-1" } })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.total).toBe(1000)
  })

  it("fails closed for malformed, zero, and negative monetary amounts", () => {
    for (const approved_amount of ["abc", "0", "-1"]) {
      const result = mapTaskPriceEvidenceRows([row({ approved_amount })], { dealId: "deal-1", assessmentId: "assessment-1", planFingerprint: "plan-v1", evidenceDealById: { "evidence-1": "deal-1" } })
      expect(result.ok).toBe(false)
    }
  })

  it("fails closed for cross-deal evidence and missing task identity", () => {
    const context = { dealId: "deal-1", assessmentId: "assessment-1", planFingerprint: "plan-v1", evidenceDealById: { "evidence-1": "deal-2" } }
    expect(mapTaskPriceEvidenceRows([row()], context).ok).toBe(false)
    expect(mapTaskPriceEvidenceRows([row({ task_id: "" })], { ...context, evidenceDealById: { "evidence-1": "deal-1" } }).ok).toBe(false)
  })

  it("fails closed for duplicate active task mappings and missing approved review", () => {
    const context = { dealId: "deal-1", assessmentId: "assessment-1", planFingerprint: "plan-v1", evidenceDealById: { "evidence-1": "deal-1" } }
    expect(mapTaskPriceEvidenceRows([row(), row({ id: "mapping-2" })], context).ok).toBe(false)
    expect(mapTaskPriceEvidenceRows([row({ reviewed_by: "" })], context).ok).toBe(false)
  })

  it("fails closed when a mapping belongs to a stale plan fingerprint", () => {
    const result = mapTaskPriceEvidenceRows([row({ plan_fingerprint: "plan-v0" })], { dealId: "deal-1", assessmentId: "assessment-1", planFingerprint: "plan-v1", evidenceDealById: { "evidence-1": "deal-1" } })
    expect(result.ok).toBe(false)
  })

  it("rejects stale plan and measurement bases", () => {
    expect(assessRefurbishmentApprovalSnapshot(snapshot(), { planFingerprint: "plan-v2", measurementFingerprint: "measure-v1", mappingSetFingerprint: "mapping-set-1", reconciledTotal: "1000.00" }).state).toBe("STALE")
    expect(assessRefurbishmentApprovalSnapshot(snapshot(), { planFingerprint: "plan-v1", measurementFingerprint: "measure-v2", mappingSetFingerprint: "mapping-set-1", reconciledTotal: "1000.00" }).state).toBe("STALE")
  })

  it("requires a reconciled total and approval timestamp", () => {
    expect(assessRefurbishmentApprovalSnapshot(snapshot({ reconciled_total: "999.00" }), { planFingerprint: "plan-v1", measurementFingerprint: "measure-v1", mappingSetFingerprint: "mapping-set-1", reconciledTotal: "1000.00" }).state).toBe("INVALID")
    expect(assessRefurbishmentApprovalSnapshot(snapshot({ approved_at: null }), { planFingerprint: "plan-v1", measurementFingerprint: "measure-v1", mappingSetFingerprint: "mapping-set-1", reconciledTotal: "1000.00" }).state).toBe("INVALID")
  })

  it("does not permit an approved snapshot pricing basis to be edited in place", () => {
    expect(proposeRefurbishmentSnapshotEdit(snapshot(), { reconciled_total: "1100.00" }).state).toBe("NEW_SNAPSHOT_REQUIRED")
  })

  it("does not apply a superseded snapshot", () => {
    expect(futureRefurbishmentApplicationEligibility(snapshot({ status: "SUPERSEDED", superseded_by: "snapshot-2" }), { planFingerprint: "plan-v1", measurementFingerprint: "measure-v1", mappingSetFingerprint: "mapping-set-1", reconciledTotal: "1000.00" }).state).toBe("STALE")
  })

  it("recognizes an identical prior application idempotently", () => {
    expect(futureRefurbishmentApplicationEligibility(snapshot(), { planFingerprint: "plan-v1", measurementFingerprint: "measure-v1", mappingSetFingerprint: "mapping-set-1", reconciledTotal: "1000.00" }, { snapshotId: "snapshot-1", snapshotFingerprint: "mapping-set-1" }).state).toBe("ALREADY_APPLIED_IDENTICALLY")
  })

  it("fails closed for a conflicting prior application", () => {
    expect(futureRefurbishmentApplicationEligibility(snapshot(), { planFingerprint: "plan-v1", measurementFingerprint: "measure-v1", mappingSetFingerprint: "mapping-set-1", reconciledTotal: "1000.00" }, { snapshotId: "snapshot-other", snapshotFingerprint: "other" }).state).toBe("CONFLICTING_APPLICATION")
  })

  it("does not silently assume unresolved actor policy", () => {
    const result = futureRefurbishmentApplicationEligibility(snapshot(), { planFingerprint: "plan-v1", measurementFingerprint: "measure-v1", mappingSetFingerprint: "mapping-set-1", reconciledTotal: "1000.00" })
    expect(result.state).toBe("ELIGIBLE")
    expect(result.policyDependencies).toContain("APPLY_ACTOR_POLICY_REQUIRED")
  })
})
