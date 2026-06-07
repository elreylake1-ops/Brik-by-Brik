import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import {
  loadInvestorShieldEvaluationInput,
  type InvestorShieldReadModelOptions,
} from "@/lib/investor-shield/investor-shield-read-model"
import { buildInvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"
import type { InvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"

function assertValidDealId(dealId: string): asserts dealId is string {
  if (typeof dealId !== "string" || dealId.trim().length === 0) {
    throw new Error("Investor Shield deal id is required.")
  }
}

export async function loadInvestorShieldUiModelForDeal(
  dealId: string,
  options: InvestorShieldReadModelOptions = {}
): Promise<InvestorShieldUiModel> {
  assertValidDealId(dealId)

  const input = await loadInvestorShieldEvaluationInput(dealId.trim(), options)
  const enforcementResult = evaluateInvestorShield(input)

  return buildInvestorShieldUiModel({
    dealId: input.dealId,
    checks: input.checks,
    evidenceItems: input.evidenceItems,
    enforcementResult,
    manualOverrides: input.manualOverrides,
  })
}
