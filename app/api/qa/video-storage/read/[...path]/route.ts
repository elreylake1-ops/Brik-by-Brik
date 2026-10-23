import { NextResponse } from "next/server"
import * as fs from "node:fs"
import * as path from "node:path"

import { isQaEnvironment, assertSafeQaPath } from "@/lib/qa-security"

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  if (!isQaEnvironment()) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const { path: pathSegments } = await context.params
  const decodedSegments = pathSegments.map((s) => decodeURIComponent(s))

  const videoRoot = path.join(process.cwd(), ".qa-local", "evidence", "video")
  let filePath: string
  try {
    filePath = assertSafeQaPath(videoRoot, ...decodedSegments)
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
  }

  const stat = await fs.promises.stat(filePath)
  const buffer = await fs.promises.readFile(filePath)

  const lower = filePath.toLowerCase()
  let contentType = "application/octet-stream"
  if (lower.endsWith(".png")) contentType = "image/png"
  else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg"
  else if (lower.endsWith(".mp4")) contentType = "video/mp4"

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, no-cache",
    },
  })
}
