import {
  authorize,
  json,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"
import {
  getVideoFrames,
  getVideoJob,
} from "@/lib/viewing-assessment/video/video-jobs-repository"
import { toSafeVideoJob } from "@/lib/viewing-assessment/video/video-route-support"

// GET /api/saved-deals/:id/viewing-assessments/:assessmentId/videos/:jobId
// Authenticated job status endpoint: returns safe job metadata, progress information,
// frame metadata and authorized signed frame URLs when ready. Masks sensitive diagnostics.
export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true, job: true })
    if (!auth.ok) return auth.response

    const dealId = auth.dealId
    const viewingId = auth.assessmentId as string
    const jobId = auth.jobId as string

    // Retrieve video job and verify deal/viewing association
    const job = await getVideoJob(dealId, viewingId, jobId)
    if (!job) {
      return json({ success: false, error: "VIDEO_JOB_NOT_FOUND" }, 404)
    }

    // Retrieve frames if job has finished extracting or ready for review
    const frames = await getVideoFrames(jobId)

    // Convert to sanitized client response with short-lived signed URLs
    const safeJob = await toSafeVideoJob(job, frames)

    return json({ success: true, job: safeJob }, 200)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.videos.status", error)
  }
}
