import { loadBuilderPack } from "@/lib/refurb-integration/documents-service"
import { getRefurbDeps } from "@/lib/refurb-integration/deps"
import { assessmentNotFound, authorize, json, serverError, type RouteContext } from "@/lib/viewing-assessment/route-support"

// GET .../builder-pack   DRAFT builder quotation-request pack built from the CONFIRMED plan. Never contains our own estimate.

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const outcome = await loadBuilderPack(getRefurbDeps(), auth.dealId, auth.assessmentId as string)
    if (outcome.status === "not_found") return assessmentNotFound()
    if (outcome.status === "no_plan") return json({ success: false, error: "NO_CONFIRMED_PLAN" }, 409)
    return json({ success: true, pack: outcome.pack }, 200)
  } catch (error) {
    return serverError("saved-deals.builder-pack", error)
  }
}
