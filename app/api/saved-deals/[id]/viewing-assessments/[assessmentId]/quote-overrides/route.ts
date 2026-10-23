import { getRefurbDeps } from "@/lib/refurb-integration/deps"
import {
  assessmentNotFound,
  authorize,
  invalidInput,
  json,
  readJsonBody,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"

// GET  .../quote-overrides  lists active and superseded contractor quote overrides for this assessment
// POST .../quote-overrides  human-reviewed operator approval of a contractor quote price mapped to a task
//
// Guaranteed rules:
// - Protected by requireSavedDealReadAccess / operator authorization (fail-closed)
// - Persisted in PostgreSQL brik_by_brik_engine.contractor_quote_overrides (isolated QA)
// - Every approved override attributes the operator, quote ref, approved amount, and timestamp
// - Any previous active approved quote for the same task is superseded, never deleted

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const deps = getRefurbDeps()
    if (!deps.quoteOverrides) return json({ success: true, overrides: [] }, 200)

    const overrides = await deps.quoteOverrides.list(auth.dealId, auth.assessmentId as string)
    return json({ success: true, overrides }, 200)
  } catch (error) {
    return serverError("saved-deals.quote-overrides.get", error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response

    const raw = body.body as Record<string, unknown>
    const errors: string[] = []

    const itemId = typeof raw.itemId === "string" ? raw.itemId.trim() : ""
    const taskId = typeof raw.taskId === "string" ? raw.taskId.trim() : ""
    const quoteRef = typeof raw.quoteRef === "string" ? raw.quoteRef.trim() : ""
    const quoteEvidenceId = typeof raw.quoteEvidenceId === "string" && raw.quoteEvidenceId.trim() ? raw.quoteEvidenceId.trim() : null
    const approvedAmount = typeof raw.approvedAmount === "number" ? raw.approvedAmount : Number(raw.approvedAmount)

    if (!itemId) errors.push("itemId is required")
    if (!taskId) errors.push("taskId is required")
    if (!quoteRef) errors.push("quoteRef (contractor/quote name) is required")
    if (!Number.isFinite(approvedAmount) || approvedAmount < 0) {
      errors.push("approvedAmount must be a non-negative number")
    }

    if (errors.length > 0) {
      return invalidInput(errors)
    }

    const deps = getRefurbDeps()
    if (!deps.quoteOverrides) {
      return json({ success: false, error: "Quote overrides repository not configured." }, 500)
    }

    const record = await deps.quoteOverrides.createAndApprove(auth.dealId, auth.assessmentId as string, {
      itemId,
      taskId,
      quoteEvidenceId,
      quoteRef,
      approvedAmount,
      approvedBy: auth.actor,
    })

    return json({ success: true, override: record }, 201)
  } catch (error) {
    return serverError("saved-deals.quote-overrides.create", error)
  }
}
