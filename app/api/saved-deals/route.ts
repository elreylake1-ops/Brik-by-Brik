import { NextResponse } from "next/server"
import { guardSavedDealApi } from "@/lib/operator-command/guard-saved-deal-api"
import { deriveSavedDealRecord } from "@/lib/operator-command/derive-saved-deal-record"
import { createSavedDeal, listSavedDeals } from "@/lib/operator-command/saved-deals-repository"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function GET(request: Request) {
  const guard = await guardSavedDealApi(request)
  if (!guard.ok) return guard.response

  try {
    const url = new URL(request.url)
    const includeArchived = url.searchParams.get("includeArchived") === "true"

    const deals = await listSavedDeals({ includeArchived })
    return NextResponse.json({ success: true, deals }, { status: 200 })
  } catch (error) {
    const diagnostic = createSafeRouteErrorDiagnostic("saved-deals.list", error)
    console.error("Saved deals list failed.", diagnostic)

    return NextResponse.json(
      {
        success: false,
        error: "SAVED_DEALS_READ_FAILED",
        traceId: diagnostic.traceId,
        diagnostic,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const guard = await guardSavedDealApi(request)
  if (!guard.ok) return guard.response

  try {
    const body: unknown = await request.json().catch(() => null)
    if (!isObject(body)) {
      return NextResponse.json({ success: false, error: "Invalid input: JSON object required." }, { status: 400 })
    }

    // Classification, governance, capital protection, pipeline state and the engine result are derived on the server
    // from the deal inputs; the browser cannot supply them.
    const derived = deriveSavedDealRecord(body)
    if (!derived.ok) {
      return NextResponse.json({ success: false, error: derived.error }, { status: 400 })
    }

    const deal = await createSavedDeal(derived.record)

    return NextResponse.json({ success: true, deal }, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to save deal at this time." },
      { status: 500 }
    )
  }
}
