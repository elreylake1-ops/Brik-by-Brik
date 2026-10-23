// Browser-side direct-to-storage resumable TUS uploader (Task 11E)
// Uploads large walkthrough video files (up to 500 MB) directly to Supabase Storage using 6 MB chunks.
// Never proxies video bytes through Vercel or Next.js serverless functions.

import type { VideoUploadProtocols } from "@/types/video-jobs"

export const TUS_CHUNK_SIZE = 6 * 1024 * 1024 // 6 MB minimum chunk size for Supabase Storage TUS

export type UploadProgress = {
  bytesUploaded: number
  totalBytes: number
  percentage: number
}

export type TusUploadOptions = {
  file: File | Blob
  protocols: VideoUploadProtocols
  chunkSize?: number
  fetchImpl?: typeof fetch
  onProgress?: (progress: UploadProgress) => void
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export type TusUploadController = {
  start: () => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  abort: () => void
  isPaused: () => boolean
}

function base64Encode(str: string): string {
  if (typeof btoa === "function") {
    return btoa(str)
  }
  return Buffer.from(str, "utf-8").toString("base64")
}

export function createResumableTusUpload(options: TusUploadOptions): TusUploadController {
  const { file, protocols, chunkSize = TUS_CHUNK_SIZE, fetchImpl = fetch, onProgress, onSuccess, onError } = options

  let paused = false
  let aborted = false
  let abortController: AbortController | null = null
  let currentOffset = 0
  let uploadUrl: string | null = null

  const reportProgress = (offset: number) => {
    currentOffset = offset
    const percentage = file.size > 0 ? Math.min(100, Math.round((offset / file.size) * 100)) : 100
    onProgress?.({ bytesUploaded: offset, totalBytes: file.size, percentage })
  }

  async function getUploadOffset(url: string, signatureToken: string, signal: AbortSignal): Promise<number> {
    const res = await fetchImpl(url, {
      method: "HEAD",
      headers: {
        "Tus-Resumable": "1.0.0",
        "x-signature": signatureToken,
      },
      signal,
    })
    if (!res.ok) {
      throw new Error(`Failed to query upload offset: HTTP ${res.status} ${res.statusText}`)
    }
    const offsetHeader = res.headers.get("Upload-Offset")
    return offsetHeader ? parseInt(offsetHeader, 10) : 0
  }

  async function createTusUploadSession(signal: AbortSignal): Promise<string> {
    const { resumable } = protocols
    const b64Bucket = base64Encode(resumable.bucket)
    const b64Object = base64Encode(resumable.objectName)
    const b64Mime = base64Encode(resumable.metadata.contentType)

    const metadataHeader = `bucketName ${b64Bucket},objectName ${b64Object},contentType ${b64Mime}`

    const res = await fetchImpl(resumable.endpoint, {
      method: "POST",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(file.size),
        "Upload-Metadata": metadataHeader,
        "x-signature": resumable.signatureToken,
      },
      signal,
    })

    if (!res.ok && res.status !== 201) {
      throw new Error(`Failed to initialize resumable upload: HTTP ${res.status} ${res.statusText}`)
    }

    const location = res.headers.get("Location")
    if (!location) {
      // In some proxies or relative returns, construct or use endpoint
      throw new Error("Storage server did not return a Location header for resumable upload")
    }

    // Resolve relative Location headers if needed
    if (location.startsWith("http")) {
      return location
    }
    const base = resumable.endpoint.replace(/\/storage\/v1\/upload\/resumable.*$/, "")
    return `${base}${location.startsWith("/") ? "" : "/"}${location}`
  }

  async function uploadChunks(signal: AbortSignal): Promise<void> {
    const { resumable } = protocols
    const maxRetries = 3
    let retryCount = 0

    while (currentOffset < file.size) {
      if (paused || aborted) return

      const nextEnd = Math.min(currentOffset + chunkSize, file.size)
      const chunk = file.slice(currentOffset, nextEnd)

      try {
        const res = await fetchImpl(uploadUrl!, {
          method: "PATCH",
          headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": String(currentOffset),
            "Content-Type": "application/offset+octet-stream",
            "x-signature": resumable.signatureToken,
          },
          body: chunk,
          signal,
        })

        if (!res.ok && res.status !== 204) {
          throw new Error(`Chunk upload failed at offset ${currentOffset}: HTTP ${res.status} ${res.statusText}`)
        }

        const newOffsetHeader = res.headers.get("Upload-Offset")
        const newOffset = newOffsetHeader ? parseInt(newOffsetHeader, 10) : nextEnd
        reportProgress(newOffset)
        retryCount = 0 // Reset retry count after successful chunk upload
      } catch (chunkErr) {
        if (paused || aborted) return
        if (retryCount < maxRetries) {
          retryCount++
          const delayMs = Math.min(2000, 300 * Math.pow(2, retryCount - 1))
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          // Re-query server offset before retrying to safely handle partially accepted chunks
          try {
            currentOffset = await getUploadOffset(uploadUrl!, resumable.signatureToken, signal)
            reportProgress(currentOffset)
          } catch {
            // Keep current offset if HEAD check fails
          }
          continue
        }
        throw chunkErr
      }
    }

    if (!paused && !aborted && currentOffset >= file.size) {
      onSuccess?.()
    }
  }

  async function startStandardUpload(signal: AbortSignal): Promise<void> {
    // Standard non-resumable upload fallback (e.g. for mock/test environments)
    const { standard } = protocols
    reportProgress(0)

    const res = await fetchImpl(standard.uploadUrl, {
      method: standard.method,
      headers: {
        "Content-Type": (file as File).type || "video/mp4",
      },
      body: file,
      signal,
    })

    if (!res.ok) {
      throw new Error(`Standard upload failed: HTTP ${res.status} ${res.statusText}`)
    }

    reportProgress(file.size)
    onSuccess?.()
  }

  async function run(): Promise<void> {
    try {
      abortController = new AbortController()

      // If standard upload is preferred or resumable endpoint is omitted, fallback cleanly
      if (!protocols.resumable?.endpoint) {
        await startStandardUpload(abortController.signal)
        return
      }

      if (!uploadUrl) {
        uploadUrl = await createTusUploadSession(abortController.signal)
        reportProgress(0)
      } else {
        // Resume from current server offset
        currentOffset = await getUploadOffset(uploadUrl, protocols.resumable.signatureToken, abortController.signal)
        reportProgress(currentOffset)
      }

      await uploadChunks(abortController.signal)
    } catch (err) {
      if (paused) return // Pausing intentionally aborts in-flight request
      if (aborted) return
      const error = err instanceof Error ? err : new Error(String(err))
      onError?.(error)
    }
  }

  return {
    start: async () => {
      paused = false
      aborted = false
      await run()
    },
    pause: () => {
      paused = true
      abortController?.abort()
    },
    resume: async () => {
      if (!paused) return
      paused = false
      await run()
    },
    abort: () => {
      aborted = true
      paused = false
      abortController?.abort()
    },
    isPaused: () => paused,
  }
}
