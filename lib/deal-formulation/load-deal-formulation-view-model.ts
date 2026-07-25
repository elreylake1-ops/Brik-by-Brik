import { composeDealFormulationViewModel } from "@/lib/deal-formulation/compose-deal-formulation-view-model"
import { extractDealFormulationCanonicalInput } from "@/lib/deal-formulation/extract-deal-formulation-canonical-input"
import { getInvestorSummaryForDeal } from "@/lib/investor-summary/investor-summary-repository"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"
import type { DealFormulationViewModel } from "@/types/deal-formulation"

function normalizeDealId(dealId: string): string | null {
  const trimmed = dealId.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function loadDealFormulationViewModel(
  dealId: string
): Promise<DealFormulationViewModel | null> {
  const normalizedDealId = normalizeDealId(dealId)
  if (!normalizedDealId) {
    return null
  }

  const savedDeal = await getSavedDealById(normalizedDealId)
  if (!savedDeal) {
    return null
  }

  const investorSummary = await getInvestorSummaryForDeal(normalizedDealId)
  if (!investorSummary) {
    return null
  }

  return composeDealFormulationViewModel(
    extractDealFormulationCanonicalInput({
      savedDeal,
      investorSummary,
    })
  )
}
