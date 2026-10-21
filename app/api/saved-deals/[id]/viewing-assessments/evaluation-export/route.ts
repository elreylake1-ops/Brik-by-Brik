import { pgViewingAssessmentRepository as repo } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import { authorize, json, serverError, type RouteContext } from "@/lib/viewing-assessment/route-support"
import { exportEvaluationDataset } from "@/lib/viewing-assessment/viewing-assessment-service"

// GET /api/saved-deals/:id/viewing-assessments/evaluation-export[?includeSimulated=true]
//
// Read-only structured dataset of this deal's AI predictions joined to the human decisions and actual outcomes
// recorded against them, with model version, prompt version, usage and exact evidence references. It contains no
// reviewer identities, storage keys or image bytes, and excludes simulated (fixture) predictions unless asked, so
// test data cannot contaminate a model evaluation. Exporting never changes anything and nothing here trains a model.
// (A static segment: it takes precedence over the dynamic [assessmentId] route.)

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context)
    if (!auth.ok) return auth.response
    const includeSimulated = new URL(request.url).searchParams.get("includeSimulated") === "true"
    const dataset = await exportEvaluationDataset(repo, { dealId: auth.dealId, includeSimulated })
    return json({ success: true, dataset }, 200)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.evaluation-export", error)
  }
}
