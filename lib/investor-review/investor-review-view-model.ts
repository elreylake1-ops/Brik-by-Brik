export const INVESTOR_REVIEW_NOT_AVAILABLE_LABEL = "Not available" as const
export const INVESTOR_REVIEW_EMPTY_EVIDENCE_LITE_LABEL =
  "No Evidence Lite records are currently attached to this deal." as const
export const INVESTOR_REVIEW_EMPTY_TASKS_LABEL =
  "No active tasks are currently recorded for this deal." as const
export const INVESTOR_REVIEW_EMPTY_OFFERS_LABEL =
  "No offers are currently recorded for this deal." as const
export const INVESTOR_REVIEW_EMPTY_ADVISORY_LABEL =
  "No advisory or caution items are currently recorded." as const
export const INVESTOR_REVIEW_EVIDENCE_LITE_NOTICE =
  "Evidence Lite is informational and does not by itself satisfy, waive, approve, or override Investor Shield requirements." as const

export type InvestorReviewSemanticTone =
  | "neutral"
  | "informational"
  | "caution"
  | "blocked"
  | "success"

export type InvestorReviewField = {
  label: string
  value: string
  tone?: InvestorReviewSemanticTone
}

export type InvestorReviewHeader = {
  title: string
  confidentialityLabel: string
  generatedAt: string
  dealId: string
  reviewPurpose: string
  notices: readonly string[]
}

export type InvestorReviewOverview = {
  propertyIdentity: InvestorReviewField
  classification: InvestorReviewField
  governance: InvestorReviewField
  capitalProtection: InvestorReviewField
  pipeline: InvestorReviewField
}

export type InvestorReviewInvestmentSummary = {
  purchasePrice: InvestorReviewField
  gdvDownside: InvestorReviewField
  gdvRealistic: InvestorReviewField
  gdvStrong: InvestorReviewField
  trueMao15: InvestorReviewField
  trueMao20: InvestorReviewField
  trueMao25: InvestorReviewField
  latestOfferAmount: InvestorReviewField
}

export type InvestorReviewDecisionSummary = {
  overallStatus: InvestorReviewField
  progressionDecision: InvestorReviewField
  canProgress: InvestorReviewField
  missingEvidenceCount: InvestorReviewField
  blockedGateCount: InvestorReviewField
  explanation: string
}

export type InvestorReviewGateRow = {
  gateKey: string
  label: string
  status: string
  statusTone: InvestorReviewSemanticTone
  blockerState: string
  blockerTone: InvestorReviewSemanticTone
  missingEvidenceState: string
  missingEvidenceTone: InvestorReviewSemanticTone
  evidenceReferenceCount: string
  latestReferenceUpdate: string
  helperText: string
}

export type InvestorReviewAdvisoryItem = {
  id: string
  label: string
  message: string
  tone: InvestorReviewSemanticTone
  sourceLabel: string
}

export type InvestorReviewEvidenceLiteRow = {
  evidenceId: string
  title: string
  evidenceType: string
  linkedGate: string
  status: string
  statusTone: InvestorReviewSemanticTone
  reviewedLabel: string
  reviewedTone: InvestorReviewSemanticTone
  note: string | null
  reviewerNote: string | null
  referenceLabel: string | null
  relevantTimestamp: string
}

export type InvestorReviewBlockerRow = {
  gateKey: string
  label: string
  blockerReason: string
}

export type InvestorReviewTaskRow = {
  taskId: string
  title: string
  taskType: string
  status: string
  priority: string
  dueDate: string
  blockerReason: string
}

export type InvestorReviewOfferSummary = {
  amount: string
  offerType: string
  offerStatus: string
  rationale: string
  sellerResponse: string
  createdAt: string
} | null

export type InvestorReviewFooter = {
  confidentialityLabel: string
  generatedAt: string
  dealId: string
  notices: readonly string[]
  disclaimers: readonly {
    code: string
    title: string
    body: string
    required: boolean
  }[]
}

export type InvestorReviewViewModel = {
  header: InvestorReviewHeader
  overview: InvestorReviewOverview
  investmentSummary: InvestorReviewInvestmentSummary
  decisionSummary: InvestorReviewDecisionSummary
  requiredGateRows: readonly InvestorReviewGateRow[]
  advisoryItems: readonly InvestorReviewAdvisoryItem[]
  evidenceLiteNotice: string
  evidenceLiteRows: readonly InvestorReviewEvidenceLiteRow[]
  emptyEvidenceLiteText: string
  blockerRows: readonly InvestorReviewBlockerRow[]
  followUpRequirements: readonly string[]
  tasks: readonly InvestorReviewTaskRow[]
  emptyTasksText: string
  latestOffer: InvestorReviewOfferSummary
  emptyOffersText: string
  recommendedNextAction: string
  footer: InvestorReviewFooter
}
