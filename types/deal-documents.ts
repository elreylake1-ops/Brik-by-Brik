import type { PdfEvidencePackDisclaimer, PdfEvidencePackEvidenceItem, PdfEvidencePackMeta } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"
import type { InvestorSummaryViewModel } from "@/types/investor-summary"
import type { AuthoritativeFigures, FinancialDecisionEvent, FinancialProposalRecord, FinancialState } from "@/types/refurb-financial"
import type { ConfirmedWorkItem, FinancialImpact, PlanComputation, WorkProposal } from "@/types/refurb-integration"
import type { MeasurementChange, MeasurementEntry, MeasurementSetRecord } from "@/types/refurb-measurements"

// Draft outputs. They are reviewable documents, never approvals: every one carries status DRAFT and approval NOT_APPROVED,
// and nothing in them changes a Saved Deal, Investor Shield, governance state or pipeline state.

export type DraftMarker = {
  status: "DRAFT"
  approval: "NOT_APPROVED"
  /** Present whenever any finding behind the document came from simulated (fixture) analysis. */
  simulatedDataWarning: string | null
}

// ---------------------------------------------------------------- builder quotation-request pack
// Safe to send to a builder once the operator has reviewed it. It deliberately contains NO: engine rates or labour days,
// internal refurbishment estimates, investor profit/return/MAO figures, verdicts, thresholds, Saved Deal prices, Investor
// Shield or governance information, or reviewer/operator identities. Builders price on their own sheet (below).

export type BuilderPackItem = {
  itemId: string
  label: string
  area: string
  kind: ConfirmedWorkItem["kind"]
  scopeRequested: string
  quantityBasis: string
  priceRequested: boolean
  specialistInspectionRequired: boolean
  needsBuilderVerification: true
  /** What was seen, by frame and time. Observations are the reviewing human's wording. */
  evidence: { evidenceId: string; timestampSeconds: number; room?: string; observation: string }[]
}

export type BuilderPackMeasurement = {
  label: string
  room?: string
  value: number | string | null
  unit: MeasurementEntry["unit"]
  /** How the value is known. UNKNOWN means the builder must establish it. */
  basis: MeasurementEntry["basis"]
  source: MeasurementEntry["source"]
  confidence: MeasurementEntry["confidence"]
  note: string
}

export type BuilderPricingLine = {
  itemId: string
  label: string
  /** Blank for the builder to complete. */
  priceExcludingVat: null
  includes: null
  excludes: null
  durationWorkingDays: null
  notes: null
}

export type BuilderQuotePack = DraftMarker & {
  kind: "BUILDER_QUOTATION_REQUEST_PACK"
  version: "builder-pack-v2"
  generatedAt: string
  dealRef: { dealId: string; address: string }
  assessmentId: string
  plan: { planId: string; version: number; confirmedAt: string; stale: boolean }
  measurements: { setVersion: number | null; recordedAt: string | null; entries: BuilderPackMeasurement[]; statement: string }
  items: BuilderPackItem[]
  assumptions: string[]
  exclusions: string[]
  builderVerificationRequired: string[]
  requestedFromBuilder: string[]
  pricingSheet: {
    instructions: string
    lines: BuilderPricingLine[]
    totalExcludingVat: null
    vatTreatment: null
    earliestStart: null
    quoteValidForDays: null
    builderName: null
    builderContact: null
  }
  confidentiality: { internalEstimateIncluded: false; engineRatesIncluded: false; investorFiguresIncluded: false; governanceInformationIncluded: false }
  disclaimers: string[]
}

// ---------------------------------------------------------------- Deal Passport

export type OutstandingDecision = { code: string; message: string }

/** Three separate layers, never blended: the authoritative Saved Deal, the confirmed scope, and the financial PROPOSAL. */
export type PassportFinancial = {
  /** AUTHORITATIVE: the Saved Deal exactly as stored. */
  authoritative: AuthoritativeFigures
  /** What the engine said when the scope was confirmed (a snapshot; may be older than the proposal). */
  confirmedScopeSnapshot: FinancialImpact | null
  /** The PROPOSAL track: latest proposal, whether a named operator approved it, and the history. */
  proposal: {
    status: FinancialState["status"]
    outdated: boolean
    outdatedReasons: string[]
    latest: FinancialProposalRecord | null
    decision: FinancialDecisionEvent | null
    history: { version: number; proposalId: string; planId: string; createdAt: string; createdBy: string; contentHash: string; decision: FinancialDecisionEvent["decision"] | null; decidedBy: string | null; decidedAt: string | null }[]
  }
  statement: string
}

export type DealPassport = DraftMarker & {
  kind: "DEAL_PASSPORT"
  version: "deal-passport-v2"
  generatedAt: string
  deal: {
    dealId: string
    address: string
    listingUrl: string | null
    /** As stored on the Saved Deal today. Read-only: this document cannot change any of it. */
    stored: { classification: string; governanceState: string; capitalProtectionState: string; pipelineState: string; purchasePrice: number | null; gdvRealistic: number | null; refurbCost: number | null; updatedAt: string }
    investorSummary: InvestorSummaryViewModel
  }
  inspection: {
    assessmentId: string | null
    analysisSource: WorkProposal["analysisSource"] | null
    checksTotal: number
    checksHumanReviewed: number
    checksNotAssessed: number
    findingsAwaitingReview: number
    specialistInspectionsRequired: number
    openGaps: WorkProposal["openInspectionGaps"]
    evidenceFrameCount: number
  } | null
  measurements: {
    current: MeasurementSetRecord | null
    history: { version: number; recordedBy: string; recordedAt: string; changeNote: string | null; changes: MeasurementChange[] }[]
    engineQuantityNotes: string[]
    unresolved: string[]
  }
  evidence: readonly PdfEvidencePackEvidenceItem[]
  /** The CONFIRMED SCOPE layer. */
  refurbishment: {
    status: "NO_PLAN" | "CONFIRMED" | "CONFIRMED_STALE"
    staleReasons: string[]
    planId: string | null
    planVersion: number | null
    confirmedAt: string | null
    confirmedBy: string | null
    acceptedItems: ConfirmedWorkItem[]
    computation: PlanComputation | null
  }
  financial: PassportFinancial
  investorShield: InvestorShieldEnforcementResult
  outstandingDecisions: OutstandingDecision[]
  provenance: {
    packMeta: PdfEvidencePackMeta
    integrationVersion: string
    planHistory: { planId: string; version: number; confirmedAt: string; confirmedBy: string; measurementSetVersion: number | null }[]
    sourceTrail: { itemId: string; checkId: string; proposalId: string; reviewId: string; reviewRevision: number; disposition: string; reviewerId: string; reviewedAt: string; evidenceIds: string[] }[]
  }
  disclaimers: readonly PdfEvidencePackDisclaimer[]
  passportNotes: string[]
}
