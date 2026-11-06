import { NextResponse } from "next/server"
import { guardSavedDealApi } from "@/lib/operator-command/guard-saved-deal-api"
import { getInvestorSummaryForDeal } from "@/lib/investor-summary/investor-summary-repository"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

const SAFE_INVALID_ID = "INVESTOR_SUMMARY_INVALID_ID"
const SAFE_NOT_FOUND = "INVESTOR_SUMMARY_NOT_FOUND"
const SAFE_READ_ERROR = "INVESTOR_SUMMARY_READ_FAILED"

export async function GET(request: Request, context: RouteContext) {
  const guard = await guardSavedDealApi(request)
  if (!guard.ok) return guard.response

  try {
    const params = await context.params
    const id = params?.id?.trim()

    if (!id) {
      return NextResponse.json({ success: false, error: SAFE_INVALID_ID }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    const investorSummary = await getInvestorSummaryForDeal(id)
    if (!investorSummary) {
      return NextResponse.json({ success: false, error: SAFE_NOT_FOUND }, { status: 404, headers: { "cache-control": "no-store" } })
    }

    const res = NextResponse.json({ success: true, investorSummary }, { status: 200, headers: { "cache-control": "no-store" } })
    return guard.applyCookies ? guard.applyCookies(res) : res
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
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
