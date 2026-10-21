import { pgViewingAssessmentRepository as repo } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import { parseOutcome } from "@/lib/viewing-assessment/request-validation"
import {
  authorize,
  invalidInput,
  json,
  readJsonBody,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"
import { recordOutcomeAction } from "@/lib/viewing-assessment/viewing-assessment-service"

// POST .../proposals/:proposalId/outcome   record what ACTUALLY turned out (survey, quote, completed works, ...)
//
// Append-only: every call adds a record; nothing is edited or deleted. The record snapshots the original AI
// prediction and the latest human decision/correction, so all three can be compared later. The recorder's identity
// comes from the verified token, never from the body. This changes no proposal, no review, no check state, no
// Investor Shield or governance decision, and no financial figure: it is evaluation evidence only.

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true, proposal: true })
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = parseOutcome(body.body)
    if (!parsed.ok) return invalidInput(parsed.errors)

    const outcome = await recordOutcomeAction(repo, {
      dealId: auth.dealId,
      assessmentId: auth.assessmentId as string,
      proposalId: auth.proposalId as string,
      input: parsed.value,
      recordedBy: auth.actor,
    })
    if (outcome.status === "not_found") return json({ success: false, error: "PROPOSAL_NOT_FOUND" }, 404)
    return json({ success: true, outcome: outcome.entry }, 201)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.outcome", error)
  }
}
