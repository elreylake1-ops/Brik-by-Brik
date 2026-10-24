import type { ProposalWithReview, StoredProposal, StoredReview, ViewingCheckStatus } from "@/types/viewing-assessment"

// The single definition of "what state is each check in?". Used by the server summary and the review UI, so they
// cannot disagree. Pure; contains no checklist wording (ids only).
//
// Rules (deliberately conservative):
//  - Every check starts NOT_ASSESSED.
//  - An AI suggestion that nobody has reviewed NEVER changes a check's state. It is shown beside the check as an
//    unverified suggestion awaiting review.
//  - A reviewed suggestion changes the state only if a human ACCEPTED it (its proposed status) or EDITED it (the
//    status the human chose). A REJECTED suggestion changes nothing.
//  - OBSERVED means "a person agreed something was visible in the frame". It is never a pass, a certification, or an
//    input to any financial or governance decision.
//  - Several reviewed suggestions on one check combine by the most cautious state (precedence below).

export type CheckState = ViewingCheckStatus

/** Most cautious first. SPECIALIST_REVIEW outranks everything: a specialist is needed. */
export const STATE_PRECEDENCE: readonly CheckState[] = [
  "SPECIALIST_REVIEW",
  "CONCERN",
  "NOT_ACCESSIBLE",
  "OBSERVED",
  "NOT_APPLICABLE",
  "NOT_ASSESSED",
]

export type CheckItem = {
  proposal: StoredProposal
  currentReview: StoredReview | null
  reviewHistory: readonly StoredReview[]
  /** The state this suggestion contributes once a human has decided; null while pending or if rejected. */
  contributes: CheckState | null
}

export type CheckStateRow = {
  checkId: string
  state: CheckState
  /** "none": nothing reviewed. "human_reviewed": state comes from at least one accepted or edited suggestion. */
  basis: "none" | "human_reviewed"
  pendingCount: number
  rejectedCount: number
  needsSpecialist: boolean
  items: CheckItem[]
}

const contribution = (item: ProposalWithReview): CheckState | null => {
  const review = item.currentReview
  if (!review) return null
  if (review.disposition === "ACCEPTED") return item.proposal.status
  if (review.disposition === "EDITED") return review.editedStatus
  return null // REJECTED
}

export function buildCheckStates(checkIds: readonly string[], proposals: readonly ProposalWithReview[]): CheckStateRow[] {
  const byCheck = new Map<string, ProposalWithReview[]>()
  for (const item of proposals) {
    const list = byCheck.get(item.proposal.checkId) ?? []
    list.push(item)
    byCheck.set(item.proposal.checkId, list)
  }

  return checkIds.map((checkId) => {
    const items: CheckItem[] = (byCheck.get(checkId) ?? []).map((p) => ({
      proposal: p.proposal,
      currentReview: p.currentReview,
      reviewHistory: p.reviewHistory,
      contributes: contribution(p),
    }))
    const contributed = items.flatMap((i) => (i.contributes ? [i.contributes] : []))
    const state = STATE_PRECEDENCE.find((s) => contributed.includes(s)) ?? "NOT_ASSESSED"
    return {
      checkId,
      state,
      basis: contributed.length > 0 ? "human_reviewed" : "none",
      pendingCount: items.filter((i) => !i.currentReview).length,
      rejectedCount: items.filter((i) => i.currentReview?.disposition === "REJECTED").length,
      needsSpecialist: state === "SPECIALIST_REVIEW",
      items,
    }
  })
}

export type CheckFilter = "all" | "needs_review" | "concerns" | "specialist" | "reviewed" | "not_assessed" | "evidence_gaps"

export function filterChecks(rows: readonly CheckStateRow[], filter: CheckFilter): CheckStateRow[] {
  switch (filter) {
    case "needs_review":
      return rows.filter((r) => r.pendingCount > 0)
    case "concerns":
      return rows.filter((r) => r.state === "CONCERN")
    case "specialist":
      return rows.filter((r) => r.needsSpecialist)
    case "not_assessed":
      return rows.filter((r) => r.state === "NOT_ASSESSED")
    case "evidence_gaps":
      return rows.filter((r) => r.state === "NOT_ASSESSED" && r.items.length === 0)
    case "reviewed":
      return rows.filter((r) => r.basis === "human_reviewed")
    default:
      return [...rows]
  }
}

export function summariseChecks(rows: readonly CheckStateRow[]) {
  return {
    total: rows.length,
    notAssessed: rows.filter((r) => r.state === "NOT_ASSESSED").length,
    humanReviewed: rows.filter((r) => r.basis === "human_reviewed").length,
    awaitingReview: rows.filter((r) => r.pendingCount > 0).length,
    specialist: rows.filter((r) => r.needsSpecialist).length,
    concern: rows.filter((r) => r.state === "CONCERN").length,
    evidenceGaps: rows.filter((r) => r.state === "NOT_ASSESSED" && r.items.length === 0).length,
  }
}
