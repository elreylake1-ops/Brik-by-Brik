import { mkdtempSync, readdirSync, rmSync, statSync, existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  BlobPolicyError,
  OBJECT_POLICIES,
  STORAGE_KEY_PATTERN,
  isValidStorageKey,
  type PrivateBlobStore,
} from "@/lib/viewing-assessment/storage/blob-store"
import { getBlobStore } from "@/lib/viewing-assessment/storage/get-blob-store"
import { createLocalFsBlobStore } from "@/lib/viewing-assessment/storage/local-fs-blob-store"
import { sha256, tinyJpeg } from "./fixtures/jpeg-fixtures"

let root: string
let store: PrivateBlobStore

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "brik-blob-test-"))
  store = createLocalFsBlobStore(root)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const put = (bytes = tinyJpeg("a"), over: Partial<{ kind: "evidence_frame" | "original_video"; mimeType: string; sha256: string }> = {}) =>
  store.put({ kind: "evidence_frame", bytes, mimeType: "image/jpeg", sha256: sha256(bytes), ...over })

const rejectsWith = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(BlobPolicyError)
  expect((error as BlobPolicyError).code).toBe(code)
}

describe("local filesystem blob store", () => {
  it("stores a JPEG under a server-generated key and returns it intact, with the verified checksum", async () => {
    const bytes = tinyJpeg("one")
    const stored = await put(bytes)
    expect(stored.storageKey).toMatch(STORAGE_KEY_PATTERN)
    expect(stored).toMatchObject({ sha256: sha256(bytes), sizeBytes: bytes.length })
    expect(Buffer.from((await store.get(stored.storageKey))!)).toEqual(Buffer.from(bytes))
  })

  it("never lets a caller choose the key: two identical puts get different keys and neither overwrites", async () => {
    const a = await put(tinyJpeg("same"))
    const b = await put(tinyJpeg("same"))
    expect(a.storageKey).not.toBe(b.storageKey)
    expect(await store.get(a.storageKey)).not.toBeNull()
    expect(await store.get(b.storageKey)).not.toBeNull()
  })

  it("enforces the object policy before writing anything", async () => {
    const bytes = tinyJpeg("x")
    await rejectsWith(put(bytes, { mimeType: "image/png" }), "UNSUPPORTED_TYPE")
    await rejectsWith(put(bytes, { mimeType: "text/html" }), "UNSUPPORTED_TYPE")
    await rejectsWith(put(new Uint8Array(0)), "EMPTY")
    await rejectsWith(put(new Uint8Array(OBJECT_POLICIES.evidence_frame.maxBytes + 1).fill(0xff)), "TOO_LARGE")
    await rejectsWith(put(new TextEncoder().encode("<html><script>alert(1)</script></html>")), "NOT_A_JPEG") // honest header, wrong bytes
    await rejectsWith(put(bytes, { sha256: "0".repeat(64) }), "CHECKSUM_MISMATCH")
    expect(readdirSync(root)).toEqual([]) // nothing was written for any rejected object
  })

  it("keeps original-video retention explicitly disabled until a retention policy is approved", async () => {
    expect(OBJECT_POLICIES.original_video.enabled).toBe(false)
    const bytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70])
    await rejectsWith(store.put({ kind: "original_video", bytes, mimeType: "video/mp4", sha256: sha256(bytes) }), "KIND_DISABLED")
    expect(readdirSync(root)).toEqual([])
  })

  it("rejects keys that are not exactly server-generated keys, so nothing can traverse out of the root", async () => {
    for (const bad of ["../secret", "..\\secret", "blob_../../etc/passwd", "/etc/passwd", "C:\\Windows\\win.ini", "blob_", "", "blob_" + "0".repeat(40), "BLOB_00000000-0000-0000-0000-000000000000"]) {
      expect(isValidStorageKey(bad)).toBe(false)
      await rejectsWith(store.get(bad), "INVALID_KEY")
      await rejectsWith(store.delete(bad), "INVALID_KEY")
    }
  })

  it("returns null for a well-formed key that does not exist, and delete is idempotent", async () => {
    const missing = "blob_00000000-0000-4000-8000-000000000000"
    expect(await store.get(missing)).toBeNull()
    expect(await store.delete(missing)).toBe(false)
    const { storageKey } = await put()
    expect(await store.delete(storageKey)).toBe(true)
    expect(await store.delete(storageKey)).toBe(false)
    expect(await store.get(storageKey)).toBeNull()
  })

  it("is isolated: each store only sees its own root", async () => {
    const other = createLocalFsBlobStore(mkdtempSync(path.join(tmpdir(), "brik-blob-other-")))
    const { storageKey } = await put()
    expect(await other.get(storageKey)).toBeNull()
  })

  it.skipIf(process.platform === "win32")("creates the directory and files owner-only", async () => {
    const { storageKey } = await put()
    const shard = path.join(root, storageKey.slice(5, 7))
    expect(statSync(shard).mode & 0o077).toBe(0)
    expect(statSync(path.join(shard, storageKey)).mode & 0o077).toBe(0)
  })

  it("refuses a root inside a public directory and leaves no temp files behind", async () => {
    expect(() => createLocalFsBlobStore(path.join(root, "public", "evidence"))).toThrow(BlobPolicyError)
    await put()
    const files = readdirSync(root, { recursive: true }).map(String)
    expect(files.filter((f) => f.endsWith(".tmp"))).toEqual([])
  })
})

describe("blob store configuration fails closed", () => {
  it("returns no store unless local-fs is explicitly configured", () => {
    expect(getBlobStore({})).toBeNull()
    expect(getBlobStore({ VIEWING_BLOB_STORE: "supabase" })).toBeNull() // future provider: not implemented => unavailable
    expect(getBlobStore({ VIEWING_BLOB_STORE: "s3" })).toBeNull()
  })

  it("refuses the local store in a deployed environment", () => {
    expect(getBlobStore({ VIEWING_BLOB_STORE: "local-fs", NODE_ENV: "production" })).toBeNull()
    expect(getBlobStore({ VIEWING_BLOB_STORE: "local-fs", VERCEL: "1" })).toBeNull()
  })

  it("builds the local store outside a deployed environment, and refuses a public root", () => {
    expect(getBlobStore({ VIEWING_BLOB_STORE: "local-fs", NODE_ENV: "development", VIEWING_BLOB_ROOT: root })).not.toBeNull()
    expect(getBlobStore({ VIEWING_BLOB_STORE: "local-fs", NODE_ENV: "development", VIEWING_BLOB_ROOT: path.join(root, "public") })).toBeNull()
  })

  it("the default evidence directory is git-ignored and outside any served directory", () => {
    const ignore = readFileSync(path.resolve(__dirname, "../.gitignore"), "utf8")
    expect(ignore).toMatch(/^\.qa-local\/$/m)
    expect(existsSync(path.resolve(__dirname, "../public/.qa-local"))).toBe(false)
  })
})
