import {
  ALLOWED_VIDEO_MIME_TYPES,
  CAPTURE_MAX_FRAMES,
  MAX_CLIP_BYTES,
  MAX_CLIP_SECONDS,
} from "../capture-limits"

// Pure logic behind the browser video capture: no DOM, no network, so every rule is unit-tested without a decoder.
// Behaviour for sampling and timestamps is taken from the supplied viewing module.

export type VideoFileCheck = { ok: true } | { ok: false; code: "EMPTY" | "UNSUPPORTED_TYPE" | "TOO_LARGE"; message: string }

/** Checks a chosen file BEFORE it is loaded, using the same limits the server enforces. */
export function checkVideoFile(file: { name: string; type: string; size: number }): VideoFileCheck {
  if (file.size <= 0) return { ok: false, code: "EMPTY", message: "That file is empty." }
  if (!(ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      code: "UNSUPPORTED_TYPE",
      message: file.type
        ? `This app accepts MP4, MOV or WebM video, not ${file.type}. Re-record or convert the clip (MP4/H.264 works best).`
        : "This browser did not identify the file as a video. Choose an MP4, MOV or WebM clip.",
    }
  }
  if (file.size > MAX_CLIP_BYTES) {
    return { ok: false, code: "TOO_LARGE", message: `Choose a clip under ${Math.round(MAX_CLIP_BYTES / 1024 ** 2)} MB. Shorter room-by-room clips work best.` }
  }
  return { ok: true }
}

export type DurationCheck = { ok: true } | { ok: false; message: string }

export function checkDuration(durationSeconds: number): DurationCheck {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { ok: false, message: "The video's length could not be read, so frames cannot be taken from it." }
  }
  if (durationSeconds > MAX_CLIP_SECONDS) {
    return { ok: false, message: `This clip is ${Math.round(durationSeconds)} s long. The limit is ${MAX_CLIP_SECONDS / 60} minutes; use a shorter clip.` }
  }
  return { ok: true }
}

/** The picture could not be decoded even though the file loaded (typically HEVC/H.265 in a browser without a decoder). */
export const NO_PICTURE_MESSAGE =
  "The video loaded but its picture cannot be decoded here (often an iPhone HEVC clip). Try an MP4 recorded as H.264, or another browser."

/** HTMLMediaElement.error.code => message. 1 aborted, 2 network, 3 decode, 4 source not supported. */
export function mediaErrorMessage(code: number | undefined): string {
  switch (code) {
    case 1:
      return "Loading the video was cancelled."
    case 2:
      return "The video could not be read (a file or network error). Choose it again."
    case 3:
      return "The video is damaged or uses an encoding this browser cannot decode."
    case 4:
      return "This browser cannot play that video format. Try an MP4 (H.264) clip."
    default:
      return "This video could not be played."
  }
}

/** Errors thrown while reading pixels or recording, mapped to plain language. Never includes the raw error text. */
export function captureErrorMessage(error: unknown): string {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : ""
  switch (name) {
    case "SecurityError":
      return "The browser blocked reading this video's picture, so no frame could be saved."
    case "NotAllowedError":
      return "Permission was denied. Allow access to the camera or file and try again."
    case "NotReadableError":
      return "The file could not be read. It may be in use by another app; try again."
    case "NotFoundError":
      return "No camera or file was found."
    case "AbortError":
      return "The action was cancelled."
    default:
      return error instanceof CaptureError ? error.message : "A frame could not be captured. Wait for the video to show a picture and try again."
  }
}

export class CaptureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CaptureError"
  }
}

/** Timestamps are stored to 10 ms, as in the original module. */
export const roundTimestamp = (seconds: number) => Math.round(seconds * 100) / 100

/** Evenly spaced sample points: the middle of each of n equal slices, never past the last frame (original formula). */
export function planSampleTimes(durationSeconds: number, requested: number, alreadyCaptured = 0): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return []
  const n = Math.max(0, Math.min(Math.floor(requested), CAPTURE_MAX_FRAMES - alreadyCaptured))
  return Array.from({ length: n }, (_, i) => roundTimestamp(Math.min(durationSeconds - 0.05, ((i + 0.5) * durationSeconds) / n)))
}

export function scaledSize(width: number, height: number, maxWidth: number): { width: number; height: number } {
  const w = Math.min(width, maxWidth)
  return { width: w, height: Math.max(1, Math.round((height * w) / width)) }
}

export type CoverageSummary = {
  frameCount: number
  firstSeconds: number | null
  lastSeconds: number | null
  largestGapSeconds: number
  /** What the reviewer is told, so unseen parts are never mistaken for "fine". */
  statement: string
}

/** Describes what the captured frames can and cannot support. Gaps include the start and end of the clip. */
export function describeCoverage(timestamps: readonly number[], durationSeconds: number): CoverageSummary {
  const sorted = [...timestamps].sort((a, b) => a - b)
  if (sorted.length === 0) {
    return {
      frameCount: 0,
      firstSeconds: null,
      lastSeconds: null,
      largestGapSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
      statement: "No frames captured yet. Nothing has evidence behind it: every check stays NOT ASSESSED.",
    }
  }
  const edges = [0, ...sorted, Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : sorted[sorted.length - 1]]
  const largestGap = Math.max(...edges.slice(1).map((t, i) => t - edges[i]))
  return {
    frameCount: sorted.length,
    firstSeconds: sorted[0],
    lastSeconds: sorted[sorted.length - 1],
    largestGapSeconds: roundTimestamp(largestGap),
    statement: `${sorted.length} still frame${sorted.length === 1 ? "" : "s"} captured; the longest stretch with no frame is ${roundTimestamp(largestGap)} s. Only what is visible in these frames can be assessed: anything between them, out of shot, or unclear stays NOT ASSESSED, and a suggestion is never proof.`,
  }
}

export const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
