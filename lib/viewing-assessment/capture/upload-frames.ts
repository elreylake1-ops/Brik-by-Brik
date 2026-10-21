import { MAX_FRAME_BYTES } from "../capture-limits"
import type { VideoCaptureConfidence, VideoCaptureMethod } from "@/types/viewing-assessment"

// Registers a clip's metadata and frame timestamps, then uploads each frame's JPEG. Browser-side orchestration with
// injected fetch/hash so it is unit-testable. Behaviour worth knowing:
//  - Only metadata and JPEG frames are sent. The original video is never uploaded (retention is not approved).
//  - Registration is done ONCE. Each frame upload is idempotent (identical bytes replay, different bytes are refused),
//    so a failed frame is retried by id without re-registering and without creating duplicates.
//  - Server error codes are mapped to plain language; raw responses are never shown.

export type FrameToUpload = {
  timestampSeconds: number
  requestedTimestampSeconds?: number
  captureMethod?: VideoCaptureMethod
  captureConfidence?: VideoCaptureConfidence
  room?: string
  bytes: Uint8Array
}

export type ClipMeta = { filename: string; mimeType: string; sizeBytes: number; durationSeconds: number }

export type UploadProgress = { registered: boolean; uploaded: number; total: number }

export type FrameResult = { ok: true } | { ok: false; message: string }

export type UploadOutcome =
  | { status: "registration_failed"; message: string }
  | { status: "done" | "partial"; evidenceIds: string[]; results: FrameResult[] }

export type UploadDeps = {
  baseUrl: string // /api/saved-deals/:id/viewing-assessments/:assessmentId
  fetchImpl?: typeof fetch
  sha256Hex: (bytes: Uint8Array) => Promise<string>
  headers?: () => Record<string, string> // authentication headers, supplied by the login layer once it exists
  onProgress?: (p: UploadProgress) => void
}

const MESSAGES: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "You are not signed in, so nothing was saved.",
  SAVED_DEAL_NOT_FOUND: "This deal could not be found, or you do not have access to it.",
  ASSESSMENT_NOT_FOUND: "This assessment could not be found.",
  EVIDENCE_NOT_FOUND: "That frame is not registered on this assessment.",
  DUPLICATE_ASSET: "This clip has already been added to this assessment.",
  TOO_MANY_FRAMES: "This assessment already holds the maximum number of frames.",
  TOO_MANY_CLIPS: "This assessment already holds the maximum number of clips.",
  FRAME_IMMUTABLE: "A different image is already stored for this frame. Stored frames cannot be replaced.",
  UNSUPPORTED_MEDIA_TYPE: "The server only accepts JPEG frames.",
  NOT_A_JPEG: "The frame was not a valid JPEG image.",
  CHECKSUM_MISMATCH: "The frame was damaged in transit. Try again.",
  CROSS_ORIGIN_REJECTED: "The request was blocked for safety (wrong origin).",
  STORAGE_UNAVAILABLE: "Private evidence storage is not available in this environment, so frame images cannot be saved yet.",
}

async function messageFrom(response: Response): Promise<string> {
  let code: string | undefined
  try {
    const body = (await response.json()) as { error?: unknown; validation?: { errors?: unknown } }
    if (typeof body.error === "string") code = body.error
    if (Array.isArray(body.validation?.errors)) return `Not accepted: ${body.validation.errors.filter((e) => typeof e === "string").slice(0, 3).join("; ")}`
  } catch {
    // not JSON: fall through to the status-based message
  }
  if (code && MESSAGES[code]) return MESSAGES[code]
  if (response.status === 413) return "The frame was too large."
  if (response.status === 415) return "The server only accepts JPEG frames."
  if (response.status >= 500) return "The server could not save that frame. Try again."
  return `The server refused the request (${response.status}).`
}

export async function uploadClipFrames(clip: ClipMeta, frames: readonly FrameToUpload[], deps: UploadDeps): Promise<UploadOutcome> {
  const doFetch = deps.fetchImpl ?? fetch
  const authHeaders = () => deps.headers?.() ?? {}
  const oversized = frames.findIndex((f) => f.bytes.length > MAX_FRAME_BYTES || f.bytes.length === 0)
  if (oversized >= 0) return { status: "registration_failed", message: `Frame ${oversized + 1} is empty or too large to upload.` }

  let evidenceIds: string[]
  try {
    const response = await doFetch(`${deps.baseUrl}/evidence`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        clip: { ...clip, contentSha256: null },
        frames: frames.map((f) => ({
          timestampSeconds: f.timestampSeconds,
          ...(f.requestedTimestampSeconds !== undefined ? { requestedTimestampSeconds: f.requestedTimestampSeconds } : {}),
          ...(f.captureMethod ? { captureMethod: f.captureMethod } : {}),
          ...(f.captureConfidence ? { captureConfidence: f.captureConfidence } : {}),
          ...(f.room ? { room: f.room } : {}),
        })),
      }),
    })
    if (!response.ok) return { status: "registration_failed", message: await messageFrom(response) }
    const body = (await response.json()) as { evidence?: { id?: unknown }[] }
    const ids = (body.evidence ?? []).map((e) => e.id)
    if (ids.length !== frames.length || !ids.every((id): id is string => typeof id === "string")) {
      return { status: "registration_failed", message: "The server returned an unexpected response. Nothing further was uploaded." }
    }
    evidenceIds = ids
  } catch {
    return { status: "registration_failed", message: "The server could not be reached. Check the connection and try again." }
  }

  deps.onProgress?.({ registered: true, uploaded: 0, total: frames.length })
  const results = await uploadFramesById(evidenceIds, frames, deps, (uploaded) => deps.onProgress?.({ registered: true, uploaded, total: frames.length }))
  return { status: results.every((r) => r.ok) ? "done" : "partial", evidenceIds, results }
}

/** Uploads (or retries) frames for ids that are already registered. Sequential, one frame at a time, with one retry on a network error. */
export async function uploadFramesById(
  evidenceIds: readonly string[],
  frames: readonly FrameToUpload[],
  deps: UploadDeps,
  onUploaded?: (uploadedSoFar: number) => void,
  only?: ReadonlySet<number>
): Promise<FrameResult[]> {
  const doFetch = deps.fetchImpl ?? fetch
  const results: FrameResult[] = frames.map(() => ({ ok: true }))
  let uploaded = 0
  for (const [i, frame] of frames.entries()) {
    if (only && !only.has(i)) {
      uploaded++
      continue
    }
    const digest = await deps.sha256Hex(frame.bytes)
    const send = () =>
      doFetch(`${deps.baseUrl}/evidence/${encodeURIComponent(evidenceIds[i])}/image`, {
        method: "PUT",
        headers: { "content-type": "image/jpeg", "x-content-sha256": digest, ...(deps.headers?.() ?? {}) },
        body: frame.bytes as unknown as BodyInit,
      })
    try {
      let response: Response
      try {
        response = await send()
      } catch {
        response = await send() // one retry for a dropped connection; the upload is idempotent
      }
      if (response.ok) {
        uploaded++
        onUploaded?.(uploaded)
      } else {
        results[i] = { ok: false, message: await messageFrom(response) }
      }
    } catch {
      results[i] = { ok: false, message: "The server could not be reached while uploading this frame." }
    }
  }
  return results
}
