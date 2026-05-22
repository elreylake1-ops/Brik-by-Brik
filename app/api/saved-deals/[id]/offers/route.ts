import { NextResponse } from "next/server"
import { createOffer, listOffersForDeal } from "@/lib/operator-command/deal-offers-repository"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

function isValidOfferAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const dealId = params?.id?.trim()

    if (!dealId) {
      return NextResponse.json(
        { success: false, error: "Invalid saved deal id." },
        { status: 400 }
      )
    }

    const offers = await listOffersForDeal(dealId)
    return NextResponse.json({ success: true, offers }, { status: 200 })
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load deal offers at this time." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const dealId = params?.id?.trim()

    if (!dealId) {
      return NextResponse.json(
        { success: false, error: "Invalid saved deal id." },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => null)

    if (!isValidOfferAmount(body?.offer_amount)) {
      return NextResponse.json(
        { success: false, error: "Invalid offer_amount." },
        { status: 400 }
      )
    }

    if (body?.offer_type !== undefined && typeof body.offer_type !== "string") {
      return NextResponse.json(
        { success: false, error: "Invalid offer_type." },
        { status: 400 }
      )
    }

    if (body?.offer_status !== undefined && typeof body.offer_status !== "string") {
      return NextResponse.json(
        { success: false, error: "Invalid offer_status." },
        { status: 400 }
      )
    }

    if (
      body?.offer_rationale !== undefined &&
      body.offer_rationale !== null &&
      typeof body.offer_rationale !== "string"
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid offer_rationale." },
        { status: 400 }
      )
    }

    if (
      body?.seller_response !== undefined &&
      body.seller_response !== null &&
      typeof body.seller_response !== "string"
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid seller_response." },
        { status: 400 }
      )
    }

    const offer = await createOffer(dealId, {
      offer_amount: body.offer_amount,
      offer_type: body.offer_type ?? "INITIAL",
      offer_status: body.offer_status ?? "DRAFT",
      offer_rationale: body.offer_rationale ?? null,
      seller_response: body.seller_response ?? null,
    })

    return NextResponse.json({ success: true, offer }, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to create deal offer at this time." },
      { status: 500 }
    )
  }
}
