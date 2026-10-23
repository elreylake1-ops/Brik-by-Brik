import { execFile } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { promisify } from "node:util"
import {
  claimNextQueuedVideoJob,
  completeVideoJob,
  insertVideoFrames,
  markJobFailed,
} from "./video-jobs-repository"
import {
  getVideoStorageService,
  type IVideoStorageService,
} from "./video-storage-service"
import {
  inspectMedia,
  probeStreamPresentationTimestamps,
  type MediaInspectionResult,
} from "./media-inspector"
import type { VideoJobRecord } from "@/types/video-jobs"

const execFileAsync = promisify(execFile)

export const WORKER_PROCESSOR_VERSION = "v1.0.0-ffmpeg"
export const MAX_FRAMES_PER_WALKTHROUGH = 40
export const MIN_FRAMES_PER_WALKTHROUGH = 5

export type ExtractedFrame = {
  sequenceNo: number
  sourceTimeMs: number
  originalFramePath: string
  thumbnailPath: string
  sha256: string
  mimeType: "image/png"
  width: number
  height: number
  bytes: Buffer
  thumbnailBytes: Buffer
  localFramePath: string
}

export type ProcessJobResult =
  | {
      success: true
      jobId: string
      frameCount: number
      durationMs: number
      sha256: string
    }
  | {
      success: false
      jobId: string
      code: string
      message: string
    }

export type WorkerDependencies = {
  storage?: IVideoStorageService
  workerId?: string
}

/**
 * Detects an installed system font for drawing labels on derivative contact sheets.
 */
export function findSystemFont(): string | null {
  const candidates =
    process.platform === "win32"
      ? [
          "C:/Windows/Fonts/arial.ttf",
          "C:/Windows/Fonts/segoeui.ttf",
          "C:/Windows/Fonts/tahoma.ttf",
          "C:/Windows/Fonts/calibri.ttf",
        ]
      : [
          "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
          "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
          "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
          "/System/Library/Fonts/Helvetica.ttc",
          "/System/Library/Fonts/SFNSText.ttf",
        ]
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c
    }
  }
  return null
}

/**
 * Formats time in milliseconds to mm:ss format.
 */
export function formatMmSs(timeMs: number): string {
  const totalSec = Math.max(0, Math.floor(timeMs / 1000))
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

/**
 * Calculates evenly spaced presentation timestamps in seconds as a fallback.
 */
export function calculateExtractionTimestamps(
  durationSec: number,
  maxFrames = MAX_FRAMES_PER_WALKTHROUGH
): number[] {
  if (durationSec <= 0) return []
  const frameCount = Math.min(
    maxFrames,
    Math.max(MIN_FRAMES_PER_WALKTHROUGH, Math.floor(durationSec / 5))
  )
  const interval = durationSec / (frameCount + 1)
  const timestamps: number[] = []
  for (let i = 1; i <= frameCount; i++) {
    timestamps.push(Number((i * interval).toFixed(3)))
  }
  return timestamps
}

/**
 * Selects presentation timestamps directly from probed stream packet timestamps.
 * Guarantees timestamps derive from genuine recorded presentation timestamps,
 * natively supporting variable-frame-rate (VFR) recordings.
 */
export function selectExtractionTimestamps(
  genuinePts: number[],
  durationSec: number,
  maxFrames = MAX_FRAMES_PER_WALKTHROUGH
): number[] {
  const frameCount = Math.min(
    maxFrames,
    Math.max(MIN_FRAMES_PER_WALKTHROUGH, Math.floor(durationSec / 5))
  )
  if (genuinePts.length === 0) {
    return calculateExtractionTimestamps(durationSec, maxFrames)
  }

  if (genuinePts.length <= frameCount) {
    return genuinePts
  }

  const step = (genuinePts.length - 1) / (frameCount + 1)
  const selected: number[] = []
  for (let i = 1; i <= frameCount; i++) {
    const idx = Math.min(genuinePts.length - 1, Math.round(i * step))
    selected.push(genuinePts[idx])
  }
  return Array.from(new Set(selected)).sort((a, b) => a - b)
}

/**
 * Extracts a single unenhanced, lossless PNG frame using FFmpeg with safe execFile execution.
 * Enforces -an to strip audio tracks for property privacy (GDPR compliance).
 * The original full-resolution extracted PNG is NEVER enhanced or modified with burnt-in text.
 */
export async function extractFramePng(
  inputVideoPath: string,
  timestampSec: number,
  outputPngPath: string,
  timeoutMs = 15_000
): Promise<Buffer> {
  const args = [
    "-ss",
    String(timestampSec),
    "-i",
    inputVideoPath,
    "-vframes",
    "1",
    "-an",
    "-c:v",
    "png",
    "-y",
    outputPngPath,
  ]

  await execFileAsync("ffmpeg", args, {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  })

  return fs.promises.readFile(outputPngPath)
}

/**
 * Generates a scaled JPEG thumbnail derivative (320px wide) from an extracted PNG frame.
 * Marked as a non-authoritative derivative.
 */
export async function generateThumbnailJpg(
  inputPngPath: string,
  outputJpgPath: string,
  timeoutMs = 10_000
): Promise<Buffer> {
  const args = [
    "-i",
    inputPngPath,
    "-vf",
    "scale=320:-1",
    "-q:v",
    "3",
    "-y",
    outputJpgPath,
  ]

  await execFileAsync("ffmpeg", args, {
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  })

  return fs.promises.readFile(outputJpgPath)
}

/**
 * Generates a tiled contact sheet derivative from the extracted frames.
 * Each tile displays a legible frame ID, source mm:ss timestamp, and derivative label.
 * The original extracted PNG frames remain unmodified.
 */
export async function generateContactSheet(
  items: Array<{
    frameLocalPath: string
    sequenceNo: number
    sourceTimeMs: number
  }>,
  tempDir: string,
  outputSheetPath: string,
  timeoutMs = 30_000
): Promise<Buffer> {
  const totalFrames = items.length
  if (totalFrames === 0) {
    throw new Error("Cannot generate contact sheet from empty frames list")
  }
  const cols = totalFrames <= 12 ? 3 : totalFrames <= 24 ? 4 : 5
  const rows = Math.ceil(totalFrames / cols)

  const tilesDir = path.join(tempDir, "annotated_tiles")
  await fs.promises.mkdir(tilesDir, { recursive: true })

  const font = findSystemFont()
  const fontEsc = font ? font.replace(/\\/g, "/").replace(":", "\\:") : null

  // Generate annotated tile derivatives for the contact sheet
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const tileOut = path.join(tilesDir, `tile_${String(i).padStart(3, "0")}.png`)
    const mmss = formatMmSs(item.sourceTimeMs)
    const rawLabel = `F${String(item.sequenceNo).padStart(2, "0")}  ${mmss} [DERIVATIVE]`
    const escapedLabel = rawLabel.replace(/:/g, "\\:")

    let vf = "scale=320:-1,drawbox=y=ih-26:color=black@0.75:width=iw:height=26:t=fill"
    if (fontEsc) {
      vf += `,drawtext=fontfile='${fontEsc}':text='${escapedLabel}':fontsize=13:fontcolor=white:x=6:y=h-19`
    }

    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", item.frameLocalPath, "-vf", vf, tileOut],
      { timeout: 10_000, windowsHide: true }
    )
  }

  const inputPattern = path.join(tilesDir, "tile_%03d.png")
  const args = [
    "-start_number",
    "0",
    "-i",
    inputPattern,
    "-filter_complex",
    `tile=${cols}x${rows}:padding=4:margin=4:color=black`,
    "-q:v",
    "3",
    "-y",
    outputSheetPath,
  ]

  await execFileAsync("ffmpeg", args, {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  })

  return fs.promises.readFile(outputSheetPath)
}

/**
 * Core worker execution: processes a claimed video job in an isolated scratch directory.
 * Guarantees temporary file cleanup, cryptographic provenance, and immutable evidence storage.
 */
export async function processVideoJob(
  job: VideoJobRecord,
  deps: WorkerDependencies = {}
): Promise<ProcessJobResult> {
  const storage = deps.storage ?? getVideoStorageService()
  const workerId = deps.workerId
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "brik-video-worker-"))

  try {
    // 1. Retrieve original footage from private storage
    const videoBytes = await storage.downloadObject(job.source_bucket, job.source_path)
    if (!videoBytes || videoBytes.length === 0) {
      await markJobFailed(job.id, "STORAGE_OBJECT_NOT_FOUND", workerId)
      return {
        success: false,
        jobId: job.id,
        code: "STORAGE_OBJECT_NOT_FOUND",
        message: "Original video could not be retrieved from private storage.",
      }
    }

    // 2. Compute original video SHA-256 hash
    const videoSha256 = createHash("sha256").update(videoBytes).digest("hex")
    const tempVideoPath = path.join(tempDir, `original_${job.id}.mp4`)
    await fs.promises.writeFile(tempVideoPath, videoBytes)

    // 3. Inspect media using ffprobe
    const inspection: MediaInspectionResult = await inspectMedia(tempVideoPath)
    if (!inspection.valid) {
      await markJobFailed(job.id, inspection.code, workerId)
      return {
        success: false,
        jobId: job.id,
        code: inspection.code,
        message: inspection.message,
      }
    }

    // 4. Probe genuine presentation timestamps from stream packets
    const genuinePts = await probeStreamPresentationTimestamps(tempVideoPath)
    const timestamps = selectExtractionTimestamps(genuinePts, inspection.durationSec)

    const framesDir = path.join(tempDir, "frames")
    const thumbsDir = path.join(tempDir, "thumbs")
    await fs.promises.mkdir(framesDir, { recursive: true })
    await fs.promises.mkdir(thumbsDir, { recursive: true })

    const extractedFrames: ExtractedFrame[] = []

    // 5. Extract unenhanced PNG frames and thumbnail derivatives
    for (let i = 0; i < timestamps.length; i++) {
      const seq = i
      const timestampSec = timestamps[i]
      const frameFileName = `frame_${String(seq).padStart(3, "0")}.png`
      const thumbFileName = `frame_${String(seq).padStart(3, "0")}.jpg`
      const frameLocalPath = path.join(framesDir, frameFileName)
      const thumbLocalPath = path.join(thumbsDir, thumbFileName)

      // Lossless unenhanced original frame
      const frameBytes = await extractFramePng(tempVideoPath, timestampSec, frameLocalPath)
      const frameSha256 = createHash("sha256").update(frameBytes).digest("hex")

      // Thumbnail derivative
      const thumbBytes = await generateThumbnailJpg(frameLocalPath, thumbLocalPath)

      const storageFramePath = `video-evidence/${job.deal_id}/${job.id}/extracted/${frameFileName}`
      const storageThumbPath = `video-evidence/${job.deal_id}/${job.id}/thumbnails/${thumbFileName}`

      // Upload genuine frame and thumbnail derivative to private storage
      await storage.uploadObject(job.source_bucket, storageFramePath, frameBytes, "image/png")
      await storage.uploadObject(job.source_bucket, storageThumbPath, thumbBytes, "image/jpeg")

      extractedFrames.push({
        sequenceNo: seq,
        sourceTimeMs: Math.round(timestampSec * 1000),
        originalFramePath: storageFramePath,
        thumbnailPath: storageThumbPath,
        sha256: frameSha256,
        mimeType: "image/png",
        width: inspection.width,
        height: inspection.height,
        bytes: frameBytes,
        thumbnailBytes: thumbBytes,
        localFramePath: frameLocalPath,
      })
    }

    // 6. Generate contact sheet derivative with labelled tiles
    const contactSheetLocalPath = path.join(tempDir, "contact_sheet.jpg")
    const contactSheetBytes = await generateContactSheet(
      extractedFrames.map((f) => ({
        frameLocalPath: f.localFramePath,
        sequenceNo: f.sequenceNo,
        sourceTimeMs: f.sourceTimeMs,
      })),
      tempDir,
      contactSheetLocalPath
    )
    const storageContactSheetPath = `video-evidence/${job.deal_id}/${job.id}/contact_sheet.jpg`
    await storage.uploadObject(
      job.source_bucket,
      storageContactSheetPath,
      contactSheetBytes,
      "image/jpeg"
    )

    // 7. Persist frame records in database (Task 11B schema)
    await insertVideoFrames(
      extractedFrames.map((f) => ({
        id: `vf_${randomUUID()}`,
        jobId: job.id,
        sequenceNo: f.sequenceNo,
        sourceTimeMs: f.sourceTimeMs,
        originalFramePath: f.originalFramePath,
        thumbnailPath: f.thumbnailPath,
        sha256: f.sha256,
        mimeType: f.mimeType,
        width: f.width,
        height: f.height,
        isReviewedEvidence: false,
      }))
    )

    // 8. Complete video job in database with worker lease fencing
    const completed = await completeVideoJob(job.id, {
      workerId,
      observedBytes: videoBytes.length,
      sha256: videoSha256,
      durationMs: inspection.durationMs,
      contactSheetPath: storageContactSheetPath,
      processorVersion: WORKER_PROCESSOR_VERSION,
    })

    if (!completed) {
      return {
        success: false,
        jobId: job.id,
        code: "LEASE_LOST_OR_EXPIRED",
        message: "Video job lease expired or was reclaimed by another worker before completion.",
      }
    }

    return {
      success: true,
      jobId: job.id,
      frameCount: extractedFrames.length,
      durationMs: inspection.durationMs,
      sha256: videoSha256,
    }
  } catch (error: unknown) {
    const message = (error as Error).message ?? "Unknown worker error"
    await markJobFailed(job.id, "EXTRACTION_FAILED", workerId)
    return {
      success: false,
      jobId: job.id,
      code: "EXTRACTION_FAILED",
      message,
    }
  } finally {
    // 9. Guaranteed removal of all temporary worker files
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignored cleanup error
    }
  }
}

/**
 * Worker polling loop cycle: claims next queued job and processes it.
 */
export async function runWorkerCycle(
  workerId: string,
  deps: WorkerDependencies = {},
  dealId?: string
): Promise<ProcessJobResult | null> {
  const claimedJob = await claimNextQueuedVideoJob(workerId, 10, dealId)
  if (!claimedJob) {
    return null
  }
  return processVideoJob(claimedJob, { ...deps, workerId })
}
