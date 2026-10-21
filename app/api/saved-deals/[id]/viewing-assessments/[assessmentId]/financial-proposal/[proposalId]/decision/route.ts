import { getRefurbDeps } from "@/lib/refurb-integration/deps"
import { decideFinancialProposal } from "@/lib/refurb-integration/financial-proposal-service"
import { parseDecisionRequest } from "@/lib/refurb-integration/financial-request-validation"
import { authorize, invalidInput, json, readJsonBody, serverError, type RouteContext } from "@/lib/viewing-assessment/route-support"

// POST .../financial-proposal/:proposalId/decision
//   The authenticated operator's explicit decision about a PROPOSED adjustment: CONFIRMED or DECLINED. Recorded as an
//   append-only event naming the operator (taken from the verified session, never from the body).
//   Confirming approves a proposed adjustment ONLY. It does not update the Saved Deal, override Investor Shield, change
//   governance or the pipeline, or approve an investment.

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true, proposal: true })
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = parseDecisionRequest(body.body)
    if (!parsed.ok) return invalidInput(parsed.errors)

    const outcome = await decideFinancialProposal(getRefurbDeps(), auth.dealId, auth.assessmentId as string, auth.proposalId as string, auth.actor, parsed.value)
    switch (outcome.status) {
      case "not_found":
        return json({ success: false, error: "PROPOSAL_NOT_FOUND" }, 404)
      case "hash_mismatch":
        return json({ success: false, error: "PROPOSAL_CHANGED", message: "The proposal you reviewed is not the one you are deciding on. Reload it." }, 409)
      case "not_latest":
        return json({ success: false, error: "NOT_LATEST_PROPOSAL" }, 409)
      case "outdated":
        return json({ success: false, error: "PROPOSAL_OUTDATED", reasons: outcome.reasons }, 409)
      case "not_computable":
        return json({ success: false, error: "PROPOSAL_NOT_COMPUTABLE", blockedBy: outcome.blockedBy }, 409)
      case "acknowledgement_required":
        return invalidInput([`Acknowledge: ${outcome.missing.join(", ")}`])
      case "already_decided":
        return json({ success: false, error: "ALREADY_DECIDED", decision: outcome.event.decision }, 409)
      case "key_reused":
        return json({ success: false, error: "IDEMPOTENCY_KEY_REUSED" }, 409)
      default:
        return json({ success: true, replayed: outcome.replayed, decision: outcome.event, savedDealChanged: false }, outcome.replayed ? 200 : 201)
    }
  } catch (error) {
    return serverError("saved-deals.financial-proposal.decision", error)
  }
}
