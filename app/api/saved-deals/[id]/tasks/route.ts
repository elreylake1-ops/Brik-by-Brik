import { NextResponse } from "next/server"
import { guardSavedDealApi } from "@/lib/operator-command/guard-saved-deal-api"
import { createTask, listTasksForDeal } from "@/lib/operator-command/deal-tasks-repository"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

function isValidTaskTitle(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isValidOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string"
}

export async function GET(request: Request, context: RouteContext) {
  const guard = await guardSavedDealApi(request)
  if (!guard.ok) return guard.response

  try {
    const params = await context.params
    const dealId = params?.id?.trim()

    if (!dealId) {
      return NextResponse.json(
        { success: false, error: "Invalid saved deal id." },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    const tasks = await listTasksForDeal(dealId)
    const res = NextResponse.json({ success: true, tasks }, { status: 200, headers: { "cache-control": "no-store" } })
    return guard.applyCookies ? guard.applyCookies(res) : res
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load deal tasks at this time." },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardSavedDealApi(request)
  if (!guard.ok) return guard.response

  try {
    const params = await context.params
    const dealId = params?.id?.trim()

    if (!dealId) {
      return NextResponse.json(
        { success: false, error: "Invalid saved deal id." },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    const body = await request.json().catch(() => null)

    if (!isValidTaskTitle(body?.task_title)) {
      return NextResponse.json(
        { success: false, error: "Invalid task_title." },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    if (!isValidOptionalString(body?.task_type)) {
      return NextResponse.json(
        { success: false, error: "Invalid task_type." },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    if (!isValidOptionalString(body?.task_status)) {
      return NextResponse.json(
        { success: false, error: "Invalid task_status." },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    if (!isValidOptionalString(body?.priority)) {
      return NextResponse.json(
        { success: false, error: "Invalid priority." },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    if (!isValidOptionalString(body?.due_date)) {
      return NextResponse.json(
        { success: false, error: "Invalid due_date." },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    if (!isValidOptionalString(body?.blocker_reason)) {
      return NextResponse.json(
        { success: false, error: "Invalid blocker_reason." },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    const task = await createTask(dealId, {
      task_title: body.task_title.trim(),
      task_type: body.task_type ?? "DUE_DILIGENCE",
      task_status: body.task_status ?? "OPEN",
      priority: body.priority ?? "MEDIUM",
      due_date: body.due_date ?? null,
      blocker_reason: body.blocker_reason ?? null,
    })

    const res = NextResponse.json({ success: true, task }, { status: 201, headers: { "cache-control": "no-store" } })
    return guard.applyCookies ? guard.applyCookies(res) : res
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to create deal task at this time." },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
