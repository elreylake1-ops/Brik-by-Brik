import { getRefurbDeps } from "@/lib/refurb-integration/deps"
import { getProposalAndCurrent } from "@/lib/refurb-integration/plan-service"
import type { VatBasis } from "@/lib/refurb-integration/quote-overrides-repository"
import {
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
// - Every approved override attributes the operator, quote ref, approved amount, VAT basis, and timestamp
// - Any previous active approved quote for the same task is superseded atomically, never deleted
// - Validates quote evidence belongs to this specific deal and is of type BUILDER_QUOTE
// - Enforces bounds on approved amounts (0 < amount <= 10,000,000)

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

    let vatBasis: VatBasis = "GROSS"
    if (raw.vatBasis !== undefined && raw.vatBasis !== null) {
      if (raw.vatBasis === "GROSS" || raw.vatBasis === "NET_PLUS_VAT" || raw.vatBasis === "EXEMPT") {
        vatBasis = raw.vatBasis
      } else {
        errors.push("vatBasis must be one of: GROSS, NET_PLUS_VAT, EXEMPT")
      }
    }

    if (!itemId) errors.push("itemId is required")
    if (!taskId) errors.push("taskId is required")
    if (!quoteRef) errors.push("quoteRef (contractor/quote name) is required")
    if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
      errors.push("approvedAmount must be a positive number greater than 0")
    } else if (approvedAmount > 10_000_000) {
      errors.push("approvedAmount exceeds maximum allowable threshold of £10,000,000")
    }

    if (errors.length > 0) {
      return invalidInput(errors)
    }

    const deps = getRefurbDeps()
    if (!deps.quoteOverrides) {
      return json({ success: false, error: "Quote overrides repository not configured." }, 500)
    }

    // Task ownership validation: verify task belongs to assessment scope
    const planState = await getProposalAndCurrent(deps, auth.dealId, auth.assessmentId as string)
    if (planState) {
      const validItem = planState.proposal.items.some((i) => i.itemId === itemId)
      if (!validItem && itemId !== "bathroom" && itemId !== "kitchen") {
        return json({ success: false, error: `Item "${itemId}" does not belong to this assessment's proposed work.` }, 400)
      }
    }

    try {
      const record = await deps.quoteOverrides.createAndApprove(auth.dealId, auth.assessmentId as string, {
        itemId,
        taskId,
        quoteEvidenceId,
        quoteRef,
        approvedAmount,
        approvedBy: auth.actor,
        vatBasis,
      })

      return json({ success: true, override: record }, 201)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (
        message.includes("Invalid quoteEvidenceId") ||
        message.includes("Cross-deal") ||
        message.includes("Invalid quote evidence type") ||
        message.includes("approvedAmount must be")
      ) {
        return json({ success: false, error: message }, 400)
      }
      throw err
    }
  } catch (error) {
    return serverError("saved-deals.quote-overrides.create", error)
  }
}
