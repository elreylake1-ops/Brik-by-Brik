import type { DealOfferRecord } from "@/lib/operator-command/deal-offers-repository"
import type { DealTaskRecord } from "@/lib/operator-command/deal-tasks-repository"
import {
  mapInvestorSummaryViewModel,
  type InvestorSummaryMapperCanonicalValuesInput,
  type InvestorSummaryMapperSavedDealInput,
  type InvestorSummaryMapperShieldInput,
} from "@/lib/investor-summary/map-investor-summary-view-model"
import { selectActiveInvestorSummaryTasks } from "@/lib/investor-summary/select-active-investor-summary-tasks"
import { selectLatestInvestorSummaryOffer } from "@/lib/investor-summary/select-latest-investor-summary-offer"
import type { InvestorSummaryViewModel } from "@/types/investor-summary"

export type InvestorSummaryCompositionInput = {
  savedDeal: InvestorSummaryMapperSavedDealInput
  canonicalValues: InvestorSummaryMapperCanonicalValuesInput
  investorShield: InvestorSummaryMapperShieldInput
  taskRecords: readonly DealTaskRecord[]
  offerRecords: readonly DealOfferRecord[]
}

export function composeInvestorSummaryViewModel(
  input: InvestorSummaryCompositionInput
): InvestorSummaryViewModel {
  const activeTasks = selectActiveInvestorSummaryTasks(input.taskRecords)
  const latestOffer = selectLatestInvestorSummaryOffer(input.offerRecords)

  return mapInvestorSummaryViewModel({
    savedDeal: input.savedDeal,
    canonicalValues: input.canonicalValues,
    investorShield: input.investorShield,
    activeTasks,
    latestOffer,
  })
}
