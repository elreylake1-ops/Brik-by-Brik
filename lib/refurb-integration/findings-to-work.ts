import { createHash } from "node:crypto"
import { FINDING_WORK_MAPPINGS, mappingForCheck, type WorkMapping } from "@/lib/data/finding-work-mapping"
import { buildCheckStates, type CheckItem } from "@/lib/viewing-assessment/check-states"
import type { ProposalWithReview, VideoEvidenceRef } from "@/types/viewing-assessment"
import {
  REFURB_INTEGRATION_VERSION,
  type ExcludedFinding,
  type ExclusionReason,
  type FindingSource,
  type ProposedWorkItem,
  type ScopeLevel,
  type WorkProposal,
} from "@/types/refurb-integration"

// Controlled adapter: human-reviewed viewing findings -> PROPOSED work items.
//
// What it guarantees (each is tested):
//  - Only a suggestion a human ACCEPTED or EDITED can become part of a work item. Unreviewed and rejected suggestions
//    are listed as excluded, with the reason, and can never appear as work.
//  - Only the check's effective reviewed state counts: CONCERN proposes works, SPECIALIST_REVIEW proposes an inspection,
//    anything else (observed, not accessible, not applicable) proposes nothing.
//  - A suggestion with no resolvable evidence frame is excluded: an unsupported claim cannot become work.
//  - Every item carries its sources: proposal, review revision, reviewer, time, frames with timestamps.
//  - Output is a PROPOSAL. Nothing is accepted until a human confirms (plan-service.confirmPlan).
//  - No amount of money appears here. Pricing is the existing engine's job.

export type BuildWorkProposalInput = {
  assessmentId: string
  analysisSource: WorkProposal["analysisSource"]
  evidence: readonly VideoEvidenceRef[]
  proposals: readonly ProposalWithReview[]
  checkIds: readonly string[]
}

const WORKS_STATES = new Set(["CONCERN", "SPECIALIST_REVIEW"])

export function fingerprintFindings(proposals: readonly ProposalWithReview[]): string {
  const rows = proposals
    .map((p) => {
      const r = p.currentReview
      return [
        p.proposal.id,
        p.proposal.checkId,
        p.proposal.status,
        p.proposal.evidenceIds.join(","),
        r ? `${r.id}:${r.revision}:${r.disposition}:${r.editedStatus ?? ""}:${r.editedObservation ?? ""}` : "pending",
      ].join("|")
    })
    .sort()
  return createHash("sha256").update(rows.join("\n")).digest("hex")
}

function toSource(item: CheckItem, evidenceById: Map<string, VideoEvidenceRef>): FindingSource | "NO_EVIDENCE" {
  const review = item.currentReview!
  const evidence = item.proposal.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((e): e is VideoEvidenceRef => Boolean(e))
    .map((e) => ({ evidenceId: e.id, assetId: e.assetId, timestampSeconds: e.timestampSeconds, ...(e.room ? { room: e.room } : {}) }))
  if (evidence.length === 0) return "NO_EVIDENCE"
  const edited = review.disposition === "EDITED"
  return {
    proposalId: item.proposal.id,
    checkId: item.proposal.checkId,
    runId: item.proposal.runId,
    modelVersion: item.proposal.modelVersion,
    aiProposedStatus: item.proposal.status,
    aiObservation: item.proposal.observation,
    aiConfidence: item.proposal.confidence,
    disposition: review.disposition as "ACCEPTED" | "EDITED",
    effectiveStatus: item.contributes!,
    reviewedObservation: (edited ? review.editedObservation : null) ?? item.proposal.observation,
    reviewId: review.id,
    reviewRevision: review.revision,
    reviewerId: review.reviewerId,
    reviewedAt: review.reviewedAt,
    reviewReason: review.reason,
    evidence,
  }
}

function itemFor(mapping: WorkMapping, inspection: boolean, sources: FindingSource[]): ProposedWorkItem {
  const sorted = [...sources].sort((a, b) => a.checkId.localeCompare(b.checkId) || a.proposalId.localeCompare(b.proposalId))
  if (inspection) {
    return {
      itemId: `${mapping.id}:inspect`,
      mappingId: mapping.id,
      kind: "SPECIALIST_INSPECTION",
      label: `${mapping.label}: specialist inspection required before pricing`,
      area: mapping.area,
      scopeEffect: null,
      allowedLevels: [],
      quantityNote: "A reviewer marked this for specialist inspection. Nothing is priced or scheduled for it until that inspection is done.",
      provisional: true,
      needsBuilderVerification: true,
      sources: sorted,
    }
  }
  const field = mapping.scopeField
  const levels = (mapping.levels ?? []) as ScopeLevel[]
  const start = levels.indexOf(mapping.proposedLevel as ScopeLevel)
  return {
    itemId: mapping.id,
    mappingId: mapping.id,
    kind: mapping.kind,
    label: mapping.label,
    area: mapping.area,
    scopeEffect: field ? { field, level: mapping.proposedLevel as ScopeLevel } : null,
    allowedLevels: field ? levels.slice(Math.max(start, 0)) : [],
    quantityNote: mapping.quantityNote,
    provisional: true,
    needsBuilderVerification: true,
    sources: sorted,
  }
}

export function buildWorkProposal(input: BuildWorkProposalInput): WorkProposal {
  const evidenceById = new Map(input.evidence.map((e) => [e.id, e]))
  const rows = buildCheckStates(input.checkIds, input.proposals)

  const excluded: ExcludedFinding[] = []
  const exclude = (item: CheckItem, reason: ExclusionReason) =>
    excluded.push({ proposalId: item.proposal.id, checkId: item.proposal.checkId, reason })

  const works = new Map<string, FindingSource[]>() // mapping id -> sources (CONCERN)
  const inspections = new Map<string, FindingSource[]>() // mapping id -> sources (SPECIALIST_REVIEW)

  for (const row of rows) {
    for (const item of row.items) {
      const review = item.currentReview
      if (!review) {
        exclude(item, "UNREVIEWED")
        continue
      }
      if (review.disposition === "REJECTED") {
        exclude(item, "REJECTED")
        continue
      }
      const state = item.contributes
      if (state === "OBSERVED") {
        exclude(item, "OBSERVED_ONLY")
        continue
      }
      if (!state || !WORKS_STATES.has(state)) {
        exclude(item, "NOT_A_CONCERN")
        continue
      }
      if (state !== row.state) {
        exclude(item, "NOT_EFFECTIVE_STATE")
        continue
      }
      const mapping = mappingForCheck(item.proposal.checkId)
      if (!mapping) {
        exclude(item, "NOT_A_WORKS_CHECK")
        continue
      }
      const source = toSource(item, evidenceById)
      if (source === "NO_EVIDENCE") {
        exclude(item, "NO_EVIDENCE")
        continue
      }
      const bucket = state === "CONCERN" ? works : inspections
      bucket.set(mapping.id, [...(bucket.get(mapping.id) ?? []), source])
    }
  }

  const items: ProposedWorkItem[] = []
  for (const mapping of FINDING_WORK_MAPPINGS) {
    const w = works.get(mapping.id)
    if (w) items.push(itemFor(mapping, false, w))
    const s = inspections.get(mapping.id)
    if (s) items.push(itemFor(mapping, true, s))
  }

  const openInspectionGaps = rows
    .filter((r) => r.state === "NOT_ACCESSIBLE" || (r.state === "NOT_ASSESSED" && r.pendingCount > 0))
    .map((r) => ({ checkId: r.checkId, state: r.state as "NOT_ACCESSIBLE" | "NOT_ASSESSED", awaitingReview: r.pendingCount > 0 }))

  excluded.sort((a, b) => a.checkId.localeCompare(b.checkId) || a.proposalId.localeCompare(b.proposalId))
  return {
    version: REFURB_INTEGRATION_VERSION,
    assessmentId: input.assessmentId,
    analysisSource: input.analysisSource,
    fingerprint: fingerprintFindings(input.proposals),
    items,
    excluded,
    openInspectionGaps,
  }
}
