import type { CapitalProtectionStatus, DealClassification } from "@/types/due-diligence"
import type { InvestorShieldGateKey } from "@/types/investor-shield"
import type { InvestorShieldOverallStatus } from "@/types/investor-shield-enforcement"
import type { OfferType, TaskPriority, TaskStatus, TaskType } from "@/types/operator-command"

// Phase 4F-1A investor summary contracts are type definitions only.
// This file does not add mapper logic, repository access, or UI behavior.

export type InvestorSummaryRecommendedActionSource =
  | "PERSISTED_NEXT_ACTION"
  | "INVESTOR_SHIELD_FALLBACK"
  | "UNAVAILABLE"

export type InvestorSummaryDealIdentity = {
  dealId: string
  address: string
}

export type InvestorSummaryGdvRange = {
  downside: number | null
  realistic: number | null
  strong: number | null
}

export type InvestorSummaryTrueMaoBreakdown = {
  fifteenPercent: number | null
  twentyPercent: number | null
  twentyFivePercent: number | null
}

export type InvestorSummaryBlockedGate = {
  gateKey: InvestorShieldGateKey
  label?: string
  gateType?: "required" | "advisory"
  blockerReason?: string
}

export type InvestorSummaryShieldSummary = {
  overallStatus: InvestorShieldOverallStatus | null
  missingEvidenceCount: number | null
  blockedGates: readonly InvestorSummaryBlockedGate[]
}

export type InvestorSummaryTaskSummary = {
  taskId: string
  title: string
  taskType: TaskType
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  blockerReason: string | null
  createdAt: string
  completedAt: string | null
}

export type InvestorSummaryLatestOfferSummary = {
  offerId: string
  amount: number
  offerType: OfferType
  offerStatus: string
  rationale: string | null
  sellerResponse: string | null
  createdAt: string
}

export type InvestorSummaryRecommendedNextAction = {
  source: InvestorSummaryRecommendedActionSource
  actionText: string | null
}

export type InvestorSummaryViewModel = {
  deal: InvestorSummaryDealIdentity
  purchasePrice: number | null
  gdvRange: InvestorSummaryGdvRange
  trueMao: InvestorSummaryTrueMaoBreakdown
  capitalProtectionState: CapitalProtectionStatus | null
  classification: DealClassification | null
  investorShield: InvestorSummaryShieldSummary
  activeTasks: readonly InvestorSummaryTaskSummary[]
  latestOffer: InvestorSummaryLatestOfferSummary | null
  recommendedNextAction: InvestorSummaryRecommendedNextAction
}
