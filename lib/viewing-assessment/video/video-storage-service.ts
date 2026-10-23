import { randomUUID } from "node:crypto"

export type VideoStorageObjectMetadata = {
  bucket: string
  path: string
  sizeBytes: number
  contentType?: string
  sha256?: string
  createdAt?: string
}

export type SignedUploadUrlResult = {
  uploadUrl: string
  uploadToken: string
  resumableEndpoint: string
  expiresAt: string
}

export type IVideoStorageService = {
  createSignedUploadUrl(bucket: string, path: string): Promise<SignedUploadUrlResult>
  getObjectMetadata(bucket: string, path: string): Promise<VideoStorageObjectMetadata | null>
  createSignedReadUrl(bucket: string, path: string, expiresInSeconds?: number): Promise<string>
  downloadObject(bucket: string, path: string): Promise<Buffer | null>
  uploadObject(bucket: string, path: string, data: Buffer, contentType?: string): Promise<void>
}

// -------------------------------------------------------------------------------------------------
// In-Memory Storage Service for Isolated Tests & Local Development
// -------------------------------------------------------------------------------------------------
export class InMemoryVideoStorageService implements IVideoStorageService {
  private objects = new Map<string, VideoStorageObjectMetadata>()
  private objectData = new Map<string, Buffer>()
  private uploadTokens = new Map<string, { path: string; bucket: string; expiresAt: number }>()

  // Helper for tests to simulate a completed upload
  setObject(bucket: string, path: string, sizeBytes: number, contentType = "video/mp4", sha256?: string, data?: Buffer) {
    const key = `${bucket}:${path}`
    this.objects.set(key, {
      bucket,
      path,
      sizeBytes,
      contentType,
      sha256: sha256 ?? "a".repeat(64),
      createdAt: new Date().toISOString(),
    })
    if (data) {
      this.objectData.set(key, data)
    }
  }

  // Helper for tests to delete an object
  removeObject(bucket: string, path: string) {
    this.objects.delete(`${bucket}:${path}`)
    this.objectData.delete(`${bucket}:${path}`)
  }

  async downloadObject(bucket: string, path: string): Promise<Buffer | null> {
    const key = `${bucket}:${path}`
    return this.objectData.get(key) ?? null
  }

  async uploadObject(bucket: string, path: string, data: Buffer, contentType = "application/octet-stream"): Promise<void> {
    const key = `${bucket}:${path}`
    this.objects.set(key, {
      bucket,
      path,
      sizeBytes: data.length,
      contentType,
      createdAt: new Date().toISOString(),
    })
    this.objectData.set(key, data)
  }

  async createSignedUploadUrl(bucket: string, path: string): Promise<SignedUploadUrlResult> {
    const token = `sig_token_${randomUUID()}`
    const expiresAtMs = Date.now() + 3600 * 1000 // 1 hour
    this.uploadTokens.set(token, { bucket, path, expiresAt: expiresAtMs })
    return {
      uploadUrl: `https://storage.local.brik/upload/${bucket}/${path}?token=${token}`,
      uploadToken: token,
      resumableEndpoint: `https://storage.local.brik/upload/resumable`,
      expiresAt: new Date(expiresAtMs).toISOString(),
    }
  }

  async getObjectMetadata(bucket: string, path: string): Promise<VideoStorageObjectMetadata | null> {
    const key = `${bucket}:${path}`
    return this.objects.get(key) ?? null
  }

  async createSignedReadUrl(bucket: string, path: string, expiresInSeconds = 300): Promise<string> {
    const token = `sig_read_${randomUUID()}`
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    return `https://storage.local.brik/read/${bucket}/${path}?token=${token}&expiresAt=${encodeURIComponent(expiresAt)}`
  }
}

// -------------------------------------------------------------------------------------------------
// Real Supabase Storage Provider (REST API, zero dependency)
// -------------------------------------------------------------------------------------------------
export class SupabaseRestVideoStorageService implements IVideoStorageService {
  private baseUrl: string
  private serviceKey: string

  constructor(baseUrl?: string, serviceKey?: string) {
    this.baseUrl = baseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    this.serviceKey = serviceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  }

  private getHeaders(): HeadersInit {
    if (!this.serviceKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Supabase Storage operations")
    }
    return {
      Authorization: `Bearer ${this.serviceKey}`,
      apikey: this.serviceKey,
      "Content-Type": "application/json",
    }
  }

  async createSignedUploadUrl(bucket: string, path: string): Promise<SignedUploadUrlResult> {
    if (!this.baseUrl || !this.serviceKey) {
      throw new Error("Supabase Storage configuration missing")
    }
    const cleanBase = this.baseUrl.replace(/\/$/, "")
    const cleanPath = path.replace(/^\//, "")
    const url = `${cleanBase}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${cleanPath}`
    const res = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ upsert: false }),
    })

    if (!res.ok) {
      throw new Error(`Failed to create signed upload URL from Supabase: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as { url: string; token?: string }
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
    const fullUrl = data.url.startsWith("http") ? data.url : `${cleanBase}/storage/v1${data.url}`
    const token = data.token ?? fullUrl.split("token=")[1] ?? ""
    if (this.serviceKey && token === this.serviceKey) {
      throw new Error("Security violation: privileged service key cannot be used as client upload token")
    }

    const resumableEndpoint = cleanBase.includes(".supabase.co") && !cleanBase.includes(".storage.supabase.co")
      ? cleanBase.replace(".supabase.co", ".storage.supabase.co") + "/storage/v1/upload/resumable"
      : `${cleanBase}/storage/v1/upload/resumable`

    return {
      uploadUrl: fullUrl,
      uploadToken: token,
      resumableEndpoint,
      expiresAt,
    }
  }

  async getObjectMetadata(bucket: string, path: string): Promise<VideoStorageObjectMetadata | null> {
    if (!this.baseUrl || !this.serviceKey) {
      throw new Error("Supabase Storage configuration missing")
    }
    const cleanBase = this.baseUrl.replace(/\/$/, "")
    const cleanPath = path.replace(/^\//, "")
    const url = `${cleanBase}/storage/v1/object/info/authenticated/${encodeURIComponent(bucket)}/${cleanPath}`

    const res = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (res.status === 404) return null
    if (!res.ok) {
      throw new Error(`Failed to query storage object metadata: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as {
      size: number
      mimetype?: string
      content_type?: string
      created_at?: string
      metadata?: { size?: number; mimetype?: string }
    }

    const sizeBytes = data.size ?? data.metadata?.size ?? 0
    return {
      bucket,
      path: cleanPath,
      sizeBytes,
      contentType: data.content_type ?? data.mimetype ?? data.metadata?.mimetype,
      createdAt: data.created_at,
    }
  }

  async createSignedReadUrl(bucket: string, path: string, expiresInSeconds = 300): Promise<string> {
    if (!this.baseUrl || !this.serviceKey) {
      throw new Error("Supabase Storage configuration missing")
    }
    const cleanBase = this.baseUrl.replace(/\/$/, "")
    const cleanPath = path.replace(/^\//, "")
    const url = `${cleanBase}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${cleanPath}`

    const res = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    })

    if (!res.ok) {
      throw new Error(`Failed to create signed read URL from Supabase: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as { signedURL: string }
    return data.signedURL.startsWith("http") ? data.signedURL : `${cleanBase}/storage/v1${data.signedURL}`
  }

  async downloadObject(bucket: string, path: string): Promise<Buffer | null> {
    if (!this.baseUrl || !this.serviceKey) {
      throw new Error("Supabase Storage configuration missing")
    }
    const cleanBase = this.baseUrl.replace(/\/$/, "")
    const cleanPath = path.replace(/^\//, "")
    const url = `${cleanBase}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${cleanPath}`
    const res = await fetch(url, { headers: this.getHeaders() })
    if (res.status === 404) return null
    if (!res.ok) {
      throw new Error(`Failed to download storage object: ${res.status} ${res.statusText}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  async uploadObject(bucket: string, path: string, data: Buffer, contentType = "application/octet-stream"): Promise<void> {
    if (!this.baseUrl || !this.serviceKey) {
      throw new Error("Supabase Storage configuration missing")
    }
    const cleanBase = this.baseUrl.replace(/\/$/, "")
    const cleanPath = path.replace(/^\//, "")
    const url = `${cleanBase}/storage/v1/object/${encodeURIComponent(bucket)}/${cleanPath}`
    const headers = {
      Authorization: `Bearer ${this.serviceKey}`,
      apikey: this.serviceKey,
      "Content-Type": contentType,
      "x-upsert": "true",
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: new Uint8Array(data),
    })
    if (!res.ok) {
      throw new Error(`Failed to upload storage object: ${res.status} ${res.statusText}`)
    }
  }
}

// -------------------------------------------------------------------------------------------------
// Storage Service Resolution & Test Hooks
// -------------------------------------------------------------------------------------------------
let testStorageService: IVideoStorageService | null | undefined

export function __setVideoStorageServiceForTests(service: IVideoStorageService | null | undefined): void {
  testStorageService = service
}

export function getVideoStorageService(): IVideoStorageService {
  if (testStorageService !== undefined && testStorageService !== null) {
    return testStorageService
  }
  // In development/test with no Supabase configured, fall back to in-memory store
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new InMemoryVideoStorageService()
  }
  return new SupabaseRestVideoStorageService()
}
