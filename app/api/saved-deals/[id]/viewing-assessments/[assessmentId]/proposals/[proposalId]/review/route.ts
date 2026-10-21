import { pgViewingAssessmentRepository as repo } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import { parseReview } from "@/lib/viewing-assessment/request-validation"
import {
  authorize,
  invalidInput,
  json,
  readJsonBody,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"
import { reviewProposalAction } from "@/lib/viewing-assessment/viewing-assessment-service"

// POST .../proposals/:proposalId/review  human accept / edit / reject
// Reviewer identity and time are server-derived. expectedRevision gives optimistic concurrency
// (0 for a first review). The original AI proposal is never modified; each review is a new revision.

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true, proposal: true })
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = parseReview(body.body)
    if (!parsed.ok) return invalidInput(parsed.errors)

    const outcome = await reviewProposalAction(repo, {
      dealId: auth.dealId,
      assessmentId: auth.assessmentId as string,
      proposalId: auth.proposalId as string,
      body: parsed.value,
      reviewerId: auth.actor,
    })
    if (outcome.status === "not_found") {
      return json({ success: false, error: "PROPOSAL_NOT_FOUND" }, 404)
    }
    if (outcome.status === "stale_revision") {
      return json({ success: false, error: "STALE_REVISION" }, 409)
    }
    return json({ success: true, item: outcome.item }, 201)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.review", error)
  }
}
