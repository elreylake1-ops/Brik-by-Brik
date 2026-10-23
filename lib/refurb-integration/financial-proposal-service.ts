import type { FinancialDecisionEvent, FinancialProposalRecord, FinancialState } from "@/types/refurb-financial"
import type { ConfirmedPlanRecord, PlanStaleReason } from "@/types/refurb-integration"
import type { DecisionRequest } from "./financial-request-validation"
import { authoritativeFigures, baselineFingerprint, buildFinancialProposal, canonicalJson, sha256 } from "./financial-proposal"
import { getProposalAndCurrent, type PlanDeps } from "./plan-service"
import { toCostOverrides } from "./quote-overrides-repository"

// Creating, reading and deciding financial-impact proposals.
//
// What a decision is: an auditable record that a named, authenticated operator approved (or declined) a PROPOSED
// adjustment. What it is not: a write to the Saved Deal, an Investor Shield or governance change, or an investment approval.
// The dependencies contain no way to do any of those (the Saved Deal is only read).

export type ProposalCreateOutcome =
  | { status: "not_found" }
  | { status: "no_plan" }
  | { status: "plan_stale"; reasons: PlanStaleReason[] }
  | { status: "ok"; replayed: boolean; proposal: FinancialProposalRecord }

async function currentPlanContext(deps: PlanDeps, dealId: string, assessmentId: string) {
  const base = await getProposalAndCurrent(deps, dealId, assessmentId)
  if (!base) return null
  const deal = await deps.getDeal(dealId)
  if (!deal) return null
  return { base, deal }
}

/** Builds a proposal from the CURRENT confirmed plan and the Saved Deal as it is now. Identical content is returned, not duplicated. */
export async function createFinancialProposal(deps: PlanDeps, dealId: string, assessmentId: string, actor: string, idempotencyKey: string): Promise<ProposalCreateOutcome> {
  const ctx = await currentPlanContext(deps, dealId, assessmentId)
  if (!ctx) return { status: "not_found" }
  const plan = ctx.base.current
  if (!plan) return { status: "no_plan" }
  if (plan.stale) return { status: "plan_stale", reasons: plan.staleReasons }

  const measurementSet = plan.record.measurementSetId ? await deps.measurements.getById(dealId, assessmentId, plan.record.measurementSetId) : null
  const activeOverrides = deps.quoteOverrides ? await deps.quoteOverrides.list(dealId, assessmentId, true) : []
  const costOverrides = toCostOverrides(activeOverrides)
  const built = buildFinancialProposal({ plan: plan.record, measurementSet, deal: ctx.deal, overrides: costOverrides })
  const created = await deps.proposals.createProposal({
    dealId,
    assessmentId,
    planId: plan.record.id,
    contentHash: built.contentHash,
    idempotencyKey,
    content: built.content,
    createdBy: actor,
    createdAt: deps.now().toISOString(),
  })
  return { status: "ok", replayed: created.status === "replayed", proposal: created.record }
}

/** Latest proposal, its decision, and whether it still matches the plan, findings, measurements and Saved Deal. */
export async function getFinancialState(deps: PlanDeps, dealId: string, assessmentId: string): Promise<FinancialState | "not_found"> {
  const ctx = await currentPlanContext(deps, dealId, assessmentId)
  if (!ctx) return "not_found"
  const proposals = await deps.proposals.listProposals(dealId, assessmentId)
  const latest = proposals[0] ?? null
  if (!latest) return { proposals, latest: null, decision: null, outdated: false, outdatedReasons: [], status: "NONE" }

  const decision = await deps.proposals.getDecision(dealId, assessmentId, latest.id)
  const reasons: string[] = []
  const plan = ctx.base.current
  if (!plan || plan.record.id !== latest.planId) {
    reasons.push("A newer scope confirmation has replaced the plan this proposal was built from.")
  } else {
    if (plan.stale) reasons.push(...plan.staleReasons.map((r) => (r === "FINDINGS_CHANGED" ? "Findings have been reviewed again since the scope was confirmed." : "Measurements have been recorded since the scope was confirmed.")))
    else {
      const measurementSet = plan.record.measurementSetId ? await deps.measurements.getById(dealId, assessmentId, plan.record.measurementSetId) : null
      const activeOverrides = deps.quoteOverrides ? await deps.quoteOverrides.list(dealId, assessmentId, true) : []
      const costOverrides = toCostOverrides(activeOverrides)
      const fresh = buildFinancialProposal({ plan: plan.record, measurementSet, deal: ctx.deal, overrides: costOverrides })
      if (fresh.contentHash !== latest.contentHash) reasons.push("The Saved Deal figures (or the engine's output for them) have changed since this proposal was made.")
    }
  }
  const outdated = reasons.length > 0
  const status = decision ? decision.decision : outdated ? "OUTDATED" : "PROPOSED"
  return { proposals, latest, decision, outdated, outdatedReasons: reasons, status }
}

export type DecisionOutcome =
  | { status: "not_found" }
  | { status: "hash_mismatch" }
  | { status: "not_latest" }
  | { status: "outdated"; reasons: string[] }
  | { status: "not_computable"; blockedBy: string[] }
  | { status: "acknowledgement_required"; missing: string[] }
  | { status: "already_decided"; event: FinancialDecisionEvent }
  | { status: "key_reused" }
  | { status: "ok"; replayed: boolean; event: FinancialDecisionEvent }

const hashDecision = (proposalId: string, r: DecisionRequest) => sha256(canonicalJson({ proposalId, decision: r.decision, proposalHash: r.proposalHash, note: r.note, acknowledge: r.acknowledge }))

/**
 * Records the operator's decision about a proposal. Confirming requires: the exact proposal the operator saw (hash), that it
 * is still the latest and still matches current data, that it can be computed, and explicit acknowledgement that this approves
 * a proposed adjustment only (not a write-back) plus any exclusions and unresolved quantities it lists.
 */
export async function decideFinancialProposal(deps: PlanDeps, dealId: string, assessmentId: string, proposalId: string, actor: string, request: DecisionRequest): Promise<DecisionOutcome> {
  const proposal = await deps.proposals.getProposal(dealId, assessmentId, proposalId)
  if (!proposal) return { status: "not_found" }
  const requestHash = hashDecision(proposalId, request)

  // Repeating a decision that was already recorded returns it, whatever has changed since.
  const existing = await deps.proposals.getDecision(dealId, assessmentId, proposalId)
  if (existing) {
    if (existing.idempotencyKey !== request.idempotencyKey) return { status: "already_decided", event: existing }
    return existing.requestHash === requestHash ? { status: "ok", replayed: true, event: existing } : { status: "key_reused" }
  }

  if (proposal.contentHash !== request.proposalHash) return { status: "hash_mismatch" }
  const state = await getFinancialState(deps, dealId, assessmentId)
  if (state === "not_found") return { status: "not_found" }
  if (state.latest?.id !== proposal.id) return { status: "not_latest" }

  const content = proposal.content
  if (request.decision === "CONFIRMED") {
    if (state.outdated) return { status: "outdated", reasons: state.outdatedReasons }
    if (content.completeness === "NOT_COMPUTABLE") return { status: "not_computable", blockedBy: content.blockedBy }
    const missing: string[] = []
    if (!request.acknowledge.notWriteBack) missing.push("notWriteBack")
    if (content.exclusions.length > 0 && !request.acknowledge.exclusions) missing.push("exclusions")
    if (content.unresolvedQuantities.length > 0 && !request.acknowledge.unresolvedQuantities) missing.push("unresolvedQuantities")
    if (missing.length) return { status: "acknowledgement_required", missing }
  }

  const deal = await deps.getDeal(dealId)
  if (!deal) return { status: "not_found" }
  const plan = (await deps.plans.list(dealId, assessmentId)).find((p: ConfirmedPlanRecord) => p.id === proposal.planId)
  const appended = await deps.proposals.appendDecision({
    dealId,
    assessmentId,
    proposalId,
    decision: request.decision,
    actor,
    note: request.note,
    idempotencyKey: request.idempotencyKey,
    requestHash,
    acknowledged: request.acknowledge,
    baselineFingerprint: baselineFingerprint(authoritativeFigures(deal)),
    sameOperatorAsScopeConfirmer: plan?.confirmedBy === actor,
    occurredAt: deps.now().toISOString(),
  })
  if (appended.status === "key_reused") return { status: "key_reused" }
  if (appended.status === "already_decided") return { status: "already_decided", event: appended.event }
  return { status: "ok", replayed: appended.status === "replayed", event: appended.event }
}
