import { REFURB_INTEGRATION_VERSION } from "@/types/refurb-integration"
import type { PdfEvidencePack } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { DealPassport, OutstandingDecision } from "@/types/deal-documents"
import type { FinancialState } from "@/types/refurb-financial"
import type { ConfirmedPlanRecord, CurrentPlanView, WorkProposal } from "@/types/refurb-integration"
import type { ViewingAssessmentDetail } from "@/types/viewing-assessment"
import { draftMarker } from "./builder-pack"
import { authoritativeFigures } from "./financial-proposal"
import type { MeasurementState } from "./measurement-service"

// Deal Passport: one reviewable page of record for a deal. It ASSEMBLES what already exists (the reused evidence pack:
// identity, investor summary, Investor Shield result, evidence index, disclaimers; the viewing review; the measurements; the
// confirmed refurbishment plan; the financial-impact proposal and its decision) and adds nothing authoritative of its own.
//
// Three layers are kept apart and labelled, never blended:
//   1. AUTHORITATIVE   the Saved Deal exactly as stored (and Investor Shield as evaluated)
//   2. CONFIRMED SCOPE what a person accepted from reviewed findings, with the engine's cost and schedule at that moment
//   3. PROPOSAL        the engine's financial effect of that scope, and whether a named operator approved it
// Approving a proposal changes layer 1 not at all.

export type BuildPassportInput = {
  generatedAt: string
  pack: PdfEvidencePack
  deal: SavedDealRecord
  inspection: { detail: ViewingAssessmentDetail; proposal: WorkProposal } | null
  plan: CurrentPlanView | null
  planHistory: readonly ConfirmedPlanRecord[]
  measurements: MeasurementState | null
  financial: FinancialState | null
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function buildDealPassport(input: BuildPassportInput): DealPassport {
  const { pack, deal, inspection, plan, measurements, financial } = input
  const analysisSource = inspection?.proposal.analysisSource ?? plan?.record.analysisSource ?? null
  const shield = pack.investorShield

  const outstanding: OutstandingDecision[] = []
  if (!shield.canProgress) outstanding.push({ code: "SHIELD_NOT_CLEARED", message: `Investor Shield does not allow progression (${shield.overallStatus}). Blocking gates: ${shield.blockingGateKeys.join(", ") || "none listed"}.` })
  if (shield.missingEvidenceGateKeys.length) outstanding.push({ code: "SHIELD_MISSING_EVIDENCE", message: `Evidence missing for gates: ${shield.missingEvidenceGateKeys.join(", ")}.` })
  if (shield.manualOverrideRequired) outstanding.push({ code: "SHIELD_MANUAL_OVERRIDE", message: "Investor Shield requires an authorised manual decision. Nothing in this document supplies one." })
  if (!inspection) {
    outstanding.push({ code: "NO_INSPECTION", message: "No viewing assessment is attached to this passport." })
  } else {
    const s = inspection.detail.summary
    if (s.awaitingReview > 0) outstanding.push({ code: "FINDINGS_AWAITING_REVIEW", message: `${s.awaitingReview} suggested finding(s) have not been reviewed by a person and are not in any scope.` })
    if (s.specialistChecks > 0) outstanding.push({ code: "SPECIALIST_INSPECTIONS", message: `${s.specialistChecks} check(s) need specialist inspection before works are priced.` })
    if (inspection.proposal.openInspectionGaps.some((g) => g.state === "NOT_ACCESSIBLE")) outstanding.push({ code: "NOT_ACCESSIBLE", message: "Some areas were not accessible and remain uninspected." })
    if (!measurements?.current) outstanding.push({ code: "NO_MEASUREMENTS", message: "No measurements have been recorded by an operator." })
    else if (measurements.engineQuantities?.blockedBy.length) outstanding.push({ code: "MEASUREMENTS_INCOMPLETE", message: `Recorded measurements are not enough to cost the scope: ${measurements.engineQuantities.blockedBy.join(", ")}.` })
  }
  if (!plan) outstanding.push({ code: "NO_CONFIRMED_PLAN", message: "No refurbishment scope has been confirmed by a person yet." })
  else {
    if (plan.stale) outstanding.push({ code: "PLAN_STALE", message: `The confirmed scope is out of date (${plan.staleReasons.join(", ").toLowerCase().replace(/_/g, " ")}). Re-confirm it.` })
    const comp = plan.record.computation
    if (comp.estimate.status === "BLOCKED") outstanding.push({ code: "COSTING_BLOCKED", message: `Costing is blocked: ${comp.estimate.blockedBy.join(", ")}.` })
    if (comp.estimate.unpricedItems.length) outstanding.push({ code: "UNPRICED_ITEMS", message: `${comp.estimate.unpricedItems.length} item(s) have no price in the estimate and need builder pricing or specialist inspection.` })
    if (!financial || financial.status === "NONE") outstanding.push({ code: "NO_FINANCIAL_PROPOSAL", message: "No financial-impact proposal has been made for the confirmed scope." })
    else if (financial.status === "PROPOSED") outstanding.push({ code: "FINANCIAL_PROPOSAL_AWAITING_DECISION", message: "A financial-impact proposal exists and no operator has confirmed or declined it." })
    else if (financial.status === "OUTDATED") outstanding.push({ code: "FINANCIAL_PROPOSAL_OUTDATED", message: `The latest financial-impact proposal is out of date: ${financial.outdatedReasons.join(" ")}` })
    else if (financial.status === "DECLINED") outstanding.push({ code: "FINANCIAL_PROPOSAL_DECLINED", message: "The latest financial-impact proposal was declined." })
    else if (financial.status === "CONFIRMED" && financial.outdated) outstanding.push({ code: "FINANCIAL_APPROVAL_OUTDATED", message: `The approved financial-impact proposal no longer matches current data: ${financial.outdatedReasons.join(" ")}` })
    if (financial?.status === "CONFIRMED") outstanding.push({ code: "NO_WRITE_BACK", message: "A financial-impact proposal was approved. The Saved Deal figures are unchanged; applying it needs a separately authorised step." })
  }
  if (analysisSource === "SIMULATED" || analysisSource === "MIXED") outstanding.push({ code: "SIMULATED_DATA", message: "Findings include SIMULATED analysis; this is a demonstration, not an inspection result." })

  const record = plan?.record
  const latest = financial?.latest ?? null
  const authoritative = authoritativeFigures(deal)
  const decisionOf = (proposalId: string) => (financial?.decision && financial.decision.proposalId === proposalId ? financial.decision : null)

  return {
    ...draftMarker(analysisSource),
    kind: "DEAL_PASSPORT",
    version: "deal-passport-v2",
    generatedAt: input.generatedAt,
    deal: {
      dealId: deal.id,
      address: deal.address,
      listingUrl: deal.listing_url,
      stored: {
        classification: deal.classification,
        governanceState: deal.governance_state,
        capitalProtectionState: deal.capital_protection_state,
        pipelineState: deal.pipeline_state,
        purchasePrice: num(deal.purchase_price),
        gdvRealistic: num(deal.gdv_realistic),
        refurbCost: num(deal.refurb_cost),
        updatedAt: deal.updated_at,
      },
      investorSummary: pack.investorSummary,
    },
    inspection: inspection
      ? {
          assessmentId: inspection.detail.assessment.id,
          analysisSource: inspection.proposal.analysisSource,
          checksTotal: inspection.detail.summary.checklistTotal,
          checksHumanReviewed: inspection.detail.summary.checklistTotal - inspection.detail.summary.checksWithoutReviewedFinding,
          checksNotAssessed: inspection.detail.summary.checksWithoutReviewedFinding,
          findingsAwaitingReview: inspection.detail.summary.awaitingReview,
          specialistInspectionsRequired: inspection.detail.summary.specialistChecks,
          openGaps: inspection.proposal.openInspectionGaps,
          evidenceFrameCount: inspection.detail.summary.evidenceFrameCount,
        }
      : null,
    measurements: {
      current: measurements?.current ?? null,
      history: (measurements?.history ?? []).map((h) => ({ version: h.record.version, recordedBy: h.record.recordedBy, recordedAt: h.record.recordedAt, changeNote: h.record.changeNote, changes: h.changesFromPrevious })),
      engineQuantityNotes: measurements?.engineQuantities?.basisNotes ?? [],
      unresolved: measurements?.engineQuantities?.unresolved ?? [],
    },
    evidence: pack.evidenceIndex,
    refurbishment: {
      status: !record ? "NO_PLAN" : plan!.stale ? "CONFIRMED_STALE" : "CONFIRMED",
      staleReasons: plan?.staleReasons ?? [],
      planId: record?.id ?? null,
      planVersion: record?.version ?? null,
      confirmedAt: record?.confirmedAt ?? null,
      confirmedBy: record?.confirmedBy ?? null,
      acceptedItems: record?.acceptedItems ?? [],
      computation: record?.computation ?? null,
    },
    financial: {
      authoritative,
      confirmedScopeSnapshot: record?.computation.financialImpact ?? null,
      proposal: {
        status: financial?.status ?? "NONE",
        outdated: financial?.outdated ?? false,
        outdatedReasons: financial?.outdatedReasons ?? [],
        latest,
        decision: financial?.decision ?? null,
        history: (financial?.proposals ?? []).map((p) => {
          const d = decisionOf(p.id)
          return { version: p.version, proposalId: p.id, planId: p.planId, createdAt: p.createdAt, createdBy: p.createdBy, contentHash: p.contentHash, decision: d?.decision ?? null, decidedBy: d?.actor ?? null, decidedAt: d?.occurredAt ?? null }
        }),
      },
      statement: "The Saved Deal figures are authoritative. The proposal is the engine's calculation of the confirmed scope's effect; approving it records an operator's agreement to a proposed adjustment and changes no Saved Deal, governance or Investor Shield value.",
    },
    investorShield: shield,
    outstandingDecisions: outstanding,
    provenance: {
      packMeta: pack.meta,
      integrationVersion: REFURB_INTEGRATION_VERSION,
      planHistory: input.planHistory.map((p) => ({ planId: p.id, version: p.version, confirmedAt: p.confirmedAt, confirmedBy: p.confirmedBy, measurementSetVersion: p.measurementSetVersion })),
      sourceTrail: (record?.acceptedItems ?? []).flatMap((item) =>
        item.sources.map((s) => ({
          itemId: item.itemId,
          checkId: s.checkId,
          proposalId: s.proposalId,
          reviewId: s.reviewId,
          reviewRevision: s.reviewRevision,
          disposition: s.disposition,
          reviewerId: s.reviewerId,
          reviewedAt: s.reviewedAt,
          evidenceIds: s.evidence.map((e) => e.evidenceId),
        }))
      ),
    },
    disclaimers: pack.disclaimers,
    passportNotes: [
      "DRAFT for review. Not approved, not a contract, not a quotation, not a valuation and not an investment decision.",
      "Investor Shield status, governance state and the Saved Deal figures are shown as stored and are unchanged by this document, by confirming a scope, or by approving a financial-impact proposal.",
      "Estimates and proposed figures come from the existing Brik-by-Brik engine and are previews until a person applies them through the established workflow.",
    ],
  }
}
