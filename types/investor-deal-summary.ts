export type InvestorDealSummarySemanticTone =
  | "neutral"
  | "informational"
  | "caution"
  | "blocked"
  | "success"

export type InvestorDealSummaryField = {
  readonly label: string
  readonly value: string
  readonly tone?: InvestorDealSummarySemanticTone
  readonly supportingText?: string | null
}

export type InvestorDealSummaryHeader = {
  readonly title: string
  readonly confidentialityLabel: string
  readonly generatedAt: string
  readonly dealId: string
  readonly propertyIdentity: string
  readonly purposeText: string
  readonly nonRelianceNotice: string
}

export type InvestorDealSummaryFooter = {
  readonly confidentialityLabel: string
  readonly generatedAt: string
  readonly dealId: string
  readonly nonRelianceNotice: string
  readonly currentStateNotice: string
  readonly notices: readonly string[]
}

export type InvestorDealSummaryGateRow = {
  readonly gateKey: string
  readonly label: string
  readonly status: string
  readonly statusTone: InvestorDealSummarySemanticTone
  readonly blockerState: string
  readonly blockerTone: InvestorDealSummarySemanticTone
  readonly missingEvidenceState: string
  readonly missingEvidenceTone: InvestorDealSummarySemanticTone
  readonly evidenceReferenceCount: string
  readonly latestReferenceUpdate: string
  readonly helperText: string
}

export type InvestorDealSummaryAdvisoryItem = {
  readonly id: string
  readonly label: string
  readonly message: string
  readonly tone: InvestorDealSummarySemanticTone
  readonly sourceLabel: string
}

export type InvestorDealSummaryUnsupportedValue = {
  readonly label: string
  readonly value: string
  readonly reason: string
}

export type InvestorDealSummaryOfferPosition = {
  readonly latestRecordedOfferAmount: InvestorDealSummaryField
  readonly latestRecordedOfferStatus: InvestorDealSummaryField
  readonly unsupportedOfferValues: readonly InvestorDealSummaryField[]
  readonly noOfferMessage: string
  readonly offerLadderNotice: string
}

export type InvestorDealSummaryEvidenceLiteRow = {
  readonly evidenceId: string
  readonly evidenceType: string
  readonly linkedGate: string
  readonly status: string
  readonly statusTone: InvestorDealSummarySemanticTone
  readonly reviewedState: string
  readonly reviewedTone: InvestorDealSummarySemanticTone
  readonly note: string
  readonly reviewerNote: string | null
  readonly relevantTimestamp: string | null
}

export type InvestorDealSummaryViewModel = {
  readonly header: InvestorDealSummaryHeader
  readonly executiveDecisionSnapshot: readonly InvestorDealSummaryField[]
  readonly coreFinancialPosition: readonly InvestorDealSummaryField[]
  readonly trueMao: {
    readonly bands: readonly InvestorDealSummaryField[]
    readonly note: string
  }
  readonly offerPosition: InvestorDealSummaryOfferPosition
  readonly unsupportedValues: readonly InvestorDealSummaryUnsupportedValue[]
  readonly investorShield: {
    readonly summaryFields: readonly InvestorDealSummaryField[]
    readonly authorityNotice: string
    readonly requiredHardGates: readonly InvestorDealSummaryGateRow[]
    readonly advisoryGates: readonly InvestorDealSummaryAdvisoryItem[]
  }
  readonly professionalReadiness: {
    readonly displayLabel: string
    readonly supportingSummary: string
    readonly authorityNotice: string
    readonly tone: InvestorDealSummarySemanticTone
  }
  readonly evidenceLite: {
    readonly notice: string
    readonly emptyText: string
    readonly rows: readonly InvestorDealSummaryEvidenceLiteRow[]
  }
  readonly risks: {
    readonly warnings: readonly string[]
    readonly blockers: readonly string[]
    readonly missingEvidence: readonly string[]
    readonly unavailableFields: readonly string[]
  }
  readonly recommendedNextAction: InvestorDealSummaryField
  readonly footer: InvestorDealSummaryFooter
}
