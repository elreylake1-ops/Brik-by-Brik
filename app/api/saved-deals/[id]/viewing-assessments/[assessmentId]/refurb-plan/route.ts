import { getRefurbDeps } from "@/lib/refurb-integration/deps"
import { confirmPlan, getProposalAndCurrent } from "@/lib/refurb-integration/plan-service"
import { parseConfirmRequest } from "@/lib/refurb-integration/plan-request-validation"
import { assessmentNotFound, authorize, invalidInput, json, readJsonBody, serverError, type RouteContext } from "@/lib/viewing-assessment/route-support"

// GET  .../refurb-plan   the proposed work (from HUMAN-REVIEWED findings only), what was excluded and why, and the
//                        current confirmed plan if there is one (with a stale flag).
// POST .../refurb-plan   the human decision: accept proposed items (optionally choosing a level), with property basics and
//                        deal assumptions. The server recomputes everything from stored data; the body supplies no cost,
//                        verdict, reviewer or governance value. Requires the fingerprint of the proposal that was reviewed.
// Neither changes the Saved Deal, Investor Shield, governance or pipeline state.

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const base = await getProposalAndCurrent(getRefurbDeps(), auth.dealId, auth.assessmentId as string)
    if (!base) return assessmentNotFound()
    return json({ success: true, proposal: base.proposal, current: base.current }, 200)
  } catch (error) {
    return serverError("saved-deals.refurb-plan.get", error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = parseConfirmRequest(body.body)
    if (!parsed.ok) return invalidInput(parsed.errors)

    const outcome = await confirmPlan(getRefurbDeps(), auth.dealId, auth.assessmentId as string, auth.actor, parsed.value)
    switch (outcome.status) {
      case "not_found":
        return assessmentNotFound()
      case "invalid":
        return invalidInput(outcome.errors)
      case "stale":
        return json({ success: false, error: "STALE_FINDINGS", currentFingerprint: outcome.currentFingerprint }, 409)
      case "stale_measurements":
        return json({ success: false, error: "STALE_MEASUREMENTS", currentMeasurementSetId: outcome.currentMeasurementSetId }, 409)
      case "key_reused":
        return json({ success: false, error: "IDEMPOTENCY_KEY_REUSED" }, 409)
      default:
        return json({ success: true, replayed: outcome.replayed, plan: outcome.record }, outcome.replayed ? 200 : 201)
    }
  } catch (error) {
    return serverError("saved-deals.refurb-plan.confirm", error)
  }
}
