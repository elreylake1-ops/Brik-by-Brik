// Types for Brik-by-Brik Video-to-Evidence Jobs & Frames (Task 11C)

export type VideoJobState =
  | "upload_pending"
  | "queued"
  | "processing"
  | "ready_for_review"
  | "failed"

export type VideoContentType =
  | "video/mp4"
  | "video/quicktime"
  | "video/x-m4v"

export const ALLOWED_VIDEO_MIME_TYPES: readonly VideoContentType[] = [
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
] as const

export const MAX_VIDEO_BYTES = 524_288_000 // 500 MB hard cap
export const MAX_DURATION_MS = 300_000 // 5 minutes hard cap
export const MAX_ACTIVE_OPERATOR_JOBS = 3 // Per operator/viewing active limit
export const MAX_CONFIRMATION_WINDOW_MS = 7_200_000 // 2 hours application-level upload confirmation window

export type VideoJobRecord = {
  id: string
  deal_id: string
  viewing_id: string
  created_by: string
  source_bucket: string
  source_path: string
  content_type: VideoContentType
  declared_bytes: number
  observed_bytes: number | null
  sha256: string | null
  duration_ms: number | null
  contact_sheet_path: string | null
  state: VideoJobState
  worker_id: string | null
  lease_until: string | null
  attempt_count: number
  failure_code: string | null
  processor_version: string | null
  temporary_retention_expires_at: string
  original_retention_policy: string
  retention_decision_notes: string | null
  deletion_status: string
  deleted_at: string | null
  created_at: string
  confirmed_at: string | null
  finished_at: string | null
  updated_at: string
}

export type VideoFrameRecord = {
  id: string
  job_id: string
  sequence_no: number
  source_time_ms: number
  original_frame_path: string
  thumbnail_path: string
  sha256: string
  mime_type: string
  width: number
  height: number
  is_reviewed_evidence: boolean
  created_at: string
}

export type SafeVideoFrame = {
  id: string
  sequenceNo: number
  sourceTimeMs: number
  originalFrameUrl?: string
  thumbnailUrl?: string
  sha256: string
  mimeType?: string
  width: number
  height: number
  isReviewedEvidence: boolean
  createdAt: string
}

export type SafeVideoJob = {
  id: string
  dealId: string
  viewingId: string
  state: VideoJobState
  contentType: VideoContentType
  declaredBytes: number
  observedBytes: number | null
  sha256?: string | null
  durationMs: number | null
  contactSheetUrl?: string | null
  processorVersion?: string | null
  attemptCount: number
  failureCode: string | null
  temporaryRetentionExpiresAt: string
  originalRetentionPolicy: string
  deletionStatus: string
  createdAt: string
  confirmedAt: string | null
  finishedAt: string | null
  updatedAt: string
  frames?: readonly SafeVideoFrame[]
}

export type CreateVideoIntentInput = {
  declaredBytes: number
  contentType: string
  filename?: string
  idempotencyKey?: string
}

export type VideoUploadProtocols = {
  standard: {
    uploadUrl: string
    method: "PUT" | "POST"
  }
  resumable: {
    endpoint: string
    token: string // token for x-signature or auth header
    signatureHeader: "x-signature"
    signatureToken: string
    bucket: string
    objectName: string
    chunkSize: number // Minimum 6 MB for Supabase TUS
    metadata: {
      bucketName: string
      objectName: string
      contentType: string
    }
  }
}

export type VideoIntentResponse = {
  success: true
  jobId: string
  sourcePath: string
  uploadEndpoint: string
  uploadToken: string
  protocols: VideoUploadProtocols
  maxBytes: number
  expiresAt: string
}

export type VideoConfirmResponse = {
  success: true
  jobId: string
  state: "queued"
  observedBytes: number
  confirmedAt: string
}

export type VideoJobStatusResponse = {
  success: true
  job: SafeVideoJob
}
