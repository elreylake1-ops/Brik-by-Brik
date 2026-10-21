import { randomUUID } from "node:crypto"

// Private object storage boundary for viewing evidence.
//
//  - Objects are PRIVATE by construction: nothing here produces a URL. Bytes are reachable only through
//    authenticated server routes that look the object up by (deal, assessment, evidence) and then call get().
//  - Keys are server-generated (`blob_<uuid>`). A client never chooses, sees or supplies a key.
//  - Every put() enforces the policy for its object kind: allowed type, size bounds, magic bytes, checksum.
//  - Implementations: local filesystem (isolated development/QA, below) and, later, a private object-storage
//    provider. A deployed environment must not use the local one (see getBlobStore).

export type ObjectKind = "evidence_frame" | "original_video"

export type ObjectPolicy = {
  enabled: boolean
  disabledReason?: string
  allowedMimeTypes: readonly string[]
  maxBytes: number
}

export const OBJECT_POLICIES: Readonly<Record<ObjectKind, ObjectPolicy>> = {
  evidence_frame: {
    enabled: true,
    allowedMimeTypes: ["image/jpeg"],
    maxBytes: 2 * 1024 * 1024, // matches the viewing_evidence_blobs size CHECK
  },
  // Explicit design path for private original-video retention. Deliberately OFF: the retention period,
  // deletion process and provider data-handling terms are not approved, so no original video may be stored.
  // Turning this on requires an approved policy, a viewing_asset_blobs table, and a provider implementation.
  original_video: {
    enabled: false,
    disabledReason: "Private original-video retention is not approved yet (retention policy pending).",
    allowedMimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    maxBytes: 250 * 1024 * 1024,
  },
}

export type BlobErrorCode =
  | "KIND_DISABLED"
  | "UNSUPPORTED_TYPE"
  | "EMPTY"
  | "TOO_LARGE"
  | "NOT_A_JPEG"
  | "CHECKSUM_MISMATCH"
  | "INVALID_KEY"
  | "STORAGE_UNAVAILABLE"

export class BlobPolicyError extends Error {
  constructor(readonly code: BlobErrorCode, message: string) {
    super(message)
    this.name = "BlobPolicyError"
  }
}

export type PutObjectInput = {
  kind: ObjectKind
  bytes: Uint8Array
  mimeType: string
  /** Lowercase hex SHA-256 the caller expects; the store recomputes and rejects a mismatch. */
  sha256: string
}

export type StoredObject = { storageKey: string; sha256: string; sizeBytes: number }

export type PrivateBlobStore = {
  put(input: PutObjectInput): Promise<StoredObject>
  /** Returns null when the object does not exist (never stored, or purged). */
  get(storageKey: string): Promise<Uint8Array | null>
  /** Idempotent. Returns whether something was removed. */
  delete(storageKey: string): Promise<boolean>
}

export const STORAGE_KEY_PATTERN = /^blob_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const newStorageKey = () => `blob_${randomUUID()}`

export const isValidStorageKey = (key: unknown): key is string =>
  typeof key === "string" && STORAGE_KEY_PATTERN.test(key)

/** JPEG start-of-image marker. The declared Content-Type is never trusted on its own. */
export const looksLikeJpeg = (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff

/** Shared policy check used by every implementation, before anything is written. */
export function assertObjectAllowed(input: Pick<PutObjectInput, "kind" | "bytes" | "mimeType">): ObjectPolicy {
  const policy = OBJECT_POLICIES[input.kind]
  if (!policy?.enabled) {
    throw new BlobPolicyError("KIND_DISABLED", policy?.disabledReason ?? "This object kind is not enabled.")
  }
  if (!policy.allowedMimeTypes.includes(input.mimeType)) {
    throw new BlobPolicyError("UNSUPPORTED_TYPE", `Content type ${JSON.stringify(input.mimeType)} is not allowed for ${input.kind}.`)
  }
  if (input.bytes.length === 0) throw new BlobPolicyError("EMPTY", "Empty object.")
  if (input.bytes.length > policy.maxBytes) {
    throw new BlobPolicyError("TOO_LARGE", `Object exceeds ${policy.maxBytes} bytes.`)
  }
  if (input.kind === "evidence_frame" && !looksLikeJpeg(input.bytes)) {
    throw new BlobPolicyError("NOT_A_JPEG", "Bytes are not a JPEG image.")
  }
  return policy
}
