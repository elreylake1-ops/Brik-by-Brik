import { NextResponse } from "next/server"
import { getInvestorSummaryForDeal } from "@/lib/investor-summary/investor-summary-repository"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

const SAFE_INVALID_ID = "INVESTOR_SUMMARY_INVALID_ID"
const SAFE_NOT_FOUND = "INVESTOR_SUMMARY_NOT_FOUND"
const SAFE_READ_ERROR = "INVESTOR_SUMMARY_READ_FAILED"

export async function GET(_request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const id = params?.id?.trim()

    if (!id) {
      return NextResponse.json({ success: false, error: SAFE_INVALID_ID }, { status: 400 })
    }

    const investorSummary = await getInvestorSummaryForDeal(id)
    if (!investorSummary) {
      return NextResponse.json({ success: false, error: SAFE_NOT_FOUND }, { status: 404 })
    }

    return NextResponse.json({ success: true, investorSummary }, { status: 200 })
  } catch (error) {
    const diagnostic = createSafeRouteErrorDiagnostic("saved-deals.investor-summary", error)
    console.error("Investor Summary route failed.", diagnostic)

    return NextResponse.json(
      {
        success: false,
        error: SAFE_READ_ERROR,
        traceId: diagnostic.traceId,
        diagnostic,
      },
      { status: 500 }
    )
  }
}
