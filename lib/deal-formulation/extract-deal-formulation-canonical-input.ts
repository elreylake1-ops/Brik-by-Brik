import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { InvestorSummaryViewModel } from "@/types/investor-summary"
import type { ComposeDealFormulationInput } from "@/types/deal-formulation"

type ExtractDealFormulationCanonicalInputArgs = {
  readonly savedDeal: SavedDealRecord
  readonly investorSummary: InvestorSummaryViewModel
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function readText(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function readNestedFiniteNumber(
  source: Record<string, unknown> | undefined,
  path: readonly string[]
): number | null {
  let current: unknown = source

  for (const key of path) {
    if (!isRecord(current)) {
      return null
    }

    current = current[key]
  }

  return readFiniteNumber(current)
}

function readNestedText(
  source: Record<string, unknown> | undefined,
  path: readonly string[]
): string | null {
  let current: unknown = source

  for (const key of path) {
    if (!isRecord(current)) {
      return null
    }

    current = current[key]
  }

  return readText(current)
}

export function extractDealFormulationCanonicalInput(
  args: ExtractDealFormulationCanonicalInputArgs
): ComposeDealFormulationInput {
  const engineResult = isRecord(args.savedDeal.engine_result_json)
    ? args.savedDeal.engine_result_json
    : undefined
  const dueDiligence = isRecord(engineResult?.dueDiligence) ? engineResult.dueDiligence : undefined
  const deal = isRecord(engineResult?.deal) ? engineResult.deal : undefined

  return {
    savedDeal: {
      dealId: args.savedDeal.id,
      address: readText(args.savedDeal.address),
      refurbishmentCost: readFiniteNumber(args.savedDeal.refurb_cost),
      classification: readText(args.savedDeal.classification),
      capitalProtectionState: readText(args.savedDeal.capital_protection_state),
    },
    engineValues: {
      stampDuty: readNestedFiniteNumber(dueDiligence, ["inputs", "stampDuty"]),
      legalCosts: readNestedFiniteNumber(dueDiligence, ["inputs", "legalCosts"]),
      saleCosts: readNestedFiniteNumber(dueDiligence, ["inputs", "saleCosts"]),
      financeCost: readNestedFiniteNumber(deal, ["financeCost", "totalFinanceCost"]),
      totalInvestment: readNestedFiniteNumber(deal, ["totalCost"]),
      projectedProfit: readNestedFiniteNumber(deal, ["profit"]),
      profitMargin: readNestedFiniteNumber(deal, ["profitMargin"]),
      trueMao: {
        fifteenPercent: args.investorSummary.trueMao.fifteenPercent,
        twentyPercent: args.investorSummary.trueMao.twentyPercent,
        twentyFivePercent: args.investorSummary.trueMao.twentyFivePercent,
      },
      verdictStatus: readNestedText(engineResult, ["verdict", "status"]),
      strategyRecommendation: readNestedText(dueDiligence, ["decision", "strategyRecommendation"]),
    },
    investorSummary: {
      purchasePrice: readFiniteNumber(args.savedDeal.purchase_price),
      gdvRange: {
        downside: args.investorSummary.gdvRange.downside,
        realistic: args.investorSummary.gdvRange.realistic,
        strong: args.investorSummary.gdvRange.strong,
      },
      recommendedNextAction: args.investorSummary.recommendedNextAction.actionText,
    },
    latestOffer: args.investorSummary.latestOffer,
    canonicalWarnings: [],
  }
}
