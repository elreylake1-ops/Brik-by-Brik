import { NextResponse } from "next/server"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const id = params?.id?.trim()

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Invalid saved deal id." },
        { status: 400 }
      )
    }

    const deal = await getSavedDealById(id)
    if (!deal) {
      return NextResponse.json(
        { success: false, error: "Saved deal not found." },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, deal }, { status: 200 })
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
      { status: 500 }
    )
  }
}
