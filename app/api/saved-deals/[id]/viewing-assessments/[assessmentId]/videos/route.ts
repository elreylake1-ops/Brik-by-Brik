import { randomUUID } from "node:crypto"
import { query } from "@/lib/db/postgres"
import {
  assessmentNotFound,
  authorize,
  json,
  readJsonBody,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"
import {
  countActiveOperatorJobs,
  createVideoJob,
  findRecentPendingJob,
  listVideoJobs,
} from "@/lib/viewing-assessment/video/video-jobs-repository"
import {
  inferExtensionFromContentType,
  toSafeVideoJob,
  validateDeclaredBytes,
  validateVideoContentType,
} from "@/lib/viewing-assessment/video/video-route-support"
import { getVideoStorageService } from "@/lib/viewing-assessment/video/video-storage-service"
import { MAX_ACTIVE_OPERATOR_JOBS, MAX_VIDEO_BYTES } from "@/types/video-jobs"

// POST /api/saved-deals/:id/viewing-assessments/:assessmentId/videos
// Authenticated upload intent endpoint: validates operator session, deal/viewing ownership,
// MIME type (MP4/MOV), size bounds (<= 500 MB), CSRF origin, concurrency limits, and issues path-bound upload token.
export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response

    const dealId = auth.dealId
    const viewingId = auth.assessmentId as string

    // Verify viewing assessment exists and belongs to this deal
    const viewingCheck = await query(
      `SELECT id FROM brik_by_brik_engine.viewing_assessments WHERE deal_id = $1 AND id = $2 LIMIT 1`,
      [dealId, viewingId]
    )
    if (viewingCheck.rows.length === 0) {
      return assessmentNotFound()
    }

    // CSRF and JSON body check
    const bodyResult = await readJsonBody(request)
    if (!bodyResult.ok) return bodyResult.response

    const body = bodyResult.body as Record<string, unknown>
    if (!body || typeof body !== "object") {
      return json({ success: false, error: "INVALID_REQUEST_BODY" }, 400)
    }

    // Validate MIME type
    const contentType = validateVideoContentType(body.contentType)
    if (!contentType) {
      return json(
        {
          success: false,
          error: "UNSUPPORTED_MEDIA_TYPE",
          message: "Only video/mp4, video/quicktime, and video/x-m4v containers are supported.",
        },
        415
      )
    }

    // Validate declared bytes
    const declaredBytes = validateDeclaredBytes(body.declaredBytes)
    if (!declaredBytes) {
      return json(
        {
          success: false,
          error: "INVALID_DECLARED_BYTES",
          message: `Video size must be an integer between 1 and ${MAX_VIDEO_BYTES} bytes (500 MB max).`,
        },
        400
      )
    }

    // Validate filename extension if provided
    if (typeof body.filename === "string") {
      const lowerName = body.filename.toLowerCase()
      if (!lowerName.endsWith(".mp4") && !lowerName.endsWith(".mov") && !lowerName.endsWith(".m4v")) {
        return json(
          {
            success: false,
            error: "INVALID_FILE_EXTENSION",
            message: "Filename must have .mp4, .mov, or .m4v extension.",
          },
          400
        )
      }
    }

    // Enforce per-operator active upload concurrency limit
    const activeJobs = await countActiveOperatorJobs(dealId, viewingId, auth.actor)
    if (activeJobs >= MAX_ACTIVE_OPERATOR_JOBS) {
      return json(
        {
          success: false,
          error: "TOO_MANY_ACTIVE_UPLOADS",
          message: `Limit of ${MAX_ACTIVE_OPERATOR_JOBS} active video processing jobs reached for this assessment.`,
        },
        429
      )
    }

    // Duplicate upload protection: check for recent pending intent with same signature
    const existingRecent = await findRecentPendingJob(dealId, viewingId, contentType, declaredBytes)
    if (existingRecent) {
      return json(
        {
          success: false,
          error: "DUPLICATE_UPLOAD_IN_PROGRESS",
          message: `An identical video upload intent is already pending confirmation (${existingRecent.id}).`,
          jobId: existingRecent.id,
        },
        409
      )
    }

    // Generate unique job ID and deterministic server-generated storage path
    const jobId = `vj_${randomUUID()}`
    const extension = inferExtensionFromContentType(contentType)
    const sourcePath = `video-evidence/${dealId}/${jobId}/original.${extension}`

    // Issue path-bound signed upload URL and token from storage provider
    const storage = getVideoStorageService()
    const uploadResult = await storage.createSignedUploadUrl("deal-evidence", sourcePath)

    // Persist video job intent in database
    const jobRecord = await createVideoJob({
      id: jobId,
      dealId,
      viewingId,
      createdBy: auth.actor,
      sourcePath,
      contentType,
      declaredBytes,
    })

    return json(
      {
        success: true,
        jobId: jobRecord.id,
        sourcePath: jobRecord.source_path,
        uploadEndpoint: uploadResult.uploadUrl,
        uploadToken: uploadResult.uploadToken,
        protocols: {
          standard: {
            uploadUrl: uploadResult.uploadUrl,
            method: "PUT",
          },
          resumable: {
            endpoint: uploadResult.resumableEndpoint,
            token: uploadResult.uploadToken,
            signatureHeader: "x-signature",
            signatureToken: uploadResult.uploadToken,
            bucket: "deal-evidence",
            objectName: jobRecord.source_path,
            chunkSize: 6 * 1024 * 1024,
            metadata: {
              bucketName: "deal-evidence",
              objectName: jobRecord.source_path,
              contentType: jobRecord.content_type,
            },
          },
        },
        maxBytes: MAX_VIDEO_BYTES,
        expiresAt: uploadResult.expiresAt,
      },
      201
    )
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.videos.intent", error)
  }
}

// GET /api/saved-deals/:id/viewing-assessments/:assessmentId/videos
// Authenticated endpoint listing safe video jobs for this viewing assessment.
export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response

    const dealId = auth.dealId
    const viewingId = auth.assessmentId as string

    // Verify viewing assessment exists
    const viewingCheck = await query(
      `SELECT id FROM brik_by_brik_engine.viewing_assessments WHERE deal_id = $1 AND id = $2 LIMIT 1`,
      [dealId, viewingId]
    )
    if (viewingCheck.rows.length === 0) {
      return assessmentNotFound()
    }

    const jobs = await listVideoJobs(dealId, viewingId)
    const safeJobs = await Promise.all(jobs.map((j) => toSafeVideoJob(j)))

    return json({ success: true, jobs: safeJobs }, 200)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.videos.list", error)
  }
}
