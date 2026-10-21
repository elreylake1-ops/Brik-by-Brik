import type { DealInputs } from "@/types/deal"
import type { RefurbTimeline } from "@/types/refurb"
import type { RefurbScopeInput, KitchenSize } from "@/types/scope"
import type { ViewingCheckStatus } from "@/types/viewing-assessment"

// Contracts for: human-reviewed viewing findings -> proposed work items -> human-confirmed refurbishment scope ->
// estimate/schedule/financial impact computed by the EXISTING engine -> builder quotation-request pack and Deal Passport.
// Nothing here is a calculation: costs, durations and verdicts always come from lib/engine (analyzeDealWithRefurb).

export const REFURB_INTEGRATION_VERSION = "refurb-integration-v1" as const

/** The scope fields of the existing RefurbScopeInput that a reviewed finding can propose a change to. */
export const SCOPE_FIELDS = [
  "kitchen.scope",
  "bathroom.scope",
  "flooring.replaceWholeProperty",
  "majorWorks.roof",
  "majorWorks.rewire",
  "majorWorks.boiler",
] as const
export type ScopeField = typeof SCOPE_FIELDS[number]
export type ScopeLevel = string | boolean

export type WorkItemKind =
  | "ENGINE_SCOPE" // maps onto a field of the existing refurbishment scope; the existing engine prices it (or says it cannot)
  | "UNPRICED" // a real works finding the engine has no scope field for: listed for the builder, no figure invented
  | "SPECIALIST_INSPECTION" // a human said a specialist must look first; nothing is priced or scheduled

export type SourceEvidenceRef = {
  evidenceId: string
  assetId: string
  timestampSeconds: number
  room?: string
}

/** One reviewed AI suggestion that supports a work item, with its full human-decision trail. */
export type FindingSource = {
  proposalId: string
  checkId: string
  runId: string
  modelVersion: string
  aiProposedStatus: ViewingCheckStatus
  aiObservation: string
  aiConfidence: "low" | "medium" | "high"
  disposition: "ACCEPTED" | "EDITED"
  effectiveStatus: ViewingCheckStatus
  /** The observation as the human left it (their edit if they edited, otherwise the AI's text they accepted). */
  reviewedObservation: string
  reviewId: string
  reviewRevision: number
  reviewerId: string
  reviewedAt: string
  reviewReason: string | null
  evidence: SourceEvidenceRef[]
}

export type ProposedWorkItem = {
  itemId: string // deterministic: mapping id (+ ":inspect" for specialist items)
  mappingId: string
  kind: WorkItemKind
  label: string
  area: string
  scopeEffect: { field: ScopeField; level: ScopeLevel } | null
  /** Levels a human may choose when confirming (ENGINE_SCOPE only). */
  allowedLevels: ScopeLevel[]
  quantityNote: string // what is unknown about quantity / extent
  provisional: true // every item from a video review is provisional until a builder verifies it
  needsBuilderVerification: true
  sources: FindingSource[]
}

export type ExclusionReason =
  | "UNREVIEWED" // nobody has decided on it
  | "REJECTED" // a human rejected it
  | "OBSERVED_ONLY" // reviewed as "seen", not a problem: no work
  | "NOT_A_CONCERN" // reviewed to a state that is not a works finding (not accessible / not applicable / not assessed)
  | "NOT_A_WORKS_CHECK" // a concern on a check that is about the sale, legal position or finance, not physical works
  | "NO_EVIDENCE" // a claim with no frame behind it cannot become work
  | "NOT_EFFECTIVE_STATE" // reviewed, but the check's effective (most cautious) state is a different one

export type ExcludedFinding = {
  proposalId: string
  checkId: string
  reason: ExclusionReason
}

export type WorkProposal = {
  version: typeof REFURB_INTEGRATION_VERSION
  assessmentId: string
  /** "SIMULATED" analysis is fixture output: everything derived from it is demonstration data. */
  analysisSource: "NONE" | "SIMULATED" | "LIVE" | "MIXED"
  fingerprint: string // changes whenever any proposal, review revision or evidence link changes
  items: ProposedWorkItem[]
  excluded: ExcludedFinding[]
  openInspectionGaps: { checkId: string; state: "NOT_ACCESSIBLE" | "NOT_ASSESSED"; awaitingReview: boolean }[]
}

// ---- Human confirmation

export type PropertyBasics = {
  bedrooms: number
  bathrooms: number
  floorAreaSqm?: number
  /** Optional: only needed when a kitchen replacement is in scope. Never defaulted into a cost. */
  kitchenSize?: KitchenSize
}

/** Operator-supplied deal assumptions the existing engine needs. They are recorded, never defaulted. */
export type FinancialAssumptions = Pick<DealInputs, "stampDuty" | "legalCosts" | "saleCosts" | "bridgeTermMonths">

export type AcceptedItemSelection = { itemId: string; level?: ScopeLevel }

export type ConfirmedWorkItem = {
  itemId: string
  mappingId: string
  kind: WorkItemKind
  label: string
  area: string
  scopeEffect: { field: ScopeField; level: ScopeLevel } | null
  levelChosenByHuman: boolean
  quantityNote: string
  sources: FindingSource[]
}

export type CostLine = {
  itemId: string | null // null only for an engine task not attributable to a work item (must never happen; checked)
  taskId: string
  taskName: string
  room: string
  trade: string
  quantity: number
  labourDays: number
  labourCost: number
  materialCost: number
  totalCost: number
  priced: boolean // false for the engine's "no templates yet" stubs: the engine includes no cost for them
  warnings: string[]
}

export type PlanEstimate = {
  status: "COMPUTED" | "BLOCKED"
  blockedBy: string[] // e.g. PROPERTY_BASICS_MISSING
  totalRefurbCost: number | null
  labourCost: number | null
  materialCost: number | null
  lines: CostLine[]
  /** Items that have no price in this estimate, and why. */
  unpricedItems: { itemId: string; label: string; reason: string }[]
  provisionalAllowances: string[]
  confidenceFlags: string[]
}

export type PlanSchedule = {
  status: "COMPUTED" | "BLOCKED"
  timeline: RefurbTimeline | null
  /** Items with no duration in this schedule. */
  unscheduledItems: { itemId: string; label: string }[]
  assumptions: string[]
}

export type FinancialSnapshot = {
  refurbCost: number
  totalCost: number
  profit: number
  profitMargin: number
  trueMao: { fifteenPercent: number; twentyPercent: number; twentyFivePercent: number }
  verdictStatus: string
  verdictReason: string
  confidenceBand: string
}

export type FinancialImpact = {
  status: "COMPUTED" | "BLOCKED"
  blockedBy: string[] // PROPERTY_BASICS_MISSING, FINANCIAL_ASSUMPTIONS_MISSING, DEAL_PRICE_OR_GDV_MISSING
  /** What the Saved Deal says today, re-run through the same engine from its stored figures. */
  baseline: FinancialSnapshot | null
  /** The same deal with the confirmed scope driving refurbishment cost. */
  scenario: FinancialSnapshot | null
  delta: { refurbCost: number; totalCost: number; profit: number; profitMargin: number } | null
  inputs: { purchasePrice: number; gdv: number; baselineRefurbCost: number } & Partial<FinancialAssumptions>
  /** Always true: a preview or a confirmed plan never edits the Saved Deal, Investor Shield or pipeline state. */
  savedDealUnchanged: true
  note: string
}

export type PlanComputation = {
  scopeInput: RefurbScopeInput | null
  estimate: PlanEstimate
  schedule: PlanSchedule
  financialImpact: FinancialImpact
  assumptions: string[]
  warnings: string[]
  /** Reproducibility: the engine inputs actually used. */
  engineInputs: { dealInputs: DealInputs | null; scope: RefurbScopeInput | null }
}

export type ConfirmedPlanRecord = {
  id: string
  dealId: string
  assessmentId: string
  version: number // 1,2,3 ...: a later confirmation supersedes, never edits, an earlier one
  idempotencyKey: string
  sourceFingerprint: string
  analysisSource: WorkProposal["analysisSource"]
  acceptedItems: ConfirmedWorkItem[]
  excluded: ExcludedFinding[]
  propertyBasics: PropertyBasics
  /** The measurement set version the basics came from; null for a plan confirmed with typed-in basics (Task 6A path). */
  measurementSetId: string | null
  measurementSetVersion: number | null
  financialAssumptions: FinancialAssumptions | null
  computation: PlanComputation // snapshot at confirmation time
  confirmedBy: string
  confirmedAt: string
}

export type PlanStaleReason = "FINDINGS_CHANGED" | "MEASUREMENTS_CHANGED"

export type CurrentPlanView = {
  record: ConfirmedPlanRecord
  /** True when findings were reviewed again, or measurements recorded, since this plan was confirmed. */
  stale: boolean
  staleReasons: PlanStaleReason[]
}
