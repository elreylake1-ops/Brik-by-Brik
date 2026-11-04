import { NextResponse } from "next/server"
import { guardSavedDealApi } from "@/lib/operator-command/guard-saved-deal-api"
import { createSavedDeal, listSavedDeals } from "@/lib/operator-command/saved-deals-repository"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"

export const dynamic = "force-dynamic"

type SavedDealPostBody = {
  address?: unknown
  listing_url?: unknown
  purchase_price?: unknown
  gdv_realistic?: unknown
  refurb_cost?: unknown
  classification?: unknown
  governance_state?: unknown
  capital_protection_state?: unknown
  pipeline_state?: unknown
  engine_result_json?: unknown
  risk_summary_json?: unknown
  next_action?: unknown
}

function isRequiredString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isNullableNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || typeof value === "number"
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string"
}

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
    const res = NextResponse.json({ success: true, deals }, { status: 200, headers: { "cache-control": "no-store" } })
    return guard.applyCookies ? guard.applyCookies(res) : res
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
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function POST(request: Request) {
  const guard = await guardSavedDealApi(request)
  if (!guard.ok) return guard.response

  try {
    const body = (await request.json()) as SavedDealPostBody

    if (!isRequiredString(body.address)) {
      return NextResponse.json({ success: false, error: "Invalid input: address is required." }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    if (!isRequiredString(body.classification)) {
      return NextResponse.json({ success: false, error: "Invalid input: classification is required." }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    if (!isRequiredString(body.governance_state)) {
      return NextResponse.json({ success: false, error: "Invalid input: governance_state is required." }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    if (!isRequiredString(body.capital_protection_state)) {
      return NextResponse.json({ success: false, error: "Invalid input: capital_protection_state is required." }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    if (!isRequiredString(body.pipeline_state)) {
      return NextResponse.json({ success: false, error: "Invalid input: pipeline_state is required." }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    if (!isObject(body.engine_result_json)) {
      return NextResponse.json({ success: false, error: "Invalid input: engine_result_json is required." }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    if (!isNullableNumber(body.purchase_price) || !isNullableNumber(body.gdv_realistic) || !isNullableNumber(body.refurb_cost)) {
      return NextResponse.json({ success: false, error: "Invalid input: numeric fields must be number or null." }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    if (!isNullableString(body.listing_url) || !isNullableString(body.next_action)) {
      return NextResponse.json({ success: false, error: "Invalid input: optional text fields must be string or null." }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    if (body.risk_summary_json !== undefined && body.risk_summary_json !== null && !isObject(body.risk_summary_json)) {
      return NextResponse.json({ success: false, error: "Invalid input: risk_summary_json must be object or null." }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    const deal = await createSavedDeal({
      address: body.address,
      listing_url: body.listing_url,
      purchase_price: body.purchase_price,
      gdv_realistic: body.gdv_realistic,
      refurb_cost: body.refurb_cost,
      classification: body.classification as any,
      governance_state: body.governance_state as any,
      capital_protection_state: body.capital_protection_state as any,
      pipeline_state: body.pipeline_state as any,
      engine_result_json: body.engine_result_json as any,
      risk_summary_json: (body.risk_summary_json ?? {}) as any,
      next_action: body.next_action ?? null,
    })

    const res = NextResponse.json({ success: true, deal }, { status: 201, headers: { "cache-control": "no-store" } })
    return guard.applyCookies ? guard.applyCookies(res) : res
  } catch (error) {
    const diagnostic = createSafeRouteErrorDiagnostic("saved-deals.create", error)
    console.error("Saved deals create failed.", diagnostic)

    return NextResponse.json(
      { success: false, error: "Unable to save deal at this time." },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
