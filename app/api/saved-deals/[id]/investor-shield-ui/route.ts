import { NextResponse } from "next/server"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"
import { loadInvestorShieldUiModelForDeal } from "@/lib/investor-shield/load-investor-shield-ui-model"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

const SAFE_ERROR = "Investor Shield status could not be loaded. Pipeline rules remain unchanged."

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const id = params?.id?.trim()

    if (!id) {
      return NextResponse.json({ success: false, error: SAFE_ERROR }, { status: 400 })
    }

    const deal = await getSavedDealById(id)
    if (!deal) {
      return NextResponse.json({ success: false, error: "Saved deal not found." }, { status: 404 })
    }

    const model = await loadInvestorShieldUiModelForDeal(id)

    return NextResponse.json({ success: true, model }, { status: 200 })
  } catch (error) {
    const diagnostic = createSafeRouteErrorDiagnostic("saved-deals.investor-shield-ui", error)
    console.error("Investor Shield UI load failed.", diagnostic)

    return NextResponse.json(
      {
        success: false,
        error: "INVESTOR_SHIELD_UI_READ_FAILED",
        traceId: diagnostic.traceId,
        diagnostic,
      },
      { status: 500 }
    )
  }
}
