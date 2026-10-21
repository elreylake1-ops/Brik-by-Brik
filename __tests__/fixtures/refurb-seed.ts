import { randomBytes } from "node:crypto"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { ViewingAssessmentRepository } from "@/lib/viewing-assessment/viewing-assessment-repository"
import type { ReviewBody } from "@/lib/viewing-assessment/request-validation"
import { reviewProposalAction } from "@/lib/viewing-assessment/viewing-assessment-service"
import type { AiProposableStatus, DraftAiFinding } from "@/types/viewing-assessment"

// Seeds a viewing assessment through the REAL repository methods and the REAL review action, so tests of the
// refurbishment layer read genuine stored data (in memory or in PostgreSQL), never hand-built stand-ins.

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export type SeedFinding = {
  checkId: string
  status: AiProposableStatus
  observation?: string
  /** the model's free-text suggestion (can contain cost claims); must never reach an authoritative output */
  suggestedWork?: string
  /** indexes into the four seeded frames (default [0]); pass [] for a claim with no frame */
  frames?: number[]
  /** how the human reviewed it; omit for "not reviewed yet" */
  review?: DistributiveOmit<ReviewBody, "expectedRevision">
}

export type Seeded = {
  assessmentId: string
  runId: string
  evidenceIds: string[]
  proposalIds: string[] // same order as the findings
}

export const FRAMES = [
  { timestampSeconds: 4, room: "Kitchen" },
  { timestampSeconds: 12, room: "Hall" },
  { timestampSeconds: 20, room: "Bathroom" },
  { timestampSeconds: 31, room: "Loft" },
]

export async function seedAssessment(
  repo: ViewingAssessmentRepository,
  dealId: string,
  findings: readonly SeedFinding[],
  opts: { reviewerId?: string; key?: string } = {}
): Promise<Seeded> {
  const key = opts.key ?? `seed-${randomBytes(6).toString("hex")}`
  const { record } = await repo.createAssessment({ dealId, idempotencyKey: key, checklistVersion: "viewing-checklist-v1", createdBy: "seed-operator" })
  const asset = await repo.addAsset(dealId, record.id, {
    asset: { filename: "seed.mp4", mimeType: "video/mp4", sizeBytes: 1000, durationSeconds: 60, contentSha256: randomBytes(32).toString("hex") },
    frames: FRAMES,
    createdBy: "seed-operator",
  })
  if (asset?.status !== "ok") throw new Error("seed: could not add asset")
  const started = await repo.startRun(dealId, record.id, { idempotencyKey: `run-${key}`, modelVersion: "fixture-frame-analysis-v1", createdBy: "seed-operator", provider: "fixture" })
  if (!started) throw new Error("seed: could not start run")
  const runId = started.run.id

  const drafts: DraftAiFinding[] = findings.map((f, i) => ({
    id: `${runId}:P${i + 1}`,
    assessmentId: record.id,
    checkId: f.checkId,
    status: f.status,
    observation: f.observation ?? `Seeded observation for ${f.checkId}`,
    evidenceIds: (f.frames ?? [0]).map((n) => asset.evidence[n].id),
    confidence: "low",
    ...(f.suggestedWork ? { suggestedWork: f.suggestedWork } : {}),
    modelVersion: "fixture-frame-analysis-v1",
    verification: "UNVERIFIED",
    disposition: "PENDING",
  }))
  await repo.completeRun(runId, { attempt: 1, status: "READY_FOR_REVIEW", proposals: drafts, rejectedCount: 0 })

  for (const [i, f] of findings.entries()) {
    if (!f.review) continue
    const out = await reviewProposalAction(repo, {
      dealId,
      assessmentId: record.id,
      proposalId: drafts[i].id,
      body: { expectedRevision: 0, ...f.review } as ReviewBody,
      reviewerId: opts.reviewerId ?? "operator-1",
      now: new Date(Date.UTC(2026, 9, 21, 9, 0, i)),
    })
    if (out.status !== "ok") throw new Error(`seed: review failed for ${f.checkId}: ${out.status}`)
  }
  return { assessmentId: record.id, runId, evidenceIds: asset.evidence.map((e) => e.id), proposalIds: drafts.map((d) => d.id) }
}

export function makeDeal(id: string, over: Partial<SavedDealRecord> = {}): SavedDealRecord {
  return {
    id,
    created_at: "2026-10-01T09:00:00.000Z",
    updated_at: "2026-10-01T09:30:00.000Z",
    archived_at: null,
    address: "14 Example Road, Leeds",
    listing_url: null,
    purchase_price: 100000,
    gdv_realistic: 190000,
    refurb_cost: 25000,
    classification: "CONDITIONAL",
    governance_state: "CONDITIONAL",
    capital_protection_state: "UNKNOWN",
    pipeline_state: "UNDER_ANALYSIS",
    engine_result_json: { marker: "stored-engine-result" },
    risk_summary_json: {},
    next_action: null,
    ...over,
  }
}

export const BASICS = { bedrooms: 3, bathrooms: 1, floorAreaSqm: 85, kitchenSize: "medium" as const }
export const ASSUMPTIONS = { stampDuty: 3000, legalCosts: 1500, saleCosts: 3000, bridgeTermMonths: 9 }
export const ACCEPT = { disposition: "ACCEPTED" } as const
