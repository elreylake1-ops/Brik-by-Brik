import {
  authorize,
  json,
  readJsonBody,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"
import {
  confirmVideoJob,
  getVideoJob,
} from "@/lib/viewing-assessment/video/video-jobs-repository"
import { getVideoStorageService } from "@/lib/viewing-assessment/video/video-storage-service"
import { MAX_VIDEO_BYTES } from "@/types/video-jobs"

// POST /api/saved-deals/:id/viewing-assessments/:assessmentId/videos/:jobId/confirm
// Authenticated upload confirmation endpoint: verifies server-side object existence,
// actual byte size matching declared bytes, legal state transitions, and queues job for worker.
export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true, job: true })
    if (!auth.ok) return auth.response

    const dealId = auth.dealId
    const viewingId = auth.assessmentId as string
    const jobId = auth.jobId as string

    // CSRF and JSON body check
    const bodyResult = await readJsonBody(request)
    if (!bodyResult.ok) return bodyResult.response

    // Retrieve video job and verify deal/viewing association
    const job = await getVideoJob(dealId, viewingId, jobId)
    if (!job) {
      return json({ success: false, error: "VIDEO_JOB_NOT_FOUND" }, 404)
    }

    // Check cancellation
    if (job.deletion_status && job.deletion_status.toUpperCase() !== "ACTIVE") {
      return json(
        {
          success: false,
          error: "JOB_CANCELLED",
          message: `Cannot confirm video job that has been marked as '${job.deletion_status}'.`,
        },
        410
      )
    }

    // Application-level expiration check (independent of storage token lifetime)
    const MAX_CONFIRMATION_WINDOW_MS = 7_200_000 // 2 hours
    const ageMs = Date.now() - new Date(job.created_at).getTime()
    if (ageMs > MAX_CONFIRMATION_WINDOW_MS) {
      return json(
        {
          success: false,
          error: "UPLOAD_INTENT_EXPIRED",
          message: "Upload intent has expired. Please create a new upload intent.",
        },
        410
      )
    }

    // Verify legal state transitions (reject duplicate confirmation)
    if (job.state !== "upload_pending") {
      if (job.state === "queued" || job.state === "processing" || job.state === "ready_for_review") {
        return json(
          {
            success: false,
            error: "ALREADY_CONFIRMED",
            message: `Video job ${jobId} has already been confirmed and is in state '${job.state}'.`,
          },
          409
        )
      }
      return json(
        {
          success: false,
          error: "INVALID_JOB_STATE",
          message: `Cannot confirm video job in state '${job.state}'.`,
        },
        400
      )
    }

    // Server-side verification of storage object (never trust client claims)
    const storage = getVideoStorageService()
    const metadata = await storage.getObjectMetadata(job.source_bucket, job.source_path)

    if (!metadata) {
      return json(
        {
          success: false,
          error: "STORAGE_OBJECT_NOT_FOUND",
          message: "Uploaded video file not found in private storage. Upload may still be in progress.",
        },
        400
      )
    }

    // Strict size verification against declared bytes
    const actualBytes = metadata.sizeBytes
    const declaredBytes = Number(job.declared_bytes)

    if (actualBytes !== declaredBytes) {
      return json(
        {
          success: false,
          error: "SIZE_MISMATCH",
          message: `Uploaded file size (${actualBytes} bytes) does not match declared size (${declaredBytes} bytes).`,
        },
        400
      )
    }

    if (actualBytes <= 0 || actualBytes > MAX_VIDEO_BYTES) {
      return json(
        {
          success: false,
          error: "INVALID_OBJECT_SIZE",
          message: `Uploaded file size (${actualBytes} bytes) is outside valid limits.`,
        },
        400
      )
    }

    // Transition state from upload_pending to queued
    const confirmedJob = await confirmVideoJob(dealId, viewingId, jobId, actualBytes)
    if (!confirmedJob) {
      return json({ success: false, error: "CONFIRMATION_FAILED" }, 409)
    }

    return json(
      {
        success: true,
        jobId: confirmedJob.id,
        state: "queued",
        observedBytes: actualBytes,
        confirmedAt: confirmedJob.confirmed_at,
      },
      200
    )
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.videos.confirm", error)
  }
}
