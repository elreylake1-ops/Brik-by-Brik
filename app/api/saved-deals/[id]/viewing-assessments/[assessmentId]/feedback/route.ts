import { pgViewingAssessmentRepository as repo } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import {
  assessmentNotFound,
  authorize,
  json,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"

// GET .../feedback  append-only feedback history (original prediction, human correction, outcomes)

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const feedback = await repo.listFeedback(auth.dealId, auth.assessmentId as string)
    if (!feedback) return assessmentNotFound()
    return json({ success: true, feedback }, 200)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.feedback", error)
  }
}
