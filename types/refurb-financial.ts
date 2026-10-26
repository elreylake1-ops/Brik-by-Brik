import type { FinancialSnapshot } from "@/types/refurb-integration"
import type { ComparableEvidenceClassification } from "@/lib/financial/verified-comparable-evidence"

// A versioned PROPOSAL of the financial effect of a confirmed refurbishment scope, and the auditable decision about it.
//
// Authority: the proprietary engine (analyzeDealWithRefurb) produces every figure. The Saved Deal remains the authoritative
// record; a proposal never edits it. Confirming a proposal records that a named operator approved this PROPOSED adjustment.
// It does not write anything back, override Investor Shield, change governance, or approve an investment.

export const FINANCIAL_PROPOSAL_VERSION = "financial-proposal-v1" as const

export type StoredEngineHeadline = {
  totalCost: number | null
  profit: number | null
  profitMargin: number | null
  verdictStatus: string | null
  trueMao: { fifteenPercent: number | null; twentyPercent: number | null; twentyFivePercent: number | null } | null
}

/** The Saved Deal exactly as stored. Read-only; never modified by anything in this feature. */
export type AuthoritativeFigures = {
  dealId: string
  storedUpdatedAt: string
  purchasePrice: number | null
  gdvRealistic: number | null
  refurbCost: number | null
  classification: string
  governanceState: string
  capitalProtectionState: string
  pipelineState: string
  /** Headline numbers read from the stored engine result, if it has them. */
  storedEngineResult: StoredEngineHeadline | null
}

export type FinancialProposalContent = {
  version: typeof FINANCIAL_PROPOSAL_VERSION
  /** Always true. This is a proposal; the Saved Deal figures are the authoritative ones. */
  nonAuthoritative: true
  plan: {
    planId: string
    planVersion: number
    confirmedBy: string
    confirmedAt: string
    analysisSource: string
    measurementSetId: string | null
    measurementSetVersion: number | null
    /** Everyone whose review decision supports an item in the confirmed scope. */
    sourceReviewers: string[]
    acceptedItems: { itemId: string; label: string; kind: string; checkIds: string[]; proposalIds: string[] }[]
  }
  authoritative: AuthoritativeFigures
  gdvEvidence: ComparableEvidenceClassification
  /** The engine re-run on the Saved Deal's stored figures plus the operator's assumptions (like-for-like baseline). */
  recalculatedBaseline: FinancialSnapshot | null
  proposed: FinancialSnapshot | null
  delta: { refurbCost: number; totalCost: number; profit: number; profitMargin: number } | null
  storedVersusRecalculated: { comparable: boolean; consistent: boolean | null; differences: string[] }
  changedAssumptions: string[]
  exclusions: { itemId: string; label: string; reason: string }[]
  unresolvedQuantities: string[]
  blockedBy: string[]
  completeness: "COMPLETE" | "HAS_EXCLUSIONS_OR_UNRESOLVED_QUANTITIES" | "NOT_COMPUTABLE"
  notes: string[]
}

export type FinancialProposalRecord = {
  id: string
  dealId: string
  assessmentId: string
  planId: string
  version: number // 1,2,3 ... per assessment
  contentHash: string // hash of everything above; identical recomputation gives the same hash
  idempotencyKey: string
  content: FinancialProposalContent
  createdBy: string
  createdAt: string
}

export const FINANCIAL_DECISIONS = ["CONFIRMED", "DECLINED"] as const
export type FinancialDecision = typeof FINANCIAL_DECISIONS[number]

export type FinancialDecisionEvent = {
  id: string
  dealId: string
  assessmentId: string
  proposalId: string
  decision: FinancialDecision
  actor: string
  note: string | null
  idempotencyKey: string
  requestHash: string
  acknowledged: { notWriteBack: boolean; exclusions: boolean; unresolvedQuantities: boolean }
  /** Fingerprint of the authoritative Saved Deal figures at the moment of the decision. */
  baselineFingerprint: string
  /** True when the deciding operator also confirmed the scope (recorded for audit; not blocked). */
  sameOperatorAsScopeConfirmer: boolean
  occurredAt: string
}

export type FinancialState = {
  proposals: FinancialProposalRecord[] // newest first
  latest: FinancialProposalRecord | null
  decision: FinancialDecisionEvent | null // decision on the latest proposal
  /** True when the latest proposal no longer matches current data (deal figures, plan, findings or measurements changed). */
  outdated: boolean
  outdatedReasons: string[]
  status: "NONE" | "PROPOSED" | "CONFIRMED" | "DECLINED" | "OUTDATED"
}
