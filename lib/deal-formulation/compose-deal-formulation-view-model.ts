import type {
  ComposeDealFormulationInput,
  DealFormulationMonetaryValue,
  DealFormulationViewModel,
} from "@/types/deal-formulation"

const CANONICAL_TRUE_MAO_SOURCE_LABEL = "Canonical deterministic True MAO bands"
const ROI_UNAVAILABLE_REASON = "ROI is not available from the current canonical engine output."
const ACQUISITION_COSTS_UNAVAILABLE_REASON = "No canonical acquisition-cost aggregate exists."
const OPENING_OFFER_UNAVAILABLE_REASON = "No canonical opening-offer source exists."
const TARGET_OFFER_UNAVAILABLE_REASON = "No canonical target-offer source exists."
const FINAL_OFFER_UNAVAILABLE_REASON = "No canonical final-offer source exists."
const WALK_AWAY_AMOUNT_UNAVAILABLE_REASON = "No canonical walk-away amount exists."
const WALK_AWAY_THRESHOLD_UNAVAILABLE_REASON = "No canonical walk-away threshold exists."

function uniqueOrdered(values: readonly string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      continue
    }

    seen.add(value)
    result.push(value)
  }

  return result
}

function textOrNull(value: string | null | undefined): string | null {
  return typeof value === "string" ? value : null
}

function buildMonetaryValue(
  amount: number | null,
  unavailableReason: string
): DealFormulationMonetaryValue {
  if (amount === null) {
    return {
      amount: null,
      availability: "UNAVAILABLE",
      unavailableReason,
    }
  }

  return {
    amount,
    availability: "AVAILABLE",
    unavailableReason: null,
  }
}

function buildUnavailableFieldNotices(viewModel: DealFormulationViewModel): string[] {
  const unavailableFields: string[] = []

  const pushMonetaryReason = (value: DealFormulationMonetaryValue) => {
    if (value.unavailableReason) {
      unavailableFields.push(value.unavailableReason)
    }
  }

  pushMonetaryReason(viewModel.financialSummary.purchasePrice)
  pushMonetaryReason(viewModel.financialSummary.gdvRealistic)
  pushMonetaryReason(viewModel.financialSummary.gdvDownside)
  pushMonetaryReason(viewModel.financialSummary.gdvStrong)
  pushMonetaryReason(viewModel.financialSummary.refurbishmentCost)
  pushMonetaryReason(viewModel.financialSummary.stampDuty)
  pushMonetaryReason(viewModel.financialSummary.legalCosts)
  pushMonetaryReason(viewModel.financialSummary.saleCosts)
  pushMonetaryReason(viewModel.financialSummary.acquisitionCosts)
  pushMonetaryReason(viewModel.financialSummary.financeCost)
  pushMonetaryReason(viewModel.financialSummary.totalInvestment)
  pushMonetaryReason(viewModel.financialSummary.projectedProfit)
  pushMonetaryReason(viewModel.trueMao.fifteenPercent)
  pushMonetaryReason(viewModel.trueMao.twentyPercent)
  pushMonetaryReason(viewModel.trueMao.twentyFivePercent)

  if (viewModel.financialSummary.profitMargin === null) {
    unavailableFields.push("Profit margin unavailable.")
  }

  unavailableFields.push(ROI_UNAVAILABLE_REASON)

  if (viewModel.offerPosition.latestRecordedOffer === null) {
    unavailableFields.push("Latest recorded offer unavailable.")
  }

  unavailableFields.push(...viewModel.offerPosition.unavailableReasons)

  if (viewModel.decision.verdictStatus === null) {
    unavailableFields.push("Verdict status unavailable.")
  }
  if (viewModel.decision.classification === null) {
    unavailableFields.push("Classification unavailable.")
  }
  if (viewModel.decision.capitalProtectionState === null) {
    unavailableFields.push("Capital protection state unavailable.")
  }
  if (viewModel.decision.strategyRecommendation === null) {
    unavailableFields.push("Strategy recommendation unavailable.")
  }
  if (viewModel.decision.recommendedNextAction === null) {
    unavailableFields.push("Recommended next action unavailable.")
  }

  return uniqueOrdered(unavailableFields)
}

export function composeDealFormulationViewModel(
  input: ComposeDealFormulationInput
): DealFormulationViewModel {
  const purchasePrice = buildMonetaryValue(
    input.investorSummary.purchasePrice,
    "Purchase price unavailable."
  )
  const gdvRealistic = buildMonetaryValue(
    input.investorSummary.gdvRange.realistic,
    "GDV realistic unavailable."
  )
  const gdvDownside = buildMonetaryValue(
    input.investorSummary.gdvRange.downside,
    "GDV downside unavailable."
  )
  const gdvStrong = buildMonetaryValue(
    input.investorSummary.gdvRange.strong,
    "GDV strong unavailable."
  )
  const refurbishmentCost = buildMonetaryValue(
    input.savedDeal.refurbishmentCost,
    "Refurbishment cost unavailable."
  )
  const stampDuty = buildMonetaryValue(
    input.engineValues.stampDuty,
    "Stamp duty unavailable."
  )
  const legalCosts = buildMonetaryValue(
    input.engineValues.legalCosts,
    "Legal costs unavailable."
  )
  const saleCosts = buildMonetaryValue(
    input.engineValues.saleCosts,
    "Sale costs unavailable."
  )
  const acquisitionCosts = buildMonetaryValue(
    null,
    ACQUISITION_COSTS_UNAVAILABLE_REASON
  )
  const financeCost = buildMonetaryValue(
    input.engineValues.financeCost,
    "Finance cost unavailable."
  )
  const totalInvestment = buildMonetaryValue(
    input.engineValues.totalInvestment,
    "Total investment unavailable."
  )
  const projectedProfit = buildMonetaryValue(
    input.engineValues.projectedProfit,
    "Projected profit unavailable."
  )
  const trueMao15 = buildMonetaryValue(
    input.engineValues.trueMao.fifteenPercent,
    "True MAO 15% unavailable."
  )
  const trueMao20 = buildMonetaryValue(
    input.engineValues.trueMao.twentyPercent,
    "True MAO 20% unavailable."
  )
  const trueMao25 = buildMonetaryValue(
    input.engineValues.trueMao.twentyFivePercent,
    "True MAO 25% unavailable."
  )

  const offerUnavailableReasons = [
    OPENING_OFFER_UNAVAILABLE_REASON,
    TARGET_OFFER_UNAVAILABLE_REASON,
    FINAL_OFFER_UNAVAILABLE_REASON,
    WALK_AWAY_AMOUNT_UNAVAILABLE_REASON,
    WALK_AWAY_THRESHOLD_UNAVAILABLE_REASON,
  ] as const

  const viewModel: DealFormulationViewModel = {
    identity: {
      dealId: input.savedDeal.dealId,
      address: input.savedDeal.address,
    },
    financialSummary: {
      purchasePrice,
      gdvRealistic,
      gdvDownside,
      gdvStrong,
      refurbishmentCost,
      stampDuty,
      legalCosts,
      saleCosts,
      acquisitionCosts,
      financeCost,
      totalInvestment,
      projectedProfit,
      profitMargin: input.engineValues.profitMargin,
      roi: null,
    },
    trueMao: {
      fifteenPercent: trueMao15,
      twentyPercent: trueMao20,
      twentyFivePercent: trueMao25,
      selectedAmount: null,
      selectedBand: null,
      sourceLabel: CANONICAL_TRUE_MAO_SOURCE_LABEL,
    },
    offerPosition: {
      latestRecordedOffer: input.latestOffer?.amount ?? null,
      latestOfferStatus: textOrNull(input.latestOffer?.offerStatus),
      openingOffer: null,
      targetOffer: null,
      finalOffer: null,
      walkAwayAmount: null,
      walkAwayThreshold: null,
      unavailableReasons: [...offerUnavailableReasons],
    },
    decision: {
      verdictStatus: textOrNull(input.engineValues.verdictStatus),
      classification: textOrNull(input.savedDeal.classification),
      capitalProtectionState: textOrNull(input.savedDeal.capitalProtectionState),
      strategyRecommendation: textOrNull(input.engineValues.strategyRecommendation),
      recommendedNextAction: textOrNull(input.investorSummary.recommendedNextAction),
    },
    warnings: {
      canonicalWarnings: uniqueOrdered(input.canonicalWarnings ?? []),
      unavailableFields: [],
    },
  }

  return {
    ...viewModel,
    warnings: {
      canonicalWarnings: viewModel.warnings.canonicalWarnings,
      unavailableFields: buildUnavailableFieldNotices(viewModel),
    },
  }
}
