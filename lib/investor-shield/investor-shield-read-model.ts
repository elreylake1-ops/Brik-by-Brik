import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import {
  listEvidenceItemsByDealId,
  listInvestorShieldChecksByDealId,
  listManualOverridesByDealId,
  listRiskFlagsByDealId,
} from "@/lib/investor-shield/investor-shield-repository"
import type {
  InvestorShieldEnforcementResult,
  InvestorShieldEvaluationInput,
} from "@/types/investor-shield-enforcement"

export type InvestorShieldReadModelOptions = {
  deterministicDealStatus?: string
  evaluatedAt?: string
}

export async function loadInvestorShieldEvaluationInput(
  dealId: string,
  options: InvestorShieldReadModelOptions = {}
): Promise<InvestorShieldEvaluationInput> {
  const [checks, evidenceItems, riskFlags, manualOverrides] = await Promise.all([
    listInvestorShieldChecksByDealId(dealId),
    listEvidenceItemsByDealId(dealId),
    listRiskFlagsByDealId(dealId),
    listManualOverridesByDealId(dealId),
  ])

  return {
    dealId,
    checks,
    evidenceItems,
    riskFlags,
    manualOverrides,
    deterministicDealStatus: options.deterministicDealStatus,
    evaluatedAt: options.evaluatedAt,
  }
}

export async function loadAndEvaluateInvestorShield(
  dealId: string,
  options: InvestorShieldReadModelOptions = {}
): Promise<InvestorShieldEnforcementResult> {
  const input = await loadInvestorShieldEvaluationInput(dealId, options)
  return evaluateInvestorShield(input)
}
