import { MEASUREMENT_SPEC } from "@/lib/data/measurement-spec"
import { getRefurbDeps } from "@/lib/refurb-integration/deps"
import { parseMeasurementRequest } from "@/lib/refurb-integration/measurements"
import { getMeasurementState, recordMeasurements } from "@/lib/refurb-integration/measurement-service"
import { assessmentNotFound, authorize, invalidInput, json, readJsonBody, serverError, type RouteContext } from "@/lib/viewing-assessment/route-support"

// GET  .../measurements   the current operator-entered measurements, every earlier version with what changed, how the
//                         engine quantities are known, and the list of recordable measurements.
// POST .../measurements   record a new version. Values are typed in by a person: there is no source called "video" and no
//                         field for a frame. A correction must be based on the version being corrected and say what was wrong.
// Recording measurements changes nothing else: no plan, proposal, Saved Deal or governance state.

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const state = await getMeasurementState(getRefurbDeps(), auth.dealId, auth.assessmentId as string)
    if (state === "not_found") return assessmentNotFound()
    const spec = Object.entries(MEASUREMENT_SPEC).map(([key, s]) => ({ key, label: s.label, unit: s.unit, usedByEngine: s.engine, perRoom: Boolean(s.perRoom), values: s.values ?? null }))
    return json({ success: true, ...state, spec }, 200)
  } catch (error) {
    return serverError("saved-deals.measurements.get", error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = parseMeasurementRequest(body.body)
    if (!parsed.ok) return invalidInput(parsed.errors)
    const outcome = await recordMeasurements(getRefurbDeps(), auth.dealId, auth.assessmentId as string, auth.actor, parsed.value)
    switch (outcome.status) {
      case "not_found":
        return assessmentNotFound()
      case "stale_base":
        return json({ success: false, error: "STALE_MEASUREMENTS", currentVersion: outcome.currentVersion }, 409)
      case "key_reused":
        return json({ success: false, error: "IDEMPOTENCY_KEY_REUSED" }, 409)
      default:
        return json({ success: true, replayed: outcome.replayed, measurementSet: outcome.record }, outcome.replayed ? 200 : 201)
    }
  } catch (error) {
    return serverError("saved-deals.measurements.record", error)
  }
}
