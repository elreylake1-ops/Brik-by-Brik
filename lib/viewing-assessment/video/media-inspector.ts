import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export const MAX_ALLOWED_DURATION_SEC = 300 // 5 minutes hard cap
export const MAX_ALLOWED_BYTES = 524_288_000 // 500 MB hard cap
export const MAX_ALLOWED_PIXELS = 1920 * 1080 // 1080p equivalent

export const ALLOWED_VIDEO_CODECS: readonly string[] = [
  "h264",
  "hevc",
] as const

export const ALLOWED_CONTAINER_FORMATS: readonly string[] = [
  "mp4",
  "mov",
  "quicktime",
  "m4v",
] as const

export type MediaInspectionSuccess = {
  valid: true
  durationSec: number
  durationMs: number
  width: number
  height: number
  codec: string
  formatName: string
  bitRate: number
  fps: number
}

export type MediaInspectionFailure = {
  valid: false
  code:
    | "CORRUPT_MEDIA"
    | "UNSUPPORTED_CODEC"
    | "UNSUPPORTED_CONTAINER"
    | "DURATION_EXCEEDED"
    | "RESOLUTION_EXCEEDED"
    | "NO_VIDEO_STREAM"
    | "SIZE_EXCEEDED"
  message: string
}

export type MediaInspectionResult = MediaInspectionSuccess | MediaInspectionFailure

/**
 * Probes all packet presentation timestamps directly from the video stream using ffprobe.
 * This guarantees source_time_ms is derived from actual hardware presentation timestamps,
 * natively supporting variable-frame-rate (VFR) videos without inferring from nominal fps.
 */
export async function probeStreamPresentationTimestamps(
  filePath: string,
  timeoutMs = 20_000
): Promise<number[]> {
  const args = [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "packet=pts_time",
    "-of",
    "csv=p=0",
    filePath,
  ]

  const { stdout } = await execFileAsync("ffprobe", args, {
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  })

  const timestamps: number[] = []
  const lines = stdout.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const val = parseFloat(trimmed)
    if (Number.isFinite(val) && val >= 0) {
      timestamps.push(val)
    }
  }

  // Deduplicate and sort chronologically
  return Array.from(new Set(timestamps)).sort((a, b) => a - b)
}

type FfprobeJsonOutput = {
  format?: {
    duration?: string
    size?: string
    bit_rate?: string
    format_name?: string
  }
  streams?: Array<{
    codec_type?: string
    codec_name?: string
    width?: number
    height?: number
    r_frame_rate?: string
    avg_frame_rate?: string
    bit_rate?: string
    duration?: string
  }>
}

/**
 * Inspects a video file using ffprobe with safe argument passing (zero shell interpolation).
 * Enforces pilot boundaries: max 5 min duration, 500 MB size, 1080p equivalent, approved codecs.
 */
export async function inspectMedia(
  filePath: string,
  timeoutMs = 15_000
): Promise<MediaInspectionResult> {
  const args = [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size,bit_rate,format_name:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,bit_rate,duration",
    "-of",
    "json",
    filePath,
  ]

  let stdout: string
  try {
    const res = await execFileAsync("ffprobe", args, {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    })
    stdout = res.stdout
  } catch (err: unknown) {
    return {
      valid: false,
      code: "CORRUPT_MEDIA",
      message: `Failed to probe video file: ${(err as Error).message ?? "unknown error"}`,
    }
  }

  let probe: FfprobeJsonOutput
  try {
    probe = JSON.parse(stdout)
  } catch {
    return {
      valid: false,
      code: "CORRUPT_MEDIA",
      message: "Malformed JSON response from ffprobe probe.",
    }
  }

  // Verify video stream exists
  const videoStream = probe.streams?.find((s) => s.codec_type === "video")
  if (!videoStream) {
    return {
      valid: false,
      code: "NO_VIDEO_STREAM",
      message: "No video stream found in uploaded file container.",
    }
  }

  // Container format verification
  const formatName = (probe.format?.format_name ?? "").toLowerCase()
  const isAllowedContainer = ALLOWED_CONTAINER_FORMATS.some((f) => formatName.includes(f))
  if (!isAllowedContainer) {
    return {
      valid: false,
      code: "UNSUPPORTED_CONTAINER",
      message: `Container format '${formatName}' is unsupported. Must be MP4 or MOV.`,
    }
  }

  // Codec verification
  const codec = (videoStream.codec_name ?? "").toLowerCase()
  if (!ALLOWED_VIDEO_CODECS.includes(codec)) {
    return {
      valid: false,
      code: "UNSUPPORTED_CODEC",
      message: `Video codec '${codec}' is unsupported. Must be H.264 or H.265 (HEVC).`,
    }
  }

  // Duration verification
  const durationSec =
    Number(probe.format?.duration) ||
    Number(videoStream.duration) ||
    0

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return {
      valid: false,
      code: "CORRUPT_MEDIA",
      message: "Invalid or indeterminable video duration.",
    }
  }

  if (durationSec > MAX_ALLOWED_DURATION_SEC) {
    return {
      valid: false,
      code: "DURATION_EXCEEDED",
      message: `Video duration (${durationSec.toFixed(1)}s) exceeds agreed pilot limit of ${MAX_ALLOWED_DURATION_SEC}s (5 min).`,
    }
  }

  // Resolution verification (1080p equivalent: 1920x1080 landscape or 1080x1920 portrait)
  const width = videoStream.width ?? 0
  const height = videoStream.height ?? 0
  const pixels = width * height

  if (pixels > MAX_ALLOWED_PIXELS) {
    return {
      valid: false,
      code: "RESOLUTION_EXCEEDED",
      message: `Resolution (${width}x${height} = ${pixels} px) exceeds 1080p maximum (${MAX_ALLOWED_PIXELS} px).`,
    }
  }

  // Frame rate parsing
  let fps = 30
  if (videoStream.r_frame_rate && videoStream.r_frame_rate.includes("/")) {
    const [num, den] = videoStream.r_frame_rate.split("/").map(Number)
    if (den && num) fps = num / den
  } else if (videoStream.avg_frame_rate && videoStream.avg_frame_rate.includes("/")) {
    const [num, den] = videoStream.avg_frame_rate.split("/").map(Number)
    if (den && num) fps = num / den
  }

  return {
    valid: true,
    durationSec,
    durationMs: Math.round(durationSec * 1000),
    width,
    height,
    codec,
    formatName: probe.format?.format_name ?? "mp4",
    bitRate: Number(probe.format?.bit_rate) || 0,
    fps: Number.isFinite(fps) ? fps : 30,
  }
}
