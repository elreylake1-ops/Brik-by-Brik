import { getRefurbDeps } from "@/lib/refurb-integration/deps"
import { createFinancialProposal, getFinancialState } from "@/lib/refurb-integration/financial-proposal-service"
import { parseProposalRequest } from "@/lib/refurb-integration/financial-request-validation"
import { assessmentNotFound, authorize, invalidInput, json, readJsonBody, serverError, type RouteContext } from "@/lib/viewing-assessment/route-support"

// GET  .../financial-proposal   the latest financial-impact PROPOSAL, any operator decision on it, whether it is out of date,
//                               and the history of proposals.
// POST .../financial-proposal   make a proposal from the current confirmed scope. Every figure is the existing engine's;
//                               the request carries no figure. Identical content is returned, not duplicated.
// A proposal never changes the Saved Deal, Investor Shield, governance or pipeline state.

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const state = await getFinancialState(getRefurbDeps(), auth.dealId, auth.assessmentId as string)
    if (state === "not_found") return assessmentNotFound()
    return json({ success: true, ...state }, 200)
  } catch (error) {
    return serverError("saved-deals.financial-proposal.get", error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = parseProposalRequest(body.body)
    if (!parsed.ok) return invalidInput(parsed.errors)
    const outcome = await createFinancialProposal(getRefurbDeps(), auth.dealId, auth.assessmentId as string, auth.actor, parsed.value.idempotencyKey)
    switch (outcome.status) {
      case "not_found":
        return assessmentNotFound()
      case "no_plan":
        return json({ success: false, error: "NO_CONFIRMED_PLAN" }, 409)
      case "plan_stale":
        return json({ success: false, error: "PLAN_STALE", reasons: outcome.reasons }, 409)
      default:
        return json({ success: true, replayed: outcome.replayed, proposal: outcome.proposal }, outcome.replayed ? 200 : 201)
    }
  } catch (error) {
    return serverError("saved-deals.financial-proposal.create", error)
  }
}
