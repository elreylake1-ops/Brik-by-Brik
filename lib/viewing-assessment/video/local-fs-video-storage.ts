import * as fs from "node:fs"
import * as path from "node:path"
import { randomUUID } from "node:crypto"
import type {
  IVideoStorageService,
  SignedUploadUrlResult,
  VideoStorageObjectMetadata,
} from "./video-storage-service"

import { isQaEnvironment, assertSafeQaPath } from "@/lib/qa-security"

// Isolated QA / Local development storage provider for video evidence.
// Strictly forbidden in production, Vercel, or CI deployments.
export class LocalFsVideoStorageService implements IVideoStorageService {
  private root: string

  constructor(rootDir?: string) {
    if (!isQaEnvironment()) {
      throw new Error("LocalFsVideoStorageService is strictly forbidden in production or deployed environments.")
    }
    this.root = rootDir ?? path.join(process.cwd(), ".qa-local", "evidence", "video")
    if (!fs.existsSync(this.root)) {
      fs.mkdirSync(this.root, { recursive: true })
    }
  }

  private resolvePath(bucket: string, objectPath: string): string {
    const cleanBucket = bucket.replace(/[^a-zA-Z0-9_-]/g, "")
    const cleanPath = objectPath.replace(/^[/\\]+/, "").replace(/\\/g, "/")
    return assertSafeQaPath(this.root, cleanBucket, cleanPath)
  }

  async createSignedUploadUrl(bucket: string, objectPath: string): Promise<SignedUploadUrlResult> {
    const token = `sig_token_${randomUUID()}`
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
    const cleanPath = objectPath.replace(/^[/\\]+/, "").replace(/\\/g, "/")
    return {
      uploadUrl: `/api/qa/video-storage/upload/${encodeURIComponent(bucket)}/${cleanPath}?token=${token}`,
      uploadToken: token,
      resumableEndpoint: `/api/qa/video-storage/resumable`,
      expiresAt,
    }
  }

  async getObjectMetadata(bucket: string, objectPath: string): Promise<VideoStorageObjectMetadata | null> {
    const filePath = this.resolvePath(bucket, objectPath)
    if (!fs.existsSync(filePath)) return null
    const stat = fs.statSync(filePath)
    const lower = objectPath.toLowerCase()
    let contentType = "application/octet-stream"
    if (lower.endsWith(".mp4")) contentType = "video/mp4"
    else if (lower.endsWith(".mov")) contentType = "video/quicktime"
    else if (lower.endsWith(".m4v")) contentType = "video/x-m4v"
    else if (lower.endsWith(".png")) contentType = "image/png"
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg"

    return {
      bucket,
      path: objectPath,
      sizeBytes: stat.size,
      contentType,
      createdAt: stat.birthtime.toISOString(),
    }
  }

  async createSignedReadUrl(bucket: string, objectPath: string, _expiresInSeconds = 300): Promise<string> {
    const token = `sig_read_${randomUUID()}`
    const cleanPath = objectPath.replace(/^[/\\]+/, "").replace(/\\/g, "/")
    return `/api/qa/video-storage/read/${encodeURIComponent(bucket)}/${cleanPath}?token=${token}`
  }

  async downloadObject(bucket: string, objectPath: string): Promise<Buffer | null> {
    const filePath = this.resolvePath(bucket, objectPath)
    if (!fs.existsSync(filePath)) return null
    return fs.promises.readFile(filePath)
  }

  async uploadObject(bucket: string, objectPath: string, data: Buffer, _contentType?: string): Promise<void> {
    const filePath = this.resolvePath(bucket, objectPath)
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, data)
  }
}

let localFsSingleton: LocalFsVideoStorageService | null = null

export function getLocalFsVideoStorageService(): LocalFsVideoStorageService {
  if (!localFsSingleton) {
    localFsSingleton = new LocalFsVideoStorageService()
  }
  return localFsSingleton
}
