import { NextResponse } from "next/server"
import { runWorkerCycle } from "@/lib/viewing-assessment/video/video-extraction-worker"

import { isQaEnvironment, isValidIdentifier } from "@/lib/qa-security"

// Isolated QA video worker trigger endpoint
// Strictly forbidden in production, Vercel, or CI deployments.
export async function POST(request: Request) {
  if (!isQaEnvironment()) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const dealId = typeof body.dealId === "string" ? body.dealId : undefined
    if (dealId !== undefined && !isValidIdentifier(dealId)) {
      return NextResponse.json({ error: "INVALID_DEAL_ID" }, { status: 400 })
    }

    const result = await runWorkerCycle("local-qa-worker-1", {}, dealId)
    return NextResponse.json({ success: true, result }, { status: 200 })
  } catch (error) {
    console.error("Worker trigger failed:", error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

