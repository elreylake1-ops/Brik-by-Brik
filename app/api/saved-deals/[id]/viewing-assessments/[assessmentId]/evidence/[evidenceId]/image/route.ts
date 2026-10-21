import { pgViewingAssessmentRepository as repo } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import {
  assessmentNotFound,
  authorize,
  json,
  readBinaryBody,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"
import { BlobPolicyError, OBJECT_POLICIES } from "@/lib/viewing-assessment/storage/blob-store"
import { getBlobStore } from "@/lib/viewing-assessment/storage/get-blob-store"
import { sha256Hex } from "@/lib/viewing-assessment/storage/local-fs-blob-store"

// PUT .../evidence/:evidenceId/image   store the JPEG for one registered frame (immutable once stored)
// GET .../evidence/:evidenceId/image   serve it to an authenticated operator
//
// The image is looked up by (deal, assessment, evidence) in the database, so a frame id from another deal
// or assessment can never reach another deal's bytes. The private storage key is never sent to the client.

const SHA_PATTERN = /^[a-f0-9]{64}$/

const STATUS_FOR: Record<string, number> = {
  UNSUPPORTED_TYPE: 415,
  NOT_A_JPEG: 415,
  TOO_LARGE: 413,
  EMPTY: 400,
  CHECKSUM_MISMATCH: 422,
  KIND_DISABLED: 501,
}

const unavailable = () => json({ success: false, error: "STORAGE_UNAVAILABLE" }, 503)

export async function PUT(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true, evidence: true })
    if (!auth.ok) return auth.response
    const store = getBlobStore()
    if (!store) return unavailable()

    const body = await readBinaryBody(request, {
      contentType: "image/jpeg",
      maxBytes: OBJECT_POLICIES.evidence_frame.maxBytes,
    })
    if (!body.ok) return body.response

    const dealId = auth.dealId
    const assessmentId = auth.assessmentId as string
    const evidenceId = auth.evidenceId as string
    const sha256 = sha256Hex(body.bytes)
    const claimed = request.headers.get("x-content-sha256")
    if (claimed !== null && (!SHA_PATTERN.test(claimed) || claimed !== sha256)) {
      return json({ success: false, error: "CHECKSUM_MISMATCH" }, 422)
    }

    const context_ = await repo.getEvidenceContext(dealId, assessmentId)
    if (!context_) return assessmentNotFound()
    if (!context_.evidence.some((e) => e.id === evidenceId)) {
      return json({ success: false, error: "EVIDENCE_NOT_FOUND" }, 404)
    }

    // Frames are immutable: an identical re-upload is an idempotent replay, a different image is refused.
    const existing = await repo.getEvidenceBlobLocation(dealId, assessmentId, evidenceId)
    if (existing) {
      return existing.sha256 === sha256
        ? json({ success: true, replayed: true, blob: publicMeta(existing) }, 200)
        : json({ success: false, error: "FRAME_IMMUTABLE" }, 409)
    }

    let stored
    try {
      stored = await store.put({ kind: "evidence_frame", bytes: body.bytes, mimeType: "image/jpeg", sha256 })
    } catch (error) {
      if (error instanceof BlobPolicyError) {
        return json({ success: false, error: error.code }, STATUS_FOR[error.code] ?? 400)
      }
      throw error
    }

    let result
    try {
      result = await repo.putEvidenceBlob(dealId, assessmentId, evidenceId, {
        storageKey: stored.storageKey,
        sha256: stored.sha256,
        sizeBytes: stored.sizeBytes,
        mimeType: "image/jpeg",
        createdBy: auth.actor,
      })
    } catch (error) {
      await store.delete(stored.storageKey).catch(() => undefined)
      throw error
    }
    if (!result || result.status !== "created") {
      await store.delete(stored.storageKey).catch(() => undefined) // lost a race, or no longer exists: no orphan bytes
      if (!result) return json({ success: false, error: "EVIDENCE_NOT_FOUND" }, 404)
      return result.status === "exists_same"
        ? json({ success: true, replayed: true, blob: result.meta }, 200)
        : json({ success: false, error: "FRAME_IMMUTABLE" }, 409)
    }
    return json({ success: true, replayed: false, blob: result.meta }, 201)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.evidence-image.put", error)
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true, evidence: true })
    if (!auth.ok) return auth.response
    const store = getBlobStore()
    if (!store) return unavailable()

    const location = await repo.getEvidenceBlobLocation(auth.dealId, auth.assessmentId as string, auth.evidenceId as string)
    if (!location) return json({ success: false, error: "IMAGE_NOT_FOUND" }, 404)

    const bytes = await store.get(location.storageKey)
    if (!bytes) return json({ success: false, error: "IMAGE_NOT_AVAILABLE" }, 410) // purged under retention
    if (sha256Hex(bytes) !== location.sha256) {
      console.error("Viewing frame failed its integrity check.", { evidenceId: auth.evidenceId })
      return json({ success: false, error: "IMAGE_INTEGRITY_FAILED" }, 500)
    }
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "content-length": String(bytes.length),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-disposition": 'inline; filename="frame.jpg"',
      },
    })
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.evidence-image.get", error)
  }
}

function publicMeta(l: { evidenceId: string; sha256: string; sizeBytes: number; mimeType: "image/jpeg" }) {
  return { evidenceId: l.evidenceId, sha256: l.sha256, sizeBytes: l.sizeBytes, mimeType: l.mimeType }
}
