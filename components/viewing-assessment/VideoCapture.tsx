"use client"

import { useEffect, useRef, useState } from "react"
import { CAPTURE_DEFAULT_SAMPLE, CAPTURE_MAX_FRAMES, FRAME_JPEG_QUALITY, FRAME_MAX_WIDTH, SEEK_TIMEOUT_MS } from "@/lib/viewing-assessment/capture-limits"
import {
  CaptureError,
  NO_PICTURE_MESSAGE,
  captureErrorMessage,
  checkDuration,
  checkVideoFile,
  describeCoverage,
  formatClock,
  mediaErrorMessage,
  planSampleTimes,
  roundTimestamp,
  scaledSize,
} from "@/lib/viewing-assessment/capture/capture-logic"
import { uploadClipFrames, uploadFramesById, type FrameResult } from "@/lib/viewing-assessment/capture/upload-frames"

// Browser video capture: choose or record a clip, preview the ORIGINAL, capture still frames with exact timestamps,
// then save the frames to the assessment. The original video stays on this device: it is never uploaded here, and
// private original-video retention stays disabled until a retention policy is approved.

export type FrameGrabber = (video: HTMLVideoElement, options: { maxWidth: number; quality: number }) => Promise<Blob>

/** Default grabber (the module's approach: draw the current frame to a canvas and encode a JPEG). */
export const canvasFrameGrabber: FrameGrabber = async (video, { maxWidth, quality }) => {
  if (video.readyState < 2 || !video.videoWidth) throw new CaptureError(NO_PICTURE_MESSAGE)
  const { width, height } = scaledSize(video.videoWidth, video.videoHeight, maxWidth)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new CaptureError("This browser could not create a drawing surface to capture the frame.")
  context.drawImage(video, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
  if (!blob) throw new CaptureError("The frame could not be encoded as a JPEG.")
  return blob
}

const PRESENTED_FRAME_TOLERANCE_SECONDS = 0.5
const FRAME_CALLBACK_GRACE_MS = 250
const FALLBACK_RENDER_GRACE_MS = 50
const DECODER_STALL_MS = 2_000
const DECODER_RELOAD_TIMEOUT_MS = 3_000
const DIAGNOSTIC_LIMIT = 500
const diagnosticNow = () => performance.now()

type CaptureFailureKind = "seek_timeout" | "decoder_stall" | "decoder_reload_timeout" | "stale_frame" | "media_read" | "media_decode" | "unsupported_media" | "not_readable" | "cancelled" | "duplicate_frame" | "capture_error" | "unknown"
export type VisualVerdict = "match" | "mismatch" | "uncertain"

type FrameFreshness = "presentation-confirmed" | "uncertain-no-comparison" | "uncertain-different-encoded-bytes" | "uncertain-exact-byte-duplicate"
type MediaLoadGeneration = { current: number }

class TransientCaptureError extends CaptureError {
  constructor(message: string, readonly diagnosticKind: CaptureFailureKind) {
    super(message)
  }
}

export type CaptureDiagnosticEvent = {
  event: string
  verdict?: VisualVerdict
  batchNumber?: number
  requestedTimestampSeconds?: number
  presentedTimestampSeconds?: number
  attempt?: number
  stage?: "canvas-encode" | "blob-read" | "decoder-reload" | "preview-restore"
  failureKind?: CaptureFailureKind
  outcome?: "completed" | "partial" | "failed"
  requestedCount?: number
  attemptedCount?: number
  capturedCount?: number
  failedCount?: number
  elapsedMs?: number
  mimeType?: string
  sizeBytes?: number
  durationSeconds?: number
  width?: number
  height?: number
  captureMethod?: FramePresentation["source"]
  captureConfidence?: CaptureConfidence
  existingFrameCount?: number
  objectUrlCount?: number
  visibilityState?: DocumentVisibilityState
  heapUsedBytes?: number
  heapLimitBytes?: number
  fingerprint?: string
  freshness?: FrameFreshness
  duplicateFingerprintTimestampSeconds?: number
}

export type CaptureDiagnosticSink = (entry: CaptureDiagnosticEvent) => void

export type FramePresentation = {
  requestedTimestampSeconds: number
  presentedTimestampSeconds: number
  source: "video-frame-callback" | "seeked-canvas"
  confidence: CaptureConfidence
}

export type CaptureConfidence = "presented-frame-confirmed" | "seek-timestamp-verified"

/** Seek, prefer presentation confirmation, then return an explicitly lower-confidence seek-verified fallback. */
export function seekToDecodedFrame(video: HTMLVideoElement, seconds: number, timeoutMs = SEEK_TIMEOUT_MS, signal?: AbortSignal, diagnostic?: CaptureDiagnosticSink, mediaLoadGeneration?: MediaLoadGeneration): Promise<FramePresentation> {
  return new Promise((resolve, reject) => {
    const generation = mediaLoadGeneration ? ++mediaLoadGeneration.current : null
    const generationIsCurrent = () => generation === null || mediaLoadGeneration?.current === generation
    let settled = false
    let callbackId: number | null = null
    let fallbackId: number | null = null
    let fallbackTimerId: ReturnType<typeof setTimeout> | null = null
    let frameCallbackTimerId: ReturnType<typeof setTimeout> | null = null
    let callbackPending = false

    const cleanup = () => {
      clearTimeout(timer)
      clearTimeout(stallTimer)
      if (fallbackTimerId !== null) clearTimeout(fallbackTimerId)
      if (frameCallbackTimerId !== null) clearTimeout(frameCallbackTimerId)
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onMediaError)
      video.removeEventListener("abort", onAbort)
      signal?.removeEventListener("abort", onCancelled)
      if (callbackPending && callbackId !== null) video.cancelVideoFrameCallback?.(callbackId)
      if (fallbackId !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(fallbackId)
    }
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const complete = (presentedTimestampSeconds: number, source: FramePresentation["source"], confidence: CaptureConfidence) => {
      if (settled || !generationIsCurrent()) return
      if (!Number.isFinite(presentedTimestampSeconds) || Math.abs(presentedTimestampSeconds - seconds) > PRESENTED_FRAME_TOLERANCE_SECONDS) {
        diagnostic?.({ event: "frame-callback.stale", requestedTimestampSeconds: seconds, presentedTimestampSeconds, failureKind: "stale_frame" })
        return fail(new TransientCaptureError("The browser presented a stale frame after seeking. That timestamp was not captured.", "stale_frame"))
      }
      settled = true
      cleanup()
      resolve({ requestedTimestampSeconds: seconds, presentedTimestampSeconds, source, confidence })
    }
    const runSeekVerifiedFallback = () => {
      if (settled) return
      const callbackWasPending = callbackPending
      if (callbackPending && callbackId !== null) video.cancelVideoFrameCallback?.(callbackId)
      callbackPending = false
      callbackId = null
      diagnostic?.({
        event: callbackWasPending ? "frame-callback.missed" : "seeked-canvas.selected",
        requestedTimestampSeconds: seconds,
        captureMethod: "seeked-canvas",
        captureConfidence: "seek-timestamp-verified",
      })
      const fallback = () => {
        if (settled || !generationIsCurrent()) return
        if (video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
          return fail(new TransientCaptureError(NO_PICTURE_MESSAGE, "media_decode"))
        }
        const actualTime = video.currentTime
        diagnostic?.({
          event: "seeked-canvas.ready",
          requestedTimestampSeconds: seconds,
          presentedTimestampSeconds: actualTime,
          captureMethod: "seeked-canvas",
          captureConfidence: "seek-timestamp-verified",
        })
        complete(actualTime, "seeked-canvas", "seek-timestamp-verified")
      }
      if (typeof requestAnimationFrame === "function") fallbackId = requestAnimationFrame(fallback)
      fallbackTimerId = setTimeout(fallback, FALLBACK_RENDER_GRACE_MS)
    }
    const waitForDecodedFrame = () => {
      if (typeof video.requestVideoFrameCallback === "function") {
        diagnostic?.({ event: "frame-callback.requested", requestedTimestampSeconds: seconds })
        callbackPending = true
        try {
          callbackId = video.requestVideoFrameCallback((_now, metadata) => {
            if (settled || !generationIsCurrent()) return
            callbackPending = false
            diagnostic?.({ event: "frame-callback.fired", requestedTimestampSeconds: seconds, presentedTimestampSeconds: metadata.mediaTime, captureMethod: "video-frame-callback", captureConfidence: "presented-frame-confirmed" })
            complete(metadata.mediaTime, "video-frame-callback", "presented-frame-confirmed")
          })
          frameCallbackTimerId = setTimeout(runSeekVerifiedFallback, FRAME_CALLBACK_GRACE_MS)
        } catch {
          runSeekVerifiedFallback()
        }
        return
      }
      runSeekVerifiedFallback()
    }
    function onSeeked() {
      if (settled || !generationIsCurrent()) return
      if (video.seeking) {
        diagnostic?.({ event: "seeked.ignored", requestedTimestampSeconds: seconds, presentedTimestampSeconds: video.currentTime, failureKind: "stale_frame" })
        return
      }
      video.removeEventListener("seeked", onSeeked)
      waitForDecodedFrame()
    }
    function onMediaError() {
      if (!generationIsCurrent()) return
      const code = video.error?.code
      const message = mediaErrorMessage(code)
      const kind: CaptureFailureKind = code === 2 ? "media_read" : code === 3 ? "media_decode" : code === 4 ? "unsupported_media" : "capture_error"
      diagnostic?.({ event: "seek.error", requestedTimestampSeconds: seconds, failureKind: kind })
      fail(code === 2 ? new TransientCaptureError(message, kind) : new CaptureError(message))
    }
    function onAbort() {
      if (!generationIsCurrent()) return
      diagnostic?.({ event: "seek.abort", requestedTimestampSeconds: seconds, failureKind: "cancelled" })
      fail(new TransientCaptureError("Loading the video was cancelled.", "cancelled"))
    }
    function onCancelled() {
      diagnostic?.({ event: "seek.cancelled", requestedTimestampSeconds: seconds, failureKind: "cancelled" })
      fail(new CaptureError("Frame extraction was cancelled."))
    }
    const timer = setTimeout(() => {
      diagnostic?.({ event: "seek.timeout", requestedTimestampSeconds: seconds, failureKind: "seek_timeout" })
      fail(new TransientCaptureError("The video did not respond to a seek in time. Capture frames manually instead.", "seek_timeout"))
    }, timeoutMs)
    const stallTimer = setTimeout(() => {
      if (settled || !generationIsCurrent()) return
      const decoderIsStalled = video.seeking && video.readyState === HTMLMediaElement.HAVE_METADATA
      if (!decoderIsStalled) return
      diagnostic?.({ event: "decoder.stall", requestedTimestampSeconds: seconds, failureKind: "decoder_stall" })
      fail(new TransientCaptureError("The browser video decoder stalled while seeking.", "decoder_stall"))
    }, Math.min(DECODER_STALL_MS, timeoutMs))
    video.addEventListener("seeked", onSeeked)
    video.addEventListener("error", onMediaError, { once: true })
    video.addEventListener("abort", onAbort, { once: true })
    signal?.addEventListener("abort", onCancelled, { once: true })
    try {
      diagnostic?.({ event: "seek.requested", requestedTimestampSeconds: seconds })
      if (signal?.aborted) return onCancelled()
      if (Math.abs(video.currentTime - seconds) < 0.02 && !video.seeking && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) onSeeked()
      else video.currentTime = seconds
    } catch {
      fail(new CaptureError("This browser could not seek to the requested video timestamp."))
    }
  })
}

function reloadVideoMetadata(
  video: HTMLVideoElement,
  generationState: MediaLoadGeneration,
  requestedTimestampSeconds: number,
  signal?: AbortSignal,
  diagnostic?: CaptureDiagnosticSink,
  timeoutMs = DECODER_RELOAD_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    const generation = ++generationState.current
    let settled = false
    let sawLoadStart = false
    const generationIsCurrent = () => generationState.current === generation
    const cleanup = () => {
      clearTimeout(timer)
      video.removeEventListener("loadstart", onLoadStart)
      video.removeEventListener("loadedmetadata", onLoadedMetadata)
      video.removeEventListener("error", onError)
      signal?.removeEventListener("abort", onCancelled)
    }
    const fail = (error: Error, invalidate = true) => {
      if (settled) return
      settled = true
      if (invalidate && generationIsCurrent()) generationState.current += 1
      cleanup()
      reject(error)
    }
    const succeed = () => {
      if (settled || !generationIsCurrent()) return
      settled = true
      cleanup()
      diagnostic?.({ event: "decoder-reload.succeeded", requestedTimestampSeconds, stage: "decoder-reload" })
      resolve()
    }
    function onLoadStart() {
      if (settled || !generationIsCurrent()) return
      sawLoadStart = true
      diagnostic?.({ event: "decoder-reload.loadstart", requestedTimestampSeconds, stage: "decoder-reload" })
    }
    function onLoadedMetadata() {
      if (settled || !generationIsCurrent()) return
      if (!sawLoadStart) {
        diagnostic?.({ event: "decoder-reload.metadata-ignored", requestedTimestampSeconds, stage: "decoder-reload" })
        return
      }
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) return
      succeed()
    }
    function onError() {
      if (!generationIsCurrent()) return
      diagnostic?.({ event: "decoder-reload.failed", requestedTimestampSeconds, stage: "decoder-reload", failureKind: "media_decode" })
      fail(new TransientCaptureError("The browser could not reload the video metadata.", "media_decode"))
    }
    function onCancelled() {
      diagnostic?.({ event: "decoder-reload.cancelled", requestedTimestampSeconds, stage: "decoder-reload", failureKind: "cancelled" })
      fail(new CaptureError("Frame extraction was cancelled."))
    }
    const timer = setTimeout(() => {
      diagnostic?.({ event: "decoder-reload.timeout", requestedTimestampSeconds, stage: "decoder-reload", failureKind: "decoder_reload_timeout" })
      fail(new TransientCaptureError("The browser video decoder did not reload its metadata in time.", "decoder_reload_timeout"))
    }, timeoutMs)
    video.addEventListener("loadstart", onLoadStart)
    video.addEventListener("loadedmetadata", onLoadedMetadata)
    video.addEventListener("error", onError)
    signal?.addEventListener("abort", onCancelled, { once: true })
    diagnostic?.({ event: "decoder-reload.requested", requestedTimestampSeconds, stage: "decoder-reload" })
    if (signal?.aborted) return onCancelled()
    try {
      video.load()
    } catch {
      diagnostic?.({ event: "decoder-reload.failed", requestedTimestampSeconds, stage: "decoder-reload", failureKind: "media_decode" })
      fail(new TransientCaptureError("The browser could not restart the video decoder.", "media_decode"))
    }
  })
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

type Captured = {
  key: string
  requestedTimestampSeconds: number
  presentedTimestampSeconds: number
  presentationSource: FramePresentation["source"] | "manual"
  captureConfidence: CaptureConfidence | "manual-user-positioned"
  room: string
  bytes: Uint8Array
  thumbUrl: string
}

function omitKey<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record
  void _removed
  return rest
}

export type VisualVerdictEntry = { verdict: VisualVerdict; note: string }
export type ComparisonStatus = "ready" | "failed"
export type VisualReviewResult = "PASS" | "CONDITIONAL" | "FAIL" | "INCOMPLETE"

const VERDICT_NOTE_MAX = 140
const VISUAL_REVIEW_REQUIRED_FRAMES = 12
const VISUAL_REVIEW_MAX_UNCERTAIN = 2

/** Keeps a tester's QA note short, single-line and free of obvious identifiers (room labels, file name, links, e-mail addresses). */
export function cleanVerdictNote(note: string, redact: readonly string[] = []): string {
  let out = note.replace(/[\u0000-\u001f\u007f]+/g, " ")
  out = out.replace(/(?:https?:|blob:|file:)\S+/gi, "[redacted]").replace(/\S+@\S+/g, "[redacted]")
  for (const term of redact) {
    const trimmed = term.trim()
    if (trimmed.length >= 2) out = out.replace(new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[redacted]")
  }
  return out.replace(/\s+/g, " ").trim().slice(0, VERDICT_NOTE_MAX)
}

type ReviewFrame = Pick<Captured, "key" | "requestedTimestampSeconds" | "presentedTimestampSeconds" | "presentationSource" | "captureConfidence" | "room">

/** A Mismatch or Uncertain verdict only counts once it has a non-empty explanation. */
export function effectiveVisualVerdict(entry: VisualVerdictEntry | undefined, redact: readonly string[] = []): VisualVerdict | "unreviewed" {
  if (!entry) return "unreviewed"
  if (entry.verdict === "match") return "match"
  return cleanVerdictNote(entry.note, redact) ? entry.verdict : "unreviewed"
}

/** Compact copyable QA summary of automatic frames only. Contains timestamps, method, confidence, verdicts and notes; never names, labels, hashes or pixels. */
export function buildVisualReviewSummary(input: {
  frames: readonly ReviewFrame[]
  verdicts: Readonly<Record<string, VisualVerdictEntry>>
  comparison: Readonly<Record<string, ComparisonStatus>>
  build: string
  redact?: readonly string[]
}): { text: string; result: VisualReviewResult; counts: { automatic: number; reviewed: number; match: number; mismatch: number; uncertain: number; unreviewed: number; manualExcluded: number } } {
  const redact = [...(input.redact ?? []), ...input.frames.map((f) => f.room)]
  const automatic = input.frames.filter((f) => f.presentationSource !== "manual")
  const counts = { automatic: automatic.length, reviewed: 0, match: 0, mismatch: 0, uncertain: 0, unreviewed: 0, manualExcluded: input.frames.length - automatic.length }
  const frameLines: string[] = []
  let comparisonIncomplete = 0
  automatic.forEach((frame, index) => {
    const verdict = effectiveVisualVerdict(input.verdicts[frame.key], redact)
    counts[verdict] += 1
    const comparison = input.comparison[frame.key] ?? "not-run"
    if (comparison !== "ready") comparisonIncomplete += 1
    const note = verdict === "mismatch" || verdict === "uncertain" ? cleanVerdictNote(input.verdicts[frame.key]!.note, redact) : ""
    frameLines.push(
      `frame=${index + 1} requested=${frame.requestedTimestampSeconds.toFixed(3)} actual=${frame.presentedTimestampSeconds.toFixed(3)} method=${frame.presentationSource} confidence=${frame.captureConfidence} comparison=${comparison} verdict=${verdict}${note ? ` note="${note}"` : ""}`
    )
  })
  counts.reviewed = counts.match + counts.mismatch + counts.uncertain
  let result: VisualReviewResult
  let reason: string
  if (counts.automatic === 0) { result = "INCOMPLETE"; reason = "no automatic frames" }
  else if (counts.mismatch > 0) { result = "FAIL"; reason = "mismatch recorded" }
  else if (counts.unreviewed > 0) { result = "INCOMPLETE"; reason = "unreviewed frames remain" }
  else if (counts.automatic < VISUAL_REVIEW_REQUIRED_FRAMES) { result = "INCOMPLETE"; reason = `fewer than ${VISUAL_REVIEW_REQUIRED_FRAMES} automatic frames`}
  else if (comparisonIncomplete > 0) { result = "FAIL"; reason = "source comparison not completed for every frame" }
  else if (counts.uncertain > VISUAL_REVIEW_MAX_UNCERTAIN) { result = "FAIL"; reason = `more than ${VISUAL_REVIEW_MAX_UNCERTAIN} uncertain` }
  else if (counts.uncertain > 0) { result = "CONDITIONAL"; reason = "uncertain frames with documented reasons; not full acceptance" }
  else { result = "PASS"; reason = "all automatic frames matched" }
  const safeBuild = /^[a-f0-9]{7,40}$/i.test(input.build) ? input.build : "unknown"
  const text = [
    "Brik-by-Brik visual comparison QA v1",
    `build=${safeBuild}`,
    `automaticFrames=${counts.automatic} reviewed=${counts.reviewed} match=${counts.match} mismatch=${counts.mismatch} uncertain=${counts.uncertain} unreviewed=${counts.unreviewed}`,
    `manualFramesExcluded=${counts.manualExcluded}`,
    `result=${result} reason=${reason}`,
    ...frameLines,
    "Human verdicts are local QA observations. They do not change capture provenance; a Match never upgrades seek-timestamp-verified frames to presented-frame-confirmed.",
  ].join("\n")
  return { text, result, counts }
}

/**
 * Local QA only: puts the source video at a requested time so a human can look at it. Separate from the capture pipeline
 * (no provenance, no frames, no fingerprints). Resolves "cancelled" silently when the signal aborts.
 */
export function seekForComparison(video: HTMLVideoElement, seconds: number, signal: AbortSignal, timeoutMs = SEEK_TIMEOUT_MS): Promise<"ready" | "cancelled"> {
  return new Promise((resolve, reject) => {
    let settled = false
    let seekedSeen = false
    const events = ["seeked", "loadeddata", "canplay"] as const
    const cleanup = () => {
      clearTimeout(timer)
      events.forEach((name) => video.removeEventListener(name, onEvent))
      video.removeEventListener("error", onError)
      signal.removeEventListener("abort", onAbort)
    }
    const settle = (finish: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      finish()
    }
    const check = () => {
      if (settled || signal.aborted) return
      if (!seekedSeen || video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return
      if (!Number.isFinite(video.currentTime) || Math.abs(video.currentTime - seconds) > PRESENTED_FRAME_TOLERANCE_SECONDS) {
        return settle(() => reject(new TransientCaptureError("The source video stopped at a different time than requested.", "stale_frame")))
      }
      settle(() => resolve("ready"))
    }
    function onEvent(event: Event) {
      if (event.type === "seeked") seekedSeen = true
      check()
    }
    function onError() {
      settle(() => reject(new TransientCaptureError("The source video reported a playback error.", "media_decode")))
    }
    function onAbort() {
      settle(() => resolve("cancelled"))
    }
    const timer = setTimeout(() => settle(() => reject(new TransientCaptureError("The source video did not finish seeking in time.", "seek_timeout"))), timeoutMs)
    events.forEach((name) => video.addEventListener(name, onEvent))
    video.addEventListener("error", onError)
    signal.addEventListener("abort", onAbort, { once: true })
    if (signal.aborted) return onAbort()
    try {
      if (Math.abs(video.currentTime - seconds) < 0.02 && !video.seeking && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        seekedSeen = true
        check()
      } else {
        video.currentTime = seconds
      }
    } catch {
      settle(() => reject(new TransientCaptureError("This browser could not seek the source video.", "capture_error")))
    }
  })
}

type FailedExtraction = { requestedTimestampSeconds: number; message: string }
type ExtractionOutcome = {
  status: "completed" | "partial" | "failed"
  requested: number
  attempted: number
  captured: number
  failures: FailedExtraction[]
}

type Props = {
  /** /api/saved-deals/:id/viewing-assessments/:assessmentId */
  baseUrl: string
  onSaved?: () => void
  frameGrabber?: FrameGrabber
  fetchImpl?: typeof fetch
  /** Capture check only: frames stay in the page and nothing is ever sent anywhere. */
  dryRun?: boolean
  /** Local capture-check telemetry. Has no effect unless dryRun is also true. */
  diagnosticMode?: boolean
  /** Git commit supplied by the local capture-check launcher. */
  buildRef?: string
}

const BUTTON = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"

export default function VideoCapture({ baseUrl, onSaved, frameGrabber = canvasFrameGrabber, fetchImpl, dryRun = false, diagnosticMode = false, buildRef = "unknown" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const urlsRef = useRef<string[]>([]) // every object URL we create, so none outlives the component
  const counter = useRef(0)
  const extractionAbortRef = useRef<AbortController | null>(null)
  const mediaLoadGenerationRef = useRef<MediaLoadGeneration>({ current: 0 })
  const diagnosticFingerprintsRef = useRef(new Map<string, number>())
  const diagnosticBatchRef = useRef(0)
  const diagnosticSequenceRef = useRef(0)
  const diagnosticStartedRef = useRef(0)
  const comparisonAbortRef = useRef<AbortController | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [room, setRoom] = useState("")
  const [sampleCount, setSampleCount] = useState(CAPTURE_DEFAULT_SAMPLE)
  const [frames, setFrames] = useState<Captured[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [retry, setRetry] = useState<{ ids: string[]; results: FrameResult[]; frames: Captured[] } | null>(null)
  const [extraction, setExtraction] = useState<ExtractionOutcome | null>(null)
  const [diagnosticLines, setDiagnosticLines] = useState<string[]>([])
  const [diagnosticCopyStatus, setDiagnosticCopyStatus] = useState<string | null>(null)
  const [verdicts, setVerdicts] = useState<Record<string, VisualVerdictEntry>>({})
  const [comparison, setComparison] = useState<Record<string, ComparisonStatus>>({})
  const [comparing, setComparing] = useState<string | null>(null)
  const [reviewCopyStatus, setReviewCopyStatus] = useState<string | null>(null)
  const diagnosticsEnabled = dryRun && diagnosticMode

  const diagnosticFailureKind = (error: unknown): CaptureFailureKind => {
    if (error instanceof TransientCaptureError) return error.diagnosticKind
    const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : ""
    if (name === "NotReadableError") return "not_readable"
    if (name === "AbortError") return "cancelled"
    if (error instanceof CaptureError) return "capture_error"
    return "unknown"
  }

  function recordDiagnostic(entry: CaptureDiagnosticEvent) {
    if (!diagnosticsEnabled) return
    const video = videoRef.current
    const fields = [`#${++diagnosticSequenceRef.current}`, `+${Math.max(0, Math.round(diagnosticNow() - diagnosticStartedRef.current))}ms`, `event=${entry.event}`]
    if (entry.failureKind) fields.push(`failure=${entry.failureKind}`)
    if (entry.outcome) fields.push(`outcome=${entry.outcome}`)
    if (entry.verdict !== undefined) fields.push(`verdict=${entry.verdict}`)
    if (entry.batchNumber !== undefined) fields.push(`batch=${entry.batchNumber}`)
    if (entry.requestedTimestampSeconds !== undefined) fields.push(`requested=${entry.requestedTimestampSeconds.toFixed(3)}`)
    if (entry.presentedTimestampSeconds !== undefined) fields.push(`presented=${entry.presentedTimestampSeconds.toFixed(3)}`)
    if (entry.attempt !== undefined) fields.push(`attempt=${entry.attempt}`)
    if (entry.stage !== undefined) fields.push(`stage=${entry.stage}`)
    if (entry.requestedCount !== undefined) fields.push(`requestedCount=${entry.requestedCount}`)
    if (entry.attemptedCount !== undefined) fields.push(`attemptedCount=${entry.attemptedCount}`)
    if (entry.capturedCount !== undefined) fields.push(`capturedCount=${entry.capturedCount}`)
    if (entry.failedCount !== undefined) fields.push(`failedCount=${entry.failedCount}`)
    if (entry.elapsedMs !== undefined) fields.push(`elapsedMs=${Math.max(0, Math.round(entry.elapsedMs))}`)
    if (entry.mimeType !== undefined) fields.push(`mime=${entry.mimeType}`)
    if (entry.sizeBytes !== undefined) fields.push(`sizeBytes=${entry.sizeBytes}`)
    if (entry.durationSeconds !== undefined) fields.push(`duration=${entry.durationSeconds.toFixed(3)}`)
    if (entry.width !== undefined) fields.push(`width=${entry.width}`)
    if (entry.height !== undefined) fields.push(`height=${entry.height}`)
    if (entry.captureMethod !== undefined) fields.push(`method=${entry.captureMethod}`)
    if (entry.captureConfidence !== undefined) fields.push(`confidence=${entry.captureConfidence}`)
    if (entry.existingFrameCount !== undefined) fields.push(`existingFrames=${entry.existingFrameCount}`)
    if (entry.objectUrlCount !== undefined) fields.push(`objectUrls=${entry.objectUrlCount}`)
    if (entry.visibilityState !== undefined) fields.push(`visibility=${entry.visibilityState}`)
    if (entry.heapUsedBytes !== undefined) fields.push(`heapUsedBytes=${entry.heapUsedBytes}`)
    if (entry.heapLimitBytes !== undefined) fields.push(`heapLimitBytes=${entry.heapLimitBytes}`)
    if (entry.fingerprint !== undefined) fields.push(`fingerprint=${entry.fingerprint}`)
    if (entry.freshness !== undefined) fields.push(`freshness=${entry.freshness}`)
    if (entry.duplicateFingerprintTimestampSeconds !== undefined) fields.push(`duplicateOf=${entry.duplicateFingerprintTimestampSeconds.toFixed(3)}`)
    if (video) {
      fields.push(`currentTime=${Number.isFinite(video.currentTime) ? video.currentTime.toFixed(3) : "unavailable"}`)
      fields.push(`readyState=${video.readyState}`)
      fields.push(`networkState=${video.networkState}`)
      fields.push(`mediaErrorCode=${video.error?.code ?? 0}`)
    }
    setDiagnosticLines((current) => [...current, fields.join(" ")].slice(-DIAGNOSTIC_LIMIT))
  }

  function startDiagnostics(chosen: File) {
    if (!diagnosticsEnabled) return
    diagnosticSequenceRef.current = 0
    diagnosticBatchRef.current = 0
    diagnosticFingerprintsRef.current.clear()
    diagnosticStartedRef.current = diagnosticNow()
    setDiagnosticCopyStatus(null)
    const safeBuildRef = /^[a-f0-9]{7,40}$/i.test(buildRef) ? buildRef : "unknown"
    const browser = navigator.userAgent.replace(/\s+/g, " ").slice(0, 300)
    const safeMimeType = ["video/mp4", "video/quicktime", "video/webm"].includes(chosen.type) ? chosen.type : "unsupported"
    const probe = document.createElement("video")
    const support = {
      avc1: probe.canPlayType('video/mp4; codecs="avc1.42E01E"') || "no",
      hevc: probe.canPlayType('video/mp4; codecs="hvc1"') || "no",
      vp9: probe.canPlayType('video/webm; codecs="vp9"') || "no",
      av1: probe.canPlayType('video/webm; codecs="av01.0.05M.08"') || "no",
    }
    setDiagnosticLines([
      "Brik-by-Brik local capture diagnostics v1",
      `build=${safeBuildRef}`,
      `browser=${browser}`,
      `file mime=${safeMimeType} sizeBytes=${chosen.size}`,
      `codec.avc1=${support.avc1} codec.hevc=${support.hevc} codec.vp9=${support.vp9} codec.av1=${support.av1}`,
      `requestVideoFrameCallback=${typeof HTMLVideoElement.prototype.requestVideoFrameCallback === "function" ? "available" : "unavailable"}`,
    ])
  }

  useEffect(() => {
    return () => {
      extractionAbortRef.current?.abort()
      comparisonAbortRef.current?.abort()
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  const track = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    urlsRef.current.push(url)
    return url
  }
  const release = (url: string | null) => {
    if (!url) return
    URL.revokeObjectURL(url)
    urlsRef.current = urlsRef.current.filter((u) => u !== url)
  }

  const diagnosticResourceState = (existingFrameCount = frames.length): Partial<CaptureDiagnosticEvent> => {
    if (!diagnosticsEnabled) return {}
    const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } }).memory
    const heapUsedBytes = memory?.usedJSHeapSize
    const heapLimitBytes = memory?.jsHeapSizeLimit
    return {
      existingFrameCount,
      objectUrlCount: urlsRef.current.length,
      visibilityState: document.visibilityState,
      ...(typeof heapUsedBytes === "number" && Number.isFinite(heapUsedBytes) ? { heapUsedBytes: Math.round(heapUsedBytes) } : {}),
      ...(typeof heapLimitBytes === "number" && Number.isFinite(heapLimitBytes) ? { heapLimitBytes: Math.round(heapLimitBytes) } : {}),
    }
  }

  function chooseFile(chosen: File | undefined) {
    if (!chosen) return
    startDiagnostics(chosen)
    extractionAbortRef.current?.abort()
    cancelComparison()
    setVerdicts({})
    setComparison({})
    setReviewCopyStatus(null)
    mediaLoadGenerationRef.current.current += 1
    diagnosticFingerprintsRef.current.clear()
    setProblem(null)
    setSaved(null)
    setRetry(null)
    setExtraction(null)
    setReady(false)
    setDuration(0)
    frames.forEach((f) => release(f.thumbUrl))
    setFrames([])
    release(videoUrl)
    const check = checkVideoFile(chosen)
    if (!check.ok) {
      setFile(null)
      setVideoUrl(null)
      setProblem(check.message)
      return
    }
    setFile(chosen)
    setVideoUrl(track(chosen))
  }

  function onMetadata() {
    const video = videoRef.current
    if (!video) return
    const length = checkDuration(video.duration)
    recordDiagnostic({
      event: "loadedmetadata",
      mimeType: file?.type ?? "unknown",
      sizeBytes: file?.size ?? 0,
      durationSeconds: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    })
    if (!length.ok) return setProblem(length.message)
    setDuration(video.duration)
    if (!video.videoWidth) return setProblem(NO_PICTURE_MESSAGE) // audio plays but there is no decodable picture
    setProblem(null)
    setReady(true)
  }

  async function grab(
    presentation: FramePresentation,
    label: string,
    source: FramePresentation["source"] | "manual" = presentation.source,
    confidence: CaptureConfidence | "manual-user-positioned" = presentation.confidence,
    diagnosticContext: { batchNumber?: number; attempt?: number; existingFrameCountAfterCapture?: number } = {}
  ) {
    const video = videoRef.current
    if (!video) throw new CaptureError("No video is loaded.")
    const startedAt = diagnosticNow()
    const { existingFrameCountAfterCapture, ...diagnosticBaseContext } = diagnosticContext
    const diagnosticBase = {
      ...diagnosticBaseContext,
      requestedTimestampSeconds: presentation.requestedTimestampSeconds,
      presentedTimestampSeconds: presentation.presentedTimestampSeconds,
      captureMethod: presentation.source,
      captureConfidence: presentation.confidence,
    }
    recordDiagnostic({ event: "frame-grab.started", ...diagnosticBase, stage: "canvas-encode" })
    let blob: Blob
    try {
      blob = await frameGrabber(video, { maxWidth: FRAME_MAX_WIDTH, quality: FRAME_JPEG_QUALITY })
    } catch (error) {
      recordDiagnostic({ event: "frame-grab.failed", ...diagnosticBase, stage: "canvas-encode", failureKind: diagnosticFailureKind(error), elapsedMs: diagnosticNow() - startedAt })
      throw error
    }
    recordDiagnostic({ event: "frame-grab.encoded", ...diagnosticBase, stage: "canvas-encode", sizeBytes: blob.size, elapsedMs: diagnosticNow() - startedAt })
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await blob.arrayBuffer())
    } catch (error) {
      recordDiagnostic({ event: "frame-grab.failed", ...diagnosticBase, stage: "blob-read", failureKind: diagnosticFailureKind(error), elapsedMs: diagnosticNow() - startedAt })
      throw error
    }
    let fingerprintDiagnostic: Pick<CaptureDiagnosticEvent, "fingerprint" | "freshness" | "duplicateFingerprintTimestampSeconds"> = {}
    if (diagnosticsEnabled) {
      try {
        const fingerprint = await sha256Hex(bytes)
        const duplicateTimestamp = diagnosticFingerprintsRef.current.get(fingerprint)
        const freshness: FrameFreshness = presentation.source === "video-frame-callback"
          ? "presentation-confirmed"
          : duplicateTimestamp !== undefined
            ? "uncertain-exact-byte-duplicate"
            : diagnosticFingerprintsRef.current.size === 0
              ? "uncertain-no-comparison"
              : "uncertain-different-encoded-bytes"
        fingerprintDiagnostic = {
          fingerprint,
          freshness,
          ...(duplicateTimestamp !== undefined ? { duplicateFingerprintTimestampSeconds: duplicateTimestamp } : {}),
        }
        recordDiagnostic({ event: duplicateTimestamp !== undefined ? "fingerprint.match" : "fingerprint.recorded", ...diagnosticBase, ...fingerprintDiagnostic })
        if (duplicateTimestamp === undefined) diagnosticFingerprintsRef.current.set(fingerprint, presentation.presentedTimestampSeconds)
      } catch {
        recordDiagnostic({ event: "fingerprint.unavailable", ...diagnosticBase, failureKind: "capture_error" })
      }
    }
    counter.current += 1
    const thumbUrl = track(blob)
    recordDiagnostic({ event: "frame-grab.completed", ...diagnosticBase, ...fingerprintDiagnostic, stage: "blob-read", sizeBytes: bytes.byteLength, elapsedMs: diagnosticNow() - startedAt, ...diagnosticResourceState(existingFrameCountAfterCapture ?? frames.length + 1) })
    return {
      key: `f${counter.current}`,
      requestedTimestampSeconds: presentation.requestedTimestampSeconds,
      presentedTimestampSeconds: presentation.presentedTimestampSeconds,
      presentationSource: source,
      captureConfidence: confidence,
      room: label,
      bytes,
      thumbUrl,
    } satisfies Captured
  }

  async function captureNow() {
    const video = videoRef.current
    if (!video) return
    if (frames.length >= CAPTURE_MAX_FRAMES) return setProblem(`Maximum ${CAPTURE_MAX_FRAMES} frames. Save these, or remove some, before capturing more.`)
    setProblem(null)
    recordDiagnostic({ event: "manual.attempt", requestedTimestampSeconds: video.currentTime, attempt: 1 })
    try {
      const timestamp = video.currentTime
      const frame = await grab(
        { requestedTimestampSeconds: timestamp, presentedTimestampSeconds: timestamp, source: "seeked-canvas", confidence: "seek-timestamp-verified" },
        room.trim(),
        "manual",
        "manual-user-positioned"
      )
      setFrames((current) => [...current, frame])
      recordDiagnostic({ event: "manual.success", requestedTimestampSeconds: timestamp, presentedTimestampSeconds: timestamp, attempt: 1 })
    } catch (error) {
      recordDiagnostic({ event: "manual.failure", requestedTimestampSeconds: video.currentTime, attempt: 1, failureKind: diagnosticFailureKind(error) })
      setProblem(captureErrorMessage(error))
    }
  }

  const retryable = (error: unknown) =>
    error instanceof TransientCaptureError ||
    (typeof error === "object" && error !== null && "name" in error && ["NotReadableError", "AbortError"].includes(String((error as { name: unknown }).name)))

  async function extractSlots(times: readonly number[], signal?: AbortSignal, batchNumber?: number) {
    const video = videoRef.current
    if (!video) return { added: [] as Captured[], failures: [] as FailedExtraction[], attempted: 0 }
    const added: Captured[] = []
    const failures: FailedExtraction[] = []
    const occupied = new Set(frames.map((frame) => frame.presentedTimestampSeconds.toFixed(3)))
    let attempted = 0
    let decoderReloadUsed = false
    for (const requestedTimestampSeconds of times) {
      attempted += 1
      let lastError: unknown
      for (let attempt = 0; attempt < 2; attempt += 1) {
        recordDiagnostic({ event: "slot.attempt", batchNumber, requestedTimestampSeconds, attempt: attempt + 1 })
        try {
          const presentation = await seekToDecodedFrame(video, requestedTimestampSeconds, SEEK_TIMEOUT_MS, signal, (entry) => recordDiagnostic({ ...entry, batchNumber, attempt: attempt + 1 }), mediaLoadGenerationRef.current)
          const key = presentation.presentedTimestampSeconds.toFixed(3)
          if (occupied.has(key)) throw new TransientCaptureError("The browser returned a duplicate frame. That timestamp was not added.", "duplicate_frame")
          const frame = await grab(presentation, room.trim(), presentation.source, presentation.confidence, { batchNumber, attempt: attempt + 1, existingFrameCountAfterCapture: frames.length + added.length + 1 })
          occupied.add(key)
          added.push(frame)
          recordDiagnostic({
            event: "slot.success",
            batchNumber,
            requestedTimestampSeconds,
            presentedTimestampSeconds: presentation.presentedTimestampSeconds,
            attempt: attempt + 1,
            captureMethod: presentation.source,
            captureConfidence: presentation.confidence,
          })
          lastError = null
          break
        } catch (error) {
          lastError = error
          recordDiagnostic({ event: "slot.failure", batchNumber, requestedTimestampSeconds, attempt: attempt + 1, failureKind: diagnosticFailureKind(error) })
          if (error instanceof TransientCaptureError && error.diagnosticKind === "decoder_stall") {
            if (attempt === 1 || decoderReloadUsed) break
            decoderReloadUsed = true
            try {
              await reloadVideoMetadata(video, mediaLoadGenerationRef.current, requestedTimestampSeconds, signal, (entry) => recordDiagnostic({ ...entry, batchNumber, attempt: attempt + 1 }))
            } catch (reloadError) {
              lastError = reloadError
              break
            }
            recordDiagnostic({ event: "slot.retry", batchNumber, requestedTimestampSeconds, attempt: attempt + 2, failureKind: "decoder_stall" })
            continue
          }
          if (attempt === 1 || !retryable(error)) break
          recordDiagnostic({ event: "slot.retry", batchNumber, requestedTimestampSeconds, attempt: attempt + 2, failureKind: diagnosticFailureKind(error) })
        }
      }
      if (lastError) failures.push({ requestedTimestampSeconds, message: captureErrorMessage(lastError) })
      if (signal?.aborted) break
    }
    return { added, failures, attempted }
  }

  async function autoSample() {
    const video = videoRef.current
    if (!video || !duration) return
    const times = planSampleTimes(duration, sampleCount, frames.length)
    if (times.length === 0) return setProblem(`Maximum ${CAPTURE_MAX_FRAMES} frames reached.`)
    setProblem(null)
    setExtraction(null)
    cancelComparison()
    setBusy(true)
    const original = video.currentTime
    const controller = new AbortController()
    extractionAbortRef.current = controller
    const startedAt = diagnosticNow()
    const batchNumber = diagnosticsEnabled ? ++diagnosticBatchRef.current : undefined
    video.pause()
    recordDiagnostic({ event: "batch.started", batchNumber, requestedCount: times.length, ...diagnosticResourceState() })
    try {
      const result = await extractSlots(times, controller.signal, batchNumber)
      setFrames((current) => [...current, ...result.added])
      const status = result.added.length === times.length ? "completed" : result.added.length > 0 ? "partial" : "failed"
      recordDiagnostic({ event: "batch.finished", batchNumber, outcome: status, requestedCount: times.length, attemptedCount: result.attempted, capturedCount: result.added.length, failedCount: result.failures.length, elapsedMs: diagnosticNow() - startedAt, ...diagnosticResourceState(frames.length + result.added.length) })
      setExtraction({ status, requested: times.length, attempted: result.attempted, captured: result.added.length, failures: result.failures })
      setProblem(result.failures.length ? `${result.failures.length} frame ${result.failures.length === 1 ? "slot" : "slots"} failed. ${result.failures[0].message}` : null)
    } finally {
      const restoreStartedAt = diagnosticNow()
      recordDiagnostic({ event: "preview-restore.started", batchNumber, requestedTimestampSeconds: original, stage: "preview-restore" })
      try {
        if (!controller.signal.aborted) {
          const restored = await seekToDecodedFrame(video, original, SEEK_TIMEOUT_MS, undefined, undefined, mediaLoadGenerationRef.current)
          recordDiagnostic({ event: "preview-restore.succeeded", batchNumber, requestedTimestampSeconds: original, presentedTimestampSeconds: restored.presentedTimestampSeconds, stage: "preview-restore", elapsedMs: diagnosticNow() - restoreStartedAt })
        } else {
          recordDiagnostic({ event: "preview-restore.skipped", batchNumber, requestedTimestampSeconds: original, stage: "preview-restore", failureKind: "cancelled" })
        }
      } catch (error) {
        recordDiagnostic({ event: "preview-restore.failed", batchNumber, requestedTimestampSeconds: original, stage: "preview-restore", failureKind: diagnosticFailureKind(error), elapsedMs: diagnosticNow() - restoreStartedAt })
        // Captured frames remain valid if restoring the preview position fails.
      }
      if (extractionAbortRef.current === controller) extractionAbortRef.current = null
      setBusy(false)
    }
  }

  async function retryFailedExtractions() {
    const video = videoRef.current
    if (!video || !extraction?.failures.length) return
    cancelComparison()
    setBusy(true)
    const original = video.currentTime
    const controller = new AbortController()
    extractionAbortRef.current = controller
    const startedAt = diagnosticNow()
    const batchNumber = diagnosticsEnabled ? ++diagnosticBatchRef.current : undefined
    const failedTimes = extraction.failures.map((failure) => failure.requestedTimestampSeconds)
    recordDiagnostic({ event: "retry-batch.started", batchNumber, requestedCount: extraction.requested, ...diagnosticResourceState() })
    try {
      const result = await extractSlots(failedTimes, controller.signal, batchNumber)
      setFrames((current) => [...current, ...result.added])
      const captured = extraction.captured + result.added.length
      const status = result.failures.length === 0 ? "completed" : captured > 0 ? "partial" : "failed"
      recordDiagnostic({ event: "retry-batch.finished", batchNumber, outcome: status, requestedCount: extraction.requested, attemptedCount: extraction.attempted, capturedCount: captured, failedCount: result.failures.length, elapsedMs: diagnosticNow() - startedAt, ...diagnosticResourceState(frames.length + result.added.length) })
      setExtraction({ ...extraction, status, captured, failures: result.failures })
      setProblem(result.failures.length ? `${result.failures.length} frame ${result.failures.length === 1 ? "slot" : "slots"} failed. ${result.failures[0].message}` : null)
    } finally {
      const restoreStartedAt = diagnosticNow()
      recordDiagnostic({ event: "preview-restore.started", batchNumber, requestedTimestampSeconds: original, stage: "preview-restore" })
      try {
        if (!controller.signal.aborted) {
          const restored = await seekToDecodedFrame(video, original, SEEK_TIMEOUT_MS, undefined, undefined, mediaLoadGenerationRef.current)
          recordDiagnostic({ event: "preview-restore.succeeded", batchNumber, requestedTimestampSeconds: original, presentedTimestampSeconds: restored.presentedTimestampSeconds, stage: "preview-restore", elapsedMs: diagnosticNow() - restoreStartedAt })
        } else {
          recordDiagnostic({ event: "preview-restore.skipped", batchNumber, requestedTimestampSeconds: original, stage: "preview-restore", failureKind: "cancelled" })
        }
      } catch (error) {
        recordDiagnostic({ event: "preview-restore.failed", batchNumber, requestedTimestampSeconds: original, stage: "preview-restore", failureKind: diagnosticFailureKind(error), elapsedMs: diagnosticNow() - restoreStartedAt })
        // Captured frames remain valid if restoring the preview position fails.
      }
      if (extractionAbortRef.current === controller) extractionAbortRef.current = null
      setBusy(false)
    }
  }

  function removeFrame(key: string) {
    const target = frames.find((f) => f.key === key)
    if (target) release(target.thumbUrl)
    if (comparing === key) cancelComparison()
    setVerdicts((current) => omitKey(current, key))
    setComparison((current) => omitKey(current, key))
    setFrames((current) => current.filter((f) => f.key !== key))
  }

  /** Invalidates any pending source-comparison seek (new comparison, new file, extraction start, unmount). */
  function cancelComparison() {
    comparisonAbortRef.current?.abort()
    comparisonAbortRef.current = null
    setComparing(null)
  }

  async function compareSource(frame: Captured) {
    const video = videoRef.current
    if (!video || busy || !diagnosticsEnabled || frame.presentationSource === "manual") return
    comparisonAbortRef.current?.abort()
    const controller = new AbortController()
    comparisonAbortRef.current = controller
    video.pause()
    setComparing(frame.key)
    recordDiagnostic({ event: "comparison.started", requestedTimestampSeconds: frame.requestedTimestampSeconds })
    try {
      const outcome = await seekForComparison(video, frame.requestedTimestampSeconds, controller.signal)
      if (outcome === "cancelled" || controller.signal.aborted) return
      setComparison((current) => ({ ...current, [frame.key]: "ready" }))
      recordDiagnostic({ event: "comparison.ready", requestedTimestampSeconds: frame.requestedTimestampSeconds, presentedTimestampSeconds: video.currentTime })
      video.scrollIntoView?.({ block: "nearest" })
    } catch (error) {
      if (controller.signal.aborted) return
      setComparison((current) => ({ ...current, [frame.key]: "failed" }))
      // A Match can only rest on a successful comparison.
      setVerdicts((current) => (current[frame.key]?.verdict === "match" ? omitKey(current, frame.key) : current))
      recordDiagnostic({ event: "comparison.failed", requestedTimestampSeconds: frame.requestedTimestampSeconds, failureKind: diagnosticFailureKind(error) })
    } finally {
      if (!controller.signal.aborted) {
        if (comparisonAbortRef.current === controller) comparisonAbortRef.current = null
        setComparing(null)
      }
    }
  }

  function chooseVerdict(frame: Captured, verdict: VisualVerdict) {
    if (verdict === "match" && comparison[frame.key] !== "ready") return
    setVerdicts((current) => ({ ...current, [frame.key]: { verdict, note: verdict === "match" ? "" : current[frame.key]?.note ?? "" } }))
    recordDiagnostic({ event: "verdict.recorded", requestedTimestampSeconds: frame.requestedTimestampSeconds, verdict })
  }

  function changeVerdictNote(key: string, note: string) {
    setVerdicts((current) => (current[key] && current[key].verdict !== "match" ? { ...current, [key]: { ...current[key], note: note.slice(0, VERDICT_NOTE_MAX) } } : current))
  }

  async function save() {
    if (dryRun || !file || frames.length === 0) return
    setBusy(true)
    setProblem(null)
    setSaved(null)
    setRetry(null)
    const deps = { baseUrl, sha256Hex, ...(fetchImpl ? { fetchImpl } : {}), onProgress: (p: { uploaded: number; total: number }) => setProgress(`Uploaded ${p.uploaded} of ${p.total} frames`) }
    try {
      const outcome = await uploadClipFrames(
        { filename: file.name.split(/[\\/]/).pop() || "clip", mimeType: file.type, sizeBytes: file.size, durationSeconds: roundTimestamp(duration) },
        frames.map((f) => ({
          timestampSeconds: f.presentedTimestampSeconds,
          requestedTimestampSeconds: f.requestedTimestampSeconds,
          captureMethod: f.presentationSource,
          captureConfidence: f.captureConfidence,
          ...(f.room ? { room: f.room } : {}),
          bytes: f.bytes,
        })),
        deps
      )
      if (outcome.status === "registration_failed") return setProblem(outcome.message)
      if (outcome.status === "partial") {
        setRetry({ ids: outcome.evidenceIds, results: outcome.results, frames })
        setProblem("Some frames could not be saved. The rest are saved; retry the failed ones below.")
      } else {
        setSaved(`${frames.length} frame${frames.length === 1 ? "" : "s"} saved to this assessment.`)
        frames.forEach((f) => release(f.thumbUrl))
        setFrames([])
      }
      onSaved?.()
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function retryFailed() {
    if (!retry) return
    setBusy(true)
    const failed = new Set(retry.results.flatMap((r, i) => (r.ok ? [] : [i])))
    const results = await uploadFramesById(
      retry.ids,
      retry.frames.map((f) => ({
        timestampSeconds: f.presentedTimestampSeconds,
        requestedTimestampSeconds: f.requestedTimestampSeconds,
        captureMethod: f.presentationSource,
        captureConfidence: f.captureConfidence,
        bytes: f.bytes,
      })),
      { baseUrl, sha256Hex, ...(fetchImpl ? { fetchImpl } : {}) },
      undefined,
      failed
    )
    const merged = retry.results.map((previous, i) => (failed.has(i) ? results[i] : previous))
    setBusy(false)
    if (merged.every((r) => r.ok)) {
      setRetry(null)
      setProblem(null)
      setSaved(`${retry.frames.length} frames saved to this assessment.`)
      retry.frames.forEach((f) => release(f.thumbUrl))
      setFrames([])
      onSaved?.()
    } else {
      setRetry({ ...retry, results: merged })
    }
  }

  const diagnosticReport = diagnosticLines.join("\n")
  const reviewRedactions = file ? [file.name.replace(/\.[^.]*$/, "")] : []
  const visualReview = diagnosticsEnabled ? buildVisualReviewSummary({ frames, verdicts, comparison, build: buildRef, redact: reviewRedactions }) : null

  async function copyVisualReview() {
    if (!visualReview) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable")
      await navigator.clipboard.writeText(visualReview.text)
      setReviewCopyStatus("Visual review summary copied.")
    } catch {
      setReviewCopyStatus("Copy failed. Select the summary text and copy it manually.")
    }
  }

  async function copyDiagnosticReport() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable")
      await navigator.clipboard.writeText(diagnosticReport)
      setDiagnosticCopyStatus("Diagnostic report copied.")
    } catch {
      setDiagnosticCopyStatus("Copy failed. Select the report text and copy it manually.")
    }
  }

  function clearDiagnosticReport() {
    diagnosticSequenceRef.current = 0
    diagnosticStartedRef.current = diagnosticNow()
    setDiagnosticLines([])
    setDiagnosticCopyStatus(null)
  }

  const coverage = describeCoverage(frames.map((f) => f.presentedTimestampSeconds), duration)
  const remaining = CAPTURE_MAX_FRAMES - frames.length
  const failedCount = retry ? retry.results.filter((r) => !r.ok).length : 0

  return (
    <section aria-labelledby="video-capture-heading" className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" data-testid="video-capture">
      <h3 id="video-capture-heading" className="text-base font-bold text-slate-950">
        Capture evidence from a video
      </h3>
      <p className="text-sm text-slate-700" data-testid="retention-note">
        {dryRun
          ? "Capture check: this page only tests whether your device and browser can read your video and take frames. Nothing is uploaded, saved or sent anywhere, and frames are discarded when you leave. The original video stays on this device."
          : "The original video stays on this device and is not uploaded. Only the still frames you save are stored, privately, against this assessment."}
      </p>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="block">
          Choose a video
          <input data-testid="video-file" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" disabled={busy} className="mt-1 block" onChange={(e) => chooseFile(e.target.files?.[0])} />
        </label>
        <label className="block">
          Record a video
          <input data-testid="video-record" type="file" accept="video/*" capture="environment" disabled={busy} className="mt-1 block" onChange={(e) => chooseFile(e.target.files?.[0])} />
        </label>
      </div>

      {diagnosticsEnabled ? (
        <section data-testid="capture-diagnostics" aria-labelledby="capture-diagnostics-heading" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <h4 id="capture-diagnostics-heading" className="font-semibold text-amber-950">Local diagnostic report</h4>
          <p className="text-xs text-amber-950">
            Contains browser/media state and timing only. It excludes video bytes, images, filenames, paths, credentials and room labels.
          </p>
          <textarea data-testid="diagnostic-report" aria-label="Diagnostic report" readOnly value={diagnosticReport} rows={14} className="w-full rounded border border-amber-300 bg-white p-2 font-mono text-xs" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={BUTTON} disabled={!diagnosticReport} onClick={copyDiagnosticReport}>Copy diagnostic report</button>
            <button type="button" className={BUTTON} disabled={!diagnosticReport} onClick={clearDiagnosticReport}>Clear diagnostic report</button>
            {diagnosticCopyStatus ? <span data-testid="diagnostic-copy-status" className="text-xs text-amber-950">{diagnosticCopyStatus}</span> : null}
          </div>
        </section>
      ) : null}

      {problem ? (
        <p role="alert" data-testid="capture-problem" className="rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-900">
          {problem}
        </p>
      ) : null}
      {saved ? (
        <p role="status" data-testid="capture-saved" className="rounded-lg border border-green-300 bg-green-50 p-2 text-sm text-green-900">
          {saved}
        </p>
      ) : null}
      {extraction ? (
        <div data-testid="extraction-outcome" role="status" className="rounded-lg border border-slate-300 bg-slate-50 p-2 text-sm text-slate-900">
          Extraction {extraction.status}. Requested {extraction.requested}; attempted {extraction.attempted}; captured {extraction.captured}.
          {extraction.failures.length ? (
            <>
              <ul className="list-disc pl-5">
                {extraction.failures.map((failure) => <li key={failure.requestedTimestampSeconds}>{failure.requestedTimestampSeconds.toFixed(2)} s: {failure.message}</li>)}
              </ul>
              <button type="button" className={BUTTON} disabled={busy} onClick={retryFailedExtractions}>
                Retry {extraction.failures.length} failed extraction{extraction.failures.length === 1 ? "" : "s"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {videoUrl ? (
        <video
          ref={videoRef}
          data-testid="video-preview"
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          className="max-h-72 w-full rounded-lg bg-black"
          onLoadedMetadata={onMetadata}
          onSeeking={() => recordDiagnostic({ event: "seeking" })}
          onSeeked={() => recordDiagnostic({ event: "seeked" })}
          onLoadedData={() => recordDiagnostic({ event: "loadeddata" })}
          onCanPlay={() => recordDiagnostic({ event: "canplay" })}
          onError={() => {
            const code = videoRef.current?.error?.code
            const failureKind: CaptureFailureKind = code === 2 ? "media_read" : code === 3 ? "media_decode" : code === 4 ? "unsupported_media" : "capture_error"
            recordDiagnostic({ event: "error", failureKind })
            setReady(false)
            setProblem(mediaErrorMessage(code))
          }}
        />
      ) : null}

      {ready ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label className="block">
              Room or area (optional)
              <input value={room} maxLength={100} onChange={(e) => setRoom(e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1" />
            </label>
            <button type="button" className={BUTTON} disabled={busy || remaining <= 0} onClick={captureNow}>
              Capture this frame
            </button>
            <label className="block">
              Frames to sample
              <input type="number" min={1} max={Math.max(1, remaining)} value={sampleCount} onChange={(e) => setSampleCount(Number(e.target.value) || 1)} className="mt-1 block w-20 rounded border border-slate-300 px-2 py-1" />
            </label>
            <button type="button" className={BUTTON} disabled={busy || remaining <= 0} onClick={autoSample}>
              Sample evenly
            </button>
          </div>
          <p className="text-xs text-slate-600">
            {frames.length} of {CAPTURE_MAX_FRAMES} frames this session. Add close-ups of anything important: only what is visible can be assessed.
          </p>
        </div>
      ) : null}

      {frames.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="frame-thumbnails">
          {frames.map((f) => (
            <li key={f.key} data-requested-seconds={f.requestedTimestampSeconds} data-presented-seconds={f.presentedTimestampSeconds} data-capture-method={f.presentationSource} data-capture-confidence={f.captureConfidence} className="rounded-lg border border-slate-200 p-1 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL of a frame the user just captured */}
              <img src={f.thumbUrl} alt={`Frame at ${formatClock(f.presentedTimestampSeconds)}${f.room ? `, ${f.room}` : ""}`} className="w-full rounded" />
              <div className="mt-1 flex items-center justify-between gap-1">
                <span>
                  {formatClock(f.presentedTimestampSeconds)}
                  {f.room ? ` · ${f.room}` : ""}
                </span>
                <button type="button" className="underline" disabled={busy} onClick={() => removeFrame(f.key)}>
                  Remove
                </button>
              </div>
              <span className="block text-slate-600">
                Requested {f.requestedTimestampSeconds.toFixed(2)} s · actual {f.presentedTimestampSeconds.toFixed(3)} s · {f.presentationSource} · {f.captureConfidence}
                {f.captureConfidence === "seek-timestamp-verified" ? " (pixel freshness not callback-confirmed)" : ""}
              </span>
              {diagnosticsEnabled && f.presentationSource !== "manual" ? (
                <div data-testid="visual-compare" className="mt-1 space-y-1 border-t border-slate-200 pt-1">
                  <button type="button" className={BUTTON} disabled={busy} onClick={() => compareSource(f)}>
                    Show source at this time
                  </button>
                  <span data-testid="compare-status" className="block text-slate-700">
                    {comparing === f.key
                      ? `Seeking source to requested ${f.requestedTimestampSeconds.toFixed(2)} s…`
                      : comparison[f.key] === "failed"
                        ? "Source seek failed or stalled. Record Uncertain with a reason."
                        : verdicts[f.key]?.verdict === "match"
                          ? `Verdict: Match recorded. Source confirmed at requested ${f.requestedTimestampSeconds.toFixed(2)} s.`
                          : verdicts[f.key]?.verdict === "mismatch"
                            ? `Verdict: Mismatch recorded. Reason required below.`
                            : verdicts[f.key]?.verdict === "uncertain"
                              ? `Verdict: Uncertain recorded. Reason required below.`
                              : comparison[f.key] === "ready"
                                ? `Source ready at requested ${f.requestedTimestampSeconds.toFixed(2)} s. Compare it with the thumbnail.`
                                : "Source not compared yet."}
                  </span>
                  <div role="group" aria-label="Visual verdict" className="flex flex-wrap gap-1">
                    {(["match", "mismatch", "uncertain"] as const).map((verdict) => {
                      const isSelected = verdicts[f.key]?.verdict === verdict
                      const selectedClass =
                        verdict === "match"
                          ? "bg-emerald-700 text-white border-emerald-700 font-semibold shadow-sm"
                          : verdict === "mismatch"
                            ? "bg-rose-700 text-white border-rose-700 font-semibold shadow-sm"
                            : "bg-amber-700 text-white border-amber-700 font-semibold shadow-sm"
                      const unselectedClass = "bg-white text-slate-900 border-slate-300 hover:bg-slate-50"
                      return (
                        <button
                          key={verdict}
                          type="button"
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? selectedClass : unselectedClass}`}
                          aria-pressed={isSelected}
                          data-verdict={verdict}
                          disabled={verdict === "match" && comparison[f.key] !== "ready"}
                          onClick={() => chooseVerdict(f, verdict)}
                        >
                          {verdict === "match" ? "Match" : verdict === "mismatch" ? "Mismatch" : "Uncertain"}
                        </button>
                      )
                    })}
                  </div>
                  {verdicts[f.key] && verdicts[f.key].verdict !== "match" ? (
                    <label className="block">
                      Short QA reason (required; no addresses, room names or personal details)
                      <input
                        data-testid="verdict-note"
                        value={verdicts[f.key].note}
                        maxLength={VERDICT_NOTE_MAX}
                        onChange={(e) => changeVerdictNote(f.key, e.target.value)}
                        className="mt-1 block w-full rounded border border-slate-300 px-2 py-1"
                      />
                      {cleanVerdictNote(verdicts[f.key].note, reviewRedactions) ? null : <span className="text-red-800">Explanation required.</span>}
                    </label>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {visualReview && visualReview.counts.automatic > 0 ? (
        <section data-testid="visual-review" aria-label="Visual comparison summary" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <h4 className="font-semibold text-amber-950">Visual comparison summary</h4>
          <p className="text-xs text-amber-950">
            Local QA only. Automatic frames only; manual frames are excluded. Excludes filenames, room labels, hashes and images. A human Match does not make a frame presentation-confirmed.
          </p>
          <textarea data-testid="visual-review-summary" aria-label="Visual comparison summary" readOnly value={visualReview.text} rows={10} className="w-full rounded border border-amber-300 bg-white p-2 font-mono text-xs" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={BUTTON} onClick={copyVisualReview}>Copy visual review summary</button>
            {reviewCopyStatus ? <span data-testid="visual-review-copy-status" className="text-xs text-amber-950">{reviewCopyStatus}</span> : null}
          </div>
        </section>
      ) : null}

      {file ? (
        <p className="text-xs text-slate-700" data-testid="coverage-statement">
          {coverage.statement}
        </p>
      ) : null}

      {frames.length > 0 && !dryRun ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BUTTON} disabled={busy} onClick={save}>
            Save {frames.length} frame{frames.length === 1 ? "" : "s"} to this assessment
          </button>
          {progress ? <span className="text-sm text-slate-700">{progress}</span> : null}
        </div>
      ) : null}

      {retry && failedCount > 0 ? (
        <div data-testid="upload-retry" className="space-y-1 text-sm">
          <ul className="list-disc pl-5 text-red-900">
            {retry.results.map((r, i) => (r.ok ? null : <li key={i}>Frame {i + 1} ({formatClock(retry.frames[i].presentedTimestampSeconds)}): {r.message}</li>))}
          </ul>
          <button type="button" className={BUTTON} disabled={busy} onClick={retryFailed}>
            Retry {failedCount} failed frame{failedCount === 1 ? "" : "s"}
          </button>
        </div>
      ) : null}
    </section>
  )
}
