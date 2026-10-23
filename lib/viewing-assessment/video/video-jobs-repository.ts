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
        updated_at = NOW()
    WHERE deal_id = $1
      AND viewing_id = $2
      AND id = $3
    RETURNING *
  `
  const res = await query<VideoJobRecord>(sql, [dealId, viewingId, jobId, failureCode])
  return res.rows[0] ?? null
}
