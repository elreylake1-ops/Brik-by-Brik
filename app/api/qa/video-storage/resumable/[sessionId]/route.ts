import { NextResponse } from "next/server"
import * as fs from "node:fs"
import * as path from "node:path"

import { isQaEnvironment, assertSafeQaPath, isValidIdentifier } from "@/lib/qa-security"

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } }
) {
  if (!isQaEnvironment()) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const { sessionId } = await context.params
  if (!isValidIdentifier(sessionId)) {
    return NextResponse.json({ error: "INVALID_SESSION" }, { status: 400 })
  }

  const sessionsRoot = path.join(process.cwd(), ".qa-local", "evidence", "video-sessions")
  let sessionDir: string
  try {
    sessionDir = assertSafeQaPath(sessionsRoot, sessionId)
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const metaFile = path.join(sessionDir, "session.json")
  const dataFile = path.join(sessionDir, "data.part")

  if (!fs.existsSync(metaFile)) {
    return new NextResponse(null, { status: 404 })
  }

  const meta = JSON.parse(await fs.promises.readFile(metaFile, "utf-8"))
  let offset = 0
  if (fs.existsSync(dataFile)) {
    const stat = await fs.promises.stat(dataFile)
    offset = stat.size
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": String(offset),
      "Upload-Length": String(meta.uploadLength),
      "Access-Control-Expose-Headers": "Location, Tus-Resumable, Upload-Offset, Upload-Length",
    },
  })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } }
) {
  if (!isQaEnvironment()) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const { sessionId } = await context.params
  if (!isValidIdentifier(sessionId)) {
    return NextResponse.json({ error: "INVALID_SESSION" }, { status: 400 })
  }

  const sessionsRoot = path.join(process.cwd(), ".qa-local", "evidence", "video-sessions")
  let sessionDir: string
  try {
    sessionDir = assertSafeQaPath(sessionsRoot, sessionId)
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const metaFile = path.join(sessionDir, "session.json")
  const dataFile = path.join(sessionDir, "data.part")

  if (!fs.existsSync(metaFile)) {
    return new NextResponse(null, { status: 404 })
  }

  const meta = JSON.parse(await fs.promises.readFile(metaFile, "utf-8"))
  const offsetHeader = request.headers.get("Upload-Offset")
  const expectedOffset = offsetHeader ? parseInt(offsetHeader, 10) : 0

  let currentSize = 0
  if (fs.existsSync(dataFile)) {
    const stat = await fs.promises.stat(dataFile)
    currentSize = stat.size
  }

  if (expectedOffset !== currentSize) {
    return new NextResponse(null, {
      status: 409,
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": String(currentSize),
      },
    })
  }

  const chunkBuffer = Buffer.from(await request.arrayBuffer())
  await fs.promises.appendFile(dataFile, chunkBuffer)

  const newOffset = currentSize + chunkBuffer.length

  // If upload completed, copy to destination
  if (newOffset >= meta.uploadLength) {
    const videoRoot = path.join(process.cwd(), ".qa-local", "evidence", "video")
    const destPath = assertSafeQaPath(videoRoot, meta.bucketName, meta.objectName)
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
    await fs.promises.copyFile(dataFile, destPath)
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": String(newOffset),
      "Access-Control-Expose-Headers": "Location, Tus-Resumable, Upload-Offset, Upload-Length",
    },
  })
}
