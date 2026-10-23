import { describe, expect, it, vi } from "vitest"
import { createResumableTusUpload } from "@/lib/viewing-assessment/capture/resumable-tus-uploader"
import type { VideoUploadProtocols } from "@/types/video-jobs"

describe("resumable-tus-uploader", () => {
  const dummyProtocols: VideoUploadProtocols = {
    standard: {
      uploadUrl: "https://storage.local/upload/standard",
      token: "standard-token-123",
      method: "POST",
    },
    resumable: {
      endpoint: "https://storage.local/upload/resumable",
      uploadUrl: "https://storage.local/upload/resumable",
      signatureToken: "sig-token-abc",
      bucket: "deal-evidence",
      objectName: "video-evidence/deal-1/vj-1/original.mp4",
      metadata: {
        bucketName: "deal-evidence",
        objectName: "video-evidence/deal-1/vj-1/original.mp4",
        contentType: "video/mp4",
      },
    },
  }

  it("initializes TUS session with proper metadata and signature headers and uploads chunks", async () => {
    // 12 MB buffer -> 2 chunks with 6 MB chunk size
    const testBytes = new Uint8Array(12 * 1024 * 1024)
    const blob = new Blob([testBytes], { type: "video/mp4" })

    const calls: { url: string; method?: string; headers?: Record<string, string> }[] = []

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url)
      const headers = (init?.headers as Record<string, string>) || {}
      calls.push({ url: urlStr, method: init?.method, headers })

      if (urlStr === "https://storage.local/upload/resumable" && init?.method === "POST") {
        return new Response(null, {
          status: 201,
          headers: {
            "Location": "https://storage.local/upload/resumable/session-xyz",
            "Tus-Resumable": "1.0.0",
          },
        })
      }

      if (urlStr === "https://storage.local/upload/resumable/session-xyz" && init?.method === "PATCH") {
        const offset = parseInt(headers["Upload-Offset"] || "0", 10)
        const nextOffset = offset + (6 * 1024 * 1024)
        return new Response(null, {
          status: 204,
          headers: {
            "Upload-Offset": String(nextOffset),
            "Tus-Resumable": "1.0.0",
          },
        })
      }

      return new Response("Not found", { status: 404 })
    })

    const progressReports: number[] = []
    let successCalled = false

    const controller = createResumableTusUpload({
      file: blob,
      protocols: dummyProtocols,
      chunkSize: 6 * 1024 * 1024,
      fetchImpl: mockFetch as unknown as typeof fetch,
      onProgress: (p) => progressReports.push(p.percentage),
      onSuccess: () => { successCalled = true },
    })

    await controller.start()

    expect(successCalled).toBe(true)
    expect(progressReports).toContain(0)
    expect(progressReports).toContain(50)
    expect(progressReports).toContain(100)

    // Check POST call
    const postCall = calls.find((c) => c.method === "POST")
    expect(postCall).toBeDefined()
    expect(postCall?.headers?.["Tus-Resumable"]).toBe("1.0.0")
    expect(postCall?.headers?.["x-signature"]).toBe("sig-token-abc")
    expect(postCall?.headers?.["Upload-Length"]).toBe(String(12 * 1024 * 1024))
    expect(postCall?.headers?.["Upload-Metadata"]).toContain("bucketName")

    // Check PATCH calls
    const patchCalls = calls.filter((c) => c.method === "PATCH")
    expect(patchCalls.length).toBe(2)
    expect(patchCalls[0].headers?.["Upload-Offset"]).toBe("0")
    expect(patchCalls[0].headers?.["Content-Type"]).toBe("application/offset+octet-stream")
    expect(patchCalls[0].headers?.["x-signature"]).toBe("sig-token-abc")
    expect(patchCalls[1].headers?.["Upload-Offset"]).toBe(String(6 * 1024 * 1024))
  })

  it("safely retries on transient chunk upload failure with offset reconciliation", async () => {
    const testBytes = new Uint8Array(6 * 1024 * 1024)
    const blob = new Blob([testBytes], { type: "video/mp4" })

    let patchAttempts = 0

    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(null, {
          status: 201,
          headers: {
            "Location": "https://storage.local/upload/resumable/session-retry",
            "Tus-Resumable": "1.0.0",
          },
        })
      }

      if (init?.method === "PATCH") {
        patchAttempts++
        if (patchAttempts === 1) {
          // Simulate transient 503 error on first chunk attempt
          return new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" })
        }
        return new Response(null, {
          status: 204,
          headers: {
            "Upload-Offset": String(6 * 1024 * 1024),
            "Tus-Resumable": "1.0.0",
          },
        })
      }

      if (init?.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: {
            "Upload-Offset": "0",
            "Tus-Resumable": "1.0.0",
          },
        })
      }

      return new Response("Not found", { status: 404 })
    })

    let successCalled = false

    const controller = createResumableTusUpload({
      file: blob,
      protocols: dummyProtocols,
      fetchImpl: mockFetch as unknown as typeof fetch,
      onSuccess: () => { successCalled = true },
    })

    await controller.start()

    expect(successCalled).toBe(true)
    expect(patchAttempts).toBe(2) // 1 failed + 1 successful retry
  })

  it("handles pause and resume querying HEAD offset before continuing", async () => {
    const testBytes = new Uint8Array(12 * 1024 * 1024)
    const blob = new Blob([testBytes], { type: "video/mp4" })

    let headCalled = false

    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = (init?.headers as Record<string, string>) || {}

      if (init?.method === "POST") {
        return new Response(null, {
          status: 201,
          headers: {
            "Location": "https://storage.local/upload/resumable/session-pause",
            "Tus-Resumable": "1.0.0",
          },
        })
      }

      if (init?.method === "HEAD") {
        headCalled = true
        return new Response(null, {
          status: 200,
          headers: {
            "Upload-Offset": String(6 * 1024 * 1024),
            "Tus-Resumable": "1.0.0",
          },
        })
      }

      if (init?.method === "PATCH") {
        const offset = parseInt(headers["Upload-Offset"] || "0", 10)
        return new Response(null, {
          status: 204,
          headers: {
            "Upload-Offset": String(offset + 6 * 1024 * 1024),
            "Tus-Resumable": "1.0.0",
          },
        })
      }

      return new Response("Not found", { status: 404 })
    })

    let successCalled = false

    const controller = createResumableTusUpload({
      file: blob,
      protocols: dummyProtocols,
      chunkSize: 6 * 1024 * 1024,
      fetchImpl: mockFetch as unknown as typeof fetch,
      onSuccess: () => { successCalled = true },
    })

    // Start upload
    const startPromise = controller.start()
    // Immediately pause
    controller.pause()
    expect(controller.isPaused()).toBe(true)
    await startPromise

    // Resume upload
    await controller.resume()
    expect(headCalled).toBe(true)
    expect(successCalled).toBe(true)
  })
})
