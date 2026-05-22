import { NextResponse } from "next/server"
import { createSavedDeal, listSavedDeals } from "@/lib/operator-command/saved-deals-repository"

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
  try {
    const url = new URL(request.url)
    const includeArchived = url.searchParams.get("includeArchived") === "true"

    const deals = await listSavedDeals({ includeArchived })
    return NextResponse.json({ success: true, deals }, { status: 200 })
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load saved deals at this time." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SavedDealPostBody

    if (!isRequiredString(body.address)) {
      return NextResponse.json({ success: false, error: "Invalid input: address is required." }, { status: 400 })
    }

    if (!isRequiredString(body.classification)) {
      return NextResponse.json({ success: false, error: "Invalid input: classification is required." }, { status: 400 })
    }

    if (!isRequiredString(body.governance_state)) {
      return NextResponse.json({ success: false, error: "Invalid input: governance_state is required." }, { status: 400 })
    }

    if (!isRequiredString(body.capital_protection_state)) {
      return NextResponse.json({ success: false, error: "Invalid input: capital_protection_state is required." }, { status: 400 })
    }

    if (!isRequiredString(body.pipeline_state)) {
      return NextResponse.json({ success: false, error: "Invalid input: pipeline_state is required." }, { status: 400 })
    }

    if (!isObject(body.engine_result_json)) {
      return NextResponse.json({ success: false, error: "Invalid input: engine_result_json is required." }, { status: 400 })
    }

    if (!isNullableNumber(body.purchase_price) || !isNullableNumber(body.gdv_realistic) || !isNullableNumber(body.refurb_cost)) {
      return NextResponse.json({ success: false, error: "Invalid input: numeric fields must be number or null." }, { status: 400 })
    }

    if (!isNullableString(body.listing_url) || !isNullableString(body.next_action)) {
      return NextResponse.json({ success: false, error: "Invalid input: optional text fields must be string or null." }, { status: 400 })
    }

    if (body.risk_summary_json !== undefined && body.risk_summary_json !== null && !isObject(body.risk_summary_json)) {
      return NextResponse.json({ success: false, error: "Invalid input: risk_summary_json must be object or null." }, { status: 400 })
    }

    const deal = await createSavedDeal({
      address: body.address,
      listing_url: body.listing_url ?? null,
      purchase_price: body.purchase_price ?? null,
      gdv_realistic: body.gdv_realistic ?? null,
      refurb_cost: body.refurb_cost ?? null,
      classification: body.classification,
      governance_state: body.governance_state,
      capital_protection_state: body.capital_protection_state,
      pipeline_state: body.pipeline_state,
      engine_result_json: body.engine_result_json,
      risk_summary_json: isObject(body.risk_summary_json) ? body.risk_summary_json : {},
      next_action: body.next_action ?? null,
    })

    return NextResponse.json({ success: true, deal }, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to save deal at this time." },
      { status: 500 }
    )
  }
}
