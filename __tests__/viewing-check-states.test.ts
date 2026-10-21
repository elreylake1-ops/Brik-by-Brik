import { describe, expect, it } from "vitest"
import { STATE_PRECEDENCE, buildCheckStates, filterChecks, summariseChecks } from "@/lib/viewing-assessment/check-states"
import { VIEWING_CHECKLIST_V1 } from "@/lib/viewing-assessment/checklist-v1"
import type { ProposalWithReview, StoredReview, ViewingCheckStatus } from "@/types/viewing-assessment"

const IDS = VIEWING_CHECKLIST_V1.map((c) => c.id)

let n = 0
function item(checkId: string, status: "OBSERVED" | "CONCERN" | "SPECIALIST_REVIEW", review?: { disposition: "ACCEPTED" | "EDITED" | "REJECTED"; editedStatus?: ViewingCheckStatus }[]): ProposalWithReview {
  const id = `p${++n}`
  const history: StoredReview[] = (review ?? []).map((r, i) => ({
    id: `r${n}-${i}`,
    proposalId: id,
    revision: i + 1,
    disposition: r.disposition,
    editedStatus: r.disposition === "EDITED" ? (r.editedStatus ?? "CONCERN") : null,
    editedObservation: r.disposition === "EDITED" ? "corrected" : null,
    reason: r.disposition === "REJECTED" ? "no" : null,
    reviewerId: "op",
    reviewedAt: "2026-10-20T10:00:00.000Z",
  }))
  return {
    proposal: { id, assessmentId: "a", runId: "run", createdAt: "t", checkId, status, observation: "x", evidenceIds: ["f"], confidence: "low", modelVersion: "m", verification: "UNVERIFIED", disposition: "PENDING" },
    currentReview: history[history.length - 1] ?? null,
    reviewHistory: history,
  }
}
const stateOf = (rows: ReturnType<typeof buildCheckStates>, id: string) => rows.find((r) => r.checkId === id)!

describe("check states", () => {
  it("covers all 58 checks, every one NOT ASSESSED by default", () => {
    const rows = buildCheckStates(IDS, [])
    expect(rows).toHaveLength(58)
    expect(new Set(rows.map((r) => r.checkId)).size).toBe(58)
    expect(rows.every((r) => r.state === "NOT_ASSESSED" && r.basis === "none" && r.items.length === 0)).toBe(true)
    expect(summariseChecks(rows)).toMatchObject({ total: 58, notAssessed: 58, humanReviewed: 0, awaitingReview: 0, specialist: 0 })
  })

  it("never lets an unreviewed AI suggestion change a check's state: it is shown as awaiting review only", () => {
    const rows = buildCheckStates(IDS, [item("C08", "SPECIALIST_REVIEW"), item("C10", "CONCERN")])
    expect(stateOf(rows, "C08")).toMatchObject({ state: "NOT_ASSESSED", basis: "none", pendingCount: 1, needsSpecialist: false })
    expect(stateOf(rows, "C10")).toMatchObject({ state: "NOT_ASSESSED", pendingCount: 1 })
    expect(summariseChecks(rows)).toMatchObject({ notAssessed: 58, awaitingReview: 2, specialist: 0 })
  })

  it("an accepted suggestion sets the proposed state, marked as human-reviewed", () => {
    const rows = buildCheckStates(IDS, [item("C08", "CONCERN", [{ disposition: "ACCEPTED" }]), item("C11", "OBSERVED", [{ disposition: "ACCEPTED" }])])
    expect(stateOf(rows, "C08")).toMatchObject({ state: "CONCERN", basis: "human_reviewed", pendingCount: 0 })
    expect(stateOf(rows, "C11")).toMatchObject({ state: "OBSERVED", basis: "human_reviewed" })
  })

  it("flags specialist inspection explicitly", () => {
    const rows = buildCheckStates(IDS, [item("C10", "SPECIALIST_REVIEW", [{ disposition: "ACCEPTED" }])])
    expect(stateOf(rows, "C10")).toMatchObject({ state: "SPECIALIST_REVIEW", needsSpecialist: true })
    expect(filterChecks(rows, "specialist").map((r) => r.checkId)).toEqual(["C10"])
  })

  it("an edit uses the status the human chose, including not accessible", () => {
    const rows = buildCheckStates(IDS, [item("C08", "CONCERN", [{ disposition: "EDITED", editedStatus: "NOT_ACCESSIBLE" }]), item("C09", "CONCERN", [{ disposition: "EDITED", editedStatus: "SPECIALIST_REVIEW" }])])
    expect(stateOf(rows, "C08").state).toBe("NOT_ACCESSIBLE")
    expect(stateOf(rows, "C09")).toMatchObject({ state: "SPECIALIST_REVIEW", needsSpecialist: true })
  })

  it("a rejected suggestion changes nothing and is counted", () => {
    const rows = buildCheckStates(IDS, [item("C08", "CONCERN", [{ disposition: "REJECTED" }])])
    expect(stateOf(rows, "C08")).toMatchObject({ state: "NOT_ASSESSED", basis: "none", rejectedCount: 1, pendingCount: 0 })
  })

  it("the latest review decides: accepted then rejected leaves the check not assessed", () => {
    const rows = buildCheckStates(IDS, [item("C08", "CONCERN", [{ disposition: "ACCEPTED" }, { disposition: "REJECTED" }])])
    expect(stateOf(rows, "C08").state).toBe("NOT_ASSESSED")
    const again = buildCheckStates(IDS, [item("C08", "CONCERN", [{ disposition: "REJECTED" }, { disposition: "ACCEPTED" }])])
    expect(stateOf(again, "C08").state).toBe("CONCERN")
  })

  it("combines several reviewed suggestions by the most cautious state", () => {
    const observed = item("C08", "OBSERVED", [{ disposition: "ACCEPTED" }])
    const concern = item("C08", "CONCERN", [{ disposition: "ACCEPTED" }])
    const specialist = item("C08", "SPECIALIST_REVIEW", [{ disposition: "ACCEPTED" }])
    expect(stateOf(buildCheckStates(IDS, [observed, concern]), "C08").state).toBe("CONCERN")
    expect(stateOf(buildCheckStates(IDS, [observed, concern, specialist]), "C08").state).toBe("SPECIALIST_REVIEW")
    expect(stateOf(buildCheckStates(IDS, [specialist, observed]), "C08").items).toHaveLength(2)
  })

  it("has no 'pass' or 'safe' state: observed means a person agreed something was visible, never that it is fine", () => {
    expect(STATE_PRECEDENCE.join(" ")).not.toMatch(/PASS|SAFE|OK|COMPLIANT|APPROVED|CERTIFIED/i)
    expect(STATE_PRECEDENCE[0]).toBe("SPECIALIST_REVIEW") // the most cautious state wins
  })

  it("filters for the review workflow", () => {
    const rows = buildCheckStates(IDS, [
      item("C08", "CONCERN"),
      item("C09", "CONCERN", [{ disposition: "ACCEPTED" }]),
      item("C10", "SPECIALIST_REVIEW", [{ disposition: "ACCEPTED" }]),
    ])
    expect(filterChecks(rows, "all")).toHaveLength(58)
    expect(filterChecks(rows, "needs_review").map((r) => r.checkId)).toEqual(["C08"])
    expect(filterChecks(rows, "reviewed").map((r) => r.checkId)).toEqual(["C09", "C10"])
    expect(filterChecks(rows, "not_assessed")).toHaveLength(56)
    expect(summariseChecks(rows)).toMatchObject({ humanReviewed: 2, awaitingReview: 1, specialist: 1, concern: 1, notAssessed: 56 })
  })

  it("ignores suggestions for ids that are not in the checklist instead of inventing a row", () => {
    const rows = buildCheckStates(IDS, [item("ZZ99", "CONCERN", [{ disposition: "ACCEPTED" }])])
    expect(rows).toHaveLength(58)
    expect(rows.some((r) => r.checkId === "ZZ99")).toBe(false)
    expect(summariseChecks(rows).humanReviewed).toBe(0)
  })
})
