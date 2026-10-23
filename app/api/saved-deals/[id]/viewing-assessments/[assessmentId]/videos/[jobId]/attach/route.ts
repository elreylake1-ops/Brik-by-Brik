import { randomUUID } from "node:crypto"
import type { PoolClient } from "pg"
import { query, withTransaction } from "@/lib/db/postgres"
import {
  assessmentNotFound,
  authorize,
  invalidInput,
  json,
  readJsonBody,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"
import { getVideoFrame, getVideoJob } from "@/lib/viewing-assessment/video/video-jobs-repository"

const SCHEMA = "brik_by_brik_engine"
const CHECK_ID_REGEX = /^(C(0[1-9]|[1-3][0-9]|4[0-5])|V(0[1-9]|1[0-3]))$/
const ALLOWED_STATUSES = ["OBSERVED", "CONCERN", "SPECIALIST_REVIEW"] as const

type AttachFrameBody = {
  frameId: string
  checkId: string
  status?: (typeof ALLOWED_STATUSES)[number]
  observation?: string
  room?: string
}

// POST /api/saved-deals/:id/viewing-assessments/:assessmentId/videos/:jobId/attach
// Attaches an extracted video frame to a C01–C45 or V01–V13 checklist item as an unreviewed suggestion.
// Treated as nonauthoritative/suggested: requires explicit human operator review in the checklist.
// Does NOT touch financial calculations, approved costs, True MAO, or Investor Shield.
export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true, job: true })
    if (!auth.ok) return auth.response

    const dealId = auth.dealId
    const viewingId = auth.assessmentId as string
    const jobId = auth.jobId as string

    // 1. Verify viewing assessment exists for this deal
    const viewingCheck = await query(
      `SELECT id FROM ${SCHEMA}.viewing_assessments WHERE deal_id = $1 AND id = $2 LIMIT 1`,
      [dealId, viewingId]
    )
    if (viewingCheck.rows.length === 0) {
      return assessmentNotFound()
    }

    // 2. Read and validate request body
    const bodyResult = await readJsonBody(request)
    if (!bodyResult.ok) return bodyResult.response

    const body = bodyResult.body as Partial<AttachFrameBody>
    if (!body || typeof body !== "object") {
      return json({ success: false, error: "INVALID_REQUEST_BODY" }, 400)
    }

    const { frameId, checkId } = body
    if (typeof frameId !== "string" || !frameId.trim()) {
      return invalidInput(["frameId is required"])
    }
    if (typeof checkId !== "string" || !CHECK_ID_REGEX.test(checkId.trim())) {
      return invalidInput([`checkId "${checkId}" is not a valid C01-C45 or V01-V13 checklist check`])
    }

    const cleanCheckId = checkId.trim()
    const cleanStatus = (body.status && ALLOWED_STATUSES.includes(body.status) ? body.status : "OBSERVED") as (typeof ALLOWED_STATUSES)[number]
    const cleanObservation = typeof body.observation === "string" && body.observation.trim()
      ? body.observation.trim().slice(0, 1000)
      : ""
    const cleanRoom = typeof body.room === "string" && body.room.trim()
      ? body.room.trim().slice(0, 100)
      : null

    // 3. Verify video job belongs to this deal and assessment and is ready_for_review
    const job = await getVideoJob(dealId, viewingId, jobId)
    if (!job) {
      return json({ success: false, error: "VIDEO_JOB_NOT_FOUND" }, 404)
    }
    if (job.state !== "ready_for_review") {
      return json(
        {
          success: false,
          error: "JOB_NOT_READY",
          message: `Cannot attach frames from job in state "${job.state}". Video extraction must complete first.`,
        },
        409
      )
    }

    // 4. Retrieve specific frame
    const frame = await getVideoFrame(jobId, frameId)
    if (!frame) {
      return json({ success: false, error: "FRAME_NOT_FOUND" }, 404)
    }

    // 5. Connect to Viewing Assessment evidence & proposal schema in a single transaction
    const result = await withTransaction(async (client: PoolClient) => {
      // 5a. Promote frame to reviewed evidence status to protect from future overwrite
      await client.query(
        `UPDATE ${SCHEMA}.video_frames SET is_reviewed_evidence = TRUE WHERE id = $1`,
        [frame.id]
      )

      // 5b. Ensure parent video asset metadata exists in viewing_assets
      const assetId = `va_${job.id}`
      const durationSeconds = Math.max(1, (job.duration_ms ?? 1000) / 1000)
      const assetFilename = `walkthrough_${job.id.slice(0, 8)}.${job.content_type === "video/quicktime" ? "mov" : "mp4"}`

      await client.query(
        `INSERT INTO ${SCHEMA}.viewing_assets (
           id, assessment_id, filename, mime_type, size_bytes, duration_seconds,
           content_sha256, storage_key, source, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DECLARED_METADATA', $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          assetId,
          viewingId,
          assetFilename,
          job.content_type,
          job.observed_bytes ?? job.declared_bytes,
          durationSeconds,
          job.sha256,
          job.source_path,
          auth.actor,
        ]
      )

      // 5c. Ensure evidence frame reference exists in viewing_evidence
      const evidenceId = `ev_${frame.id}`
      const timestampSeconds = frame.source_time_ms / 1000

      await client.query(
        `INSERT INTO ${SCHEMA}.viewing_evidence (
           id, assessment_id, asset_id, timestamp_seconds, room, ordinal
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          evidenceId,
          viewingId,
          assetId,
          timestampSeconds,
          cleanRoom,
          frame.sequence_no,
        ]
      )

      // 5d. Ensure an analysis run entry exists for the video worker
      const runId = `run_${job.id}`
      const idempotencyKey = `video-worker-${job.id}`
      const processorVersion = job.processor_version || "v1.0.0-ffmpeg"

      const runRes = await client.query(
        `INSERT INTO ${SCHEMA}.viewing_analysis_runs (
           id, assessment_id, idempotency_key, provider, model_version, status, created_by
         ) VALUES ($1, $2, $3, 'mock', $4, 'READY_FOR_REVIEW', $5)
         ON CONFLICT (assessment_id, idempotency_key) DO UPDATE
         SET updated_at = NOW()
         RETURNING id`,
        [runId, viewingId, idempotencyKey, processorVersion, auth.actor]
      )
      const activeRunId = runRes.rows[0].id

      // 5f. Count existing proposals in this run to set ordinal
      const countRes = await client.query(
        `SELECT COUNT(*)::int AS count FROM ${SCHEMA}.viewing_proposals WHERE run_id = $1`,
        [activeRunId]
      )
      const ordinal = countRes.rows[0]?.count ?? 0

      // 5g. Format final observation note
      const minutes = Math.floor(frame.source_time_ms / 60000)
      const seconds = Math.floor((frame.source_time_ms % 60000) / 1000)
      const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      const finalObservation = cleanObservation || `Walkthrough video observation at ${timeStr} (Frame ${frame.sequence_no}).`

      const suggestedWork =
        cleanStatus === "CONCERN"
          ? "Inspection and works required; scope to be confirmed by contractor."
          : cleanStatus === "SPECIALIST_REVIEW"
          ? "Specialist survey or structural report recommended."
          : null

      // 5h. Insert proposal (verification = 'UNVERIFIED', nonauthoritative until reviewed by human)
      const proposalId = `prop_${randomUUID()}`
      await client.query(
        `INSERT INTO ${SCHEMA}.viewing_proposals (
           id, assessment_id, run_id, check_id, status, observation,
           evidence_ids, room, confidence, suggested_work, model_version, verification, ordinal
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'high', $9, $10, 'UNVERIFIED', $11)`,
        [
          proposalId,
          viewingId,
          activeRunId,
          cleanCheckId,
          cleanStatus,
          finalObservation,
          [evidenceId],
          cleanRoom,
          suggestedWork,
          processorVersion,
          ordinal,
        ]
      )

      return {
        proposalId,
        evidenceId,
        checkId: cleanCheckId,
        frameId: frame.id,
      }
    })

    return json(
      {
        success: true,
        proposalId: result.proposalId,
        evidenceId: result.evidenceId,
        checkId: result.checkId,
        frameId: result.frameId,
        message: "Video frame successfully attached to checklist as an unreviewed suggestion.",
      },
      201
    )
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.videos.attach-frame", error)
  }
}
