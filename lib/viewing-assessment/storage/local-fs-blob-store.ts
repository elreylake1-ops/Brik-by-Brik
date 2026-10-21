import { createHash } from "node:crypto"
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  BlobPolicyError,
  assertObjectAllowed,
  isValidStorageKey,
  newStorageKey,
  type PrivateBlobStore,
} from "./blob-store"

// Local filesystem implementation for isolated development and QA ONLY.
//  - Directory is created owner-only (0700) and files owner-read/write (0600).
//  - Paths are derived solely from a validated server-generated key, then re-checked to stay inside the root,
//    so no input can traverse out of it.
//  - Files are never overwritten (exclusive create) and are written atomically (temp file + rename).
//  - The root must not sit under a `public` directory, which a web server could serve.

export const sha256Hex = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

export function createLocalFsBlobStore(rootDir: string): PrivateBlobStore {
  const root = path.resolve(rootDir)
  if (root.split(path.sep).some((segment) => segment.toLowerCase() === "public")) {
    throw new BlobPolicyError("STORAGE_UNAVAILABLE", "Blob root must not be inside a public directory.")
  }

  function locate(key: string): string {
    if (!isValidStorageKey(key)) throw new BlobPolicyError("INVALID_KEY", "Invalid storage key.")
    const full = path.resolve(root, key.slice(5, 7), key)
    if (!full.startsWith(root + path.sep)) throw new BlobPolicyError("INVALID_KEY", "Invalid storage key.")
    return full
  }

  return {
    async put(input) {
      assertObjectAllowed(input)
      const actual = sha256Hex(input.bytes)
      if (actual !== input.sha256) throw new BlobPolicyError("CHECKSUM_MISMATCH", "Checksum does not match the bytes.")

      const storageKey = newStorageKey()
      const target = locate(storageKey)
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
      const temp = `${target}.tmp`
      await writeFile(temp, input.bytes, { flag: "wx", mode: 0o600 })
      await rename(temp, target)
      return { storageKey, sha256: actual, sizeBytes: input.bytes.length }
    },

    async get(storageKey) {
      try {
        return new Uint8Array(await readFile(locate(storageKey)))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
        throw error
      }
    },

    async delete(storageKey) {
      try {
        await unlink(locate(storageKey))
        return true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
        throw error
      }
    },
  }
}
