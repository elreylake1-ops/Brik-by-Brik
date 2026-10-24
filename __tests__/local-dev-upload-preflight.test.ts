import { describe, it, expect } from "vitest"
import path from "node:path"
import { inspectMedia, probeStreamPresentationTimestamps } from "@/lib/viewing-assessment/video/media-inspector"
import { isQaEnvironment } from "@/lib/qa-security"
import { getVideoStorageService } from "@/lib/viewing-assessment/video/video-storage-service"

describe("Local Upload Preflight & Guard Verification", () => {
  it("verifies production fail-closed security guard strictly rejects production and CI", () => {
    expect(isQaEnvironment({ NODE_ENV: "production" })).toBe(false)
    expect(isQaEnvironment({ NODE_ENV: "development", VERCEL: "1" })).toBe(false)
    expect(isQaEnvironment({ NODE_ENV: "development", CI: "true" })).toBe(false)
    expect(isQaEnvironment({ NODE_ENV: "development" })).toBe(true)
    expect(isQaEnvironment({ NODE_ENV: "test" })).toBe(true)
  })

  it("verifies inspectMedia and probeStreamPresentationTimestamps on 3-second synthetic fixture", async () => {
    const fixturePath = path.resolve(__dirname, "fixtures", "synthetic-video.mp4")
    const media = await inspectMedia(fixturePath)
    expect(media.valid).toBe(true)
    if (media.valid) {
      expect(media.codec).toBe("h264")
      expect(media.durationSec).toBe(3)
      expect(media.width).toBe(320)
      expect(media.height).toBe(240)
      expect(media.fps).toBe(10)
    }

    const pts = await probeStreamPresentationTimestamps(fixturePath)
    expect(pts.length).toBe(30)
    expect(pts[0]).toBe(0)
    expect(pts[10]).toBeCloseTo(1.0, 1)
    expect(pts[20]).toBeCloseTo(2.0, 1)
  })

  it("verifies LocalFsVideoStorageService resolves in development with VIEWING_BLOB_STORE=local-fs", () => {
    const origEnv = { ...process.env }
    try {
      process.env.NODE_ENV = "development"
      delete process.env.VERCEL
      delete process.env.CI
      process.env.VIEWING_BLOB_STORE = "local-fs"
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_SERVICE_ROLE_KEY

      const storage = getVideoStorageService()
      expect(storage.constructor.name).toBe("LocalFsVideoStorageService")
    } finally {
      process.env = origEnv
    }
  })
})
