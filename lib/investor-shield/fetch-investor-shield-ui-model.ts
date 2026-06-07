import type { InvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"

const SAFE_ERROR = "Investor Shield status could not be loaded. Pipeline rules remain unchanged."

export type FetchInvestorShieldUiModelSuccess = {
  success: true
  model: InvestorShieldUiModel
}

export type FetchInvestorShieldUiModelFailure = {
  success: false
  error: string
}

export type FetchInvestorShieldUiModelResult =
  | FetchInvestorShieldUiModelSuccess
  | FetchInvestorShieldUiModelFailure

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export async function fetchInvestorShieldUiModel(
  dealId: string
): Promise<FetchInvestorShieldUiModelResult> {
  const trimmedDealId = typeof dealId === "string" ? dealId.trim() : ""

  if (!trimmedDealId) {
    return { success: false, error: SAFE_ERROR }
  }

  try {
    const response = await fetch(
      `/api/saved-deals/${encodeURIComponent(trimmedDealId)}/investor-shield-ui`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      }
    )

    let payload: unknown = null

    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!response.ok) {
      return {
        success: false,
        error:
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : SAFE_ERROR,
      }
    }

    if (isRecord(payload) && payload.success === true && payload.model != null) {
      return { success: true, model: payload.model as InvestorShieldUiModel }
    }

    return { success: false, error: SAFE_ERROR }
  } catch {
    return { success: false, error: SAFE_ERROR }
  }
}
