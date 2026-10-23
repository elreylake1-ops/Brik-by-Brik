import { describe, expect, it } from "vitest"
import * as path from "node:path"
import { isQaEnvironment, assertSafeQaPath, isValidIdentifier } from "@/lib/qa-security"
import { isDevelopmentOpen } from "@/lib/operator-command/guard-saved-deal-api"
import { LocalFsVideoStorageService } from "@/lib/viewing-assessment/video/local-fs-video-storage"
import { POST as resumablePost } from "@/app/api/qa/video-storage/resumable/route"
import { GET as readGet } from "@/app/api/qa/video-storage/read/[...path]/route"
import { PUT as uploadPut } from "@/app/api/qa/video-storage/upload/[...path]/route"
import { POST as workerPost } from "@/app/api/qa/video-worker/cycle/route"

describe("QA Security Guard and Fail-Closed Environment Verification", () => {
  it("strictly fails closed under Production, Preview, or CI environments even if local QA flags are present", () => {
    const hostileEnvConfigs = [
      { NODE_ENV: "production", SAVED_DEALS_AUTH_ENFORCEMENT: "development-open" },
      { NODE_ENV: "development", VERCEL: "1", SAVED_DEALS_AUTH_ENFORCEMENT: "development-open" },
      { NODE_ENV: "development", VERCEL_ENV: "preview", SAVED_DEALS_AUTH_ENFORCEMENT: "development-open" },
      { NODE_ENV: "development", NEXT_PUBLIC_VERCEL_ENV: "preview", SAVED_DEALS_AUTH_ENFORCEMENT: "development-open" },
      { NODE_ENV: "development", CI: "true", SAVED_DEALS_AUTH_ENFORCEMENT: "development-open" },
      { NODE_ENV: "development", APP_ENV: "production", SAVED_DEALS_AUTH_ENFORCEMENT: "development-open" },
    ]

    for (const env of hostileEnvConfigs) {
      expect(isQaEnvironment(env)).toBe(false)
      expect(isDevelopmentOpen(env)).toBe(false)
    }
  })

  it("permits QA operations strictly when in development or test without deployment markers", () => {
    expect(isQaEnvironment({ NODE_ENV: "development" })).toBe(true)
    expect(isQaEnvironment({ NODE_ENV: "test" })).toBe(true)
  })

  it("blocks path traversal attempts outside QA storage root", () => {
    const root = path.join(process.cwd(), ".qa-local", "evidence", "video")

    expect(() => assertSafeQaPath(root, "..", "secret.txt")).toThrow(/path traversal/i)
    expect(() => assertSafeQaPath(root, "deal-1", "..", "..", "system.ini")).toThrow(/path traversal/i)
    expect(() => assertSafeQaPath(root, "deal-1/../../../etc/passwd")).toThrow(/path traversal/i)

    const safe = assertSafeQaPath(root, "deal-1", "file.mp4")
    expect(safe).toContain("deal-1")
    expect(safe).toContain("file.mp4")
  })

  it("validates deal and session identifiers strictly", () => {
    expect(isValidIdentifier("deal-17408-blue-jay")).toBe(true)
    expect(isValidIdentifier("tus_12345678-abcd-ef01-2345-6789abcdef01")).toBe(true)
    expect(isValidIdentifier("vj_12345")).toBe(true)

    expect(isValidIdentifier("deal-1; DROP TABLE video_jobs;")).toBe(false)
    expect(isValidIdentifier("deal-1/../../")).toBe(false)
    expect(isValidIdentifier("deal-1\0bad")).toBe(false)
    expect(isValidIdentifier("")).toBe(false)
  })

  it("LocalFsVideoStorageService throws immediately in production or deployed environments", () => {
    const prev = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = "production"
      expect(() => new LocalFsVideoStorageService()).toThrow(/strictly forbidden/i)
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  it("all app/api/qa routes return HTTP 403 when QA environment is not allowed", async () => {
    const prev = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = "production"

      const req = new Request("http://localhost:3000/api/qa/video-storage/resumable", { method: "POST" })
      const res1 = await resumablePost(req)
      expect(res1.status).toBe(403)

      const res2 = await readGet(new Request("http://localhost:3000/api/qa/video-storage/read/test.png"), {
        params: Promise.resolve({ path: ["test.png"] }),
      })
      expect(res2.status).toBe(403)

      const res3 = await uploadPut(new Request("http://localhost:3000/api/qa/video-storage/upload/test.mp4", { method: "PUT", body: "test" }), {
        params: Promise.resolve({ path: ["test.mp4"] }),
      })
      expect(res3.status).toBe(403)

      const res4 = await workerPost(new Request("http://localhost:3000/api/qa/video-worker/cycle", { method: "POST", body: "{}" }))
      expect(res4.status).toBe(403)
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  it("worker cycle route rejects malformed or malicious dealId", async () => {
    const maliciousReq = new Request("http://localhost:3000/api/qa/video-worker/cycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId: "deal-1; DROP TABLE video_jobs; --" }),
    })
    const res = await workerPost(maliciousReq)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("INVALID_DEAL_ID")
  })
})
