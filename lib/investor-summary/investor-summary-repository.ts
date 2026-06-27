import { listOffersForDeal } from "@/lib/operator-command/deal-offers-repository"
import { listTasksForDeal } from "@/lib/operator-command/deal-tasks-repository"
import { getSavedDealById, type SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import { loadAndEvaluateInvestorShield } from "@/lib/investor-shield/investor-shield-read-model"
import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import { composeInvestorSummaryViewModel } from "@/lib/investor-summary/compose-investor-summary-view-model"
import type {
  InvestorSummaryMapperCanonicalValuesInput,
  InvestorSummaryMapperSavedDealInput,
  InvestorSummaryMapperShieldInput,
} from "@/lib/investor-summary/map-investor-summary-view-model"
import type {
  InvestorSummaryBlockedGate,
  InvestorSummaryViewModel,
} from "@/types/investor-summary"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"

type SavedDealCanonicalValues = {
  savedDeal: InvestorSummaryMapperSavedDealInput
  canonicalValues: InvestorSummaryMapperCanonicalValuesInput
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
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

function normalizeDealId(dealId: string): string | null {
  const trimmed = dealId.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getGateDefinitionLabel(gateKey: string): string | undefined {
  return INVESTOR_SHIELD_DEFAULT_GATES.find((gate) => gate.key === gateKey)?.label
}

function mapBlockedGates(
  result: InvestorShieldEnforcementResult
): readonly InvestorSummaryBlockedGate[] {
  return result.blockingGateKeys.map((gateKey) => ({
    gateKey,
    label: getGateDefinitionLabel(gateKey),
    gateType: "required",
  }))
}

function buildInvestorShieldInput(
  result: InvestorShieldEnforcementResult
): InvestorSummaryMapperShieldInput {
  return {
    overallStatus: result.overallStatus,
    missingEvidenceCount: result.missingEvidenceGateKeys.length,
    blockedGates: mapBlockedGates(result),
    fallbackRecommendedActionTitle: result.taskRecommendations[0]?.title ?? null,
  }
}

function extractSavedDealValues(savedDeal: SavedDealRecord): SavedDealCanonicalValues {
  const engineResult = isRecord(savedDeal.engine_result_json) ? savedDeal.engine_result_json : undefined
  const dueDiligence = isRecord(engineResult?.dueDiligence) ? engineResult.dueDiligence : undefined
  const deal = isRecord(engineResult?.deal) ? engineResult.deal : undefined
  return {
    savedDeal: {
      dealId: savedDeal.id,
      address: savedDeal.address,
      purchasePrice: savedDeal.purchase_price,
      classification: savedDeal.classification as InvestorSummaryMapperSavedDealInput["classification"],
      capitalProtectionState: savedDeal.capital_protection_state as InvestorSummaryMapperSavedDealInput["capitalProtectionState"],
      persistedNextAction: savedDeal.next_action,
    },
    canonicalValues: {
      gdvRange: {
        downside: readNestedFiniteNumber(dueDiligence, ["gdvRange", "downside"]),
        realistic: readNestedFiniteNumber(dueDiligence, ["gdvRange", "realistic"]),
        strong: readNestedFiniteNumber(dueDiligence, ["gdvRange", "strong"]),
      },
      trueMao: {
        fifteenPercent: readNestedFiniteNumber(deal, ["trueMao", "fifteenPercent"]),
        twentyPercent: readNestedFiniteNumber(deal, ["trueMao", "twentyPercent"]),
        twentyFivePercent: readNestedFiniteNumber(deal, ["trueMao", "twentyFivePercent"]),
      },
    },
  }
}

export async function getInvestorSummaryForDeal(
  dealId: string
): Promise<InvestorSummaryViewModel | null> {
  const normalizedDealId = normalizeDealId(dealId)
  if (!normalizedDealId) {
    return null
  }

  const savedDeal = await getSavedDealById(normalizedDealId)
  if (!savedDeal) {
    return null
  }

  const extractedValues = extractSavedDealValues(savedDeal)
  const [investorShield, taskRecords, offerRecords] = await Promise.all([
    loadAndEvaluateInvestorShield(normalizedDealId),
    listTasksForDeal(normalizedDealId),
    listOffersForDeal(normalizedDealId),
  ])

  return composeInvestorSummaryViewModel({
    savedDeal: extractedValues.savedDeal,
    canonicalValues: extractedValues.canonicalValues,
    investorShield: buildInvestorShieldInput(investorShield),
    taskRecords,
    offerRecords,
  })
}
