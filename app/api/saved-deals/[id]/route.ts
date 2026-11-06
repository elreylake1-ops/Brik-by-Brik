import { NextResponse } from "next/server"
import { guardSavedDealApi } from "@/lib/operator-command/guard-saved-deal-api"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

export async function GET(request: Request, context: RouteContext) {
  const guard = await guardSavedDealApi(request)
  if (!guard.ok) return guard.response

  try {
    const params = await context.params
    const id = params?.id?.trim()

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Invalid saved deal id." },
        { status: 400, headers: { "cache-control": "no-store" } }
      )
    }

    const deal = await getSavedDealById(id)
    if (!deal) {
      return NextResponse.json(
        { success: false, error: "Saved deal not found." },
        { status: 404, headers: { "cache-control": "no-store" } }
      )
    }

    const res = NextResponse.json({ success: true, deal }, { status: 200, headers: { "cache-control": "no-store" } })
    return guard.applyCookies ? guard.applyCookies(res) : res
  } catch (error) {
    const diagnostic = createSafeRouteErrorDiagnostic("saved-deals.detail", error)
    console.error("Saved deal detail failed.", diagnostic)

    return NextResponse.json(
      {
        success: false,
        error: "SAVED_DEAL_READ_FAILED",
        traceId: diagnostic.traceId,
        diagnostic,
      },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
