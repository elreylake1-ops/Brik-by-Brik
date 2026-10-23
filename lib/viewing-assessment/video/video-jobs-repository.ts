import { query } from "@/lib/db/postgres"
import type {
  VideoJobRecord,
  VideoFrameRecord,
  VideoContentType,
} from "@/types/video-jobs"

const SCHEMA = "brik_by_brik_engine"

export type CreateVideoJobParams = {
  id?: string
  dealId: string
  viewingId: string
  createdBy: string
  sourcePath: string
  contentType: VideoContentType
  declaredBytes: number
}

export async function createVideoJob(params: CreateVideoJobParams): Promise<VideoJobRecord> {
  const sql = `
    INSERT INTO ${SCHEMA}.video_jobs (
      id, deal_id, viewing_id, created_by, source_bucket, source_path,
      content_type, declared_bytes, state, original_retention_policy
    ) VALUES (
      COALESCE($1, 'vj_' || gen_random_uuid()::text),
      $2, $3, $4, 'deal-evidence', $5, $6, $7, 'upload_pending', 'RETAIN_PENDING_OWNER_POLICY'
    )
    RETURNING *
  `
  const res = await query<VideoJobRecord>(sql, [
    params.id ?? null,
    params.dealId,
    params.viewingId,
    params.createdBy,
    params.sourcePath,
    params.contentType,
    params.declaredBytes,
  ])
  return res.rows[0]
}

export async function countActiveOperatorJobs(
  dealId: string,
  viewingId: string,
  createdBy: string
): Promise<number> {
  const sql = `
    SELECT COUNT(*)::int AS count
    FROM ${SCHEMA}.video_jobs
    WHERE deal_id = $1
      AND viewing_id = $2
      AND created_by = $3
      AND state IN ('upload_pending', 'queued', 'processing')
  `
  const res = await query<{ count: number }>(sql, [dealId, viewingId, createdBy])
  return res.rows[0]?.count ?? 0
}

export async function findRecentPendingJob(
  dealId: string,
  viewingId: string,
  contentType: string,
  declaredBytes: number
): Promise<VideoJobRecord | null> {
  const sql = `
    SELECT *
    FROM ${SCHEMA}.video_jobs
    WHERE deal_id = $1
      AND viewing_id = $2
      AND content_type = $3
      AND declared_bytes = $4
      AND state = 'upload_pending'
      AND created_at > NOW() - INTERVAL '5 minutes'
    ORDER BY created_at DESC
    LIMIT 1
  `
  const res = await query<VideoJobRecord>(sql, [dealId, viewingId, contentType, declaredBytes])
  return res.rows[0] ?? null
}

export async function getVideoJob(
  dealId: string,
  viewingId: string,
  jobId: string
): Promise<VideoJobRecord | null> {
  const sql = `
    SELECT *
    FROM ${SCHEMA}.video_jobs
    WHERE deal_id = $1 AND viewing_id = $2 AND id = $3
    LIMIT 1
  `
  const res = await query<VideoJobRecord>(sql, [dealId, viewingId, jobId])
  return res.rows[0] ?? null
}

export async function listVideoJobs(
  dealId: string,
  viewingId: string
): Promise<VideoJobRecord[]> {
  const sql = `
    SELECT *
    FROM ${SCHEMA}.video_jobs
    WHERE deal_id = $1 AND viewing_id = $2
    ORDER BY created_at DESC
  `
  const res = await query<VideoJobRecord>(sql, [dealId, viewingId])
  return res.rows
}

export async function getVideoJobById(jobId: string): Promise<VideoJobRecord | null> {
  const sql = `
    SELECT *
    FROM ${SCHEMA}.video_jobs
    WHERE id = $1
    LIMIT 1
  `
  const res = await query<VideoJobRecord>(sql, [jobId])
  return res.rows[0] ?? null
}

export async function getVideoFrames(jobId: string): Promise<VideoFrameRecord[]> {
  const sql = `
    SELECT *
    FROM ${SCHEMA}.video_frames
    WHERE job_id = $1
    ORDER BY sequence_no ASC
  `
  const res = await query<VideoFrameRecord>(sql, [jobId])
  return res.rows
}

export const listVideoFramesByJobId = getVideoFrames

export async function getVideoFrame(jobId: string, frameId: string): Promise<VideoFrameRecord | null> {
  const sql = `
    SELECT *
    FROM ${SCHEMA}.video_frames
    WHERE job_id = $1 AND id = $2
    LIMIT 1
  `
  const res = await query<VideoFrameRecord>(sql, [jobId, frameId])
  return res.rows[0] ?? null
}

export async function confirmVideoJob(
  dealId: string,
  viewingId: string,
  jobId: string,
  observedBytes: number
): Promise<VideoJobRecord | null> {
  const sql = `
    UPDATE ${SCHEMA}.video_jobs
    SET state = 'queued',
        observed_bytes = $4,
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE deal_id = $1
      AND viewing_id = $2
      AND id = $3
      AND state = 'upload_pending'
    RETURNING *
  `
  const res = await query<VideoJobRecord>(sql, [dealId, viewingId, jobId, observedBytes])
  return res.rows[0] ?? null
}

export async function failVideoJob(
  dealId: string,
  viewingId: string,
  jobId: string,
  failureCode: string
): Promise<VideoJobRecord | null> {
  const sql = `
    UPDATE ${SCHEMA}.video_jobs
    SET state = 'failed',
        failure_code = $4,
        lease_until = NULL,
        finished_at = NOW(),
        updated_at = NOW()
    WHERE deal_id = $1
      AND viewing_id = $2
      AND id = $3
    RETURNING *
  `
  const res = await query<VideoJobRecord>(sql, [dealId, viewingId, jobId, failureCode])
  return res.rows[0] ?? null
}

export async function claimNextQueuedVideoJob(
  workerId: string,
  leaseDurationMinutes = 10,
  dealId?: string
): Promise<VideoJobRecord | null> {
  const params: unknown[] = [workerId, String(leaseDurationMinutes)]
  let dealFilter = ""
  if (dealId) {
    params.push(dealId)
    dealFilter = `AND deal_id = $${params.length}`
  }

  const sql = `
    UPDATE ${SCHEMA}.video_jobs
    SET state = 'processing',
        worker_id = $1,
        lease_until = NOW() + ($2 || ' minutes')::interval,
        attempt_count = attempt_count + 1,
        updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM ${SCHEMA}.video_jobs
      WHERE (state = 'queued' OR (state = 'processing' AND lease_until < NOW()))
        AND deletion_status = 'ACTIVE'
        AND attempt_count < 3
        ${dealFilter}
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `
  const res = await query<VideoJobRecord>(sql, params)
  return res.rows[0] ?? null
}

export async function completeVideoJob(
  jobId: string,
  params: {
    workerId?: string
    observedBytes: number
    sha256: string
    durationMs: number
    contactSheetPath: string
    processorVersion?: string
  }
): Promise<VideoJobRecord | null> {
  const queryParams: unknown[] = [
    jobId,
    params.observedBytes,
    params.sha256,
    params.durationMs,
    params.contactSheetPath,
    params.processorVersion ?? "v1.0.0-ffmpeg",
  ]
  let workerFence = ""
  if (params.workerId) {
    queryParams.push(params.workerId)
    workerFence = `AND worker_id = $${queryParams.length} AND (lease_until IS NULL OR lease_until > NOW())`
  }

  const sql = `
    UPDATE ${SCHEMA}.video_jobs
    SET state = 'ready_for_review',
        observed_bytes = $2,
        sha256 = $3,
        duration_ms = $4,
        contact_sheet_path = $5,
        processor_version = $6,
        finished_at = NOW(),
        lease_until = NULL,
        updated_at = NOW()
    WHERE id = $1 AND state = 'processing' ${workerFence}
    RETURNING *
  `
  const res = await query<VideoJobRecord>(sql, queryParams)
  return res.rows[0] ?? null
}

export async function markJobFailed(
  jobId: string,
  failureCode: string,
  workerId?: string
): Promise<VideoJobRecord | null> {
  const queryParams: unknown[] = [jobId, failureCode]
  let workerFence = ""
  if (workerId) {
    queryParams.push(workerId)
    workerFence = `AND (worker_id IS NULL OR worker_id = $${queryParams.length})`
  }
  const sql = `
    UPDATE ${SCHEMA}.video_jobs
    SET state = 'failed',
        failure_code = $2,
        lease_until = NULL,
        finished_at = NOW(),
        updated_at = NOW()
    WHERE id = $1 ${workerFence}
    RETURNING *
  `
  const res = await query<VideoJobRecord>(sql, queryParams)
  return res.rows[0] ?? null
}

export async function insertVideoFrames(
  frames: Array<{
    id: string
    jobId: string
    sequenceNo: number
    sourceTimeMs: number
    originalFramePath: string
    thumbnailPath: string
    sha256: string
    mimeType: string
    width: number
    height: number
    isReviewedEvidence?: boolean
  }>
): Promise<void> {
  for (const f of frames) {
    const sql = `
      INSERT INTO ${SCHEMA}.video_frames (
        id, job_id, sequence_no, source_time_ms, original_frame_path,
        thumbnail_path, sha256, mime_type, width, height, is_reviewed_evidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (job_id, sequence_no) DO UPDATE
      SET original_frame_path = EXCLUDED.original_frame_path,
          thumbnail_path = EXCLUDED.thumbnail_path,
          sha256 = EXCLUDED.sha256,
          source_time_ms = EXCLUDED.source_time_ms
      WHERE video_frames.is_reviewed_evidence = FALSE
    `
    await query(sql, [
      f.id,
      f.jobId,
      f.sequenceNo,
      f.sourceTimeMs,
      f.originalFramePath,
      f.thumbnailPath,
      f.sha256,
      f.mimeType,
      f.width,
      f.height,
      f.isReviewedEvidence ?? false,
    ])
  }
}

export async function releaseVideoJobLease(
  jobId: string,
  workerId: string
): Promise<void> {
  const sql = `
    UPDATE ${SCHEMA}.video_jobs
    SET state = 'queued',
        worker_id = NULL,
        lease_until = NULL,
        updated_at = NOW()
    WHERE id = $1 AND worker_id = $2 AND state = 'processing'
  `
  await query(sql, [jobId, workerId])
}
