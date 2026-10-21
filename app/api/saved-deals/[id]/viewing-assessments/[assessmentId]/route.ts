import { pgViewingAssessmentRepository as repo } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import {
  assessmentNotFound,
  authorize,
  json,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"
import { loadAssessmentDetail } from "@/lib/viewing-assessment/viewing-assessment-service"

// GET /api/saved-deals/:id/viewing-assessments/:assessmentId
// Assessment, evidence metadata, runs (processing status), proposals with review history, summary.

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const detail = await loadAssessmentDetail(repo, auth.dealId, auth.assessmentId as string)
    if (!detail) return assessmentNotFound()
    return json({ success: true, ...detail }, 200)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.detail", error)
  }
}
