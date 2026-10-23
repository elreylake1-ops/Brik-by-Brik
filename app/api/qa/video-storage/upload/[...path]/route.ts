import { NextResponse } from "next/server"
import * as fs from "node:fs"
import * as path from "node:path"

import { isQaEnvironment, assertSafeQaPath } from "@/lib/qa-security"

export async function PUT(
  request: Request,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  if (!isQaEnvironment()) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const { path: pathSegments } = await context.params
  const decodedSegments = pathSegments.map((s) => decodeURIComponent(s))

  const videoRoot = path.join(process.cwd(), ".qa-local", "evidence", "video")
  let destPath: string
  try {
    destPath = assertSafeQaPath(videoRoot, ...decodedSegments)
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
  const buffer = Buffer.from(await request.arrayBuffer())
  await fs.promises.writeFile(destPath, buffer)

  return NextResponse.json({ success: true, bytes: buffer.length }, { status: 200 })
}

