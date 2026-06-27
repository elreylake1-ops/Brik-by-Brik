import type {
  InvestorSummaryBlockedGate,
  InvestorSummaryLatestOfferSummary,
  InvestorSummaryRecommendedNextAction,
  InvestorSummaryTaskSummary,
  InvestorSummaryViewModel,
} from "@/types/investor-summary"

export type InvestorSummaryMapperSavedDealInput = {
  dealId: string
  address: string
  purchasePrice: number | null
  classification: InvestorSummaryViewModel["classification"]
  capitalProtectionState: InvestorSummaryViewModel["capitalProtectionState"]
  persistedNextAction: string | null
}

export type InvestorSummaryMapperCanonicalValuesInput = {
  gdvRange: InvestorSummaryViewModel["gdvRange"]
  trueMao: InvestorSummaryViewModel["trueMao"]
}

export type InvestorSummaryMapperShieldInput = {
  overallStatus: InvestorSummaryViewModel["investorShield"]["overallStatus"]
  missingEvidenceCount: InvestorSummaryViewModel["investorShield"]["missingEvidenceCount"]
  blockedGates: readonly InvestorSummaryBlockedGate[]
  fallbackRecommendedActionTitle?: string | null
}

export type InvestorSummaryMapperInput = {
  savedDeal: InvestorSummaryMapperSavedDealInput
  canonicalValues: InvestorSummaryMapperCanonicalValuesInput
  investorShield: InvestorSummaryMapperShieldInput
  activeTasks: readonly InvestorSummaryTaskSummary[]
  latestOffer: InvestorSummaryLatestOfferSummary | null
}

function normalizeActionText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function copyBlockedGate(gate: InvestorSummaryBlockedGate): InvestorSummaryBlockedGate {
  return { ...gate }
}

function copyTask(task: InvestorSummaryTaskSummary): InvestorSummaryTaskSummary {
  return { ...task }
}

function copyOffer(offer: InvestorSummaryLatestOfferSummary): InvestorSummaryLatestOfferSummary {
  return { ...offer }
}

function buildRecommendedNextAction(
  persistedNextAction: string | null,
  fallbackRecommendedActionTitle: string | null | undefined
): InvestorSummaryRecommendedNextAction {
  const normalizedPersisted = normalizeActionText(persistedNextAction)
  if (normalizedPersisted) {
    return {
      source: "PERSISTED_NEXT_ACTION",
      actionText: normalizedPersisted,
    }
  }

  const normalizedFallback = normalizeActionText(fallbackRecommendedActionTitle)
  if (normalizedFallback) {
    return {
      source: "INVESTOR_SHIELD_FALLBACK",
      actionText: normalizedFallback,
    }
  }

  return {
    source: "UNAVAILABLE",
    actionText: null,
  }
}

export function mapInvestorSummaryViewModel(
  input: InvestorSummaryMapperInput
): InvestorSummaryViewModel {
  return {
    deal: {
      dealId: input.savedDeal.dealId,
      address: input.savedDeal.address,
    },
    purchasePrice: input.savedDeal.purchasePrice,
    gdvRange: {
      downside: input.canonicalValues.gdvRange.downside,
      realistic: input.canonicalValues.gdvRange.realistic,
      strong: input.canonicalValues.gdvRange.strong,
    },
    trueMao: {
      fifteenPercent: input.canonicalValues.trueMao.fifteenPercent,
      twentyPercent: input.canonicalValues.trueMao.twentyPercent,
      twentyFivePercent: input.canonicalValues.trueMao.twentyFivePercent,
    },
    capitalProtectionState: input.savedDeal.capitalProtectionState ?? null,
    classification: input.savedDeal.classification ?? null,
    investorShield: {
      overallStatus: input.investorShield.overallStatus ?? null,
      missingEvidenceCount: input.investorShield.missingEvidenceCount ?? null,
      blockedGates: input.investorShield.blockedGates.map(copyBlockedGate),
    },
    activeTasks: input.activeTasks.map(copyTask),
    latestOffer: input.latestOffer ? copyOffer(input.latestOffer) : null,
    recommendedNextAction: buildRecommendedNextAction(
      input.savedDeal.persistedNextAction,
      input.investorShield.fallbackRecommendedActionTitle
    ),
  }
}
