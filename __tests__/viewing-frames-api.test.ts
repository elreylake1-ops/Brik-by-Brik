import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { sha256, tinyJpeg } from "./fixtures/jpeg-fixtures"

const h = vi.hoisted(() => ({ repo: null as unknown, access: vi.fn(), getDeal: vi.fn() }))

vi.mock("@/lib/viewing-assessment/pg-viewing-assessment-repository", () => ({
  get pgViewingAssessmentRepository() {
    return h.repo
  },
}))
vi.mock("@/lib/operator-command/require-saved-deal-read-access", () => ({ requireSavedDealReadAccess: h.access }))
vi.mock("@/lib/operator-command/saved-deals-repository", () => ({ getSavedDealById: h.getDeal }))

import * as listRoute from "@/app/api/saved-deals/[id]/viewing-assessments/route"
import * as detailRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/route"
import * as evidenceRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/route"
import * as imageRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/[evidenceId]/image/route"
import { OBJECT_POLICIES, type PrivateBlobStore } from "@/lib/viewing-assessment/storage/blob-store"
import { __setBlobStoreForTests } from "@/lib/viewing-assessment/storage/get-blob-store"
import { createLocalFsBlobStore } from "@/lib/viewing-assessment/storage/local-fs-blob-store"

const OPERATOR = { kind: "internal_operator", subject: "operator-1" }
type Ids = { id?: string; assessmentId?: string; evidenceId?: string }
const ctx = (ids: Ids) => ({ params: Promise.resolve(ids) })

let mem: ReturnType<typeof createInMemoryViewingRepository>
let root: string
let store: PrivateBlobStore

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) })
const put = (bytes: BodyInit | null, headers: Record<string, string> = { "content-type": "image/jpeg" }) =>
  new Request("http://localhost/x", { method: "PUT", headers, body: bytes })
const get = () => new Request("http://localhost/x", { method: "GET" })

async function seed(frames = 3, dealId = "deal-1") {
  const created = await (await listRoute.POST(json({ idempotencyKey: `create-key-${dealId}` }), ctx({ id: dealId }))).json()
  const assessmentId = created.assessment.id as string
  const registered = await (
    await evidenceRoute.POST(
      json({ clip: { filename: "walk.mp4", mimeType: "video/mp4", sizeBytes: 5000, durationSeconds: 60, contentSha256: null }, frames: Array.from({ length: frames }, (_, i) => ({ timestampSeconds: i * 10 + 1, room: `R${i}` })) }),
      ctx({ id: dealId, assessmentId })
    )
  ).json()
  return { dealId, assessmentId, evidenceIds: registered.evidence.map((e: { id: string }) => e.id) as string[] }
}

beforeEach(() => {
  mem = createInMemoryViewingRepository()
  h.repo = mem.repo
  h.access.mockReset().mockResolvedValue({ allowed: true, principal: OPERATOR })
  h.getDeal.mockReset().mockImplementation(async (id: string) => (["deal-1", "deal-2"].includes(id) ? { id } : null))
  root = mkdtempSync(path.join(tmpdir(), "brik-frames-test-"))
  store = createLocalFsBlobStore(root)
  __setBlobStoreForTests(store)
})
afterEach(() => {
  __setBlobStoreForTests(undefined)
  rmSync(root, { recursive: true, force: true })
})

const files = () => readdirSync(root, { recursive: true }).map(String).filter((f) => f.includes("blob_") && !f.endsWith(".tmp"))

describe("frame upload and retrieval", () => {
  it("stores a JPEG for a registered frame, serves it back byte-for-byte to an authenticated operator, and never reveals a storage key", async () => {
    const s = await seed()
    const bytes = tinyJpeg("first")
    const ids = { id: s.dealId, assessmentId: s.assessmentId, evidenceId: s.evidenceIds[0] }
    const res = await imageRoute.PUT(put(bytes as unknown as BodyInit), ctx(ids))
    const body = await res.json()
    expect([res.status, body.replayed]).toEqual([201, false])
    expect(body.blob).toEqual({ evidenceId: s.evidenceIds[0], sha256: sha256(bytes), sizeBytes: bytes.length, mimeType: "image/jpeg" })
    expect(JSON.stringify(body)).not.toMatch(/blob_|storage|key/i)
    expect(files()).toHaveLength(1)

    const served = await imageRoute.GET(get(), ctx(ids))
    expect(served.status).toBe(200)
    expect(Buffer.from(await served.arrayBuffer())).toEqual(Buffer.from(bytes))
    expect(served.headers.get("content-type")).toBe("image/jpeg")
    expect(served.headers.get("cache-control")).toBe("private, no-store")
    expect(served.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("is idempotent for identical bytes and refuses to replace a stored frame with a different image", async () => {
    const s = await seed()
    const ids = { id: s.dealId, assessmentId: s.assessmentId, evidenceId: s.evidenceIds[0] }
    const bytes = tinyJpeg("same")
    expect((await imageRoute.PUT(put(bytes as unknown as BodyInit), ctx(ids))).status).toBe(201)
    const replay = await imageRoute.PUT(put(bytes as unknown as BodyInit), ctx(ids))
    expect([replay.status, (await replay.json()).replayed]).toEqual([200, true])
    const different = await imageRoute.PUT(put(tinyJpeg("other") as unknown as BodyInit), ctx(ids))
    expect([different.status, (await different.json()).error]).toEqual([409, "FRAME_IMMUTABLE"])
    expect(files()).toHaveLength(1) // neither the replay nor the rejected replacement left bytes behind
  })

  it("exposes which frames have images through the assessment detail, without keys", async () => {
    const s = await seed()
    await imageRoute.PUT(put(tinyJpeg("a") as unknown as BodyInit), ctx({ id: s.dealId, assessmentId: s.assessmentId, evidenceId: s.evidenceIds[1] }))
    const detail = await (await detailRoute.GET(get(), ctx({ id: s.dealId, assessmentId: s.assessmentId }))).json()
    expect(detail.blobs).toHaveLength(1)
    expect(detail.blobs[0]).toMatchObject({ evidenceId: s.evidenceIds[1], mimeType: "image/jpeg" })
    expect(JSON.stringify(detail)).not.toMatch(/blob_|storageKey|storage_key/)
  })
})

describe("access control and isolation", () => {
  it("requires authentication for upload and download and writes nothing when unauthenticated", async () => {
    const s = await seed()
    const ids = { id: s.dealId, assessmentId: s.assessmentId, evidenceId: s.evidenceIds[0] }
    h.access.mockResolvedValue({ allowed: false, reason: "unauthenticated", status: 401, code: "AUTHENTICATION_REQUIRED" })
    expect((await imageRoute.PUT(put(tinyJpeg() as unknown as BodyInit), ctx(ids))).status).toBe(401)
    expect((await imageRoute.GET(get(), ctx(ids))).status).toBe(401)
    expect(files()).toHaveLength(0)
    expect(mem.rows.blobs.size).toBe(0)
  })

  it("denies a non-member with a privacy-preserving 404", async () => {
    const s = await seed()
    h.access.mockResolvedValue({ allowed: false, reason: "unauthorized", status: 404, code: "SAVED_DEAL_NOT_FOUND" })
    const res = await imageRoute.PUT(put(tinyJpeg() as unknown as BodyInit), ctx({ id: s.dealId, assessmentId: s.assessmentId, evidenceId: s.evidenceIds[0] }))
    expect([res.status, (await res.json()).error]).toEqual([404, "SAVED_DEAL_NOT_FOUND"])
  })

  it("cannot read, write or probe another deal's frames, even with valid ids", async () => {
    const a = await seed(2, "deal-1")
    const own = { id: "deal-1", assessmentId: a.assessmentId, evidenceId: a.evidenceIds[0] }
    await imageRoute.PUT(put(tinyJpeg("secret") as unknown as BodyInit), ctx(own))
    const other = { id: "deal-2", assessmentId: a.assessmentId, evidenceId: a.evidenceIds[0] }
    expect((await imageRoute.GET(get(), ctx(other))).status).toBe(404)
    expect((await imageRoute.PUT(put(tinyJpeg("planted") as unknown as BodyInit), ctx({ ...other, evidenceId: a.evidenceIds[1] }))).status).toBe(404)
    expect(files()).toHaveLength(1) // nothing written for the cross-deal attempt
  })

  it("does not let one assessment address another assessment's frame within the same deal", async () => {
    const a = await seed(1, "deal-1")
    const created = await (await listRoute.POST(json({ idempotencyKey: "create-key-second" }), ctx({ id: "deal-1" }))).json()
    const res = await imageRoute.PUT(put(tinyJpeg() as unknown as BodyInit), ctx({ id: "deal-1", assessmentId: created.assessment.id, evidenceId: a.evidenceIds[0] }))
    expect([res.status, (await res.json()).error]).toEqual([404, "EVIDENCE_NOT_FOUND"])
    expect(files()).toHaveLength(0)
  })

  it("rejects cross-origin uploads without storing anything", async () => {
    const s = await seed()
    const res = await imageRoute.PUT(put(tinyJpeg() as unknown as BodyInit, { "content-type": "image/jpeg", origin: "http://evil.example", host: "localhost" }), ctx({ id: s.dealId, assessmentId: s.assessmentId, evidenceId: s.evidenceIds[0] }))
    expect([res.status, (await res.json()).error]).toEqual([403, "CROSS_ORIGIN_REJECTED"])
    expect(files()).toHaveLength(0)
  })

  it("rejects malformed identifiers", async () => {
    const res = await imageRoute.GET(get(), ctx({ id: "deal-1", assessmentId: "a", evidenceId: "../../etc/passwd" }))
    expect(res.status).toBe(400)
  })
})

describe("upload validation", () => {
  async function attempt(bytes: BodyInit | null, headers: Record<string, string>) {
    const s = await seed(1)
    const res = await imageRoute.PUT(put(bytes, headers), ctx({ id: s.dealId, assessmentId: s.assessmentId, evidenceId: s.evidenceIds[0] }))
    return { status: res.status, error: (await res.json()).error as string | undefined }
  }

  it("rejects wrong content types, including HTML and video", async () => {
    for (const type of ["image/png", "text/html", "video/mp4", "application/octet-stream", ""]) {
      const r = await attempt(tinyJpeg() as unknown as BodyInit, { "content-type": type })
      expect([type, r.status]).toEqual([type, 415])
    }
    expect(files()).toHaveLength(0)
  })

  it("rejects bytes that are not a JPEG even when the header says image/jpeg", async () => {
    const r = await attempt("<html><script>alert(1)</script></html>", { "content-type": "image/jpeg" })
    expect([r.status, r.error]).toEqual([415, "NOT_A_JPEG"])
    expect(files()).toHaveLength(0)
  })

  it("rejects oversized images by declared length and by actual length", async () => {
    const big = new Uint8Array(OBJECT_POLICIES.evidence_frame.maxBytes + 1).fill(0xff)
    big.set([0xff, 0xd8, 0xff])
    expect((await attempt(big as unknown as BodyInit, { "content-type": "image/jpeg" })).status).toBe(413)
    expect((await attempt(tinyJpeg() as unknown as BodyInit, { "content-type": "image/jpeg", "content-length": "99999999" })).status).toBe(413)
    expect(files()).toHaveLength(0)
  })

  it("rejects an empty body and a checksum that does not match the bytes", async () => {
    expect((await attempt(new Uint8Array(0) as unknown as BodyInit, { "content-type": "image/jpeg" })).status).toBe(400)
    const mismatch = await attempt(tinyJpeg("m") as unknown as BodyInit, { "content-type": "image/jpeg", "x-content-sha256": "0".repeat(64) })
    expect([mismatch.status, mismatch.error]).toEqual([422, "CHECKSUM_MISMATCH"])
    expect((await attempt(tinyJpeg("m") as unknown as BodyInit, { "content-type": "image/jpeg", "x-content-sha256": "not-hex" })).status).toBe(422)
    expect(files()).toHaveLength(0)
  })

  it("accepts a correct client checksum", async () => {
    const bytes = tinyJpeg("ok")
    const r = await attempt(bytes as unknown as BodyInit, { "content-type": "image/jpeg; charset=binary", "x-content-sha256": sha256(bytes) })
    expect(r.status).toBe(201)
  })

  it("returns 404 for an unknown evidence id and writes nothing", async () => {
    const s = await seed(1)
    const res = await imageRoute.PUT(put(tinyJpeg() as unknown as BodyInit), ctx({ id: s.dealId, assessmentId: s.assessmentId, evidenceId: "no-such-frame" }))
    expect(res.status).toBe(404)
    expect(files()).toHaveLength(0)
  })
})

describe("storage failure handling", () => {
  it("answers 503 without revealing paths when no private store is configured", async () => {
    const s = await seed()
    __setBlobStoreForTests(null)
    const ids = { id: s.dealId, assessmentId: s.assessmentId, evidenceId: s.evidenceIds[0] }
    for (const res of [await imageRoute.PUT(put(tinyJpeg() as unknown as BodyInit), ctx(ids)), await imageRoute.GET(get(), ctx(ids))]) {
      const body = await res.json()
      expect([res.status, body.error]).toEqual([503, "STORAGE_UNAVAILABLE"])
      expect(JSON.stringify(body)).not.toContain(root)
    }
  })

  it("removes the stored bytes if recording them in the database fails (no orphans)", async () => {
    const s = await seed()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const original = mem.repo.putEvidenceBlob
    mem.repo.putEvidenceBlob = async () => { throw new Error("db down") }
    const res = await imageRoute.PUT(put(tinyJpeg() as unknown as BodyInit), ctx({ id: s.dealId, assessmentId: s.assessmentId, evidenceId: s.evidenceIds[0] }))
    mem.repo.putEvidenceBlob = original
    expect(res.status).toBe(500)
    expect(files()).toHaveLength(0)
  })

  it("reports a purged frame as gone, and refuses to serve a frame whose bytes no longer match their checksum", async () => {
    const s = await seed(2)
    const ids = (i: number) => ({ id: s.dealId, assessmentId: s.assessmentId, evidenceId: s.evidenceIds[i] })
    await imageRoute.PUT(put(tinyJpeg("one") as unknown as BodyInit), ctx(ids(0)))
    await imageRoute.PUT(put(tinyJpeg("two") as unknown as BodyInit), ctx(ids(1)))

    const location = (await mem.repo.getEvidenceBlobLocation(s.dealId, s.assessmentId, s.evidenceIds[0]))!
    await store.delete(location.storageKey) // retention purge
    expect((await imageRoute.GET(get(), ctx(ids(0)))).status).toBe(410)

    const tampered = (await mem.repo.getEvidenceBlobLocation(s.dealId, s.assessmentId, s.evidenceIds[1]))!
    writeFileSync(path.join(root, tampered.storageKey.slice(5, 7), tampered.storageKey), tinyJpeg("EVIL"))
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const served = await imageRoute.GET(get(), ctx(ids(1)))
    expect([served.status, (await served.json()).error]).toEqual([500, "IMAGE_INTEGRITY_FAILED"])
  })
})
