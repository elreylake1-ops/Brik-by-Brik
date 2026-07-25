import type {
  InvestorSummaryGdvRange,
  InvestorSummaryLatestOfferSummary,
  InvestorSummaryTrueMaoBreakdown,
} from "@/types/investor-summary"

export type DealFormulationAvailability = "AVAILABLE" | "UNAVAILABLE"

export type DealFormulationMonetaryValue = {
  readonly amount: number | null
  readonly availability: DealFormulationAvailability
  readonly unavailableReason: string | null
}

export type PreparedDealFormulationSavedDealValues = {
  readonly dealId: string
  readonly address: string | null
  readonly refurbishmentCost: number | null
  readonly classification: string | null
  readonly capitalProtectionState: string | null
}

export type PreparedDealFormulationEngineValues = {
  readonly stampDuty: number | null
  readonly legalCosts: number | null
  readonly saleCosts: number | null
  readonly financeCost: number | null
  readonly totalInvestment: number | null
  readonly projectedProfit: number | null
  readonly profitMargin: number | null
  readonly trueMao: Readonly<InvestorSummaryTrueMaoBreakdown>
  readonly verdictStatus: string | null
  readonly strategyRecommendation: string | null
}

export type PreparedDealFormulationInvestorSummaryValues = {
  readonly purchasePrice: number | null
  readonly gdvRange: Readonly<InvestorSummaryGdvRange>
  readonly recommendedNextAction: string | null
}

export type ComposeDealFormulationInput = {
  readonly savedDeal: PreparedDealFormulationSavedDealValues
  readonly engineValues: PreparedDealFormulationEngineValues
  readonly investorSummary: PreparedDealFormulationInvestorSummaryValues
  readonly latestOffer: InvestorSummaryLatestOfferSummary | null
  readonly canonicalWarnings?: readonly string[]
}

export type DealFormulationViewModel = {
  readonly identity: {
    readonly dealId: string
    readonly address: string | null
  }
  readonly financialSummary: {
    readonly purchasePrice: DealFormulationMonetaryValue
    readonly gdvRealistic: DealFormulationMonetaryValue
    readonly gdvDownside: DealFormulationMonetaryValue
    readonly gdvStrong: DealFormulationMonetaryValue
    readonly refurbishmentCost: DealFormulationMonetaryValue
    readonly stampDuty: DealFormulationMonetaryValue
    readonly legalCosts: DealFormulationMonetaryValue
    readonly saleCosts: DealFormulationMonetaryValue
    readonly acquisitionCosts: DealFormulationMonetaryValue
    readonly financeCost: DealFormulationMonetaryValue
    readonly totalInvestment: DealFormulationMonetaryValue
    readonly projectedProfit: DealFormulationMonetaryValue
    readonly profitMargin: number | null
    readonly roi: number | null
  }
  readonly trueMao: {
    readonly fifteenPercent: DealFormulationMonetaryValue
    readonly twentyPercent: DealFormulationMonetaryValue
    readonly twentyFivePercent: DealFormulationMonetaryValue
    readonly selectedAmount: null
    readonly selectedBand: null
    readonly sourceLabel: string
  }
  readonly offerPosition: {
    readonly latestRecordedOffer: number | null
    readonly latestOfferStatus: string | null
    readonly openingOffer: null
    readonly targetOffer: null
    readonly finalOffer: null
    readonly walkAwayAmount: null
    readonly walkAwayThreshold: null
    readonly unavailableReasons: readonly string[]
  }
  readonly decision: {
    readonly verdictStatus: string | null
    readonly classification: string | null
    readonly capitalProtectionState: string | null
    readonly strategyRecommendation: string | null
    readonly recommendedNextAction: string | null
  }
  readonly warnings: {
    readonly canonicalWarnings: readonly string[]
    readonly unavailableFields: readonly string[]
  }
}
