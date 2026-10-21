import { OUTCOME_RESULTS, OUTCOME_SOURCES, VIDEO_CAPTURE_CONFIDENCES, VIDEO_CAPTURE_METHODS, VIEWING_CHECK_STATUSES, type OutcomeInput, type OutcomeResult, type OutcomeSource, type VideoCaptureConfidence, type VideoCaptureMethod, type ViewingCheckStatus } from "@/types/viewing-assessment"
import { ALLOWED_VIDEO_MIME_TYPES, MAX_CLIP_BYTES, MAX_CLIP_SECONDS, MAX_FRAMES_PER_CLIP } from "./capture-limits"

// Strict allowlist parsers for client bodies. Unknown keys are rejected, so a client can never
// supply ownership (dealId/createdBy), reviewer identity/time, proposal status, storage keys, or
// anything financial. Those are all derived server-side.

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

export const MAX_BODY_BYTES = 64 * 1024
export { ALLOWED_VIDEO_MIME_TYPES, MAX_CLIP_BYTES, MAX_CLIP_SECONDS, MAX_FRAMES_PER_CLIP }

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const BAD_FILENAME = /[\\/\u0000-\u001f]/

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

function unknownKeys(obj: Record<string, unknown>, allowed: readonly string[], path: string): string[] {
  return Object.keys(obj)
    .filter((k) => !allowed.includes(k))
    .map((k) => `${path}${k} is not allowed`)
}

const fail = <T>(errors: string[]): ParseResult<T> => ({ ok: false, errors })

function text(v: unknown, field: string, min: number, max: number, errors: string[]): string {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max) {
    errors.push(`${field} must be a string of ${min}-${max} characters`)
    return ""
  }
  return v.trim()
}

function idempotencyKeyBody(body: unknown): ParseResult<{ idempotencyKey: string }> {
  if (!isRecord(body)) return fail(["body must be a JSON object"])
  const errors = unknownKeys(body, ["idempotencyKey"], "")
  if (typeof body.idempotencyKey !== "string" || !KEY_PATTERN.test(body.idempotencyKey)) {
    errors.push("idempotencyKey must be 8-100 characters of A-Z a-z 0-9 _ -")
  }
  return errors.length
    ? fail(errors)
    : { ok: true, value: { idempotencyKey: body.idempotencyKey as string } }
}

export const parseCreateAssessment = idempotencyKeyBody
export const parseRunRequest = idempotencyKeyBody

export type AddEvidenceBody = {
  clip: {
    filename: string
    mimeType: string
    sizeBytes: number
    durationSeconds: number
    contentSha256: string | null
  }
  frames: { timestampSeconds: number; requestedTimestampSeconds?: number; captureMethod?: VideoCaptureMethod; captureConfidence?: VideoCaptureConfidence; room?: string }[]
}

export function parseAddEvidence(body: unknown): ParseResult<AddEvidenceBody> {
  if (!isRecord(body)) return fail(["body must be a JSON object"])
  const errors = unknownKeys(body, ["clip", "frames"], "")
  const clip = body.clip
  if (!isRecord(clip)) return fail([...errors, "clip must be an object"])
  errors.push(
    ...unknownKeys(clip, ["filename", "mimeType", "sizeBytes", "durationSeconds", "contentSha256"], "clip.")
  )

  const filename = text(clip.filename, "clip.filename", 1, 255, errors)
  if (filename && BAD_FILENAME.test(filename)) errors.push("clip.filename must not contain path separators")
  if (!ALLOWED_VIDEO_MIME_TYPES.includes(clip.mimeType as never)) errors.push("clip.mimeType is not supported")
  const { sizeBytes, durationSeconds } = clip
  if (!Number.isInteger(sizeBytes) || (sizeBytes as number) < 1 || (sizeBytes as number) > MAX_CLIP_BYTES) {
    errors.push("clip.sizeBytes out of range")
  }
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > MAX_CLIP_SECONDS
  ) {
    errors.push("clip.durationSeconds out of range")
  }
  const sha = clip.contentSha256 ?? null
  if (sha !== null && (typeof sha !== "string" || !SHA256_PATTERN.test(sha))) {
    errors.push("clip.contentSha256 must be 64 lowercase hex characters")
  }

  const frames: AddEvidenceBody["frames"] = []
  if (!Array.isArray(body.frames) || body.frames.length < 1 || body.frames.length > MAX_FRAMES_PER_CLIP) {
    errors.push(`frames must contain 1-${MAX_FRAMES_PER_CLIP} items`)
  } else {
    body.frames.forEach((f, i) => {
      if (!isRecord(f)) {
        errors.push(`frames[${i}] must be an object`)
        return
      }
      errors.push(...unknownKeys(f, ["timestampSeconds", "requestedTimestampSeconds", "captureMethod", "captureConfidence", "room"], `frames[${i}].`))
      const ts = f.timestampSeconds
      if (typeof ts !== "number" || !Number.isFinite(ts) || ts < 0 || ts > (durationSeconds as number)) {
        errors.push(`frames[${i}].timestampSeconds must be within the clip`)
      }
      let room: string | undefined
      if (f.room !== undefined) room = text(f.room, `frames[${i}].room`, 1, 100, errors)
      const requested = f.requestedTimestampSeconds
      if (requested !== undefined && (typeof requested !== "number" || !Number.isFinite(requested) || requested < 0 || requested > (durationSeconds as number))) {
        errors.push(`frames[${i}].requestedTimestampSeconds must be within the clip`)
      }
      if (typeof requested === "number" && Number.isFinite(requested) && typeof ts === "number" && Number.isFinite(ts) && Math.abs(ts - requested) > 0.5) {
        errors.push(`frames[${i}] actual and requested timestamps differ by more than 0.5 seconds`)
      }
      const method = f.captureMethod
      const confidence = f.captureConfidence
      const provenanceFields = [requested, method, confidence].filter((value) => value !== undefined).length
      if (provenanceFields !== 0 && provenanceFields !== 3) errors.push(`frames[${i}] requestedTimestampSeconds, captureMethod and captureConfidence must be supplied together`)
      if (method !== undefined && !VIDEO_CAPTURE_METHODS.includes(method as VideoCaptureMethod)) errors.push(`frames[${i}].captureMethod is invalid`)
      if (confidence !== undefined && !VIDEO_CAPTURE_CONFIDENCES.includes(confidence as VideoCaptureConfidence)) errors.push(`frames[${i}].captureConfidence is invalid`)
      const expectedConfidence: Partial<Record<VideoCaptureMethod, VideoCaptureConfidence>> = {
        "video-frame-callback": "presented-frame-confirmed",
        "seeked-canvas": "seek-timestamp-verified",
        manual: "manual-user-positioned",
      }
      if (method !== undefined && confidence !== undefined && expectedConfidence[method as VideoCaptureMethod] !== confidence) {
        errors.push(`frames[${i}] captureMethod and captureConfidence do not match`)
      }
      frames.push({
        timestampSeconds: ts as number,
        ...(requested !== undefined ? { requestedTimestampSeconds: requested as number } : {}),
        ...(method !== undefined ? { captureMethod: method as VideoCaptureMethod } : {}),
        ...(confidence !== undefined ? { captureConfidence: confidence as VideoCaptureConfidence } : {}),
        ...(room ? { room } : {}),
      })
    })
  }

  if (errors.length) return fail(errors)
  return {
    ok: true,
    value: {
      clip: {
        filename,
        mimeType: clip.mimeType as string,
        sizeBytes: sizeBytes as number,
        durationSeconds: durationSeconds as number,
        contentSha256: sha as string | null,
      },
      frames,
    },
  }
}

export type ReviewBody =
  | { expectedRevision: number; disposition: "ACCEPTED"; reason?: string }
  | {
      expectedRevision: number
      disposition: "EDITED"
      status: ViewingCheckStatus
      observation: string
      reason?: string
    }
  | { expectedRevision: number; disposition: "REJECTED"; reason: string }

export function parseReview(body: unknown): ParseResult<ReviewBody> {
  if (!isRecord(body)) return fail(["body must be a JSON object"])
  const errors = unknownKeys(body, ["expectedRevision", "disposition", "status", "observation", "reason"], "")
  const { expectedRevision, disposition } = body
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) {
    errors.push("expectedRevision must be a non-negative integer")
  }
  if (disposition !== "ACCEPTED" && disposition !== "EDITED" && disposition !== "REJECTED") {
    errors.push("disposition must be ACCEPTED, EDITED or REJECTED")
    return fail(errors)
  }
  const rev = expectedRevision as number
  const optionalReason = () =>
    body.reason === undefined ? undefined : text(body.reason, "reason", 1, 500, errors)

  let value: ReviewBody
  if (disposition === "EDITED") {
    if (!VIEWING_CHECK_STATUSES.includes(body.status as ViewingCheckStatus)) errors.push("status is invalid")
    const observation = text(body.observation, "observation", 1, 1000, errors)
    const reason = optionalReason()
    value = {
      expectedRevision: rev,
      disposition,
      status: body.status as ViewingCheckStatus,
      observation,
      ...(reason ? { reason } : {}),
    }
  } else if (disposition === "REJECTED") {
    errors.push(...unknownKeys(body, ["expectedRevision", "disposition", "reason"], ""))
    value = { expectedRevision: rev, disposition, reason: text(body.reason, "reason", 1, 500, errors) }
  } else {
    errors.push(...unknownKeys(body, ["expectedRevision", "disposition", "reason"], ""))
    const reason = optionalReason()
    value = { expectedRevision: rev, disposition, ...(reason ? { reason } : {}) }
  }
  return errors.length ? fail([...new Set(errors)]) : { ok: true, value }
}

/**
 * Body for recording what actually turned out. Strict allowlist: no proposal, deal, reviewer or time fields (all are
 * derived server-side), and nothing financial can be expressed.
 */
export function parseOutcome(body: unknown): ParseResult<OutcomeInput> {
  if (!isRecord(body)) return fail(["body must be a JSON object"])
  const errors = unknownKeys(body, ["result", "source", "observedStatus", "note"], "")
  if (!OUTCOME_RESULTS.includes(body.result as OutcomeResult)) errors.push("result is invalid")
  if (!OUTCOME_SOURCES.includes(body.source as OutcomeSource)) errors.push("source is invalid")
  const observed = body.observedStatus ?? null
  if (observed !== null && !VIEWING_CHECK_STATUSES.includes(observed as ViewingCheckStatus)) errors.push("observedStatus is invalid")
  const note = text(body.note, "note", 1, 1000, errors)
  if (errors.length) return fail([...new Set(errors)])
  return {
    ok: true,
    value: { result: body.result as OutcomeResult, source: body.source as OutcomeSource, observedStatus: observed as ViewingCheckStatus | null, note },
  }
}
