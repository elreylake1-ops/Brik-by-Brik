import { getRefurbDeps } from "@/lib/refurb-integration/deps"
import { previewPlan } from "@/lib/refurb-integration/plan-service"
import { parsePreviewRequest } from "@/lib/refurb-integration/plan-request-validation"
import { assessmentNotFound, authorize, invalidInput, json, readJsonBody, serverError, type RouteContext } from "@/lib/viewing-assessment/route-support"

// POST .../refurb-plan/preview   what the plan, schedule and financial impact would be for the chosen items. Writes nothing.
// The financial impact is the existing engine's result for this deal with and without the scope; it changes nothing.

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = parsePreviewRequest(body.body)
    if (!parsed.ok) return invalidInput(parsed.errors)
    const outcome = await previewPlan(getRefurbDeps(), auth.dealId, auth.assessmentId as string, parsed.value)
    if (outcome.status === "not_found") return assessmentNotFound()
    if (outcome.status === "invalid") return invalidInput(outcome.errors)
    if (outcome.status === "stale_measurements") return json({ success: false, error: "STALE_MEASUREMENTS", currentMeasurementSetId: outcome.currentMeasurementSetId }, 409)
    return json({ success: true, preview: true, selection: outcome.selection, proposal: outcome.proposal, computation: outcome.computation, basis: outcome.basis, current: outcome.current }, 200)
  } catch (error) {
    return serverError("saved-deals.refurb-plan.preview", error)
  }
}
