import type { InvestorSummaryViewModel } from "@/types/investor-summary"

const SAFE_ERROR = "Investor Summary could not be loaded."
const INVALID_ID_ERROR = "Investor Summary deal id is required."

export type FetchInvestorSummarySuccess = {
  success: true
  investorSummary: InvestorSummaryViewModel
}

export type FetchInvestorSummaryFailure = {
  success: false
  status: number
  error: string
  traceId?: string
}

export type FetchInvestorSummaryResult = FetchInvestorSummarySuccess | FetchInvestorSummaryFailure

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function buildInvestorSummaryRouteUrl(dealId: string): string {
  return `/api/saved-deals/${encodeURIComponent(dealId.trim())}/investor-summary`
}

export async function fetchInvestorSummary(
  dealId: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<FetchInvestorSummaryResult> {
  const trimmedDealId = typeof dealId === "string" ? dealId.trim() : ""

  if (!trimmedDealId) {
    return { success: false, status: 400, error: INVALID_ID_ERROR }
  }

  try {
    const response = await fetchImpl(buildInvestorSummaryRouteUrl(trimmedDealId), {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    })

    const payload = await readJsonResponse(response)

    if (response.ok) {
      if (isRecord(payload) && payload.success === true && payload.investorSummary != null) {
        return { success: true, investorSummary: payload.investorSummary as InvestorSummaryViewModel }
      }

      return { success: false, status: response.status || 500, error: SAFE_ERROR }
    }

    return {
      success: false,
      status: response.status || 500,
      error: isRecord(payload) && typeof payload.error === "string" ? payload.error : SAFE_ERROR,
      traceId: isRecord(payload) && typeof payload.traceId === "string" ? payload.traceId : undefined,
    }
  } catch {
    return { success: false, status: 500, error: SAFE_ERROR }
  }
}
