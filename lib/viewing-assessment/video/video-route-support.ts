import {
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_VIDEO_BYTES,
  type VideoContentType,
  type VideoJobRecord,
  type VideoFrameRecord,
  type SafeVideoJob,
  type SafeVideoFrame,
} from "@/types/video-jobs"
import { getVideoStorageService } from "./video-storage-service"

export function validateVideoContentType(type: unknown): VideoContentType | null {
  if (typeof type !== "string") return null
  const clean = type.toLowerCase().trim()
  if (ALLOWED_VIDEO_MIME_TYPES.includes(clean as VideoContentType)) {
    return clean as VideoContentType
  }
  return null
}

export function validateDeclaredBytes(bytes: unknown): number | null {
  if (typeof bytes !== "number" || !Number.isInteger(bytes)) return null
  if (bytes <= 0 || bytes > MAX_VIDEO_BYTES) return null
  return bytes
}

export function inferExtensionFromContentType(contentType: VideoContentType): "mp4" | "mov" | "m4v" {
  switch (contentType) {
    case "video/mp4":
      return "mp4"
    case "video/quicktime":
      return "mov"
    case "video/x-m4v":
      return "m4v"
  }
}

export async function toSafeVideoJob(
  job: VideoJobRecord,
  frames?: VideoFrameRecord[]
): Promise<SafeVideoJob> {
  const storage = getVideoStorageService()

  let contactSheetUrl: string | null | undefined
  if (job.contact_sheet_path && job.state === "ready_for_review") {
    contactSheetUrl = await storage.createSignedReadUrl(job.source_bucket, job.contact_sheet_path, 300)
  }

  let safeFrames: SafeVideoFrame[] | undefined
  if (frames && frames.length > 0) {
    safeFrames = await Promise.all(
      frames.map(async (f) => {
        let originalFrameUrl: string | undefined
        let thumbnailUrl: string | undefined

        if (job.state === "ready_for_review") {
          originalFrameUrl = await storage.createSignedReadUrl(job.source_bucket, f.original_frame_path, 300)
          thumbnailUrl = await storage.createSignedReadUrl(job.source_bucket, f.thumbnail_path, 300)
        }

        return {
          id: f.id,
          sequenceNo: f.sequence_no,
          sourceTimeMs: f.source_time_ms,
          originalFrameUrl,
          thumbnailUrl,
          sha256: f.sha256,
          width: f.width,
          height: f.height,
          isReviewedEvidence: f.is_reviewed_evidence,
          createdAt: f.created_at,
        }
      })
    )
  }

  return {
    id: job.id,
    dealId: job.deal_id,
    viewingId: job.viewing_id,
    state: job.state,
    contentType: job.content_type,
    declaredBytes: Number(job.declared_bytes),
    observedBytes: job.observed_bytes !== null ? Number(job.observed_bytes) : null,
    durationMs: job.duration_ms,
    contactSheetUrl,
    attemptCount: job.attempt_count,
    failureCode: job.failure_code,
    temporaryRetentionExpiresAt: job.temporary_retention_expires_at,
    originalRetentionPolicy: job.original_retention_policy,
    deletionStatus: job.deletion_status,
    createdAt: job.created_at,
    confirmedAt: job.confirmed_at,
    finishedAt: job.finished_at,
    updatedAt: job.updated_at,
    frames: safeFrames,
  }
}
