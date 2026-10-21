// Single source of truth for capture and upload limits. Imported by the server validators AND the browser
// capture code, so the two can never disagree. Plain constants only: safe to ship to the client.

export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const
export const MAX_CLIP_BYTES = 250 * 1024 * 1024 // draft launch limit from the architecture brief (the original module allowed 2 GB)
export const MAX_CLIP_SECONDS = 300

export const MAX_FRAMES_PER_CLIP = 120
export const MAX_FRAMES_PER_ASSESSMENT = 120 // total across clips: bounds storage and row growth
export const MAX_CLIPS_PER_ASSESSMENT = 5

// Frame capture, taken from the supplied viewing module so behaviour matches what James already tested.
export const CAPTURE_MAX_FRAMES = 40 // also the per-analysis-run ceiling
export const CAPTURE_DEFAULT_SAMPLE = 12
export const FRAME_MAX_WIDTH = 960
export const FRAME_JPEG_QUALITY = 0.72
export const SEEK_TIMEOUT_MS = 10_000
export const MAX_FRAME_BYTES = 2 * 1024 * 1024 // matches the stored-object policy and the database CHECK
