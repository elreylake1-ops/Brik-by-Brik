import type {
  AnalysisRunRecord,
  AiUsageRecord,
  EvidenceBlobMeta,
  FeedbackEntry,
  ProposalWithReview,
  StoredProposal,
  StoredReview,
  VideoEvidenceRef,
  ViewingAssessmentRecord,
  ViewingAssetRecord,
} from "@/types/viewing-assessment"
import {
  MAX_RUN_ATTEMPTS,
  RUN_LEASE_SECONDS,
  RunLeaseLostError,
  type ViewingAssessmentRepository,
} from "@/lib/viewing-assessment/viewing-assessment-repository"

// Test double honouring the repository contract: deal scoping, idempotency, optimistic revisions,
// and append-only rows (frozen on insert, so any attempted mutation throws in strict mode).

const freeze = <T extends object>(o: T): T => Object.freeze(o)

export function createInMemoryViewingRepository() {
  let seq = 0
  const nextId = (p: string) => `${p}-${++seq}`
  const now = () => new Date(Date.UTC(2026, 9, 20, 10, 0, seq)).toISOString()

  const assessments: ViewingAssessmentRecord[] = []
  const keys = new Map<string, string>() // `${dealId}|${key}` -> assessment id
  const assets: ViewingAssetRecord[] = []
  const evidence: (VideoEvidenceRef & { assessmentId: string })[] = []
  type StoredRun = AnalysisRunRecord & { key: string; touchedMs: number } // touchedMs: real clock, for the lease
  const runs = new Map<string, StoredRun>()
  const proposals: StoredProposal[] = []
  const reviews: (StoredReview & { assessmentId: string })[] = []
  const feedback: FeedbackEntry[] = []
  const blobs = new Map<string, EvidenceBlobMeta & { storageKey: string; assessmentId: string }>()
  const usage: (AiUsageRecord & { runId: string; attempt: number; atMs: number })[] = []

  const inDeal = (dealId: string, assessmentId: string) =>
    assessments.some((a) => a.id === assessmentId && a.dealId === dealId)
  const publicRun = (r: StoredRun): AnalysisRunRecord => {
    const { key, touchedMs, ...run } = r
    void key
    void touchedMs
    return run
  }

  const repo: ViewingAssessmentRepository = {
    async createAssessment({ dealId, idempotencyKey, checklistVersion, createdBy }) {
      const existingId = keys.get(`${dealId}|${idempotencyKey}`)
      const existing = assessments.find((a) => a.id === existingId)
      if (existing) return { record: existing, created: false }
      const record = freeze({ id: nextId("asmt"), dealId, checklistVersion, createdBy, createdAt: now() })
      assessments.push(record)
      keys.set(`${dealId}|${idempotencyKey}`, record.id)
      return { record, created: true }
    },
    async listAssessments(dealId) {
      return assessments.filter((a) => a.dealId === dealId)
    },
    async getAssessment(dealId, assessmentId) {
      return assessments.find((a) => a.id === assessmentId && a.dealId === dealId) ?? null
    },
    async addAsset(dealId, assessmentId, { asset, frames }) {
      if (!inDeal(dealId, assessmentId)) return null
      if (asset.contentSha256 && assets.some((a) => a.assessmentId === assessmentId && a.contentSha256 === asset.contentSha256)) {
        return { status: "duplicate_asset" }
      }
      const record = freeze({
        ...asset,
        id: nextId("asset"),
        assessmentId,
        source: "DECLARED_METADATA" as const,
        createdAt: now(),
      })
      assets.push(record)
      const refs = frames.map((f) =>
        freeze({
          id: nextId("frame"),
          assetId: record.id,
          clipFilename: record.filename,
          timestampSeconds: f.timestampSeconds,
          ...(f.requestedTimestampSeconds !== undefined ? { requestedTimestampSeconds: f.requestedTimestampSeconds } : {}),
          ...(f.captureMethod ? { captureMethod: f.captureMethod } : {}),
          ...(f.captureConfidence ? { captureConfidence: f.captureConfidence } : {}),
          ...(f.room ? { room: f.room } : {}),
          assessmentId,
        })
      )
      evidence.push(...refs)
      return { status: "ok", asset: record, evidence: refs }
    },
    async listAssets(dealId, assessmentId) {
      return inDeal(dealId, assessmentId) ? assets.filter((a) => a.assessmentId === assessmentId) : null
    },
    async getEvidenceContext(dealId, assessmentId) {
      if (!inDeal(dealId, assessmentId)) return null
      return {
        assets: assets
          .filter((a) => a.assessmentId === assessmentId)
          .map((a) => ({ id: a.id, durationSeconds: a.durationSeconds })),
        // same ordering as the Postgres implementation: by clip, then by time within the clip
        evidence: evidence
          .filter((e) => e.assessmentId === assessmentId)
          .sort((a, b) => assets.findIndex((x) => x.id === a.assetId) - assets.findIndex((x) => x.id === b.assetId) || a.timestampSeconds - b.timestampSeconds),
      }
    },
    async startRun(dealId, assessmentId, { idempotencyKey, modelVersion, leaseSeconds, provider }) {
      if (!inDeal(dealId, assessmentId)) return null
      const existing = runs.get(`${assessmentId}|${idempotencyKey}`)
      if (existing) {
        const stale =
          existing.status === "RUNNING" &&
          Date.now() - existing.touchedMs >= (leaseSeconds ?? RUN_LEASE_SECONDS) * 1000
        if (existing.attemptCount < MAX_RUN_ATTEMPTS && (existing.status === "FAILED" || stale)) {
          Object.assign(existing, { status: "RUNNING", errorCode: null, touchedMs: Date.now(), updatedAt: now() })
          existing.attemptCount += 1
          return { run: publicRun(existing), created: true }
        }
        if (stale) {
          Object.assign(existing, { status: "FAILED", errorCode: "MAX_ATTEMPTS_EXCEEDED", touchedMs: Date.now(), updatedAt: now() })
        }
        return { run: publicRun(existing), created: false }
      }
      const run: StoredRun = {
        touchedMs: Date.now(),
        id: nextId("run"),
        key: idempotencyKey,
        assessmentId,
        provider: provider ?? ("mock" as const),
        modelVersion,
        status: "RUNNING" as const,
        attemptCount: 1,
        proposalsCount: 0,
        rejectedCount: 0,
        errorCode: null,
        createdAt: now(),
        updatedAt: now(),
      }
      runs.set(`${assessmentId}|${idempotencyKey}`, run)
      return { run: publicRun(run), created: true }
    },
    async completeRun(runId, { attempt, status, proposals: drafts, rejectedCount, errorCode, usage: u }) {
      const run = [...runs.values()].find((r) => r.id === runId)
      if (!run || run.status !== "RUNNING" || run.attemptCount !== attempt) throw new RunLeaseLostError()
      if (u) usage.push(freeze({ ...u, runId, attempt, atMs: Date.now() }))
      for (const p of drafts) proposals.push(freeze({ ...p, runId, createdAt: now() }))
      Object.assign(run, { status, proposalsCount: drafts.length, rejectedCount, errorCode: errorCode ?? null, updatedAt: now() })
      return publicRun(run)
    },
    async listRuns(dealId, assessmentId) {
      return inDeal(dealId, assessmentId)
        ? [...runs.values()].filter((r) => r.assessmentId === assessmentId).map(publicRun)
        : null
    },
    async listAbandonedRuns({ leaseSeconds, limit }) {
      return [...runs.values()]
        .filter((r) => r.status === "RUNNING" && Date.now() - r.touchedMs >= leaseSeconds * 1000)
        .sort((a, b) => a.touchedMs - b.touchedMs)
        .slice(0, limit)
        .map((r) => ({
          runId: r.id,
          dealId: assessments.find((a) => a.id === r.assessmentId)!.dealId,
          assessmentId: r.assessmentId,
          idempotencyKey: r.key,
          attemptCount: r.attemptCount,
          provider: r.provider,
        }))
    },
    async putEvidenceBlob(dealId, assessmentId, evidenceId, { storageKey, sha256, sizeBytes, mimeType }) {
      if (!inDeal(dealId, assessmentId)) return null
      if (!evidence.some((e) => e.id === evidenceId && e.assessmentId === assessmentId)) return null
      const existing = blobs.get(evidenceId)
      if (existing) {
        return existing.sha256 === sha256
          ? { status: "exists_same", meta: { evidenceId, sha256, sizeBytes: existing.sizeBytes, mimeType } }
          : { status: "conflict" }
      }
      blobs.set(evidenceId, freeze({ evidenceId, assessmentId, storageKey, sha256, sizeBytes, mimeType }))
      return { status: "created", meta: { evidenceId, sha256, sizeBytes, mimeType } }
    },
    async getEvidenceBlobLocation(dealId, assessmentId, evidenceId) {
      const b = blobs.get(evidenceId)
      if (!b || b.assessmentId !== assessmentId || !inDeal(dealId, assessmentId)) return null
      return { evidenceId, storageKey: b.storageKey, sha256: b.sha256, sizeBytes: b.sizeBytes, mimeType: b.mimeType }
    },
    async listEvidenceBlobs(dealId, assessmentId) {
      if (!inDeal(dealId, assessmentId)) return null
      return [...blobs.values()]
        .filter((b) => b.assessmentId === assessmentId)
        .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId))
        .map(({ evidenceId, sha256, sizeBytes, mimeType }) => ({ evidenceId, sha256, sizeBytes, mimeType }))
    },
    async getAiUsageSummary(sinceIso) {
      const since = Date.parse(sinceIso)
      const paid = usage.filter((x) => !x.simulated)
      return {
        totalCostMicros: paid.reduce((n, x) => n + x.costMicros, 0),
        sinceCostMicros: paid.filter((x) => x.atMs >= since).reduce((n, x) => n + x.costMicros, 0),
        sinceRuns: paid.filter((x) => x.atMs >= since).length,
      }
    },
    async listProposals(dealId, assessmentId): Promise<ProposalWithReview[] | null> {
      if (!inDeal(dealId, assessmentId)) return null
      return proposals
        .filter((p) => p.assessmentId === assessmentId)
        .map((proposal) => {
          const history = reviews.filter((r) => r.proposalId === proposal.id)
          return { proposal, currentReview: history[history.length - 1] ?? null, reviewHistory: history }
        })
    },
    async recordReview(dealId, assessmentId, proposalId, { expectedRevision, decision, feedback: fb }) {
      if (!inDeal(dealId, assessmentId)) return null
      if (!proposals.some((p) => p.id === proposalId && p.assessmentId === assessmentId)) return null
      const history = reviews.filter((r) => r.proposalId === proposalId)
      if (history.length !== expectedRevision) return { status: "stale_revision" }
      const review = freeze({
        id: nextId("review"),
        proposalId,
        assessmentId,
        revision: expectedRevision + 1,
        disposition: decision.disposition,
        editedStatus: decision.disposition === "EDITED" ? decision.status : null,
        editedObservation: decision.disposition === "EDITED" ? decision.observation : null,
        reason: "reason" in decision ? (decision.reason ?? null) : null,
        reviewerId: decision.reviewerId,
        reviewedAt: decision.reviewedAt,
      })
      reviews.push(review)
      feedback.push(freeze({ ...fb, id: nextId("fb"), kind: "REVIEW" as const }))
      return { status: "ok", review }
    },
    async recordOutcome(dealId, assessmentId, proposalId, { result, source, observedStatus, note, recordedBy, recordedAt }) {
      if (!inDeal(dealId, assessmentId)) return null
      const p = proposals.find((x) => x.id === proposalId && x.assessmentId === assessmentId)
      if (!p) return null
      const history = reviews.filter((r) => r.proposalId === proposalId)
      const latest = history[history.length - 1]
      const entry: FeedbackEntry = freeze({
        id: nextId("fb"),
        kind: "ACTUAL_OUTCOME" as const,
        proposalId,
        assessmentId,
        checkId: p.checkId,
        modelVersion: p.modelVersion,
        original: { status: p.status, observation: p.observation, confidence: p.confidence },
        disposition: latest?.disposition ?? null,
        humanCorrection:
          latest?.disposition === "EDITED" && latest.editedStatus && latest.editedObservation
            ? { status: latest.editedStatus, observation: latest.editedObservation }
            : null,
        reviewerId: recordedBy,
        reviewedAt: recordedAt,
        actualOutcome: { recordedAt, result, source, observedStatus, note },
      })
      feedback.push(entry)
      return entry
    },
    async listRunUsage(dealId, assessmentId) {
      if (!inDeal(dealId, assessmentId)) return null
      const mine = new Set([...runs.values()].filter((r) => r.assessmentId === assessmentId).map((r) => r.id))
      return usage
        .filter((u) => mine.has(u.runId))
        .map(({ atMs, ...u }) => ({ ...u, recordedAt: new Date(atMs).toISOString() }))
    },
    async listFeedback(dealId, assessmentId) {
      return inDeal(dealId, assessmentId) ? feedback.filter((f) => f.assessmentId === assessmentId) : null
    },
  }

  return { repo, rows: { assessments, assets, evidence, proposals, reviews, feedback, blobs, usage } }
}
