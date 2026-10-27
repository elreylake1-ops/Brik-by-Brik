import { describe, expect, it } from "vitest"
import {
  approveRefurbishmentSnapshot,
  assessRefurbishmentCoverage,
  createRefurbishmentSnapshot,
  futureApplicationEligibility,
  invalidateRefurbishmentSnapshot,
  type RefurbishmentCoverageInput,
} from "@/lib/refurb-integration/refurb-pricing-coverage"

const base = (patch: Partial<RefurbishmentCoverageInput> = {}): RefurbishmentCoverageInput => ({
  dealId: "deal-1",
  plan: { id: "plan-1", assessmentId: "assessment-1", version: 1, measurementSetId: "measure-1", measurementSetVersion: 1 },
  planCurrent: true,
  measurementsCurrent: true,
  costLines: [{ itemId: "bathroom", taskId: "bathroom-fit", taskName: "Bathroom fit", room: "Bathroom", trade: "Plumbing", quantity: 1, labourDays: 1, labourCost: 100, materialCost: 900, totalCost: 1000, priced: true, warnings: [] }],
  activeOverrides: [{ id: "override-1", dealId: "deal-1", assessmentId: "assessment-1", itemId: "bathroom", taskId: "bathroom-fit", quoteEvidenceId: "evidence-1", quoteRef: "Apex Q1", approvedAmount: 1000, approvedBy: "operator", approvedAt: "2026-10-27T00:00:00Z", status: "APPROVED", supersededBy: null, vatBasis: "GROSS", quoteType: "VERIFIED_CONTRACTOR_QUOTE", scopeVerified: true }],
  evidence: [{ id: "evidence-1", dealId: "deal-1", evidenceType: "BUILDER_QUOTE", reviewState: "REVIEWED" }],
  mappings: [{ taskId: "bathroom-fit", taskName: "Bathroom fit", included: true, amount: 1000, priceSource: "VERIFIED_CONTRACTOR_QUOTE", overrideId: "override-1", evidenceId: "evidence-1", evidenceType: "BUILDER_QUOTE", evidenceReviewState: "REVIEWED", scopeVerified: true, vatBasis: "GROSS" }],
  computedRefurbTotal: 1000,
  ...patch,
})

describe("refurbishment pricing coverage", () => {
  it("covers a fully reconciled reviewed contractor price", () => {
    const result = assessRefurbishmentCoverage(base())
    expect(result.state).toBe("COVERED")
    expect(result.tasks[0].coverageState).toBe("COVERED")
  })

  it("fails closed for missing, provisional, duplicate, contradictory and stale bases", () => {
    expect(assessRefurbishmentCoverage(base({ costLines: [{ ...base().costLines[0], totalCost: 0, priced: false }], mappings: [], activeOverrides: [], computedRefurbTotal: 0 })).state).toBe("UNPRICED")
    expect(assessRefurbishmentCoverage(base({ mappings: [{ ...base().mappings[0], priceSource: "OPERATOR_PROVISIONAL_ESTIMATE", evidenceId: undefined, evidenceType: undefined, evidenceReviewState: undefined, scopeVerified: false }], activeOverrides: [{ ...base().activeOverrides[0], quoteEvidenceId: null, quoteType: "OPERATOR_PROVISIONAL_ESTIMATE", scopeVerified: false }] })).state).toBe("PARTIAL")
    expect(assessRefurbishmentCoverage(base({ activeOverrides: [...base().activeOverrides, { ...base().activeOverrides[0], id: "override-2" }] })).state).toBe("CONFLICTING")
    expect(assessRefurbishmentCoverage(base({ mappings: [...base().mappings, { ...base().mappings[0], amount: 999 }] })).state).toBe("CONFLICTING")
    expect(assessRefurbishmentCoverage(base({ planCurrent: false })).state).toBe("STALE")
    expect(assessRefurbishmentCoverage(base({ measurementsCurrent: false })).state).toBe("STALE")
  })

  it("rejects cross-deal, unsupported and unreviewed evidence while allowing one explicit quote across tasks", () => {
    expect(assessRefurbishmentCoverage(base({ evidence: [{ ...base().evidence[0], dealId: "deal-2" }] })).state).toBe("PARTIAL")
    expect(assessRefurbishmentCoverage(base({ evidence: [{ ...base().evidence[0], evidenceType: "OTHER" }] })).state).toBe("PARTIAL")
    expect(assessRefurbishmentCoverage(base({ evidence: [{ ...base().evidence[0], reviewState: "RECEIVED" }] })).state).toBe("PARTIAL")
    const twoTasks = base({
      costLines: [...base().costLines, { ...base().costLines[0], itemId: "kitchen", taskId: "kitchen-fit", taskName: "Kitchen fit", totalCost: 2000 }],
      activeOverrides: [...base().activeOverrides, { ...base().activeOverrides[0], id: "override-2", itemId: "kitchen", taskId: "kitchen-fit", approvedAmount: 2000 }],
      mappings: [...base().mappings, { ...base().mappings[0], taskId: "kitchen-fit", taskName: "Kitchen fit", amount: 2000, overrideId: "override-2" }],
      computedRefurbTotal: 3000,
    })
    expect(assessRefurbishmentCoverage(twoTasks).state).toBe("COVERED")
  })

  it("requires exact reconciliation and ignores excluded zero-cost rows", () => {
    expect(assessRefurbishmentCoverage(base({ computedRefurbTotal: 999 })).state).toBe("CONFLICTING")
    expect(assessRefurbishmentCoverage(base({ mappings: [...base().mappings, { taskId: "excluded", taskName: "Excluded", included: false, amount: 0, priceSource: "DEFAULT_ENGINE_RATE" }] })).state).toBe("COVERED")
  })

  it("permits approval and future application only for an unchanged covered snapshot", () => {
    const coverage = assessRefurbishmentCoverage(base())
    const draft = createRefurbishmentSnapshot({ approvalId: "approval-1", coverage, approvedBy: "", approvedAt: "", decisionNote: "" })
    const approved = approveRefurbishmentSnapshot(draft, coverage, "reviewer", "2026-10-27T01:00:00Z")
    expect(approved.eligible).toBe(true)
    if (!approved.eligible) throw new Error("expected approval")
    expect(approved.snapshot.status).toBe("APPROVED")
    expect(futureApplicationEligibility(approved.snapshot, coverage).state).toBe("NOT_APPLIED")
    expect(invalidateRefurbishmentSnapshot(approved.snapshot, assessRefurbishmentCoverage(base({ computedRefurbTotal: 999 }))).state).toBe("SUPERSEDED")
    expect(approveRefurbishmentSnapshot(draft, assessRefurbishmentCoverage(base({ planCurrent: false })), "reviewer", "2026-10-27T01:00:00Z").eligible).toBe(false)
    expect(approveRefurbishmentSnapshot(draft, coverage, "", "2026-10-27T01:00:00Z").eligible).toBe(false)
    expect(approveRefurbishmentSnapshot(draft, coverage, "reviewer", "").eligible).toBe(false)
  })

  it("supersedes an approval when any persisted pricing basis changes", () => {
    const original = assessRefurbishmentCoverage(base())
    const created = createRefurbishmentSnapshot({ approvalId: "approval-2", coverage: original, approvedBy: "", approvedAt: "" })
    const approved = approveRefurbishmentSnapshot(created, original, "reviewer", "2026-10-27T01:00:00Z")
    if (!approved.eligible) throw new Error("expected approval")
    const changed = [
      base({ plan: { ...base().plan, version: 2 } }),
      base({ plan: { ...base().plan, measurementSetVersion: 2 } }),
      base({ mappings: [{ ...base().mappings[0], amount: 999 }], activeOverrides: [{ ...base().activeOverrides[0], approvedAmount: 999 }], costLines: [{ ...base().costLines[0], totalCost: 999 }], computedRefurbTotal: 999 }),
      base({ activeOverrides: [{ ...base().activeOverrides[0], id: "override-2" }], mappings: [{ ...base().mappings[0], overrideId: "override-2" }] }),
      base({ evidence: [{ ...base().evidence[0], reviewState: "REJECTED" }], mappings: [{ ...base().mappings[0], evidenceReviewState: "REJECTED" }] }),
      base({ costLines: [...base().costLines, { ...base().costLines[0], taskId: "kitchen-fit", taskName: "Kitchen fit", totalCost: 0, priced: false }], computedRefurbTotal: 1000 }),
      base({ costLines: [], activeOverrides: [], mappings: [], computedRefurbTotal: 0 }),
    ]
    for (const input of changed) expect(invalidateRefurbishmentSnapshot(approved.snapshot, assessRefurbishmentCoverage(input)).state).toBe("SUPERSEDED")
  })

  it("rejects an override whose evidence or task no longer matches its mapping", () => {
    expect(assessRefurbishmentCoverage(base({ activeOverrides: [{ ...base().activeOverrides[0], quoteEvidenceId: "other-evidence" }] })).state).toBe("CONFLICTING")
    expect(assessRefurbishmentCoverage(base({ activeOverrides: [{ ...base().activeOverrides[0], taskId: "other-task" }] })).state).toBe("CONFLICTING")
  })
})
