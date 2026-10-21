import path from "node:path"
import { BlobPolicyError, type PrivateBlobStore } from "./blob-store"
import { createLocalFsBlobStore } from "./local-fs-blob-store"

// Chooses the blob store from configuration. Fails closed:
//  - nothing configured                         -> no store (routes answer 503 STORAGE_UNAVAILABLE)
//  - VIEWING_BLOB_STORE=local-fs                -> local filesystem, ONLY outside a deployed environment
//  - anything else (e.g. a future provider)     -> not implemented, so unavailable
// A deployed environment (NODE_ENV=production or running on Vercel) is refused for the local store: serverless
// disks are ephemeral and the local store is a QA tool, not a retention solution.

let testStore: PrivateBlobStore | null | undefined

/** Test seam. Refuses to run outside NODE_ENV=test. */
export function __setBlobStoreForTests(store: PrivateBlobStore | null | undefined): void {
  if (process.env.NODE_ENV !== "test") throw new Error("__setBlobStoreForTests is test-only")
  testStore = store
}

let cached: { key: string; store: PrivateBlobStore | null } | undefined

export function getBlobStore(env: Record<string, string | undefined> = process.env): PrivateBlobStore | null {
  if (testStore !== undefined) return testStore
  const mode = env.VIEWING_BLOB_STORE
  if (mode !== "local-fs") return null
  if (env.NODE_ENV === "production" || env.VERCEL) return null
  const root = env.VIEWING_BLOB_ROOT?.trim() || path.join(process.cwd(), ".qa-local", "evidence")
  const key = `${mode}|${root}`
  if (cached?.key !== key) {
    try {
      cached = { key, store: createLocalFsBlobStore(root) }
    } catch (error) {
      if (error instanceof BlobPolicyError) return null
      throw error
    }
  }
  return cached.store
}
