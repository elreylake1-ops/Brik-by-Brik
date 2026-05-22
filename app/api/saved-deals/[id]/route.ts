import { NextResponse } from "next/server"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"

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
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load saved deal at this time." },
      { status: 500 }
    )
  }
}
