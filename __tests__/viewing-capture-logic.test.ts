import { createHash } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import { CAPTURE_MAX_FRAMES, MAX_CLIP_BYTES, MAX_CLIP_SECONDS } from "@/lib/viewing-assessment/capture-limits"
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
import { uploadClipFrames, uploadFramesById, type FrameToUpload } from "@/lib/viewing-assessment/capture/upload-frames"
import { tinyJpeg } from "./fixtures/jpeg-fixtures"

describe("video file checks (before anything is loaded)", () => {
  it("accepts MP4, MOV and WebM within the size limit", () => {
    for (const type of ["video/mp4", "video/quicktime", "video/webm"]) {
      expect(checkVideoFile({ name: "a", type, size: 1000 })).toEqual({ ok: true })
    }
    expect(checkVideoFile({ name: "a", type: "video/mp4", size: MAX_CLIP_BYTES })).toEqual({ ok: true })
  })

  it("rejects unsupported types, unidentified files, empty files and oversized clips with a clear reason", () => {
    expect(checkVideoFile({ name: "a.avi", type: "video/x-msvideo", size: 10 })).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE", message: expect.stringContaining("video/x-msvideo") })
    expect(checkVideoFile({ name: "a.pdf", type: "application/pdf", size: 10 })).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE" })
    expect(checkVideoFile({ name: "a.mp4", type: "", size: 10 })).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE" })
    expect(checkVideoFile({ name: "a.mp4", type: "video/mp4", size: 0 })).toMatchObject({ ok: false, code: "EMPTY" })
    expect(checkVideoFile({ name: "a.mp4", type: "video/mp4", size: MAX_CLIP_BYTES + 1 })).toMatchObject({ ok: false, code: "TOO_LARGE" })
  })

  it("uses the server's limit, not the original module's 2 GB", () => {
    expect(checkVideoFile({ name: "a.mp4", type: "video/mp4", size: 300 * 1024 ** 2 }).ok).toBe(false)
  })

  it("checks duration: unreadable, zero, NaN and too-long clips are refused", () => {
    expect(checkDuration(60)).toEqual({ ok: true })
    expect(checkDuration(MAX_CLIP_SECONDS)).toEqual({ ok: true })
    for (const bad of [0, -1, NaN, Infinity]) expect(checkDuration(bad).ok).toBe(false)
    expect(checkDuration(MAX_CLIP_SECONDS + 1)).toMatchObject({ ok: false, message: expect.stringContaining("5 minutes") })
  })
})

describe("error mapping gives plain language and never leaks raw error text", () => {
  it("maps media error codes", () => {
    expect(mediaErrorMessage(4)).toMatch(/cannot play that video format/)
    expect(mediaErrorMessage(3)).toMatch(/damaged|cannot decode/)
    expect(mediaErrorMessage(2)).toMatch(/could not be read/)
    expect(mediaErrorMessage(1)).toMatch(/cancelled/)
    expect(mediaErrorMessage(undefined)).toMatch(/could not be played/)
  })

  it("maps permission, security and read failures; unknown errors get a generic message", () => {
    for (const name of ["SecurityError", "NotAllowedError", "NotReadableError", "NotFoundError", "AbortError"]) {
      const message = captureErrorMessage(Object.assign(new Error("RAW SECRET TEXT"), { name }))
      expect(message, name).not.toContain("RAW SECRET TEXT")
      expect(message.length).toBeGreaterThan(10)
    }
    expect(captureErrorMessage(new Error("boom /home/user/file"))).not.toContain("/home/user")
    expect(captureErrorMessage(new CaptureError(NO_PICTURE_MESSAGE))).toBe(NO_PICTURE_MESSAGE)
    expect(captureErrorMessage("string")).toMatch(/could not be captured/)
  })
})

describe("frame sampling and timestamps (behaviour of the supplied module)", () => {
  it("places samples at the middle of equal slices and rounds to 10 ms", () => {
    const times = planSampleTimes(60, 12)
    expect(times).toHaveLength(12)
    expect(times[0]).toBe(2.5)
    expect(times[11]).toBe(57.5)
    expect(planSampleTimes(10, 3)).toEqual([1.67, 5, 8.33])
  })

  it("plans 12 distinct midpoint samples for the 23-second Samsung test clip", () => {
    expect(planSampleTimes(23, 12)).toEqual([0.96, 2.88, 4.79, 6.71, 8.63, 10.54, 12.46, 14.38, 16.29, 18.21, 20.13, 22.04])
  })

  it("never samples past the last frame, and never exceeds the frame ceiling", () => {
    expect(planSampleTimes(1, 1)[0]).toBeLessThanOrEqual(0.95)
    expect(planSampleTimes(60, 100)).toHaveLength(CAPTURE_MAX_FRAMES)
    expect(planSampleTimes(60, 12, 35)).toHaveLength(5)
    expect(planSampleTimes(60, 12, CAPTURE_MAX_FRAMES)).toEqual([])
    expect(planSampleTimes(0, 5)).toEqual([])
    expect(planSampleTimes(NaN, 5)).toEqual([])
    expect(planSampleTimes(60, 0)).toEqual([])
  })

  it("formats and scales", () => {
    expect(roundTimestamp(12.5)).toBe(12.5)
    expect(roundTimestamp(1.004)).toBe(1)
    expect(formatClock(72.9)).toBe("1:12")
    expect(scaledSize(1920, 1080, 960)).toEqual({ width: 960, height: 540 })
    expect(scaledSize(640, 480, 960)).toEqual({ width: 640, height: 480 })
  })
})

describe("coverage statement states what the frames cannot support", () => {
  it("says nothing is assessed when there are no frames", () => {
    const c = describeCoverage([], 60)
    expect(c).toMatchObject({ frameCount: 0, firstSeconds: null, lastSeconds: null, largestGapSeconds: 60 })
    expect(c.statement).toMatch(/NOT ASSESSED/)
  })

  it("measures the largest unseen stretch including the start and end of the clip", () => {
    expect(describeCoverage([10, 20, 50], 60).largestGapSeconds).toBe(30)
    expect(describeCoverage([30], 60).largestGapSeconds).toBe(30)
    expect(describeCoverage([55], 60).largestGapSeconds).toBe(55)
    const c = describeCoverage([50, 10, 20], 60) // order-independent
    expect(c).toMatchObject({ frameCount: 3, firstSeconds: 10, lastSeconds: 50 })
    expect(c.statement).toMatch(/never proof/)
    expect(c.statement).toMatch(/NOT ASSESSED/)
  })
})

describe("frame upload orchestration (browser side, fake fetch)", () => {
  const sha256Hex = async (b: Uint8Array) => createHash("sha256").update(b).digest("hex")
  const clip = { filename: "walk.mp4", mimeType: "video/mp4", sizeBytes: 5000, durationSeconds: 60 }
  const frames: FrameToUpload[] = [
    { timestampSeconds: 5, room: "Kitchen", bytes: tinyJpeg("1") },
    { timestampSeconds: 20, bytes: tinyJpeg("2") },
    { timestampSeconds: 40, bytes: tinyJpeg("3") },
  ]
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
  const registered = (n: number) => reply(201, { success: true, evidence: Array.from({ length: n }, (_, i) => ({ id: `ev-${i + 1}` })) })

  it("registers the clip once, then uploads each frame with its checksum, reporting progress", async () => {
    const calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = []
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method as string, headers: init.headers as Record<string, string>, body: init.body })
      return calls.length === 1 ? registered(3) : reply(201, { success: true })
    })
    const progress: number[] = []
    const out = await uploadClipFrames(clip, frames, { baseUrl: "/api/x", fetchImpl: fetchImpl as unknown as typeof fetch, sha256Hex, onProgress: (p) => progress.push(p.uploaded) })
    expect(out).toMatchObject({ status: "done", evidenceIds: ["ev-1", "ev-2", "ev-3"] })
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/x/evidence", "PUT /api/x/evidence/ev-1/image", "PUT /api/x/evidence/ev-2/image", "PUT /api/x/evidence/ev-3/image"])
    const register = JSON.parse(calls[0].body as string)
    expect(register.clip).toMatchObject({ filename: "walk.mp4", mimeType: "video/mp4", contentSha256: null })
    expect(register.frames).toEqual([{ timestampSeconds: 5, room: "Kitchen" }, { timestampSeconds: 20 }, { timestampSeconds: 40 }])
    expect(calls[1].headers["content-type"]).toBe("image/jpeg")
    expect(calls[1].headers["x-content-sha256"]).toBe(await sha256Hex(frames[0].bytes))
    expect(progress).toEqual([0, 1, 2, 3])
  })

  it("never sends the original video: only JSON metadata and JPEG frame bytes leave the browser", async () => {
    const bodies: unknown[] = []
    const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => {
      bodies.push(init.body)
      return bodies.length === 1 ? registered(3) : reply(201, {})
    })
    await uploadClipFrames(clip, frames, { baseUrl: "/api/x", fetchImpl: fetchImpl as unknown as typeof fetch, sha256Hex })
    expect(typeof bodies[0]).toBe("string")
    for (const body of bodies.slice(1)) {
      expect(body).toBeInstanceOf(Uint8Array)
      expect((body as Uint8Array).length).toBeLessThan(5000)
    }
  })

  it("maps registration failures to plain language and stops before uploading any image", async () => {
    for (const [status, body, expected] of [
      [401, { error: "AUTHENTICATION_REQUIRED" }, /not signed in/],
      [404, { error: "SAVED_DEAL_NOT_FOUND" }, /could not be found/],
      [409, { error: "DUPLICATE_ASSET" }, /already been added/],
      [422, { error: "TOO_MANY_FRAMES" }, /maximum number of frames/],
      [400, { error: "Invalid input.", validation: { errors: ["frames[0].timestampSeconds must be within the clip"] } }, /within the clip/],
      [500, { error: "VIEWING_ASSESSMENT_FAILED", traceId: "t" }, /could not save/],
    ] as const) {
      const fetchImpl = vi.fn(async () => reply(status, body))
      const out = await uploadClipFrames(clip, frames, { baseUrl: "/api/x", fetchImpl: fetchImpl as unknown as typeof fetch, sha256Hex })
      expect(out).toMatchObject({ status: "registration_failed", message: expect.stringMatching(expected) })
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    }
  })

  it("reports an unreachable server and refuses empty or oversized frames before any request", async () => {
    const down = vi.fn(async () => { throw new TypeError("network") })
    expect(await uploadClipFrames(clip, frames, { baseUrl: "/api/x", fetchImpl: down as unknown as typeof fetch, sha256Hex })).toMatchObject({ status: "registration_failed", message: expect.stringMatching(/could not be reached/) })
    const never = vi.fn()
    const empty = await uploadClipFrames(clip, [{ timestampSeconds: 1, bytes: new Uint8Array(0) }], { baseUrl: "/api/x", fetchImpl: never as unknown as typeof fetch, sha256Hex })
    expect(empty).toMatchObject({ status: "registration_failed" })
    expect(never).not.toHaveBeenCalled()
  })

  it("rejects a registration response that does not match the frames sent", async () => {
    const fetchImpl = vi.fn(async () => registered(2))
    const out = await uploadClipFrames(clip, frames, { baseUrl: "/api/x", fetchImpl: fetchImpl as unknown as typeof fetch, sha256Hex })
    expect(out).toMatchObject({ status: "registration_failed", message: expect.stringMatching(/unexpected response/) })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("retries a dropped connection once, reports partial success, and retries only the failed frames by id", async () => {
    let putCount = 0
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === "POST") return registered(3)
      putCount++
      if (url.includes("ev-2")) return reply(413, { error: "TOO_LARGE" })
      return reply(201, {})
    })
    const deps = { baseUrl: "/api/x", fetchImpl: fetchImpl as unknown as typeof fetch, sha256Hex }
    const out = await uploadClipFrames(clip, frames, deps)
    expect(out.status).toBe("partial")
    if (out.status === "registration_failed") throw new Error("unexpected")
    expect(out.results.map((r) => r.ok)).toEqual([true, false, true])

    const before = fetchImpl.mock.calls.length
    const again = await uploadFramesById(out.evidenceIds, frames, deps, undefined, new Set([1]))
    expect(fetchImpl.mock.calls.length - before).toBe(1) // only the failed frame was sent again, nothing re-registered
    expect(again[1]).toMatchObject({ ok: false })
    expect(putCount).toBe(4)
  })

  it("retries once after a network error, then succeeds without duplicating the frame", async () => {
    let attempts = 0
    const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => {
      if (init.method === "POST") return registered(1)
      if (++attempts === 1) throw new TypeError("dropped")
      return reply(201, {})
    })
    const out = await uploadClipFrames(clip, frames.slice(0, 1), { baseUrl: "/api/x", fetchImpl: fetchImpl as unknown as typeof fetch, sha256Hex })
    expect(out.status).toBe("done")
    expect(attempts).toBe(2)
  })

  it("attaches authentication headers from the login layer when one exists, and sends none by default", async () => {
    const seen: Record<string, string>[] = []
    const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => {
      seen.push(init.headers as Record<string, string>)
      return seen.length === 1 ? registered(1) : reply(201, {})
    })
    await uploadClipFrames(clip, frames.slice(0, 1), { baseUrl: "/api/x", fetchImpl: fetchImpl as unknown as typeof fetch, sha256Hex, headers: () => ({ authorization: "Bearer test-token" }) })
    expect(seen.every((h) => h.authorization === "Bearer test-token")).toBe(true)
    seen.length = 0
    await uploadClipFrames(clip, frames.slice(0, 1), { baseUrl: "/api/x", fetchImpl: fetchImpl as unknown as typeof fetch, sha256Hex })
    expect(seen.some((h) => "authorization" in h)).toBe(false)
  })
})
