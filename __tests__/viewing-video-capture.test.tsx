// @vitest-environment jsdom

import { createHash } from "node:crypto"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import VideoCapture, { buildVisualReviewSummary, cleanVerdictNote, seekToDecodedFrame, type FrameGrabber } from "@/components/viewing-assessment/VideoCapture"
import { CaptureError, NO_PICTURE_MESSAGE } from "@/lib/viewing-assessment/capture/capture-logic"
import { tinyJpeg } from "./fixtures/jpeg-fixtures"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let urls: Set<string>
let counter = 0

const BASE = "/api/saved-deals/deal-1/viewing-assessments/asmt-1"
const mp4 = (over: Partial<{ name: string; type: string; size: number }> = {}) => {
  const f = new File([new Uint8Array(over.size ?? 1000)], over.name ?? "walk.mp4", { type: over.type ?? "video/mp4" })
  return f
}

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  urls = new Set()
  counter = 0
  vi.stubGlobal("URL", Object.assign(URL, {
    createObjectURL: vi.fn(() => {
      const u = `blob:test/${++counter}`
      urls.add(u)
      return u
    }),
    revokeObjectURL: vi.fn((u: string) => void urls.delete(u)),
  }))
  // jsdom has no media pipeline and its Blob lacks arrayBuffer() (all real browsers have it): polyfill faithfully.
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined)
  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function (this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = () => reject(reader.error)
        reader.readAsArrayBuffer(this)
      })
    }
  }
  // WebCrypto digest for the component's checksum (jsdom's crypto may lack subtle)
  vi.stubGlobal("crypto", {
    subtle: { digest: async (_alg: string, data: BufferSource) => new Uint8Array(createHash("sha256").update(new Uint8Array(data as ArrayBuffer)).digest()).buffer },
  })
})
afterEach(() => {
  vi.useRealTimers()
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const q = <T extends Element>(sel: string) => container.querySelector(sel) as T | null
const byText = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
/** Waits (inside act) until a condition holds, for flows with several async steps. */
const until = async (condition: () => boolean, timeoutMs = 2000) => {
  const end = Date.now() + timeoutMs
  while (!condition() && Date.now() < end) await flush()
  if (!condition()) throw new Error(`condition not met in time: ${container.textContent}`)
}

async function choose(file: File, testId = "video-file") {
  const input = q<HTMLInputElement>(`[data-testid=${testId}]`)!
  Object.defineProperty(input, "files", { value: [file], configurable: true })
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })) })
}

/** Makes the <video> behave like a decodable clip, including seeking (which fires "seeked"). */
async function loadVideo(over: { duration?: number; width?: number; height?: number; currentTime?: number } = {}) {
  const video = q<HTMLVideoElement>("[data-testid=video-preview]")!
  let time = over.currentTime ?? 0
  Object.defineProperty(video, "duration", { value: over.duration ?? 60, configurable: true })
  Object.defineProperty(video, "videoWidth", { value: over.width ?? 640, configurable: true })
  Object.defineProperty(video, "videoHeight", { value: over.height ?? 360, configurable: true })
  Object.defineProperty(video, "readyState", { value: 4, configurable: true })
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => time,
    set: (v: number) => {
      time = v
      queueMicrotask(() => video.dispatchEvent(new Event("seeked")))
    },
  })
  await act(async () => { video.dispatchEvent(new Event("loadedmetadata")) })
  return video
}

function presentFrames(video: HTMLVideoElement, mediaTimes: number[] = []) {
  let callbackId = 0
  Object.defineProperty(video, "requestVideoFrameCallback", {
    configurable: true,
    value: vi.fn((callback: VideoFrameRequestCallback) => {
      const id = ++callbackId
      const mediaTime = mediaTimes.shift() ?? video.currentTime
      queueMicrotask(() => callback(performance.now(), { mediaTime } as VideoFrameCallbackMetadata))
      return id
    }),
  })
  Object.defineProperty(video, "cancelVideoFrameCallback", { configurable: true, value: vi.fn() })
}

const grabber = (): FrameGrabber => vi.fn(async () => new Blob([tinyJpeg(`g${++counter}`) as unknown as BlobPart], { type: "image/jpeg" }))
const render = (props: Partial<React.ComponentProps<typeof VideoCapture>> = {}) =>
  act(() => root.render(<VideoCapture baseUrl={BASE} frameGrabber={grabber()} {...props} />))

describe("choosing a video", () => {
  it("states that the original video stays on the device and nothing is uploaded until frames are saved", () => {
    render()
    expect(q("[data-testid=retention-note]")?.textContent).toMatch(/original video stays on this device and is not uploaded/)
    expect(q("[data-testid=video-preview]")).toBeNull()
  })

  it("offers both choosing and recording (camera capture hint)", () => {
    render()
    expect(q("[data-testid=video-file]")).not.toBeNull()
    expect(q("[data-testid=video-record]")?.getAttribute("capture")).toBe("environment")
  })

  it("rejects an unsupported file type before loading it", async () => {
    render()
    await choose(mp4({ name: "a.avi", type: "video/x-msvideo" }))
    expect(q("[data-testid=capture-problem]")?.textContent).toMatch(/accepts MP4, MOV or WebM/)
    expect(q("[data-testid=video-preview]")).toBeNull()
    expect(urls.size).toBe(0) // nothing was loaded, so no object URL exists
  })

  it("rejects an oversized clip, and an empty one", async () => {
    render()
    const big = mp4({ size: 10 })
    Object.defineProperty(big, "size", { value: 300 * 1024 ** 2 })
    await choose(big)
    expect(q("[data-testid=capture-problem]")?.textContent).toMatch(/under 250 MB/)
    await choose(mp4({ size: 0 }))
    expect(q("[data-testid=capture-problem]")?.textContent).toMatch(/empty/)
  })

  it("explains a clip whose picture cannot be decoded (audio loads, no video track)", async () => {
    render()
    await choose(mp4())
    await loadVideo({ width: 0 })
    expect(q("[data-testid=capture-problem]")?.textContent).toBe(NO_PICTURE_MESSAGE)
    expect(byText("Capture this frame")).toBeUndefined()
  })

  it("reports the browser's own playback error in plain language", async () => {
    render()
    await choose(mp4())
    const video = q<HTMLVideoElement>("[data-testid=video-preview]")!
    Object.defineProperty(video, "error", { value: { code: 4 }, configurable: true })
    await act(async () => { video.dispatchEvent(new Event("error")) })
    expect(q("[data-testid=capture-problem]")?.textContent).toMatch(/cannot play that video format/)
  })

  it("refuses a clip that is too long", async () => {
    render()
    await choose(mp4())
    await loadVideo({ duration: 400 })
    expect(q("[data-testid=capture-problem]")?.textContent).toMatch(/limit is 5 minutes/)
    expect(byText("Sample evenly")).toBeUndefined()
  })
})

describe("capturing frames", () => {
  it("attempts and captures 12 distinct timestamps from a 23-second clip", async () => {
    render()
    await choose(mp4())
    await loadVideo({ duration: 23 })
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("completed") === true)
    const items = [...q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")]
    expect(items).toHaveLength(12)
    expect(items.map((item) => Number(item.getAttribute("data-requested-seconds")))).toEqual([0.96, 2.88, 4.79, 6.71, 8.63, 10.54, 12.46, 14.38, 16.29, 18.21, 20.13, 22.04])
    expect(new Set(items.map((item) => item.getAttribute("data-presented-seconds"))).size).toBe(12)
    expect(items.every((item) => item.getAttribute("data-capture-method") === "seeked-canvas")).toBe(true)
    expect(items.every((item) => item.getAttribute("data-capture-confidence") === "seek-timestamp-verified")).toBe(true)
    expect(items.every((item) => item.textContent?.includes("pixel freshness not callback-confirmed"))).toBe(true)
    expect(q("[data-testid=extraction-outcome]")?.textContent).toMatch(/completed.*Requested 12.*attempted 12.*captured 12/i)
  })

  it("waits for the decoded frame and records requested and presented timestamps", async () => {
    render()
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    presentFrames(video, [11.52])
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => !!q("[data-testid=extraction-outcome]"))
    expect(q("[data-testid=frame-thumbnails] li")?.getAttribute("data-requested-seconds")).toBe("11.5")
    expect(q("[data-testid=frame-thumbnails] li")?.getAttribute("data-presented-seconds")).toBe("11.52")
    expect(q("[data-testid=frame-thumbnails] li")?.getAttribute("data-capture-method")).toBe("video-frame-callback")
    expect(q("[data-testid=frame-thumbnails] li")?.getAttribute("data-capture-confidence")).toBe("presented-frame-confirmed")
  })

  it("accepts visually identical frames at distinct verified media times", async () => {
    const identical: FrameGrabber = vi.fn(async () => new Blob([tinyJpeg("same-scene") as unknown as BlobPart], { type: "image/jpeg" }))
    render({ frameGrabber: identical })
    await choose(mp4())
    await loadVideo({ duration: 23 })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      byText("Sample evenly")!.click()
    })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("completed") === true)
    const items = [...q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")]
    expect(items).toHaveLength(2)
    expect(items.map((item) => item.getAttribute("data-presented-seconds"))).toEqual(["5.75", "17.25"])
  })

  it("rejects a repeated actual media timestamp without comparing image pixels", async () => {
    render()
    await choose(mp4())
    const video = await loadVideo({ duration: 1 })
    presentFrames(video, [0.5, 0.5, 0.5])
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("partial") === true)
    expect(q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")).toHaveLength(1)
    expect(q("[data-testid=extraction-outcome]")?.textContent).toMatch(/captured 1/i)
    expect(q("[data-testid=capture-problem]")?.textContent).toMatch(/duplicate frame/i)
  })

  it("rejects a stale decoded frame and accepts the retry for the same slot", async () => {
    const frameGrabber = grabber()
    render({ frameGrabber })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    presentFrames(video, [0, 11.51])
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("completed") === true)
    expect(frameGrabber).toHaveBeenCalledTimes(1)
    expect(q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")).toHaveLength(1)
  })

  it("captures the frame at the current playback time, with a labelled thumbnail and the exact timestamp", async () => {
    render()
    await choose(mp4())
    await loadVideo({ currentTime: 72.5 })
    const room = q<HTMLInputElement>("input[maxlength='100']")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(room, "Kitchen")
      room.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { byText("Capture this frame")!.click() })
    await flush()
    const thumbs = q("[data-testid=frame-thumbnails]")!
    expect(thumbs.querySelectorAll("li")).toHaveLength(1)
    expect(thumbs.textContent).toContain("1:12 · Kitchen")
    expect(thumbs.querySelector("img")?.getAttribute("alt")).toBe("Frame at 1:12, Kitchen")
    expect(q("[data-testid=coverage-statement]")?.textContent).toMatch(/1 still frame captured/)
  })

  it("samples evenly using the module's midpoint formula, restoring the playback position", async () => {
    render()
    await choose(mp4())
    const video = await loadVideo({ duration: 60, currentTime: 7 })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "4")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => q("[data-testid=frame-thumbnails]")?.querySelectorAll("li").length === 4)
    const labels = [...q("[data-testid=frame-thumbnails]")!.querySelectorAll("li div span")].map((s) => s.textContent)
    expect(labels).toEqual(["0:07", "0:22", "0:37", "0:52"]) // 7.5, 22.5, 37.5, 52.5 seconds
    expect(video.currentTime).toBe(7)
  })

  it("attempts all slots, reports partial completion, and retries only the failed slot without duplicates", async () => {
    const attempts = new Map<number, number>()
    let failThirty = true
    const flaky: FrameGrabber = async () => {
      const timestamp = q<HTMLVideoElement>("[data-testid=video-preview]")!.currentTime
      const count = (attempts.get(timestamp) ?? 0) + 1
      attempts.set(timestamp, count)
      if (timestamp === 30 && failThirty) throw Object.assign(new Error("RAW /secret/path"), { name: "NotReadableError" })
      return new Blob([tinyJpeg(`s${timestamp}-${count}`) as unknown as BlobPart], { type: "image/jpeg" })
    }
    render({ frameGrabber: flaky })
    await choose(mp4())
    await loadVideo()
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "5")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("partial") === true)
    expect(q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")).toHaveLength(4)
    expect(q("[data-testid=extraction-outcome]")?.textContent).toMatch(/partial.*Requested 5.*attempted 5.*captured 4/i)
    expect(q("[data-testid=capture-problem]")?.textContent).toMatch(/file could not be read/)
    expect(container.textContent).not.toContain("RAW /secret/path")
    expect(attempts.get(30)).toBe(2)

    failThirty = false
    await until(() => byText("Retry 1 failed extraction")?.disabled === false)
    await act(async () => { byText("Retry 1 failed extraction")!.click() })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("completed") === true)
    expect(q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")).toHaveLength(5)
    expect(new Set([...q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")].map((li) => li.getAttribute("data-requested-seconds"))).size).toBe(5)
    expect(urls.size).toBe(6) // one source-video URL plus five unique frame URLs
  })

  it("continues after a persistent media-read failure following the first frame", async () => {
    let firstTimestamp: number | null = null
    const failedTimestamp = 11.5
    const frameGrabber: FrameGrabber = vi.fn(async (video) => {
      firstTimestamp ??= video.currentTime
      if (video.currentTime === failedTimestamp) throw Object.assign(new Error("device read failed"), { name: "NotReadableError" })
      return new Blob([tinyJpeg(`read-${video.currentTime}`) as unknown as BlobPart], { type: "image/jpeg" })
    })
    render({ frameGrabber })
    await choose(mp4())
    await loadVideo({ duration: 23 })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "3")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    // 3 midpoint slots are 3.83, 11.50 and 19.17 seconds.
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("partial") === true)
    expect(firstTimestamp).toBe(3.83)
    expect(q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")).toHaveLength(2)
    expect(q("[data-testid=extraction-outcome]")?.textContent).toMatch(/Requested 3.*attempted 3.*captured 2/i)
  })

  it("continues after Android-like media error events on one slot", async () => {
    render()
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    let time = 0
    let failures = 0
    Object.defineProperty(video, "error", { value: { code: 2 }, configurable: true })
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => time,
      set: (value: number) => {
        if (value === 11.5 && failures < 2) {
          failures += 1
          time = value - 1
          queueMicrotask(() => video.dispatchEvent(new Event("error")))
        } else {
          time = value
          queueMicrotask(() => video.dispatchEvent(new Event("seeked")))
        }
      },
    })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "3")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("partial") === true)
    expect(failures).toBe(2)
    expect(q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")).toHaveLength(2)
    expect(q("[data-testid=extraction-outcome]")?.textContent).toMatch(/Requested 3.*attempted 3.*captured 2/i)
  })

  it("reports failed when no requested frame can be decoded", async () => {
    render({ frameGrabber: vi.fn(async () => { throw new CaptureError(NO_PICTURE_MESSAGE) }) })
    await choose(mp4())
    await loadVideo({ duration: 23 })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("failed") === true)
    expect(q("[data-testid=extraction-outcome]")?.textContent).toMatch(/Requested 2.*attempted 2.*captured 0/i)
  })

  it("retries an intermittent read error once and stores one frame for the slot", async () => {
    let calls = 0
    const intermittent: FrameGrabber = vi.fn(async () => {
      if (++calls === 1) throw Object.assign(new Error("temporary"), { name: "NotReadableError" })
      return new Blob([tinyJpeg("retry") as unknown as BlobPart], { type: "image/jpeg" })
    })
    render({ frameGrabber: intermittent })
    await choose(mp4())
    await loadVideo({ duration: 23 })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("completed") === true)
    expect(intermittent).toHaveBeenCalledTimes(2)
    expect(q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")).toHaveLength(1)
  })

  it("reports a failed manual capture and keeps working", async () => {
    render({ frameGrabber: vi.fn(async () => { throw new CaptureError("The frame could not be encoded as a JPEG.") }) })
    await choose(mp4())
    await loadVideo()
    await act(async () => { byText("Capture this frame")!.click() })
    await flush()
    expect(q("[data-testid=capture-problem]")?.textContent).toBe("The frame could not be encoded as a JPEG.")
    expect(q("[data-testid=frame-thumbnails]")).toBeNull()
  })

  it("lets the user remove a frame before saving, releasing its object URL", async () => {
    render()
    await choose(mp4())
    await loadVideo()
    await act(async () => { byText("Capture this frame")!.click() })
    await flush()
    const before = urls.size
    await act(async () => { byText("Remove")!.click() })
    expect(q("[data-testid=frame-thumbnails]")).toBeNull()
    expect(urls.size).toBe(before - 1)
  })

  it("states plainly, before anything is captured, that unseen parts are not assessed", async () => {
    render()
    await choose(mp4())
    await loadVideo()
    expect(q("[data-testid=coverage-statement]")?.textContent).toMatch(/every check stays NOT ASSESSED/)
  })
})

describe("saving frames", () => {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

  async function captured(count: number, props: Partial<React.ComponentProps<typeof VideoCapture>> = {}) {
    render(props)
    await choose(mp4({ name: "C:\\fakepath\\walk.mp4" }))
    await loadVideo()
    for (let i = 0; i < count; i++) {
      await act(async () => { byText("Capture this frame")!.click() })
      await flush()
    }
  }

  it("sends only clip metadata and JPEG frames (never the video), then clears the saved frames and tells the parent", async () => {
    const sent: { url: string; method: string; body: unknown }[] = []
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      sent.push({ url, method: init.method as string, body: init.body })
      return init.method === "POST" ? reply(201, { success: true, evidence: [{ id: "e1" }, { id: "e2" }] }) : reply(201, { success: true })
    })
    const onSaved = vi.fn()
    await captured(2, { fetchImpl: fetchImpl as unknown as typeof fetch, onSaved })
    await act(async () => { byText("Save 2 frames")!.click() })
    await flush(); await flush()
    expect(sent.map((s) => `${s.method} ${s.url}`)).toEqual([`POST ${BASE}/evidence`, `PUT ${BASE}/evidence/e1/image`, `PUT ${BASE}/evidence/e2/image`])
    expect(JSON.parse(sent[0].body as string).clip).toMatchObject({ filename: "walk.mp4", mimeType: "video/mp4", sizeBytes: 1000, durationSeconds: 60 })
    expect(JSON.parse(sent[0].body as string).frames).toEqual([
      { timestampSeconds: 0, requestedTimestampSeconds: 0, captureMethod: "manual", captureConfidence: "manual-user-positioned" },
      { timestampSeconds: 0, requestedTimestampSeconds: 0, captureMethod: "manual", captureConfidence: "manual-user-positioned" },
    ])
    expect(sent.slice(1).every((s) => s.body instanceof Uint8Array && s.body.length < 1000)).toBe(true)
    expect(sent.some((s) => s.body instanceof File || s.body instanceof Blob)).toBe(false)
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(q("[data-testid=capture-saved]")?.textContent).toMatch(/2 frames saved/)
    expect(q("[data-testid=frame-thumbnails]")).toBeNull()
  })

  it("shows why saving failed (for example not signed in) and keeps the frames so nothing is lost", async () => {
    const fetchImpl = vi.fn(async () => reply(401, { success: false, error: "AUTHENTICATION_REQUIRED" }))
    const onSaved = vi.fn()
    await captured(1, { fetchImpl: fetchImpl as unknown as typeof fetch, onSaved })
    await act(async () => { byText("Save 1 frame")!.click() })
    await flush(); await flush()
    expect(q("[data-testid=capture-problem]")?.textContent).toMatch(/not signed in/)
    expect(q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")).toHaveLength(1)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it("on partial failure keeps the saved frames, lists the failed one, and retries only that one", async () => {
    let putsForE2 = 0
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === "POST") return reply(201, { success: true, evidence: [{ id: "e1" }, { id: "e2" }] })
      if (url.includes("/e2/")) return ++putsForE2 === 1 ? reply(503, { error: "STORAGE_UNAVAILABLE" }) : reply(201, { success: true })
      return reply(201, { success: true })
    })
    const onSaved = vi.fn()
    await captured(2, { fetchImpl: fetchImpl as unknown as typeof fetch, onSaved })
    await act(async () => { byText("Save 2 frames")!.click() })
    await flush(); await flush()
    const retryBox = q("[data-testid=upload-retry]")!
    expect(retryBox.textContent).toMatch(/Frame 2/)
    expect(retryBox.textContent).toMatch(/storage is not available/i)
    const callsBefore = fetchImpl.mock.calls.length
    await act(async () => { byText("Retry 1 failed frame")!.click() })
    await flush(); await flush()
    const retried = fetchImpl.mock.calls.slice(callsBefore).map(([u, i]) => `${(i as RequestInit).method} ${u}`)
    expect(retried).toEqual([`PUT ${BASE}/evidence/e2/image`]) // not re-registered, e1 not re-sent
    expect(q("[data-testid=capture-saved]")?.textContent).toMatch(/2 frames saved/)
    expect(q("[data-testid=upload-retry]")).toBeNull()
  })
})

describe("cleanup", () => {
  it("fails early only when a seek remains unresolved at metadata-only readiness", async () => {
    vi.useFakeTimers()
    const video = document.createElement("video")
    let time = 0
    Object.defineProperties(video, {
      readyState: { value: HTMLMediaElement.HAVE_METADATA, configurable: true },
      seeking: { value: true, configurable: true },
      currentTime: { configurable: true, get: () => time, set: (value: number) => { time = value } },
    })
    const events: string[] = []
    const controller = new AbortController()
    let observedError = ""
    const pending = seekToDecodedFrame(video, 5, 10_000, controller.signal, (entry) => events.push(entry.event))
    void pending.catch((error) => { observedError = String(error) })
    await vi.advanceTimersByTimeAsync(1_999)
    expect(events).not.toContain("decoder.stall")
    await vi.advanceTimersByTimeAsync(1)
    await Promise.resolve()
    const errorAtThreshold = observedError
    controller.abort()
    await pending.catch(() => undefined)
    expect(events).toContain("decoder.stall")
    expect(errorAtThreshold).toMatch(/decoder stalled/i)
    vi.useRealTimers()
  })

  it("does not classify elapsed time alone as a decoder stall", async () => {
    vi.useFakeTimers()
    const video = document.createElement("video")
    let time = 0
    Object.defineProperties(video, {
      readyState: { value: HTMLMediaElement.HAVE_METADATA, configurable: true },
      seeking: { value: false, configurable: true },
      currentTime: { configurable: true, get: () => time, set: (value: number) => { time = value } },
    })
    const events: string[] = []
    const pending = seekToDecodedFrame(video, 5, 10_000, undefined, (entry) => events.push(entry.event))
    const rejection = expect(pending).rejects.toThrow(/in time/i)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(events).not.toContain("decoder.stall")
    await vi.advanceTimersByTimeAsync(8_000)
    await rejection
    expect(events).toContain("seek.timeout")
    vi.useRealTimers()
  })

  it("falls back after a bounded wait when paused Chrome never delivers its frame callback", async () => {
    vi.useFakeTimers()
    const video = document.createElement("video")
    let time = 0
    Object.defineProperties(video, {
      readyState: { value: 4, configurable: true },
      videoWidth: { value: 1080, configurable: true },
      videoHeight: { value: 1920, configurable: true },
      currentTime: {
        configurable: true,
        get: () => time,
        set: (value: number) => { time = value; queueMicrotask(() => video.dispatchEvent(new Event("seeked"))) },
      },
      requestVideoFrameCallback: { configurable: true, value: vi.fn(() => 41) },
      cancelVideoFrameCallback: { configurable: true, value: vi.fn() },
    })
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { setTimeout(() => callback(performance.now()), 0); return 7 })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())

    const pending = seekToDecodedFrame(video, 5, 10_000)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(249)
    let settled = false
    void pending.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await expect(pending).resolves.toEqual({
      requestedTimestampSeconds: 5,
      presentedTimestampSeconds: 5,
      source: "seeked-canvas",
      confidence: "seek-timestamp-verified",
    })
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(41)
    vi.useRealTimers()
  })

  it("rejects stale fallback evidence instead of treating matching readiness as pixel proof", async () => {
    vi.useFakeTimers()
    const video = document.createElement("video")
    let time = 0
    Object.defineProperties(video, {
      readyState: { value: 4, configurable: true },
      videoWidth: { value: 1080, configurable: true },
      videoHeight: { value: 1920, configurable: true },
      currentTime: {
        configurable: true,
        get: () => time,
        set: () => { time = 4; queueMicrotask(() => video.dispatchEvent(new Event("seeked"))) },
      },
      requestVideoFrameCallback: { configurable: true, value: vi.fn(() => 9) },
      cancelVideoFrameCallback: { configurable: true, value: vi.fn() },
    })
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { setTimeout(() => callback(performance.now()), 0); return 8 })
    const pending = seekToDecodedFrame(video, 5, 10_000)
    const rejection = expect(pending).rejects.toThrow(/stale frame/i)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(251)
    await rejection
    vi.useRealTimers()
  })

  it("handles a repeated seek to the current timestamp without waiting for seeked", async () => {
    const video = document.createElement("video")
    Object.defineProperties(video, {
      readyState: { value: 4, configurable: true },
      videoWidth: { value: 1080, configurable: true },
      videoHeight: { value: 1920, configurable: true },
      currentTime: { value: 5, writable: true, configurable: true },
    })
    await expect(seekToDecodedFrame(video, 5, 100)).resolves.toMatchObject({
      requestedTimestampSeconds: 5,
      presentedTimestampSeconds: 5,
      source: "seeked-canvas",
      confidence: "seek-timestamp-verified",
    })
  })

  it("revokes frames created after an earlier frame was removed", async () => {
    render()
    await choose(mp4())
    await loadVideo()
    await act(async () => { byText("Capture this frame")!.click() })
    await flush()
    await act(async () => { byText("Remove")!.click() })
    await act(async () => { byText("Capture this frame")!.click() })
    await flush()
    expect(urls.size).toBe(2)
    act(() => root.render(<div />))
    expect(urls.size).toBe(0)
  })

  it("removes pending seek listeners when extraction is cancelled", async () => {
    const video = document.createElement("video")
    let time = 0
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => time,
      set: (value: number) => { time = value },
    })
    const remove = vi.spyOn(video, "removeEventListener")
    const controller = new AbortController()
    const pending = seekToDecodedFrame(video, 5, 1000, controller.signal)
    const rejection = expect(pending).rejects.toThrow(/cancelled/)
    controller.abort()
    await rejection
    expect(remove.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(["seeked", "error", "abort"]))
  })

  it("cancels the pending frame callback and grace timer after seeked", async () => {
    vi.useFakeTimers()
    const video = document.createElement("video")
    let time = 0
    Object.defineProperties(video, {
      readyState: { value: 4, configurable: true },
      videoWidth: { value: 1080, configurable: true },
      videoHeight: { value: 1920, configurable: true },
      currentTime: {
        configurable: true,
        get: () => time,
        set: (value: number) => { time = value; queueMicrotask(() => video.dispatchEvent(new Event("seeked"))) },
      },
      requestVideoFrameCallback: { configurable: true, value: vi.fn(() => 77) },
      cancelVideoFrameCallback: { configurable: true, value: vi.fn() },
    })
    const controller = new AbortController()
    const pending = seekToDecodedFrame(video, 5, 10_000, controller.signal)
    const rejection = expect(pending).rejects.toThrow(/cancelled/)
    await Promise.resolve()
    controller.abort()
    await rejection
    await vi.advanceTimersByTimeAsync(10_000)
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(77)
    vi.useRealTimers()
  })

  it("cancels the render-turn fallback and backup timer", async () => {
    vi.useFakeTimers()
    const video = document.createElement("video")
    let time = 0
    Object.defineProperties(video, {
      readyState: { value: 4, configurable: true },
      videoWidth: { value: 1080, configurable: true },
      videoHeight: { value: 1920, configurable: true },
      currentTime: {
        configurable: true,
        get: () => time,
        set: (value: number) => { time = value; queueMicrotask(() => video.dispatchEvent(new Event("seeked"))) },
      },
    })
    const cancelAnimation = vi.fn()
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 88))
    vi.stubGlobal("cancelAnimationFrame", cancelAnimation)
    const controller = new AbortController()
    const pending = seekToDecodedFrame(video, 5, 10_000, controller.signal)
    const rejection = expect(pending).rejects.toThrow(/cancelled/)
    await Promise.resolve()
    controller.abort()
    await rejection
    await vi.advanceTimersByTimeAsync(10_000)
    expect(cancelAnimation).toHaveBeenCalledWith(88)
    vi.useRealTimers()
  })

  it("cleans seek listeners and cancels a pending decoded-frame callback on timeout", async () => {
    vi.useFakeTimers()
    const video = document.createElement("video")
    let time = 0
    Object.defineProperty(video, "readyState", { value: 4, configurable: true })
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => time,
      set: (value: number) => { time = value; queueMicrotask(() => video.dispatchEvent(new Event("seeked"))) },
    })
    const callback = vi.fn(() => 41)
    const cancel = vi.fn()
    Object.defineProperty(video, "requestVideoFrameCallback", { configurable: true, value: callback })
    Object.defineProperty(video, "cancelVideoFrameCallback", { configurable: true, value: cancel })
    const pending = seekToDecodedFrame(video, 5, 25)
    const rejection = expect(pending).rejects.toThrow(/in time/)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(25)
    await rejection
    expect(cancel).toHaveBeenCalledWith(41)
    vi.useRealTimers()
  })

  it("revokes every object URL it created when the component is removed", async () => {
    render()
    await choose(mp4())
    await loadVideo()
    await act(async () => { byText("Capture this frame")!.click() })
    await flush()
    expect(urls.size).toBeGreaterThanOrEqual(2) // the video and one thumbnail
    act(() => root.render(<div />))
    expect(urls.size).toBe(0)
  })
})

describe("local capture diagnostics", () => {
  it("renders diagnostics only when dry-run and diagnostic mode are both active", () => {
    render({ diagnosticMode: true })
    expect(q("[data-testid=capture-diagnostics]")).toBeNull()
    act(() => root.render(<VideoCapture baseUrl="" dryRun diagnosticMode />))
    expect(q("[data-testid=capture-diagnostics]")).not.toBeNull()
  })

  it("reports safe metadata, media-event order, frame callbacks and final counts", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation((type: string) => type.includes("avc1") ? "probably" : "")
    render({ dryRun: true, diagnosticMode: true, buildRef: "41a8fd0" })
    await choose(mp4({ name: "customer-address-secret.mp4", type: "video/mp4", size: 4321 }))
    const video = await loadVideo({ duration: 23, width: 1280, height: 720 })
    presentFrames(video, [11.52])
    await act(async () => {
      video.dispatchEvent(new Event("loadeddata"))
      video.dispatchEvent(new Event("canplay"))
    })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { byText("Sample evenly")!.click() })
    await until(() => q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")?.value.includes("outcome=completed") === true)
    const report = q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")!.value
    expect(report).toContain("build=41a8fd0")
    expect(report).toContain("mime=video/mp4 sizeBytes=4321 duration=23.000 width=1280 height=720")
    expect(report).toContain("codec.avc1=probably")
    expect(report).toContain("event=loadeddata")
    expect(report).toContain("event=canplay")
    expect(report).toContain("event=seek.requested batch=1 requested=11.500 attempt=1")
    expect(report).toContain("event=frame-callback.fired batch=1 requested=11.500 presented=11.520")
    expect(report).toMatch(/event=batch\.finished outcome=completed.*requestedCount=1 attemptedCount=1 capturedCount=1 failedCount=0 elapsedMs=\d+/)
    expect(report).toContain("method=video-frame-callback confidence=presented-frame-confirmed")
    expect(report.indexOf("event=seek.requested")).toBeLessThan(report.indexOf("event=frame-callback.fired"))
    expect(report).not.toContain("customer-address-secret")
  })

  it("records safe timeout and retry diagnostics without raw errors, paths or room labels", async () => {
    const events: { event: string; failureKind?: string; attempt?: number }[] = []
    vi.useFakeTimers()
    const video = document.createElement("video")
    let time = 0
    Object.defineProperty(video, "currentTime", { configurable: true, get: () => time, set: (value: number) => { time = value } })
    const pending = seekToDecodedFrame(video, 5, 25, undefined, (entry) => events.push(entry))
    const rejection = expect(pending).rejects.toThrow(/in time/)
    await vi.advanceTimersByTimeAsync(25)
    await rejection
    expect(events.map((entry) => entry.event)).toEqual(["seek.requested", "seek.timeout"])
    expect(events.at(-1)).toMatchObject({ failureKind: "seek_timeout" })
    vi.useRealTimers()

    let calls = 0
    const flaky: FrameGrabber = vi.fn(async () => {
      if (++calls === 1) throw Object.assign(new Error("C:\\private\\customer\\clip.mp4"), { name: "NotReadableError" })
      return new Blob([tinyJpeg("diagnostic-retry") as unknown as BlobPart], { type: "image/jpeg" })
    })
    render({ dryRun: true, diagnosticMode: true, frameGrabber: flaky })
    await choose(mp4({ name: "private-home.mp4" }))
    await loadVideo({ duration: 23 })
    const room = q<HTMLInputElement>("input[maxlength='100']")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(room, "Customer bedroom")
      room.dispatchEvent(new Event("input", { bubbles: true }))
      byText("Sample evenly")!.click()
    })
    await until(() => q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")?.value.includes("event=slot.retry") === true)
    const report = q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")!.value
    expect(report).toContain("event=slot.failure failure=not_readable")
    expect(report).toContain("event=slot.retry")
    expect(report).not.toMatch(/private-home|Customer bedroom|C:\\private|clip\.mp4/)
  })

  it("localizes frame-grabber failures without exposing raw device errors", async () => {
    const failing: FrameGrabber = vi.fn(async () => {
      throw Object.assign(new Error("customer /private/path/video.mp4"), { name: "NotReadableError" })
    })
    render({ dryRun: true, diagnosticMode: true, frameGrabber: failing })
    await choose(mp4())
    await loadVideo({ duration: 23 })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      byText("Sample evenly")!.click()
    })
    await until(() => q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")?.value.includes("outcome=failed") === true)
    const report = q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")!.value
    expect(report).toMatch(/event=batch\.started batch=1.*existingFrames=0 objectUrls=1/)
    expect(report).toMatch(/event=frame-grab\.started.*batch=1.*attempt=1.*stage=canvas-encode/)
    expect(report).toMatch(/event=frame-grab\.failed failure=not_readable.*batch=1.*attempt=1.*stage=canvas-encode/)
    expect(report).not.toMatch(/customer|private|path|video\.mp4/)
  })

  it("labels repeated batches and reports retained resources and preview restoration", async () => {
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    await loadVideo({ duration: 23 })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      byText("Sample evenly")!.click()
    })
    await until(() => q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")?.value.includes("event=preview-restore.succeeded batch=1") === true)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      byText("Sample evenly")!.click()
    })
    await until(() => q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")?.value.includes("event=preview-restore.succeeded batch=2") === true)
    const report = q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")!.value
    expect(report).toMatch(/event=batch\.started batch=1.*existingFrames=0 objectUrls=1/)
    expect(report).toMatch(/event=batch\.started batch=2.*existingFrames=1 objectUrls=2/)
    expect(report).toMatch(/event=batch\.finished.*batch=2.*capturedCount=2.*objectUrls=4/)
  })

  it("reloads metadata once after a decoder stall and retries the original timestamp", async () => {
    vi.useFakeTimers()
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    let time = 0
    let readyState: number = HTMLMediaElement.HAVE_ENOUGH_DATA
    let seeking = false
    let recovered = false
    const assigned: number[] = []
    Object.defineProperties(video, {
      readyState: { configurable: true, get: () => readyState },
      seeking: { configurable: true, get: () => seeking },
      currentTime: {
        configurable: true,
        get: () => time,
        set: (value: number) => {
          time = value
          assigned.push(value)
          if (!recovered && value === 11.5) {
            seeking = true
            readyState = HTMLMediaElement.HAVE_METADATA
            return
          }
          seeking = false
          readyState = HTMLMediaElement.HAVE_ENOUGH_DATA
          queueMicrotask(() => video.dispatchEvent(new Event("seeked")))
        },
      },
      load: {
        configurable: true,
        value: vi.fn(() => {
          queueMicrotask(() => {
            video.dispatchEvent(new Event("loadstart"))
            recovered = true
            readyState = HTMLMediaElement.HAVE_METADATA
            video.dispatchEvent(new Event("loadedmetadata"))
          })
        }),
      },
    })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      byText("Sample evenly")!.click()
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(2_100) })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(q("[data-testid=extraction-outcome]")?.textContent).toMatch(/completed.*captured 1/i)
    expect(video.load).toHaveBeenCalledTimes(1)
    expect(assigned.filter((value) => value === 11.5)).toHaveLength(2)
    expect(q("[data-testid=frame-thumbnails] li")?.getAttribute("data-requested-seconds")).toBe("11.5")
    const report = q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")!.value
    expect(report).toContain("event=decoder.stall")
    expect(report).toContain("event=decoder-reload.succeeded")
    vi.useRealTimers()
  })

  it("uses at most one decoder reload per batch and fails a later stalled slot safely", async () => {
    vi.useFakeTimers()
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    let time = 0
    let readyState: number = HTMLMediaElement.HAVE_ENOUGH_DATA
    let seeking = false
    let firstRecovered = false
    const assigned: number[] = []
    Object.defineProperties(video, {
      readyState: { configurable: true, get: () => readyState },
      seeking: { configurable: true, get: () => seeking },
      currentTime: {
        configurable: true,
        get: () => time,
        set: (value: number) => {
          time = value
          assigned.push(value)
          const firstSlotStall = value === 5.75 && !firstRecovered
          const secondSlotStall = value === 17.25
          if (firstSlotStall || secondSlotStall) {
            seeking = true
            readyState = HTMLMediaElement.HAVE_METADATA
            return
          }
          seeking = false
          readyState = HTMLMediaElement.HAVE_ENOUGH_DATA
          queueMicrotask(() => video.dispatchEvent(new Event("seeked")))
        },
      },
      load: {
        configurable: true,
        value: vi.fn(() => queueMicrotask(() => {
          video.dispatchEvent(new Event("loadstart"))
          firstRecovered = true
          readyState = HTMLMediaElement.HAVE_METADATA
          video.dispatchEvent(new Event("loadedmetadata"))
        })),
      },
    })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      byText("Sample evenly")!.click()
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(4_500) })
    expect(video.load).toHaveBeenCalledTimes(1)
    expect(assigned.filter((value) => value === 5.75)).toHaveLength(2)
    expect(assigned.filter((value) => value === 17.25)).toHaveLength(1)
    expect(q("[data-testid=extraction-outcome]")?.textContent).toMatch(/partial.*captured 1/i)
    vi.useRealTimers()
  })

  it("reports exact encoded-byte duplicate fingerprints without rejecting static scenes", async () => {
    const bytes = tinyJpeg("same-static-scene")
    const identical: FrameGrabber = vi.fn(async () => new Blob([bytes as unknown as BlobPart], { type: "image/jpeg" }))
    render({ dryRun: true, diagnosticMode: true, frameGrabber: identical })
    await choose(mp4())
    await loadVideo({ duration: 23 })
    const input = q<HTMLInputElement>("input[type=number]")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      byText("Sample evenly")!.click()
    })
    await until(() => q("[data-testid=extraction-outcome]")?.textContent?.includes("completed") === true)
    const report = q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")!.value
    const expected = createHash("sha256").update(bytes).digest("hex")
    expect(report).toContain(`fingerprint=${expected}`)
    expect(report).toContain("event=fingerprint.match")
    expect(report).toContain("freshness=uncertain-exact-byte-duplicate")
    expect(q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")).toHaveLength(2)
  })

  it("keeps selectable text and reports clipboard failure; Clear removes entries", async () => {
    const writeText = vi.fn(async () => { throw new DOMException("denied", "NotAllowedError") })
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const report = q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")!
    expect(report.readOnly).toBe(true)
    await act(async () => { byText("Copy diagnostic report")!.click() })
    expect(q("[data-testid=diagnostic-copy-status]")?.textContent).toMatch(/select the report text/i)
    expect(report.value.length).toBeGreaterThan(0)
    await act(async () => { byText("Clear diagnostic report")!.click() })
    expect(report.value).toBe("")
  })
})

type StallOptions = { stallAt: number[]; load?: "success" | "silent" | "error" | "throw"; manualSeekedAfterRecovery?: boolean }

/** A <video> whose decoder stalls (seeking=true, readyState=1, no "seeked") at chosen timestamps until a reload succeeds. */
function stallingVideo(video: HTMLVideoElement, options: StallOptions) {
  let time = 0
  let readyState = 4
  let seeking = false
  let recovered = false
  const assigned: number[] = []
  const live = new Map<string, Set<EventListenerOrEventListenerObject>>()
  const add = video.addEventListener.bind(video)
  const remove = video.removeEventListener.bind(video)
  video.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) => {
    if (!live.has(type)) live.set(type, new Set())
    live.get(type)!.add(listener)
    add(type, listener, opts)
  }) as typeof video.addEventListener
  video.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, opts?: boolean | EventListenerOptions) => {
    live.get(type)?.delete(listener)
    remove(type, listener, opts)
  }) as typeof video.removeEventListener
  Object.defineProperties(video, {
    readyState: { configurable: true, get: () => readyState },
    seeking: { configurable: true, get: () => seeking },
    currentTime: {
      configurable: true,
      get: () => time,
      set: (value: number) => {
        time = value
        assigned.push(value)
        if (options.stallAt.includes(value) && !recovered) {
          seeking = true
          readyState = HTMLMediaElement.HAVE_METADATA
          return
        }
        if (recovered && options.manualSeekedAfterRecovery && options.stallAt.includes(value)) {
          seeking = true
          readyState = HTMLMediaElement.HAVE_METADATA
          return
        }
        seeking = false
        readyState = HTMLMediaElement.HAVE_ENOUGH_DATA
        queueMicrotask(() => video.dispatchEvent(new Event("seeked")))
      },
    },
    load: {
      configurable: true,
      value: vi.fn(() => {
        if (options.load === "throw") throw new Error("decoder restart refused")
        if (options.load === "silent") return
        queueMicrotask(() => {
          if (options.load === "error") return void video.dispatchEvent(new Event("error"))
          video.dispatchEvent(new Event("loadstart"))
          recovered = true
          readyState = HTMLMediaElement.HAVE_METADATA
          video.dispatchEvent(new Event("loadedmetadata"))
        })
      }),
    },
  })
  return {
    assigned,
    load: video.load as unknown as ReturnType<typeof vi.fn>,
    finishSeek: () => { seeking = false; readyState = HTMLMediaElement.HAVE_ENOUGH_DATA; video.dispatchEvent(new Event("seeked")) },
    liveListeners: () => ["seeked", "loadstart", "abort"].map((type) => `${type}=${live.get(type)?.size ?? 0}`).join(","),
  }
}

async function startBatch(count: string) {
  const input = q<HTMLInputElement>("input[type=number]")!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, count)
    input.dispatchEvent(new Event("input", { bubbles: true }))
    byText("Sample evenly")!.click()
  })
}
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const diagnosticReport = () => q<HTMLTextAreaElement>("[data-testid=diagnostic-report]")?.value ?? ""
const outcomeText = () => q("[data-testid=extraction-outcome]")?.textContent ?? ""
const thumbs = () => [...container.querySelectorAll<HTMLElement>("[data-testid=frame-thumbnails] li")]

describe("decoder stall recovery", () => {
  it("fails the slot after an unresolved reload timeout without retrying it, then continues with later slots", async () => {
    vi.useFakeTimers()
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    const stalling = stallingVideo(video, { stallAt: [5.75], load: "silent" })
    await startBatch("2")
    await advance(5_100)
    await advance(500)
    expect(stalling.load).toHaveBeenCalledTimes(1)
    expect(stalling.assigned.filter((v) => v === 5.75)).toHaveLength(1)
    expect(stalling.assigned.filter((v) => v === 17.25)).toHaveLength(1)
    expect(outcomeText()).toMatch(/partial.*captured 1/i)
    expect(diagnosticReport()).toContain("event=decoder-reload.timeout")
    expect(thumbs().map((li) => li.getAttribute("data-requested-seconds"))).toEqual(["17.25"])
  })

  it.each(["error", "throw"] as const)("fails safely when the media reload itself reports %s", async (mode) => {
    vi.useFakeTimers()
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    const stalling = stallingVideo(video, { stallAt: [11.5], load: mode })
    await startBatch("1")
    await advance(2_100)
    await advance(500)
    expect(stalling.load).toHaveBeenCalledTimes(1)
    expect(stalling.assigned.filter((v) => v === 11.5)).toHaveLength(1)
    expect(outcomeText()).toMatch(/failed/i)
    expect(diagnosticReport()).toContain("event=decoder-reload.failed")
    expect(thumbs()).toHaveLength(0)
  })

  it("cancels recovery without leaking timers, listeners or further seeks", async () => {
    vi.useFakeTimers()
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    const stalling = stallingVideo(video, { stallAt: [11.5], load: "silent" })
    const baseline = stalling.liveListeners()
    await startBatch("1")
    await advance(2_100)
    expect(stalling.load).toHaveBeenCalledTimes(1)
    expect(stalling.liveListeners()).not.toBe(baseline) // reload listeners are live while recovering
    await choose(mp4({ name: "other.mp4" })) // chooseFile aborts the in-flight extraction
    await advance(10_000)
    expect(stalling.load).toHaveBeenCalledTimes(1)
    expect(stalling.assigned.filter((v) => v === 11.5)).toHaveLength(1)
    expect(stalling.liveListeners()).toBe(baseline)
    expect(vi.getTimerCount()).toBe(0)
    expect(diagnosticReport()).not.toContain("event=decoder-reload.timeout")
  })

  it("ignores delayed seeked, loadstart and loadedmetadata events from an earlier seek or media load", async () => {
    vi.useFakeTimers()
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    const stalling = stallingVideo(video, { stallAt: [11.5], load: "success", manualSeekedAfterRecovery: true })
    await startBatch("1")
    await advance(2_100) // stall -> reload succeeds -> retry seek is pending (seeking=true)
    expect(diagnosticReport()).toContain("event=decoder-reload.succeeded")
    const reloadEvents = () => (diagnosticReport().match(/event=decoder-reload\.(loadstart|succeeded)/g) ?? []).length
    const before = reloadEvents()
    await act(async () => {
      video.dispatchEvent(new Event("seeked")) // late event of the abandoned seek while the retry is still seeking
      video.dispatchEvent(new Event("loadstart")) // late media-load events after the reload settled
      video.dispatchEvent(new Event("loadedmetadata"))
    })
    await advance(300)
    expect(diagnosticReport()).toContain("event=seeked.ignored")
    expect(reloadEvents()).toBe(before)
    expect(outcomeText()).not.toMatch(/completed/i)
    expect(thumbs()).toHaveLength(0)
    await act(async () => stalling.finishSeek())
    await advance(300)
    expect(outcomeText()).toMatch(/completed.*captured 1/i)
  })

  it("reuses the single local video Blob URL and releases every URL on replacement", async () => {
    vi.useFakeTimers()
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    const initialSrc = video.getAttribute("src")
    const stalling = stallingVideo(video, { stallAt: [11.5], load: "success" })
    const create = URL.createObjectURL as unknown as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalledTimes(1)
    await startBatch("1")
    await advance(2_100)
    await advance(300)
    expect(stalling.load).toHaveBeenCalledTimes(1)
    expect(video.getAttribute("src")).toBe(initialSrc)
    expect(create).toHaveBeenCalledTimes(2) // the video URL plus exactly one thumbnail; the reload created none
    await choose(mp4({ name: "next.mp4" }))
    expect(urls.size).toBe(1) // only the new video URL survives; old video and thumbnail were revoked
  })

  it("keeps requested and actual timestamps exact after recovery and continues with later slots", async () => {
    vi.useFakeTimers()
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    const stalling = stallingVideo(video, { stallAt: [5.75], load: "success" })
    await startBatch("2")
    await advance(2_100)
    await advance(500)
    expect(stalling.load).toHaveBeenCalledTimes(1)
    expect(outcomeText()).toMatch(/completed.*captured 2/i)
    expect(thumbs().map((li) => [li.getAttribute("data-requested-seconds"), li.getAttribute("data-presented-seconds")])).toEqual([["5.75", "5.75"], ["17.25", "17.25"]])
  })

  it("keeps seeked-canvas captures after recovery as uncertain, never presented-frame-confirmed", async () => {
    vi.useFakeTimers()
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    stallingVideo(video, { stallAt: [11.5], load: "success" })
    await startBatch("1")
    await advance(2_100)
    await advance(300)
    const li = thumbs()[0]
    expect(li.getAttribute("data-capture-method")).toBe("seeked-canvas")
    expect(li.textContent).toMatch(/pixel freshness not callback-confirmed/)
    const report = diagnosticReport()
    expect(report).toContain("confidence=seek-timestamp-verified")
    expect(report).toContain("freshness=uncertain-no-comparison")
    expect(report).not.toContain("presented-frame-confirmed")
    expect(report).not.toMatch(/walk\.mp4|blob:/)
  })

  it("preserves presented-frame-confirmed only when the frame-presentation callback fires after recovery", async () => {
    vi.useFakeTimers()
    render({ dryRun: true, diagnosticMode: true })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    stallingVideo(video, { stallAt: [11.5], load: "success" })
    presentFrames(video)
    await startBatch("1")
    await advance(2_100)
    await advance(300)
    expect(thumbs()[0].getAttribute("data-capture-method")).toBe("video-frame-callback")
    expect(diagnosticReport()).toContain("freshness=presentation-confirmed")
  })

  it("does not compute fingerprints outside local diagnostic mode", async () => {
    for (const props of [{ dryRun: true, diagnosticMode: false }, { dryRun: false, diagnosticMode: true }]) {
      const digest = vi.fn(async () => new ArrayBuffer(32))
      vi.stubGlobal("crypto", { subtle: { digest } })
      render(props)
      await choose(mp4())
      await loadVideo({ duration: 23 })
      await startBatch("2")
      await until(() => /completed/i.test(outcomeText()))
      expect(digest).not.toHaveBeenCalled()
      expect(q("[data-testid=diagnostic-report]")).toBeNull()
      act(() => root.render(<></>))
    }
  })

  it("treats identical encoded bytes as a static-scene note, never a decoder fault, even with presentation-confirmed frames", async () => {
    const bytes = tinyJpeg("static-room")
    const identical: FrameGrabber = vi.fn(async () => new Blob([bytes as unknown as BlobPart], { type: "image/jpeg" }))
    render({ dryRun: true, diagnosticMode: true, frameGrabber: identical })
    await choose(mp4())
    const video = await loadVideo({ duration: 23 })
    presentFrames(video)
    await startBatch("2")
    await until(() => /completed/i.test(outcomeText()))
    const report = diagnosticReport()
    expect(report).toContain("event=fingerprint.match")
    expect(report).toContain("freshness=presentation-confirmed")
    expect(report).not.toMatch(/decoder_stall|stale_frame|duplicate_frame|failure=/)
    expect(thumbs()).toHaveLength(2)
  })
})

/** After extraction: a <video> whose seeks the test controls (hold = never completes until finish()). */
function controllableSeeks(video: HTMLVideoElement) {
  let time = video.currentTime
  let seeking = false
  let readyState = 4
  let hold = false
  const assigned: number[] = []
  Object.defineProperties(video, {
    readyState: { configurable: true, get: () => readyState },
    seeking: { configurable: true, get: () => seeking },
    currentTime: {
      configurable: true,
      get: () => time,
      set: (value: number) => {
        time = value
        assigned.push(value)
        if (hold) {
          seeking = true
          readyState = HTMLMediaElement.HAVE_METADATA
          return
        }
        seeking = false
        readyState = HTMLMediaElement.HAVE_ENOUGH_DATA
        queueMicrotask(() => video.dispatchEvent(new Event("seeked")))
      },
    },
  })
  return {
    assigned,
    hold: (value: boolean) => { hold = value },
    finish: (ready = true) => { seeking = false; readyState = ready ? HTMLMediaElement.HAVE_ENOUGH_DATA : HTMLMediaElement.HAVE_METADATA; video.dispatchEvent(new Event("seeked")) },
    becomeReady: () => { readyState = HTMLMediaElement.HAVE_ENOUGH_DATA; video.dispatchEvent(new Event("canplay")) },
    landAt: (value: number) => { time = value },
  }
}

const nativeSet = (input: HTMLInputElement, value: string) => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
const click = (el: HTMLElement | undefined) => act(async () => { el!.click() })
const cardButton = (li: HTMLElement, label: string) => [...li.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLButtonElement
const compareStatus = (li: HTMLElement) => li.querySelector("[data-testid=compare-status]")?.textContent ?? ""
const reviewText = () => q<HTMLTextAreaElement>("[data-testid=visual-review-summary]")?.value ?? ""
const showSource = (index: number) => click(cardButton(thumbs()[index], "Show source at this time"))
const untilReady = (index: number) => until(() => /Source ready/.test(compareStatus(thumbs()[index])))
async function setNote(index: number, text: string) {
  const input = thumbs()[index].querySelector<HTMLInputElement>("[data-testid=verdict-note]")!
  await act(async () => { nativeSet(input, text); input.dispatchEvent(new Event("input", { bubbles: true })) })
}

async function sampledFrames(opts: { room?: string; name?: string; presented?: number[]; frameGrabber?: FrameGrabber; props?: Partial<React.ComponentProps<typeof VideoCapture>> } = {}) {
  render({ dryRun: true, diagnosticMode: true, ...(opts.frameGrabber ? { frameGrabber: opts.frameGrabber } : {}), ...opts.props })
  await choose(mp4(opts.name ? { name: opts.name } : {}))
  const video = await loadVideo({ duration: 23 })
  if (opts.presented) presentFrames(video, [...opts.presented])
  if (opts.room) {
    await act(async () => {
      const roomInput = q<HTMLInputElement>('input[maxlength="100"]')!
      nativeSet(roomInput, opts.room!)
      roomInput.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }
  await startBatch("2")
  await until(() => /completed/i.test(outcomeText()) && !byText("Sample evenly")?.disabled)
  return video
}

describe("visual source comparison (local QA)", () => {
  it("seeks the source to the requested timestamp, then waits for seek completion and decoded data; creates no frames and makes no network call", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const video = await sampledFrames({ presented: [5.9, 17.4] })
    const first = thumbs()[0]
    expect(first.getAttribute("data-requested-seconds")).toBe("5.75")
    expect(first.getAttribute("data-presented-seconds")).toBe("5.9")
    expect(first.textContent).toMatch(/Requested 5\.75 s · actual 5\.900 s/)
    const seeks = controllableSeeks(video)
    seeks.hold(true)
    await showSource(0)
    expect(seeks.assigned).toEqual([5.75]) // requested, never the actual 5.9
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    expect(compareStatus(thumbs()[0])).toMatch(/Seeking source to requested 5\.75/)
    expect(cardButton(thumbs()[0], "Match").disabled).toBe(true)
    await act(async () => seeks.finish(false)) // seeked, but no decoded picture yet
    expect(compareStatus(thumbs()[0])).toMatch(/Seeking/)
    await act(async () => seeks.becomeReady())
    expect(compareStatus(thumbs()[0])).toMatch(/Source ready at requested 5\.75/)
    expect(cardButton(thumbs()[0], "Match").disabled).toBe(false)
    expect(thumbs()).toHaveLength(2)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("activates Match button with visual feedback, status confirmation and diagnostic logging once comparison is ready, and refuses Match before comparison", async () => {
    const video = await sampledFrames()
    controllableSeeks(video)
    // Before comparison: Match is strictly disabled
    expect(cardButton(thumbs()[0], "Match").disabled).toBe(true)
    await showSource(0)
    await untilReady(0)
    // After comparison ready: Match is enabled
    const matchBtn = cardButton(thumbs()[0], "Match")
    expect(matchBtn.disabled).toBe(false)
    expect(compareStatus(thumbs()[0])).toMatch(/Source ready at requested 5\.75/)

    // Click Match: activates with distinct pressed state, status message, and diagnostic event
    await click(matchBtn)
    expect(matchBtn.getAttribute("aria-pressed")).toBe("true")
    expect(matchBtn.className).toMatch(/bg-emerald-700|bg-slate-900/)
    expect(compareStatus(thumbs()[0])).toMatch(/Verdict: Match recorded/i)
    expect(diagnosticReport()).toContain("event=verdict.recorded")
    expect(diagnosticReport()).toContain("verdict=match")
    expect(reviewText()).toMatch(/reviewed=1 match=1/)
  })

  it("reports a stalled comparison seek explicitly and refuses a Match on it", async () => {
    const video = await sampledFrames()
    const seeks = controllableSeeks(video)
    seeks.hold(true)
    vi.useFakeTimers()
    await showSource(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_050) })
    expect(compareStatus(thumbs()[0])).toMatch(/failed or stalled\. Record Uncertain/)
    expect(cardButton(thumbs()[0], "Match").disabled).toBe(true)
    expect(cardButton(thumbs()[0], "Uncertain").disabled).toBe(false)
    expect(diagnosticReport()).toContain("event=comparison.failed failure=seek_timeout")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("drops an existing Match when a later comparison of the same frame fails", async () => {
    const video = await sampledFrames()
    const seeks = controllableSeeks(video)
    await showSource(0)
    await untilReady(0)
    await click(cardButton(thumbs()[0], "Match"))
    expect(cardButton(thumbs()[0], "Match").getAttribute("aria-pressed")).toBe("true")
    seeks.hold(true)
    seeks.landAt(0)
    vi.useFakeTimers()
    await showSource(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_050) })
    expect(cardButton(thumbs()[0], "Match").getAttribute("aria-pressed")).toBe("false")
    expect(reviewText()).toMatch(/frame=1 .*comparison=failed verdict=unreviewed/)
  })

  it("lets only the newest comparison complete when attempts overlap", async () => {
    const video = await sampledFrames()
    const seeks = controllableSeeks(video)
    seeks.hold(true)
    await showSource(0)
    await showSource(1)
    expect(seeks.assigned).toEqual([5.75, 17.25])
    await act(async () => seeks.finish())
    expect(compareStatus(thumbs()[1])).toMatch(/Source ready at requested 17\.25/)
    expect(compareStatus(thumbs()[0])).toBe("Source not compared yet.")
    expect(reviewText()).toMatch(/frame=1 .*comparison=not-run/)
    expect(reviewText()).toMatch(/frame=2 .*comparison=ready/)
  })

  it("disables comparison while extraction is active and cancels a pending comparison when extraction starts", async () => {
    let calls = 0
    let open!: () => void
    const gate = new Promise<void>((resolve) => { open = resolve })
    const gated: FrameGrabber = vi.fn(async () => {
      if (++calls > 2) await gate
      return new Blob([tinyJpeg(`gate${calls}`) as unknown as BlobPart], { type: "image/jpeg" })
    })
    const video = await sampledFrames({ frameGrabber: gated })
    const seeks = controllableSeeks(video)
    seeks.hold(true)
    await showSource(0)
    expect(compareStatus(thumbs()[0])).toMatch(/Seeking/)
    seeks.hold(false)
    await startBatch("1") // extraction begins and blocks on the gated grabber
    expect(cardButton(thumbs()[0], "Show source at this time").disabled).toBe(true)
    expect(compareStatus(thumbs()[0])).toBe("Source not compared yet.")
    await act(async () => { open() })
    await until(() => /captured 1/i.test(outcomeText()))
    await act(async () => { video.dispatchEvent(new Event("seeked")) }) // a late event must not resurrect the old comparison
    await until(() => !cardButton(thumbs()[0], "Show source at this time").disabled)
    expect(compareStatus(thumbs()[0])).toBe("Source not compared yet.")
    expect(cardButton(thumbs()[0], "Show source at this time").disabled).toBe(false)
  })

  it("invalidates a pending comparison when a different file is chosen", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const video = await sampledFrames()
    const seeks = controllableSeeks(video)
    seeks.hold(true)
    await showSource(0)
    await choose(mp4({ name: "other.mp4" }))
    expect(q("[data-testid=visual-review]")).toBeNull()
    expect(thumbs()).toHaveLength(0)
    await act(async () => { video.dispatchEvent(new Event("seeked")) })
    expect(q("[data-testid=visual-review]")).toBeNull()
    expect(errors).not.toHaveBeenCalled()
  })

  it("invalidates a pending comparison on unmount without touching the video again", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const video = await sampledFrames()
    const seeks = controllableSeeks(video)
    seeks.hold(true)
    await showSource(0)
    const seekCount = seeks.assigned.length
    await act(async () => root.unmount())
    await act(async () => { seeks.finish(); video.dispatchEvent(new Event("canplay")) })
    expect(seeks.assigned.length).toBe(seekCount)
    expect(errors).not.toHaveBeenCalled()
    root = createRoot(container) // afterEach unmounts a root
  })

  it("records verdicts locally, requires a reason for Mismatch/Uncertain, redacts identifiers, and resets on removal", async () => {
    const video = await sampledFrames({ room: "Kitchen", name: "12 Oak Street.mp4" })
    controllableSeeks(video)
    await showSource(0)
    await untilReady(0)
    await showSource(1)
    await untilReady(1)
    await click(cardButton(thumbs()[0], "Mismatch"))
    expect(reviewText()).toMatch(/mismatch=0 uncertain=0 unreviewed=2/) // no reason yet, so not counted
    expect(thumbs()[0].textContent).toMatch(/Explanation required/)
    await setNote(0, "Kitchen wall differs near 12 Oak Street, mail a@b.com http://x.example/p blob:abc")
    const text = reviewText()
    expect(text).toMatch(/mismatch=1 uncertain=0 unreviewed=1/)
    expect(text).toContain("[redacted]")
    expect(text).not.toMatch(/Kitchen|Oak|a@b\.com|x\.example|blob:/i)
    expect(text).toMatch(/result=FAIL reason=mismatch recorded/)
    await click(cardButton(thumbs()[1], "Match"))
    expect(reviewText()).toMatch(/match=1 mismatch=1/)
    await click(cardButton(thumbs()[0], "Uncertain")) // keeps the reason, changes the verdict
    expect(reviewText()).toMatch(/match=1 mismatch=0 uncertain=1 unreviewed=0/)
    expect(reviewText()).toMatch(/result=INCOMPLETE reason=fewer than 12 automatic frames/)
    await click(cardButton(thumbs()[0], "Match")) // comparison still ready, so allowed; reason no longer applies
    expect(reviewText()).toMatch(/match=2/)
    await click([...thumbs()[0].querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Remove"))
    expect(reviewText()).toMatch(/automaticFrames=1 reviewed=1 match=1/)
  })

  it("keeps manual frames out of the comparison controls and acceptance counts", async () => {
    const video = await sampledFrames()
    controllableSeeks(video)
    await act(async () => { byText("Capture this frame")!.click() })
    await until(() => thumbs().length === 3)
    expect(container.querySelectorAll("[data-testid=visual-compare]")).toHaveLength(2)
    expect(thumbs()[2].getAttribute("data-capture-method")).toBe("manual")
    expect(reviewText()).toMatch(/automaticFrames=2 /)
    expect(reviewText()).toContain("manualFramesExcluded=1")
    expect(reviewText().match(/^frame=/gm)).toHaveLength(2)
  })

  it("never changes capture provenance and never marks fallback frames presentation-confirmed", async () => {
    const video = await sampledFrames()
    controllableSeeks(video)
    const before = thumbs().map((li) => [li.getAttribute("data-capture-method"), li.getAttribute("data-capture-confidence"), li.getAttribute("data-requested-seconds"), li.getAttribute("data-presented-seconds")])
    const report = diagnosticReport()
    await showSource(0)
    await untilReady(0)
    await click(cardButton(thumbs()[0], "Match"))
    const after = thumbs().map((li) => [li.getAttribute("data-capture-method"), li.getAttribute("data-capture-confidence"), li.getAttribute("data-requested-seconds"), li.getAttribute("data-presented-seconds")])
    expect(after).toEqual(before)
    expect(thumbs()[0].textContent).toMatch(/pixel freshness not callback-confirmed/)
    expect(reviewText()).toMatch(/method=seeked-canvas confidence=seek-timestamp-verified/)
    expect(reviewText()).not.toContain("presented-frame-confirmed ")
    expect(diagnosticReport()).not.toMatch(/event=fingerprint[^\n]*presentation-confirmed/)
    expect(diagnosticReport().replace(/event=comparison\.[^\n]*\n?/g, "")).toContain(report.split("\n").slice(-1)[0].replace(/^#\d+ \+\d+ms /, "").slice(0, 20))
  })

  it("offers no comparison controls outside local diagnostic mode", async () => {
    for (const props of [{ dryRun: true, diagnosticMode: false }, { dryRun: false, diagnosticMode: true }]) {
      render(props)
      await choose(mp4())
      await loadVideo({ duration: 23 })
      await startBatch("2")
      await until(() => /completed/i.test(outcomeText()))
      expect(byText("Show source at this time")).toBeUndefined()
      expect(q("[data-testid=visual-review]")).toBeNull()
      act(() => root.render(<></>))
    }
  })
})

describe("visual review summary rules", () => {
  const frame = (i: number, over: Partial<Parameters<typeof buildVisualReviewSummary>[0]["frames"][number]> = {}) => ({
    key: `k${i}`,
    requestedTimestampSeconds: i,
    presentedTimestampSeconds: i + 0.01,
    presentationSource: "seeked-canvas" as const,
    captureConfidence: "seek-timestamp-verified" as const,
    room: "",
    ...over,
  })
  const twelve = Array.from({ length: 12 }, (_, i) => frame(i + 1))
  const matches = Object.fromEntries(twelve.map((f) => [f.key, { verdict: "match" as const, note: "" }]))
  const ready = Object.fromEntries(twelve.map((f) => [f.key, "ready" as const]))
  const build = (over: Partial<Parameters<typeof buildVisualReviewSummary>[0]> = {}) => buildVisualReviewSummary({ frames: twelve, verdicts: matches, comparison: ready, build: "45bd44a", ...over })

  it("PASS only for 12/12 Match with every source comparison completed", () => {
    const out = build()
    expect(out.result).toBe("PASS")
    expect(out.counts).toMatchObject({ automatic: 12, reviewed: 12, match: 12, mismatch: 0, uncertain: 0, unreviewed: 0 })
    expect(out.text).toContain("build=45bd44a")
    expect(out.text.match(/^frame=/gm)).toHaveLength(12)
    expect(out.text).toContain("frame=1 requested=1.000 actual=1.010 method=seeked-canvas confidence=seek-timestamp-verified comparison=ready verdict=match")
  })

  it("CONDITIONAL for up to two documented Uncertain and no Mismatch", () => {
    const verdicts = { ...matches, k1: { verdict: "uncertain" as const, note: "glare" }, k2: { verdict: "uncertain" as const, note: "motion blur" } }
    const out = build({ verdicts })
    expect(out.result).toBe("CONDITIONAL")
    expect(out.text).toContain('verdict=uncertain note="glare"')
    expect(build({ verdicts: { ...verdicts, k3: { verdict: "uncertain", note: "dark" } } }).result).toBe("FAIL")
  })

  it("FAIL for any Mismatch or an incomplete source comparison", () => {
    expect(build({ verdicts: { ...matches, k4: { verdict: "mismatch", note: "different scene" } } }).result).toBe("FAIL")
    expect(build({ comparison: { ...ready, k5: "failed" } }).result).toBe("FAIL")
    const { k6: _omitted, ...rest } = ready
    void _omitted
    expect(build({ comparison: rest }).text).toContain("comparison=not-run")
    expect(build({ comparison: rest }).result).toBe("FAIL")
  })

  it("INCOMPLETE while any frame is unreviewed, a reason is missing, or fewer than 12 automatic frames exist", () => {
    const { k7: _omitted, ...rest } = matches
    void _omitted
    expect(build({ verdicts: rest }).result).toBe("INCOMPLETE")
    expect(build({ verdicts: { ...matches, k8: { verdict: "uncertain", note: "   " } } }).result).toBe("INCOMPLETE")
    expect(build({ frames: twelve.slice(0, 11) }).result).toBe("INCOMPLETE")
    expect(build({ frames: [] }).result).toBe("INCOMPLETE")
  })

  it("excludes manual frames from totals, never prints identifiers, and sanitises the build ref", () => {
    const withManual = [...twelve, frame(99, { presentationSource: "manual", captureConfidence: "manual-user-positioned", room: "Hallway" })]
    const out = build({ frames: withManual, build: "not a commit; Hallway" })
    expect(out.counts.automatic).toBe(12)
    expect(out.counts.manualExcluded).toBe(1)
    expect(out.result).toBe("PASS")
    expect(out.text).toContain("manualFramesExcluded=1")
    expect(out.text).toContain("build=unknown")
    expect(out.text).not.toMatch(/Hallway|manual-user-positioned|sha|fingerprint|\.mp4|blob:/i)
    expect(cleanVerdictNote("  a\n\tb  " + "x".repeat(300)).length).toBeLessThanOrEqual(140)
  })
})

describe("capture check (dry run)", () => {
  it("lets a device test a real clip but offers no save and makes no network request", async () => {
    const fetchImpl = vi.fn()
    render({ dryRun: true, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(q("[data-testid=retention-note]")?.textContent).toMatch(/Nothing is uploaded, saved or sent anywhere/)
    await choose(mp4())
    await loadVideo()
    await act(async () => { byText("Capture this frame")!.click() })
    await flush()
    expect(q("[data-testid=frame-thumbnails]")!.querySelectorAll("li")).toHaveLength(1)
    expect(byText("Save 1 frame")).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
