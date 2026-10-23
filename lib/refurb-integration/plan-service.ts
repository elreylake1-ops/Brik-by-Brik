import { createHash } from "node:crypto"
import { VIEWING_CHECKLIST_V1 } from "@/lib/viewing-assessment/checklist-v1"
import { loadAssessmentDetail } from "@/lib/viewing-assessment/viewing-assessment-service"
import type { ViewingAssessmentRepository } from "@/lib/viewing-assessment/viewing-assessment-repository"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { MeasurementSetRecord } from "@/types/refurb-measurements"
import type { ViewingAssessmentDetail } from "@/types/viewing-assessment"
import type {
  AcceptedItemSelection,
  ConfirmedPlanRecord,
  ConfirmedWorkItem,
  CurrentPlanView,
  PlanComputation,
  PlanStaleReason,
  ProposedWorkItem,
  PropertyBasics,
  WorkProposal,
} from "@/types/refurb-integration"
import { buildWorkProposal } from "./findings-to-work"
import { computePlan, type DealFigures } from "./plan-compute"
import { toCostOverrides, type QuoteOverridesRepository } from "./quote-overrides-repository"
import type { ConfirmRequest, PreviewRequest } from "./plan-request-validation"
import { basicsFromMeasurements } from "./measurements"
import type { FinancialProposalRepository } from "./financial-proposal-repository"
import type { MeasurementRepository } from "./measurement-repository"
import type { RefurbPlanRepository } from "./plan-repository"

// Orchestration. Everything the server decides is decided here from stored data; a request contributes only the human's
// choices (which proposed items to accept, optional level, property basics, deal assumptions).
//
// Deliberately absent from the dependencies: any way to update a Saved Deal, Investor Shield, governance or pipeline state.
// Confirming a plan records the human's scope decision and the engine's numbers at that moment, and nothing else.

// pg returns numeric columns as strings; the engine needs numbers, and a null/blank figure must stay "unknown".
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const dealFigures = (deal: SavedDealRecord): DealFigures => ({ purchasePrice: num(deal.purchase_price), gdv: num(deal.gdv_realistic), refurbCost: num(deal.refurb_cost) })

export type PlanDeps = {
  viewing: ViewingAssessmentRepository
  plans: RefurbPlanRepository
  measurements: MeasurementRepository
  proposals: FinancialProposalRepository
  quoteOverrides?: QuoteOverridesRepository
  getDeal: (dealId: string) => Promise<SavedDealRecord | null>
  now: () => Date
}

const CHECK_IDS = VIEWING_CHECKLIST_V1.map((c) => c.id)

export type LoadedProposal = { detail: ViewingAssessmentDetail; proposal: WorkProposal }

export async function loadWorkProposal(deps: PlanDeps, dealId: string, assessmentId: string): Promise<LoadedProposal | null> {
  const detail = await loadAssessmentDetail(deps.viewing, dealId, assessmentId)
  if (!detail) return null
  const proposal = buildWorkProposal({
    assessmentId,
    analysisSource: detail.summary.analysisSource,
    evidence: detail.evidence,
    proposals: detail.proposals,
    checkIds: CHECK_IDS,
  })
  return { detail, proposal }
}

type Selection = { ok: true; accepted: ConfirmedWorkItem[] } | { ok: false; errors: string[] }

export function resolveSelection(proposal: WorkProposal, selection: readonly AcceptedItemSelection[] | undefined): Selection {
  const chosen: readonly AcceptedItemSelection[] = selection ?? proposal.items.map((i) => ({ itemId: i.itemId }))
  const byId = new Map<string, ProposedWorkItem>(proposal.items.map((i) => [i.itemId, i]))
  const seen = new Set<string>()
  const errors: string[] = []
  const accepted: ConfirmedWorkItem[] = []
  for (const sel of chosen) {
    const item = byId.get(sel.itemId)
    if (!item) {
      errors.push(`Unknown work item: ${sel.itemId} is not in the current proposal`)
      continue
    }
    if (seen.has(sel.itemId)) {
      errors.push(`Work item ${sel.itemId} was listed twice`)
      continue
    }
    seen.add(sel.itemId)
    let scopeEffect = item.scopeEffect
    let levelChosenByHuman = false
    if (sel.level !== undefined) {
      if (!item.scopeEffect || !item.allowedLevels.includes(sel.level)) {
        errors.push(`Level ${String(sel.level)} is not allowed for ${sel.itemId}`)
        continue
      }
      scopeEffect = { field: item.scopeEffect.field, level: sel.level }
      levelChosenByHuman = true
    }
    accepted.push({
      itemId: item.itemId,
      mappingId: item.mappingId,
      kind: item.kind,
      label: item.label,
      area: item.area,
      scopeEffect,
      levelChosenByHuman,
      quantityNote: item.quantityNote,
      sources: item.sources,
    })
  }
  return errors.length ? { ok: false, errors } : { ok: true, accepted }
}

export type BasicsSource = "REQUEST_BASICS" | "MEASUREMENT_SET" | "LATEST_MEASUREMENT_SET" | "NONE"

/** How the engine's property quantities were obtained, and what is still unresolved about them. */
export type BasisReport = {
  source: BasicsSource
  measurementSetId: string | null
  measurementSetVersion: number | null
  basisNotes: string[]
  unresolved: string[]
  blockedBy: string[]
}

type ResolvedBasics =
  | { ok: true; basics: PropertyBasics | null; set: MeasurementSetRecord | null; report: BasisReport }
  | { ok: false; status: "invalid"; errors: string[] }
  | { ok: false; status: "stale_measurements"; currentMeasurementSetId: string }

/**
 * Chooses the quantities handed to the engine. Typed-in basics (the Task 6A path) are accepted as operator estimates.
 * Otherwise they come from a recorded measurement set, which must be the CURRENT version. Nothing is defaulted.
 */
async function resolveBasics(
  deps: PlanDeps,
  dealId: string,
  assessmentId: string,
  request: { propertyBasics?: PropertyBasics; measurementSetId?: string },
  useLatestWhenUnspecified: boolean
): Promise<ResolvedBasics> {
  if (request.propertyBasics) {
    return {
      ok: true,
      basics: request.propertyBasics,
      set: null,
      report: {
        source: "REQUEST_BASICS",
        measurementSetId: null,
        measurementSetVersion: null,
        basisNotes: ["Property quantities were typed in with the request (operator estimate); no measurement record exists for them."],
        unresolved: ["Property quantities have no measurement record: how they are known (measured or estimated) is not recorded."],
        blockedBy: [],
      },
    }
  }
  const latest = await deps.measurements.getCurrent(dealId, assessmentId)
  let set: MeasurementSetRecord | null = null
  let source: BasicsSource = "NONE"
  if (request.measurementSetId) {
    set = await deps.measurements.getById(dealId, assessmentId, request.measurementSetId)
    if (!set) return { ok: false, status: "invalid", errors: ["Unknown measurement set for this assessment"] }
    if (!latest || latest.id !== set.id) return { ok: false, status: "stale_measurements", currentMeasurementSetId: latest?.id ?? "" }
    source = "MEASUREMENT_SET"
  } else if (useLatestWhenUnspecified && latest) {
    set = latest
    source = "LATEST_MEASUREMENT_SET"
  }
  if (!set) {
    return { ok: true, basics: null, set: null, report: { source: "NONE", measurementSetId: null, measurementSetVersion: null, basisNotes: [], unresolved: ["No measurements have been recorded."], blockedBy: ["PROPERTY_BASICS_MISSING"] } }
  }
  const info = basicsFromMeasurements(set.entries)
  return { ok: true, basics: info.basics, set, report: { source, measurementSetId: set.id, measurementSetVersion: set.version, basisNotes: info.basisNotes, unresolved: info.unresolved, blockedBy: info.blockedBy } }
}

/** Quantities that are unknown or only estimated travel with the plan as stated assumptions (same in a preview and in the confirmed plan). */
function withBasisAssumptions(computation: PlanComputation, report: BasisReport): PlanComputation {
  return { ...computation, assumptions: [...new Set([...computation.assumptions, ...report.basisNotes.map((n) => `Quantity basis: ${n}`)])] }
}

export type PreviewOutcome =
  | { status: "not_found" }
  | { status: "invalid"; errors: string[] }
  | { status: "stale_measurements"; currentMeasurementSetId: string }
  | { status: "ok"; proposal: WorkProposal; selection: "ALL_PROPOSED_DEFAULT" | "AS_REQUESTED"; computation: PlanComputation; current: CurrentPlanView | null; basis: BasisReport }

export async function getProposalAndCurrent(deps: PlanDeps, dealId: string, assessmentId: string) {
  const loaded = await loadWorkProposal(deps, dealId, assessmentId)
  if (!loaded) return null
  const [record, latestMeasurements] = await Promise.all([deps.plans.getCurrent(dealId, assessmentId), deps.measurements.getCurrent(dealId, assessmentId)])
  let current: CurrentPlanView | null = null
  if (record) {
    const staleReasons: PlanStaleReason[] = []
    if (record.sourceFingerprint !== loaded.proposal.fingerprint) staleReasons.push("FINDINGS_CHANGED")
    if (latestMeasurements && record.measurementSetId !== latestMeasurements.id) staleReasons.push("MEASUREMENTS_CHANGED")
    current = { record, stale: staleReasons.length > 0, staleReasons }
  }
  return { ...loaded, current, latestMeasurements }
}

/** What the plan would look like if these items were accepted. Writes nothing. */
export async function previewPlan(deps: PlanDeps, dealId: string, assessmentId: string, request: PreviewRequest): Promise<PreviewOutcome> {
  const base = await getProposalAndCurrent(deps, dealId, assessmentId)
  if (!base) return { status: "not_found" }
  const deal = await deps.getDeal(dealId)
  if (!deal) return { status: "not_found" }
  const selected = resolveSelection(base.proposal, request.accepted)
  if (!selected.ok) return { status: "invalid", errors: selected.errors }
  const resolved = await resolveBasics(deps, dealId, assessmentId, request, true)
  if (!resolved.ok) return resolved.status === "invalid" ? { status: "invalid", errors: resolved.errors } : { status: "stale_measurements", currentMeasurementSetId: resolved.currentMeasurementSetId }
  const activeOverrides = deps.quoteOverrides ? await deps.quoteOverrides.list(dealId, assessmentId, true) : []
  const costOverrides = toCostOverrides(activeOverrides)
  const computation = withBasisAssumptions(
    computePlan({
      accepted: selected.accepted,
      basics: resolved.basics,
      assumptions: request.financialAssumptions ?? null,
      deal: dealFigures(deal),
      overrides: costOverrides,
    }),
    resolved.report
  )
  return { status: "ok", proposal: base.proposal, selection: request.accepted ? "AS_REQUESTED" : "ALL_PROPOSED_DEFAULT", computation, current: base.current, basis: resolved.report }
}

export type ConfirmOutcome =
  | { status: "not_found" }
  | { status: "invalid"; errors: string[] }
  | { status: "stale"; currentFingerprint: string }
  | { status: "stale_measurements"; currentMeasurementSetId: string }
  | { status: "key_reused" }
  | { status: "ok"; replayed: boolean; record: ConfirmedPlanRecord }

export const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, val) => (val && typeof val === "object" && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val))

export function hashConfirmRequest(request: ConfirmRequest): string {
  const accepted = [...request.accepted].sort((a, b) => a.itemId.localeCompare(b.itemId))
  return createHash("sha256")
    .update(canonical({ expectedFingerprint: request.expectedFingerprint, accepted, propertyBasics: request.propertyBasics ?? null, measurementSetId: request.measurementSetId ?? null, financialAssumptions: request.financialAssumptions }))
    .digest("hex")
}

/**
 * The human decision. Recomputes everything from stored data, refuses if the findings or the measurements changed since the
 * human looked, records the accepted items with their full source trail, and snapshots the engine's results.
 */
export async function confirmPlan(deps: PlanDeps, dealId: string, assessmentId: string, actor: string, request: ConfirmRequest): Promise<ConfirmOutcome> {
  const requestHash = hashConfirmRequest(request)

  // A repeat of an already-stored confirmation returns that confirmation, even if findings have moved on since.
  const existing = await deps.plans.findByKey(dealId, assessmentId, request.idempotencyKey)
  if (existing) return existing.requestHash === requestHash ? { status: "ok", replayed: true, record: existing.record } : { status: "key_reused" }

  const loaded = await loadWorkProposal(deps, dealId, assessmentId)
  if (!loaded) return { status: "not_found" }
  const deal = await deps.getDeal(dealId)
  if (!deal) return { status: "not_found" }
  if (loaded.proposal.fingerprint !== request.expectedFingerprint) return { status: "stale", currentFingerprint: loaded.proposal.fingerprint }

  const selected = resolveSelection(loaded.proposal, request.accepted)
  if (!selected.ok) return { status: "invalid", errors: selected.errors }

  const resolved = await resolveBasics(deps, dealId, assessmentId, request, false)
  if (!resolved.ok) return resolved.status === "invalid" ? { status: "invalid", errors: resolved.errors } : { status: "stale_measurements", currentMeasurementSetId: resolved.currentMeasurementSetId }
  if (!resolved.basics) return { status: "invalid", errors: [`The recorded measurements are not enough to cost the scope: ${resolved.report.blockedBy.join(", ")}. Record or correct them first.`] }

  const activeOverrides = deps.quoteOverrides ? await deps.quoteOverrides.list(dealId, assessmentId, true) : []
  const costOverrides = toCostOverrides(activeOverrides)
  const computation = withBasisAssumptions(
    computePlan({
      accepted: selected.accepted,
      basics: resolved.basics,
      assumptions: request.financialAssumptions,
      deal: dealFigures(deal),
      overrides: costOverrides,
    }),
    resolved.report
  )

  const created = await deps.plans.create({
    dealId,
    assessmentId,
    idempotencyKey: request.idempotencyKey,
    requestHash,
    sourceFingerprint: loaded.proposal.fingerprint,
    analysisSource: loaded.proposal.analysisSource,
    acceptedItems: selected.accepted,
    excluded: loaded.proposal.excluded,
    propertyBasics: resolved.basics,
    measurementSetId: resolved.set?.id ?? null,
    measurementSetVersion: resolved.set?.version ?? null,
    financialAssumptions: request.financialAssumptions,
    computation,
    confirmedBy: actor,
    confirmedAt: deps.now().toISOString(),
  })
  if (created.status === "key_reused") return { status: "key_reused" }
  return { status: "ok", replayed: created.status === "replayed", record: created.record }
}

export async function getCurrentPlan(deps: PlanDeps, dealId: string, assessmentId: string): Promise<CurrentPlanView | null | "not_found"> {
  const base = await getProposalAndCurrent(deps, dealId, assessmentId)
  if (!base) return "not_found"
  return base.current
}
