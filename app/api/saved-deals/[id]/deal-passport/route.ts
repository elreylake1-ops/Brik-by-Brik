import { loadDealPassport } from "@/lib/refurb-integration/documents-service"
import { getRefurbDeps } from "@/lib/refurb-integration/deps"
import { authorize, invalidInput, json, serverError, type RouteContext } from "@/lib/viewing-assessment/route-support"

// GET /api/saved-deals/:id/deal-passport[?assessmentId=...]   DRAFT Deal Passport. Read-only.

const ID = /^[A-Za-z0-9:_.-]{1,150}$/

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context)
    if (!auth.ok) return auth.response
    const assessmentId = new URL(request.url).searchParams.get("assessmentId")
    if (assessmentId !== null && !ID.test(assessmentId)) return invalidInput(["assessmentId is invalid"])
    const outcome = await loadDealPassport(getRefurbDeps(), auth.dealId, assessmentId)
    if (outcome.status === "not_found") return json({ success: false, error: "NOT_FOUND" }, 404)
    return json({ success: true, passport: outcome.passport }, 200)
  } catch (error) {
    return serverError("saved-deals.deal-passport", error)
  }
}
