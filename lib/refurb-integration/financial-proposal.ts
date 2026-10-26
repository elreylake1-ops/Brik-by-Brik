import { createHash } from "node:crypto"
import { SCOPE_DEFAULTS } from "@/lib/data/finding-work-mapping"
import { formatCurrency } from "@/lib/formatters"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import {
  FINANCIAL_PROPOSAL_VERSION,
  type AuthoritativeFigures,
  type FinancialProposalContent,
  type StoredEngineHeadline,
} from "@/types/refurb-financial"
import type { ConfirmedPlanRecord } from "@/types/refurb-integration"
import type { MeasurementSetRecord } from "@/types/refurb-measurements"
import { basicsFromMeasurements } from "./measurements"
import type { CostOverride } from "@/types/overrides"
import { computePlan, type DealFigures } from "./plan-compute"
import { classifyVerifiedComparableEvidence, type VerifiedComparableEvidence } from "@/lib/financial/verified-comparable-evidence"

// Builds the financial-impact PROPOSAL for a confirmed refurbishment scope.
//
// Every figure comes from the existing engine through computePlan (which calls analyzeDealWithRefurb for both the Saved
// Deal's own figures and the confirmed scope). This file only arranges them for review beside the authoritative Saved
// Deal, and lists what changed, what is excluded and what is still unresolved. It adds no formula, rate or threshold, and
// it has no way to write to the Saved Deal.

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const obj = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

export const canonicalJson = (v: unknown): string =>
  JSON.stringify(v, (_k, val) => (val && typeof val === "object" && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val))

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex")

/** Headline numbers from the stored engine result, if it has them. Read-only; tolerant of any stored shape. */
function readStoredHeadline(engineResultJson: unknown): StoredEngineHeadline | null {
  const root = obj(engineResultJson)
  const deal = obj(root?.deal)
  if (!deal) return null
  const mao = obj(deal.trueMao)
  const verdict = obj(root?.verdict)
  return {
    totalCost: num(deal.totalCost),
    profit: num(deal.profit),
    profitMargin: num(deal.profitMargin),
    verdictStatus: typeof verdict?.status === "string" ? verdict.status : null,
    trueMao: mao ? { fifteenPercent: num(mao.fifteenPercent), twentyPercent: num(mao.twentyPercent), twentyFivePercent: num(mao.twentyFivePercent) } : null,
  }
}

export function authoritativeFigures(deal: SavedDealRecord): AuthoritativeFigures {
  return {
    dealId: deal.id,
    storedUpdatedAt: deal.updated_at,
    purchasePrice: num(deal.purchase_price),
    gdvRealistic: num(deal.gdv_realistic),
    refurbCost: num(deal.refurb_cost),
    classification: deal.classification,
    governanceState: deal.governance_state,
    capitalProtectionState: deal.capital_protection_state,
    pipelineState: deal.pipeline_state,
    storedEngineResult: readStoredHeadline(deal.engine_result_json),
  }
}

/** Fingerprint of the authoritative Saved Deal figures. If it changes, any proposal compared against them is out of date. */
export const baselineFingerprint = (figures: AuthoritativeFigures): string => sha256(canonicalJson(figures))

export type BuiltProposal = { content: FinancialProposalContent; contentHash: string; baselineFingerprint: string }

export function buildFinancialProposal(input: { plan: ConfirmedPlanRecord; measurementSet: MeasurementSetRecord | null; deal: SavedDealRecord; overrides?: CostOverride[]; comparableEvidence?: readonly VerifiedComparableEvidence[] }): BuiltProposal {
  const { plan, deal, overrides = [] } = input
  const authoritative = authoritativeFigures(deal)
  const figures: DealFigures = { purchasePrice: authoritative.purchasePrice, gdv: authoritative.gdvRealistic, refurbCost: authoritative.refurbCost }

  // Re-run the confirmed scope against the Saved Deal AS IT IS NOW (it may have changed since the plan was confirmed).
  const computation = computePlan({ accepted: plan.acceptedItems, basics: plan.propertyBasics, assumptions: plan.financialAssumptions, deal: figures, overrides })
  const impact = computation.financialImpact

  const blockedBy = [...new Set([...(computation.estimate.status === "BLOCKED" ? computation.estimate.blockedBy : []), ...(impact.status === "BLOCKED" ? impact.blockedBy : [])])]

  const baseline = impact.baseline
  const stored = authoritative.storedEngineResult
  const differences: string[] = []
  let comparable = false
  if (baseline && stored && stored.profit !== null && stored.totalCost !== null) {
    comparable = true
    if (Math.abs(stored.profit - baseline.profit) > 0.5) differences.push(`Stored profit ${formatCurrency(stored.profit)} differs from the engine's recalculation of the stored figures with the operator's assumptions (${formatCurrency(baseline.profit)}).`)
    if (Math.abs(stored.totalCost - baseline.totalCost) > 0.5) differences.push(`Stored total cost ${formatCurrency(stored.totalCost)} differs from the recalculation (${formatCurrency(baseline.totalCost)}).`)
    if (differences.length) differences.push("The assumptions used when the Saved Deal was saved (stamp duty, legal costs, sale costs, bridge term) are not stored, so this difference cannot be resolved automatically.")
  }

  const quantityBasis = input.measurementSet ? basicsFromMeasurements(input.measurementSet.entries) : null
  const changedAssumptions: string[] = []
  if (baseline && impact.scenario) {
    changedAssumptions.push(`Refurbishment cost: the Saved Deal holds ${formatCurrency(baseline.refurbCost)}; this proposal uses ${formatCurrency(impact.scenario.refurbCost)}, the existing engine's cost for the confirmed scope (version ${plan.version}).`)
  }
  if (plan.financialAssumptions) {
    const a = plan.financialAssumptions
    changedAssumptions.push(`Stamp duty ${formatCurrency(a.stampDuty)}, legal costs ${formatCurrency(a.legalCosts)}, sale costs ${formatCurrency(a.saleCosts)} and a ${a.bridgeTermMonths}-month bridge term were supplied by the operator when the scope was confirmed. The Saved Deal does not store them, so the same values are used on both sides of the comparison.`)
  }
  if (quantityBasis) changedAssumptions.push(...quantityBasis.basisNotes.map((n) => `Quantity: ${n}`))
  changedAssumptions.push(SCOPE_DEFAULTS.note)

  const exclusions = computation.estimate.unpricedItems.map((u) => ({ itemId: u.itemId, label: u.label, reason: u.reason }))
  const unresolvedQuantities = [
    ...(quantityBasis ? quantityBasis.unresolved : ["Property quantities were typed in without a measurement record, so how they are known is not recorded."]),
    ...computation.estimate.provisionalAllowances,
    ...computation.estimate.confidenceFlags,
  ]

  const completeness = blockedBy.length ? "NOT_COMPUTABLE" : exclusions.length || unresolvedQuantities.length ? "HAS_EXCLUSIONS_OR_UNRESOLVED_QUANTITIES" : "COMPLETE"

  const content: FinancialProposalContent = {
    version: FINANCIAL_PROPOSAL_VERSION,
    nonAuthoritative: true,
    plan: {
      planId: plan.id,
      planVersion: plan.version,
      confirmedBy: plan.confirmedBy,
      confirmedAt: plan.confirmedAt,
      analysisSource: plan.analysisSource,
      measurementSetId: plan.measurementSetId,
      measurementSetVersion: plan.measurementSetVersion,
      sourceReviewers: [...new Set(plan.acceptedItems.flatMap((i) => i.sources.map((s) => s.reviewerId)))].sort(),
      acceptedItems: plan.acceptedItems.map((i) => ({ itemId: i.itemId, label: i.label, kind: i.kind, checkIds: [...new Set(i.sources.map((s) => s.checkId))].sort(), proposalIds: [...new Set(i.sources.map((s) => s.proposalId))].sort() })),
    },
    authoritative,
    gdvEvidence: classifyVerifiedComparableEvidence(input.comparableEvidence ?? [], deal.updated_at),
    recalculatedBaseline: baseline,
    proposed: impact.scenario,
    delta: impact.delta,
    storedVersusRecalculated: { comparable, consistent: comparable ? differences.length === 0 : null, differences },
    changedAssumptions,
    exclusions,
    unresolvedQuantities,
    blockedBy,
    completeness,
    notes: [
      "This is a PROPOSAL. The Saved Deal figures above are the authoritative record and have not been changed.",
      "Every figure was produced by the existing Brik-by-Brik engine (analyzeDealWithRefurb); nothing was estimated by AI or by this document.",
      "Confirming records that a named operator approved this proposed adjustment. It does not update the Saved Deal, Investor Shield, governance state or pipeline, and it is not an investment approval.",
      ...(exclusions.length || unresolvedQuantities.length
        ? [
            "Unresolved refurbishment scope items require contractor quotation. Apparent refurb cost difference from baseline is provisional and must not be treated as confirmed savings.",
          ]
        : []),
    ],
  }
  return { content, contentHash: sha256(canonicalJson(content)), baselineFingerprint: baselineFingerprint(authoritative) }
}
