import { VIEWING_CHECKLIST_VERSION } from "@/lib/viewing-assessment/checklist-v1"
import { pgViewingAssessmentRepository as repo } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import { parseCreateAssessment } from "@/lib/viewing-assessment/request-validation"
import {
  authorize,
  invalidInput,
  json,
  readJsonBody,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"

// GET  /api/saved-deals/:id/viewing-assessments  list assessments of this deal
// POST /api/saved-deals/:id/viewing-assessments  create (idempotent on idempotencyKey)

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context)
    if (!auth.ok) return auth.response
    const assessments = await repo.listAssessments(auth.dealId)
    return json({ success: true, assessments }, 200)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.list", error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context)
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = parseCreateAssessment(body.body)
    if (!parsed.ok) return invalidInput(parsed.errors)

    const { record, created } = await repo.createAssessment({
      dealId: auth.dealId,
      idempotencyKey: parsed.value.idempotencyKey,
      checklistVersion: VIEWING_CHECKLIST_VERSION,
      createdBy: auth.actor,
    })
    return json({ success: true, assessment: record, replayed: !created }, created ? 201 : 200)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.create", error)
  }
}
