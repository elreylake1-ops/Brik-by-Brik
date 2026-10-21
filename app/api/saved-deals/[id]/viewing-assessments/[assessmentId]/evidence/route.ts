import { pgViewingAssessmentRepository as repo } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import { MAX_CLIPS_PER_ASSESSMENT, MAX_FRAMES_PER_ASSESSMENT } from "@/lib/viewing-assessment/capture-limits"
import { parseAddEvidence } from "@/lib/viewing-assessment/request-validation"
import {
  assessmentNotFound,
  authorize,
  invalidInput,
  json,
  readJsonBody,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"

// POST /api/saved-deals/:id/viewing-assessments/:assessmentId/evidence
// Registers clip METADATA and frame timestamps only. No video bytes, no storage keys: the client
// cannot supply a storage location and none is ever returned.

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = parseAddEvidence(body.body)
    if (!parsed.ok) return invalidInput(parsed.errors)

    // Bound growth per assessment (frames and clips), whatever number of requests are made.
    const existing = await repo.getEvidenceContext(auth.dealId, auth.assessmentId as string)
    if (!existing) return assessmentNotFound()
    if (existing.assets.length + 1 > MAX_CLIPS_PER_ASSESSMENT) {
      return json({ success: false, error: "TOO_MANY_CLIPS", limit: MAX_CLIPS_PER_ASSESSMENT }, 422)
    }
    if (existing.evidence.length + parsed.value.frames.length > MAX_FRAMES_PER_ASSESSMENT) {
      return json({ success: false, error: "TOO_MANY_FRAMES", limit: MAX_FRAMES_PER_ASSESSMENT }, 422)
    }

    const result = await repo.addAsset(auth.dealId, auth.assessmentId as string, {
      asset: parsed.value.clip,
      frames: parsed.value.frames,
      createdBy: auth.actor,
    })
    if (!result) return assessmentNotFound()
    if (result.status === "duplicate_asset") {
      return json({ success: false, error: "DUPLICATE_ASSET" }, 409)
    }
    return json({ success: true, asset: result.asset, evidence: result.evidence }, 201)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.evidence", error)
  }
}
