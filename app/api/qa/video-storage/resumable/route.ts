import { NextResponse } from "next/server"
import * as fs from "node:fs"
import * as path from "node:path"
import { randomUUID } from "node:crypto"

import { isQaEnvironment, assertSafeQaPath } from "@/lib/qa-security"

// Isolated QA / Local development TUS session creation endpoint
// Strictly forbidden in production, Vercel, or CI deployments.
export async function POST(request: Request) {
  if (!isQaEnvironment()) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const uploadLengthHeader = request.headers.get("Upload-Length")
  const uploadLength = uploadLengthHeader ? parseInt(uploadLengthHeader, 10) : 0
  const metadataHeader = request.headers.get("Upload-Metadata")

  let bucketName = "deal-evidence"
  let objectName = `video_${Date.now()}.mp4`
  let contentType = "video/mp4"

  if (metadataHeader) {
    const pairs = metadataHeader.split(",")
    for (const pair of pairs) {
      const parts = pair.trim().split(" ")
      if (parts.length === 2) {
        const [k, v] = parts
        try {
          const val = Buffer.from(v, "base64").toString("utf-8")
          if (k === "bucketName") bucketName = val
          else if (k === "objectName") objectName = val
          else if (k === "contentType") contentType = val
        } catch {}
      }
    }
  }

  const sessionId = `tus_${randomUUID()}`
  const sessionsDir = path.join(process.cwd(), ".qa-local", "evidence", "video-sessions", sessionId)
  await fs.promises.mkdir(sessionsDir, { recursive: true })

  const sessionMeta = {
    sessionId,
    bucketName,
    objectName,
    contentType,
    uploadLength,
    createdAt: new Date().toISOString(),
  }
  await fs.promises.writeFile(path.join(sessionsDir, "session.json"), JSON.stringify(sessionMeta, null, 2))
  await fs.promises.writeFile(path.join(sessionsDir, "data.part"), Buffer.alloc(0))

  // Same-origin relative Location: the browser resolves it against the page origin, so no CORS is needed
  // regardless of whether the page was opened as localhost or 127.0.0.1.
  const locationUrl = `/api/qa/video-storage/resumable/${sessionId}`

  return new NextResponse(null, {
    status: 201,
    headers: {
      Location: locationUrl,
      "Tus-Resumable": "1.0.0",
      "Access-Control-Expose-Headers": "Location, Tus-Resumable, Upload-Offset, Upload-Length",
    },
  })
}
