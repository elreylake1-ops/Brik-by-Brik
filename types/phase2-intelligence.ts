import type { Phase2GovernanceInput } from "@/types/phase2-governance"
import type { Phase2Strategy, RiskSeverity } from "@/types/phase2"

export type Phase2ExitStrategyPreference = Extract<
  Phase2Strategy,
  "BRRR" | "FLIP" | "BUY_TO_LET"
>

export type Phase2IntelligenceInput = Phase2GovernanceInput & {
  motivationSignals?: string[]
  listingSignals?: string[]
  exitStrategyPreference?: Phase2ExitStrategyPreference
}

export type NegotiationPositionResult = {
  strength: "WEAK" | "NEUTRAL" | "STRONG"
  matchedSignals: string[]
  unsupportedUrgency: boolean
  heatModifier: number
  explanation: string
}

export type TimeRiskResult = {
  severity: RiskSeverity
  deductions: string[]
  reviewReasons: string[]
  explanation: string
}
