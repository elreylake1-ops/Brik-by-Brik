import { composePdfEvidencePack } from "@/lib/pdf-evidence-pack/compose-pdf-evidence-pack"
import type {
  PdfEvidencePack,
  PdfEvidencePackDisclaimer,
} from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import { projectEvidenceLiteRecordToPdfEvidenceItem } from "@/lib/pdf-evidence-pack/project-evidence-lite-record-to-pdf-evidence-item"
import { listEvidenceLiteForDeal } from "@/lib/evidence-lite/evidence-lite-repository"
import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import { loadAndEvaluateInvestorShield } from "@/lib/investor-shield/investor-shield-read-model"
import { composeInvestorSummaryViewModel } from "@/lib/investor-summary/compose-investor-summary-view-model"
import type {
  InvestorSummaryMapperCanonicalValuesInput,
  InvestorSummaryMapperSavedDealInput,
  InvestorSummaryMapperShieldInput,
} from "@/lib/investor-summary/map-investor-summary-view-model"
import { listOffersForDeal } from "@/lib/operator-command/deal-offers-repository"
import { listTasksForDeal } from "@/lib/operator-command/deal-tasks-repository"
import {
  getSavedDealById,
  type SavedDealRecord,
} from "@/lib/operator-command/saved-deals-repository"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"
import type { InvestorSummaryBlockedGate } from "@/types/investor-summary"

export type LoadPdfEvidencePackInput = {
  dealId: string
  generatedAt: string
  confidentialityLabel: string
}

type SavedDealCanonicalValues = {
  savedDeal: InvestorSummaryMapperSavedDealInput
  canonicalValues: InvestorSummaryMapperCanonicalValuesInput
}

const PDF_EVIDENCE_PACK_DISCLAIMERS: readonly PdfEvidencePackDisclaimer[] = [
  {
    code: "informational-decision-support",
    title: "Informational decision support",
    body: "This pack is read-only investor decision support.",
    required: true,
  },
  {
    code: "not-legal-advice",
    title: "Not legal advice",
    body: "This pack is not legal advice.",
    required: true,
  },
  {
    code: "not-valuation",
    title: "Not a valuation",
    body: "This pack is not a valuation.",
    required: true,
  },
  {
    code: "not-structural-survey",
    title: "Not a structural survey",
    body: "This pack is not a structural survey.",
    required: true,
  },
  {
    code: "not-lender-approval",
    title: "Not lender approval",
    body: "This pack is not lender approval.",
    required: true,
  },
  {
    code: "not-planning-or-building-control-certificate",
    title: "Not planning or building-control approval",
    body: "This pack is not a planning or building-control certificate.",
    required: true,
  },
  {
    code: "not-solicitor-substitute",
    title: "Not a solicitor substitute",
    body: "This pack is not a solicitor substitute.",
    required: true,
  },
  {
    code: "data-may-be-incomplete-or-stale",
    title: "Data may be incomplete or stale",
    body: "Canonical source data may be incomplete or stale at generation time.",
    required: true,
  },
  {
    code: "evidence-does-not-prove-gate-satisfaction",
    title: "Evidence does not prove gate satisfaction",
    body: "Evidence inclusion does not prove gate satisfaction.",
    required: true,
  },
  {
    code: "manual-overrides-remain-visible",
    title: "Manual overrides remain visible",
    body: "Manual overrides remain visible where applicable.",
    required: true,
  },
]

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
      capitalProtectionState:
        savedDeal.capital_protection_state as InvestorSummaryMapperSavedDealInput["capitalProtectionState"],
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

export async function loadPdfEvidencePackForDeal(
  input: LoadPdfEvidencePackInput
): Promise<PdfEvidencePack | null> {
  const normalizedDealId = normalizeDealId(input.dealId)
  if (!normalizedDealId) {
    return null
  }

  const savedDeal = await getSavedDealById(normalizedDealId)
  if (!savedDeal) {
    return null
  }

  const [investorShield, taskRecords, offerRecords, evidenceRecords] = await Promise.all([
    loadAndEvaluateInvestorShield(normalizedDealId),
    listTasksForDeal(normalizedDealId),
    listOffersForDeal(normalizedDealId),
    listEvidenceLiteForDeal(normalizedDealId),
  ])

  const extractedValues = extractSavedDealValues(savedDeal)
  const investorSummary = composeInvestorSummaryViewModel({
    savedDeal: extractedValues.savedDeal,
    canonicalValues: extractedValues.canonicalValues,
    investorShield: buildInvestorShieldInput(investorShield),
    taskRecords,
    offerRecords,
  })
  const evidenceIndex = evidenceRecords.map(projectEvidenceLiteRecordToPdfEvidenceItem)

  return composePdfEvidencePack({
    generatedAt: input.generatedAt,
    confidentialityLabel: input.confidentialityLabel,
    investorSummary,
    investorShield,
    evidenceIndex,
    disclaimers: PDF_EVIDENCE_PACK_DISCLAIMERS,
  })
}
