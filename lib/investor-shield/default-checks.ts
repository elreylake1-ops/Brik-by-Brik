import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import type { InvestorShieldCheck } from "@/types/investor-shield"

export function buildDefaultInvestorShieldChecks(
  dealId: string
): readonly InvestorShieldCheck[] {
  return INVESTOR_SHIELD_DEFAULT_GATES.map((definition) => ({
    dealId,
    gateKey: definition.key,
    status: "REQUIRED",
    severity: definition.defaultSeverity,
    confidence: "UNKNOWN",
    requiredEvidence: definition.evidenceTypes,
    summary: `${definition.label}: ${definition.description}`,
    advisoryOnly: definition.advisoryOnly,
  }))
}
