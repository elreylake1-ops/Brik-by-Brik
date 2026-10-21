import type {
  AiUsageRecord,
  AnalysisProviderId,
  AnalysisRunRecord,
  AnalysisRunStatus,
  DraftAiFinding,
  EvidenceBlobMeta,
  FeedbackEntry,
  NewViewingAsset,
  OutcomeInput,
  ProposalFeedbackRecord,
  ProposalWithReview,
  ReviewDecision,
  RunUsageEntry,
  StoredReview,
  VideoAssetRef,
  VideoCaptureConfidence,
  VideoCaptureMethod,
  VideoEvidenceRef,
  ViewingAssessmentRecord,
  ViewingAssetRecord,
} from "@/types/viewing-assessment"

// Storage boundary. Every method is scoped by dealId, so an assessment id from another deal
// resolves to null/"not found" rather than leaking. The pg implementation and the in-memory test
// double must both honour: deal scoping, idempotency, append-only reviews/feedback.

// Processing lease: a RUNNING run not touched for RUN_LEASE_SECONDS is considered abandoned and may be
// reclaimed (attempt_count + 1). After MAX_RUN_ATTEMPTS the run is parked as FAILED/MAX_ATTEMPTS_EXCEEDED
// and needs a new idempotency key (a deliberate human re-analysis). Analysis here is instant (mock), so
// there is no heartbeat; a real provider must refresh updated_at while it works or use a longer lease.
export const RUN_LEASE_SECONDS = 300
export const MAX_RUN_ATTEMPTS = 3

// Thrown by completeRun when the caller no longer owns the run (reclaimed by a newer attempt, or already
// finished). The caller must discard its work; nothing was written.
export class RunLeaseLostError extends Error {
  constructor() {
    super("Analysis run lease lost")
    this.name = "RunLeaseLostError"
  }
}

export type EvidenceContext = {
  assets: readonly VideoAssetRef[]
  evidence: readonly VideoEvidenceRef[]
}

export type AddAssetResult =
  | { status: "ok"; asset: ViewingAssetRecord; evidence: readonly VideoEvidenceRef[] }
  | { status: "duplicate_asset" }

export type PutBlobResult =
  | { status: "created"; meta: EvidenceBlobMeta }
  | { status: "exists_same"; meta: EvidenceBlobMeta } // identical bytes already stored: idempotent replay
  | { status: "conflict" } // a DIFFERENT image is already stored for this frame; frames are immutable

// Internal only: includes the private storage key. Never serialise this to a client.
export type EvidenceBlobLocation = EvidenceBlobMeta & { storageKey: string }

export type AbandonedRun = {
  runId: string
  dealId: string
  assessmentId: string
  idempotencyKey: string
  attemptCount: number
  provider: AnalysisProviderId
}

export type AiUsageSummary = {
  totalCostMicros: number // all paid (non-simulated) usage ever recorded
  sinceCostMicros: number // paid usage since the given instant
  sinceRuns: number // paid analysis attempts since the given instant
}

export type RecordReviewResult =
  | { status: "ok"; review: StoredReview }
  | { status: "stale_revision" }

export type ViewingAssessmentRepository = {
  createAssessment(input: {
    dealId: string
    idempotencyKey: string
    checklistVersion: string
    createdBy: string
  }): Promise<{ record: ViewingAssessmentRecord; created: boolean }>
  listAssessments(dealId: string): Promise<ViewingAssessmentRecord[]>
  getAssessment(dealId: string, assessmentId: string): Promise<ViewingAssessmentRecord | null>

  addAsset(
    dealId: string,
    assessmentId: string,
    input: { asset: NewViewingAsset; frames: readonly { timestampSeconds: number; requestedTimestampSeconds?: number; captureMethod?: VideoCaptureMethod; captureConfidence?: VideoCaptureConfidence; room?: string }[]; createdBy: string }
  ): Promise<AddAssetResult | null>
  listAssets(dealId: string, assessmentId: string): Promise<ViewingAssetRecord[] | null>
  getEvidenceContext(dealId: string, assessmentId: string): Promise<EvidenceContext | null>

  // Returns the existing run for a replayed key (created:false). A FAILED run, or a RUNNING run whose lease
  // expired, is re-opened with attemptCount + 1 (created:true) while attemptCount < MAX_RUN_ATTEMPTS.
  // A stale run out of attempts is parked FAILED (MAX_ATTEMPTS_EXCEEDED) and returned with created:false.
  startRun(
    dealId: string,
    assessmentId: string,
    input: {
      idempotencyKey: string
      modelVersion: string
      createdBy: string
      leaseSeconds?: number
      provider?: AnalysisProviderId // defaults to "mock"
    }
  ): Promise<{ run: AnalysisRunRecord; created: boolean } | null>
  // Persists proposals and the final status atomically, only if the run is still RUNNING at `attempt`
  // (fencing token). Otherwise throws RunLeaseLostError and writes nothing.
  completeRun(
    runId: string,
    input: {
      attempt: number
      status: AnalysisRunStatus
      proposals: readonly DraftAiFinding[]
      rejectedCount: number
      errorCode?: string
      usage?: AiUsageRecord // appended to the ledger in the SAME transaction as the run result
    }
  ): Promise<AnalysisRunRecord>
  listRuns(dealId: string, assessmentId: string): Promise<AnalysisRunRecord[] | null>
  // RUNNING runs whose lease expired, oldest first, for an out-of-band worker to re-drive via startRun.
  listAbandonedRuns(input: { leaseSeconds: number; limit: number }): Promise<AbandonedRun[]>

  // Frame images. Rows are immutable; bytes live in the private blob store, referenced by an internal key.
  putEvidenceBlob(
    dealId: string,
    assessmentId: string,
    evidenceId: string,
    input: { storageKey: string; sha256: string; sizeBytes: number; mimeType: "image/jpeg"; createdBy: string }
  ): Promise<PutBlobResult | null>
  getEvidenceBlobLocation(dealId: string, assessmentId: string, evidenceId: string): Promise<EvidenceBlobLocation | null>
  listEvidenceBlobs(dealId: string, assessmentId: string): Promise<EvidenceBlobMeta[] | null>

  // Paid-usage accounting for the budget guard (simulated rows are excluded).
  getAiUsageSummary(sinceIso: string): Promise<AiUsageSummary>

  listProposals(dealId: string, assessmentId: string): Promise<ProposalWithReview[] | null>
  // Appends revision expectedRevision+1 and its feedback row atomically. Never edits earlier rows.
  recordReview(
    dealId: string,
    assessmentId: string,
    proposalId: string,
    input: { expectedRevision: number; decision: ReviewDecision; feedback: ProposalFeedbackRecord }
  ): Promise<RecordReviewResult | null>
  listFeedback(dealId: string, assessmentId: string): Promise<FeedbackEntry[] | null>
  // Appends what actually turned out for a prediction. Snapshots the original prediction and the latest human
  // decision/correction at that moment, so the three can be compared later. Never edits an earlier row, never
  // touches the proposal, its reviews, or anything financial. Null when the proposal is not in this deal/assessment.
  recordOutcome(
    dealId: string,
    assessmentId: string,
    proposalId: string,
    input: OutcomeInput & { recordedBy: string; recordedAt: string } // recordedAt: the application clock, like reviewedAt, so history sorts consistently
  ): Promise<FeedbackEntry | null>
  // Usage accounting rows (tokens, cost, prompt version) for an assessment's analysis attempts.
  listRunUsage(dealId: string, assessmentId: string): Promise<RunUsageEntry[] | null>
}
