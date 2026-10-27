import { canonicalJson, sha256 } from "./financial-proposal"
import type { ContractorQuoteOverrideRecord, QuoteType, VatBasis } from "./quote-overrides-repository"
import type { CostLine, ConfirmedPlanRecord } from "@/types/refurb-integration"

export const REFURBISHMENT_COVERAGE_STATES = ["COVERED", "PARTIAL", "UNPRICED", "CONFLICTING", "STALE"] as const
export type RefurbishmentCoverageState = typeof REFURBISHMENT_COVERAGE_STATES[number]
export type RefurbishmentPriceSource = "DEFAULT_ENGINE_RATE" | QuoteType
export type EvidenceReviewState = "RECEIVED" | "REVIEWED" | "VERIFIED" | "REJECTED" | "EXPIRED"

export type PricingEvidenceFact = { id: string; dealId: string; evidenceType: string; reviewState: EvidenceReviewState }
export type TaskPriceEvidenceMapping = {
  taskId: string; taskName: string; included: boolean; amount: number; priceSource: RefurbishmentPriceSource
  overrideId?: string; evidenceId?: string; evidenceType?: string; evidenceReviewState?: EvidenceReviewState; scopeVerified?: boolean; vatBasis?: VatBasis
}
export type RefurbishmentCoverageInput = {
  dealId: string
  plan: Pick<ConfirmedPlanRecord, "id" | "assessmentId" | "version" | "measurementSetId" | "measurementSetVersion">
  planCurrent: boolean
  measurementsCurrent: boolean
  costLines: readonly CostLine[]
  activeOverrides: readonly ContractorQuoteOverrideRecord[]
  evidence: readonly PricingEvidenceFact[]
  mappings: readonly TaskPriceEvidenceMapping[]
  computedRefurbTotal: number
}
export type RefurbishmentTaskCoverage = TaskPriceEvidenceMapping & { coverageState: RefurbishmentCoverageState; reasons: readonly string[] }
export type RefurbishmentCoverageResult = { state: RefurbishmentCoverageState; tasks: readonly RefurbishmentTaskCoverage[]; reasons: readonly string[]; fingerprint: string; computedRefurbTotal: number; basis: { dealId: string; assessmentId: string; planId: string; planVersion: number; measurementSetId: string | null; measurementVersion: number | null } }

const qualifyingEvidence = new Set(["BUILDER_QUOTE", "BUILDER_PROPOSAL", "BUILDER_CONTRACT"])
const reviewedEvidence = new Set<EvidenceReviewState>(["REVIEWED", "VERIFIED"])
const stateRank: Record<RefurbishmentCoverageState, number> = { COVERED: 0, PARTIAL: 1, UNPRICED: 2, CONFLICTING: 3, STALE: 4 }
const maxState = (states: readonly RefurbishmentCoverageState[]) => states.reduce((highest, state) => stateRank[state] > stateRank[highest] ? state : highest, "COVERED" as RefurbishmentCoverageState)
const moneyEqual = (a: number, b: number) => Math.abs(a - b) < 0.000001

export function fingerprintRefurbishmentCoverage(input: Pick<RefurbishmentCoverageResult, "state" | "tasks" | "computedRefurbTotal"> & { planId?: string; planVersion?: number; measurementSetId?: string | null; measurementSetVersion?: number | null }): string {
  return sha256(canonicalJson({
    planId: input.planId ?? null, planVersion: input.planVersion ?? null, measurementSetId: input.measurementSetId ?? null, measurementSetVersion: input.measurementSetVersion ?? null,
    state: input.state, computedRefurbTotal: input.computedRefurbTotal,
    tasks: [...input.tasks].map(({ taskId, included, amount, priceSource, overrideId, evidenceId, evidenceReviewState, scopeVerified, vatBasis }) => ({ taskId, included, amount, priceSource, overrideId: overrideId ?? null, evidenceId: evidenceId ?? null, evidenceReviewState: evidenceReviewState ?? null, scopeVerified: Boolean(scopeVerified), vatBasis: vatBasis ?? null })).sort((a, b) => a.taskId.localeCompare(b.taskId)),
  }))
}

export function assessRefurbishmentCoverage(input: RefurbishmentCoverageInput): RefurbishmentCoverageResult {
  const stale = !input.planCurrent || !input.measurementsCurrent
  const lines = new Map(input.costLines.map((line) => [line.taskId, line]))
  const mappingsByTask = new Map<string, TaskPriceEvidenceMapping[]>()
  for (const mapping of input.mappings) mappingsByTask.set(mapping.taskId, [...(mappingsByTask.get(mapping.taskId) ?? []), mapping])
  const activeByTask = new Map<string, ContractorQuoteOverrideRecord[]>()
  for (const override of input.activeOverrides.filter((o) => o.status === "APPROVED")) activeByTask.set(override.taskId, [...(activeByTask.get(override.taskId) ?? []), override])
  const evidenceById = new Map(input.evidence.map((evidence) => [evidence.id, evidence]))
  const tasks: RefurbishmentTaskCoverage[] = []

  for (const line of input.costLines) {
    const mappings = mappingsByTask.get(line.taskId) ?? []
    const mapping = mappings[0] ?? { taskId: line.taskId, taskName: line.taskName, included: true, amount: line.totalCost, priceSource: "DEFAULT_ENGINE_RATE" as const }
    const reasons: string[] = []
    let state: RefurbishmentCoverageState = "COVERED"
    if (stale) { state = "STALE"; reasons.push(!input.planCurrent ? "PLAN_NOT_CURRENT" : "MEASUREMENTS_NOT_CURRENT") }
    if (!mapping.included && !moneyEqual(mapping.amount, 0)) { state = "CONFLICTING"; reasons.push("EXCLUDED_TASK_HAS_COST") }
    if (!mapping.included) { tasks.push({ ...mapping, coverageState: state, reasons }); continue }
    if (!line.priced || !Number.isFinite(line.totalCost) || line.totalCost <= 0) { state = "UNPRICED"; reasons.push("TASK_UNPRICED") }
    if (mappings.length > 1 || (mappings.length === 0 && line.priced && line.totalCost > 0)) { state = "CONFLICTING"; reasons.push(mappings.length ? "DUPLICATE_TASK_MAPPING" : "TASK_MAPPING_MISSING") }
    if (!moneyEqual(mapping.amount, line.totalCost)) { state = "CONFLICTING"; reasons.push("TASK_AMOUNT_DOES_NOT_MATCH_COMPUTED_COST") }
    const active = activeByTask.get(line.taskId) ?? []
    if (active.length > 1) { state = "CONFLICTING"; reasons.push("DUPLICATE_ACTIVE_TASK_PRICE") }
    if (mapping.priceSource === "DEFAULT_ENGINE_RATE") { state = maxState([state, "PARTIAL"]); reasons.push("DEFAULT_ENGINE_RATE_POLICY_REQUIRED") }
    if (mapping.priceSource === "OPERATOR_PROVISIONAL_ESTIMATE") { state = maxState([state, "PARTIAL"]); reasons.push("PROVISIONAL_PRICE_NOT_EVIDENCED") }
    if (mapping.priceSource === "VERIFIED_CONTRACTOR_QUOTE") {
      const override = active[0]
      if (!override || override.dealId !== input.dealId || override.id !== mapping.overrideId || override.quoteEvidenceId !== mapping.evidenceId || !override.scopeVerified || !moneyEqual(override.approvedAmount, mapping.amount) || override.quoteType !== "VERIFIED_CONTRACTOR_QUOTE") { state = "CONFLICTING"; reasons.push("OVERRIDE_DOES_NOT_MATCH_TASK_MAPPING") }
      const evidence = mapping.evidenceId ? evidenceById.get(mapping.evidenceId) : undefined
      if (!mapping.evidenceId || !mapping.scopeVerified || !evidence || evidence.dealId !== input.dealId || !qualifyingEvidence.has(evidence.evidenceType) || !reviewedEvidence.has(evidence.reviewState) || evidence.evidenceType !== mapping.evidenceType || evidence.reviewState !== mapping.evidenceReviewState) {
        state = maxState([state, "PARTIAL"]); reasons.push("QUALIFYING_REVIEWED_TASK_EVIDENCE_REQUIRED")
      }
    }
    tasks.push({ ...mapping, coverageState: state, reasons })
  }

  for (const mapping of input.mappings.filter((mapping) => !lines.has(mapping.taskId))) {
    tasks.push({ ...mapping, coverageState: !mapping.included && moneyEqual(mapping.amount, 0) ? "COVERED" : "CONFLICTING", reasons: !mapping.included && moneyEqual(mapping.amount, 0) ? [] : ["MAPPING_TASK_NOT_IN_COMPUTED_PLAN"] })
  }
  for (const override of input.activeOverrides.filter((override) => override.status === "APPROVED" && !lines.has(override.taskId))) {
    tasks.push({ taskId: override.taskId, taskName: override.taskId, included: true, amount: override.approvedAmount, priceSource: override.quoteType, overrideId: override.id, evidenceId: override.quoteEvidenceId ?? undefined, scopeVerified: override.scopeVerified, vatBasis: override.vatBasis, coverageState: "CONFLICTING", reasons: ["OVERRIDE_TASK_NOT_IN_COMPUTED_PLAN"] })
  }
  const includedTotal = input.costLines.reduce((total, line) => total + (line.priced ? line.totalCost : 0), 0)
  const reasons = [...new Set(tasks.flatMap((task) => task.reasons))]
  if (!moneyEqual(includedTotal, input.computedRefurbTotal)) reasons.push("COMPUTED_REFURB_TOTAL_DOES_NOT_RECONCILE")
  const state = stale ? "STALE" : maxState([...tasks.map((task) => task.coverageState), ...(reasons.includes("COMPUTED_REFURB_TOTAL_DOES_NOT_RECONCILE") ? ["CONFLICTING" as const] : [])])
  const result = { state, tasks, reasons, computedRefurbTotal: input.computedRefurbTotal }
  const basis = { dealId: input.dealId, assessmentId: input.plan.assessmentId, planId: input.plan.id, planVersion: input.plan.version, measurementSetId: input.plan.measurementSetId, measurementVersion: input.plan.measurementSetVersion }
  return { ...result, basis, fingerprint: fingerprintRefurbishmentCoverage({ ...result, planId: basis.planId, planVersion: basis.planVersion, measurementSetId: basis.measurementSetId, measurementSetVersion: basis.measurementVersion }) }
}

export const REFURBISHMENT_SNAPSHOT_STATUSES = ["DRAFT", "FULLY_PRICED", "APPROVED", "SUPERSEDED"] as const
export type RefurbishmentSnapshotStatus = typeof REFURBISHMENT_SNAPSHOT_STATUSES[number]
export type RefurbishmentApprovalSnapshot = Readonly<{ approvalId: string; dealId: string; assessmentId: string; planId: string; planVersion: number; measurementSetId: string | null; measurementVersion: number | null; coverageFingerprint: string; tasks: readonly RefurbishmentTaskCoverage[]; computedRefurbTotal: number; coverageState: RefurbishmentCoverageState; approvedBy: string; approvedAt: string; decisionNote?: string; status: RefurbishmentSnapshotStatus }>
export type SnapshotCreateInput = { approvalId: string; coverage: RefurbishmentCoverageResult; approvedBy: string; approvedAt: string; decisionNote?: string }

export function createRefurbishmentSnapshot(input: SnapshotCreateInput): RefurbishmentApprovalSnapshot {
  const { basis } = input.coverage
  return { approvalId: input.approvalId, dealId: basis.dealId, assessmentId: basis.assessmentId, planId: basis.planId, planVersion: basis.planVersion, measurementSetId: basis.measurementSetId, measurementVersion: basis.measurementVersion, coverageFingerprint: input.coverage.fingerprint, tasks: input.coverage.tasks, computedRefurbTotal: input.coverage.computedRefurbTotal, coverageState: input.coverage.state, approvedBy: input.approvedBy, approvedAt: input.approvedAt, ...(input.decisionNote ? { decisionNote: input.decisionNote } : {}), status: input.coverage.state === "COVERED" ? "FULLY_PRICED" : "DRAFT" }
}

export function approveRefurbishmentSnapshot(snapshot: RefurbishmentApprovalSnapshot, coverage: RefurbishmentCoverageResult, approvedBy: string, approvedAt: string): { eligible: true; snapshot: RefurbishmentApprovalSnapshot } | { eligible: false; reasons: readonly string[] } {
  const reasons = [
    ...(coverage.state === "COVERED" ? [] : ["COVERAGE_NOT_COVERED"]),
    ...(snapshot.coverageFingerprint === coverage.fingerprint ? [] : ["COVERAGE_FINGERPRINT_CHANGED"]),
    ...(snapshot.dealId && snapshot.assessmentId && snapshot.planId && snapshot.planVersion > 0 ? [] : ["SNAPSHOT_BASIS_REQUIRED"]),
    ...(snapshot.computedRefurbTotal > 0 ? [] : ["COMPUTED_TOTAL_INVALID"]),
    ...(approvedBy.trim() ? [] : ["APPROVER_REQUIRED"]),
    ...(approvedAt.trim() ? [] : ["APPROVAL_TIMESTAMP_REQUIRED"]),
  ]
  return reasons.length ? { eligible: false, reasons } : { eligible: true, snapshot: { ...snapshot, approvedBy, approvedAt, status: "APPROVED" } }
}

export function invalidateRefurbishmentSnapshot(snapshot: RefurbishmentApprovalSnapshot, current: RefurbishmentCoverageResult): { state: "CURRENT" | "SUPERSEDED"; reasons: readonly string[] } {
  const reasons = [
    ...(snapshot.status === "APPROVED" ? [] : ["SNAPSHOT_NOT_APPROVED"]),
    ...(snapshot.coverageFingerprint === current.fingerprint ? [] : ["BASIS_FINGERPRINT_CHANGED"]),
    ...(current.state === "COVERED" ? [] : ["CURRENT_COVERAGE_NOT_COVERED"]),
  ]
  return reasons.length ? { state: "SUPERSEDED", reasons } : { state: "CURRENT", reasons: [] }
}

export function futureApplicationEligibility(snapshot: RefurbishmentApprovalSnapshot, current: RefurbishmentCoverageResult, application?: { snapshotId: string; coverageFingerprint: string }): { state: "NOT_APPLIED" | "ALREADY_APPLIED_IDENTICALLY" | "CONFLICTING_APPLICATION"; eligible: boolean } {
  const valid = invalidateRefurbishmentSnapshot(snapshot, current).state === "CURRENT"
  if (!application) return { state: "NOT_APPLIED", eligible: valid }
  return application.snapshotId === snapshot.approvalId && application.coverageFingerprint === snapshot.coverageFingerprint
    ? { state: "ALREADY_APPLIED_IDENTICALLY", eligible: valid }
    : { state: "CONFLICTING_APPLICATION", eligible: false }
}
