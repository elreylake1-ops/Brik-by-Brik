// Saved Deal viewing-assessment contracts (Option 2, task 1).
// Type definitions only. No persistence, API, schema or UI behavior.
// AI output is draft and UNVERIFIED: it may propose findings but never sets review state,
// reviewer identity, costs, or any Investor Shield / finance input. Use `advisoryOnly`
// evidence (see types/investor-shield.ts) if proposals are ever surfaced to the Shield.

export const VIEWING_CHECKLIST_SOURCES = ["45-check inspection", "Viewing supplement"] as const

export type ChecklistItem = {
  id: string // C01-C45 or V01-V13
  group: string
  title: string
  prompt: string
  source: typeof VIEWING_CHECKLIST_SOURCES[number]
}

// Physical-observation status. OBSERVED is not a safety pass.
export const VIEWING_CHECK_STATUSES = [
  "NOT_ASSESSED",
  "OBSERVED",
  "CONCERN",
  "SPECIALIST_REVIEW",
  "NOT_ACCESSIBLE",
  "NOT_APPLICABLE",
] as const

export type ViewingCheckStatus = typeof VIEWING_CHECK_STATUSES[number]

export const VIDEO_CAPTURE_METHODS = ["video-frame-callback", "seeked-canvas", "manual"] as const
export type VideoCaptureMethod = typeof VIDEO_CAPTURE_METHODS[number]
export const VIDEO_CAPTURE_CONFIDENCES = ["presented-frame-confirmed", "seek-timestamp-verified", "manual-user-positioned"] as const
export type VideoCaptureConfidence = typeof VIDEO_CAPTURE_CONFIDENCES[number]

// Subset an AI proposal may suggest; it can never propose "not assessed/accessible/applicable".
export const AI_PROPOSABLE_STATUSES = ["OBSERVED", "CONCERN", "SPECIALIST_REVIEW"] as const

export type AiProposableStatus = typeof AI_PROPOSABLE_STATUSES[number]

export type VideoEvidenceRef = {
  id: string // exact frame/evidence id supplied to the analysis job
  assetId: string
  clipFilename?: string
  timestampSeconds: number // actual media position used for the frame in the ORIGINAL clip
  requestedTimestampSeconds?: number // requested sampler position; absent only on legacy evidence
  captureMethod?: VideoCaptureMethod
  captureConfidence?: VideoCaptureConfidence
  room?: string
}

export type VideoAssetRef = {
  id: string
  durationSeconds: number
}

export type AiConfidence = "low" | "medium" | "high" // model assertion, not a calibrated probability

// Wire format of the existing viewing module (INTEGRATION.md "AI exchange format"), plus model version.
export type AiFindingsEnvelope = {
  kind: "brik-ai-findings"
  version: 1
  assessmentId: string
  modelVersion: string
  findings: readonly unknown[]
}

export type AiFindingInput = {
  checkId: string
  status: "observed" | "concern" | "specialist"
  observation: string
  frameIds: readonly string[]
  room?: string
  confidence: AiConfidence
  suggestedWork?: string
}

export const PROPOSAL_DISPOSITIONS = ["PENDING", "ACCEPTED", "EDITED", "REJECTED"] as const

export type ProposalDisposition = typeof PROPOSAL_DISPOSITIONS[number]

export type DraftAiFinding = {
  id: string
  assessmentId: string
  checkId: string
  status: AiProposableStatus
  observation: string
  evidenceIds: readonly string[]
  room?: string
  confidence: AiConfidence
  suggestedWork?: string
  modelVersion: string
  verification: "UNVERIFIED" // always; only a human review event can change check state
  disposition: "PENDING" // proposals are created pending; review produces a ReviewedFinding
}

export type RejectedProposal = {
  index: number
  checkId?: string
  reason: string
}

export type ProposalValidationResult = {
  proposals: readonly DraftAiFinding[]
  rejected: readonly RejectedProposal[]
}

export type ReviewDecision =
  | { disposition: "ACCEPTED"; reviewerId: string; reviewedAt: string; reason?: string }
  | {
      disposition: "EDITED"
      reviewerId: string
      reviewedAt: string
      status: ViewingCheckStatus
      observation: string
      reason?: string
    }
  | { disposition: "REJECTED"; reviewerId: string; reviewedAt: string; reason: string }

export type ReviewedFinding = Omit<DraftAiFinding, "disposition"> & {
  disposition: Exclude<ProposalDisposition, "PENDING">
  review: ReviewDecision
}

// Links what the model said, what the human decided, and (later) what actually turned out.
export const OUTCOME_RESULTS = ["CONFIRMED", "PARTIALLY_CONFIRMED", "NOT_CONFIRMED", "UNDETERMINED"] as const
export type OutcomeResult = typeof OUTCOME_RESULTS[number]
export const OUTCOME_SOURCES = ["SURVEY", "CONTRACTOR_QUOTE", "WORKS_COMPLETED", "VENDOR_DISCLOSURE", "OTHER"] as const
export type OutcomeSource = typeof OUTCOME_SOURCES[number]

// What really turned out for an AI prediction. Recording one never changes the prediction, the review, or any
// deal figure: it is evidence for evaluating the model, nothing else.
export type ActualOutcome = {
  recordedAt: string
  result: OutcomeResult
  source: OutcomeSource
  observedStatus: ViewingCheckStatus | null // the condition actually found, when known
  note: string
}

export type OutcomeInput = {
  result: OutcomeResult
  source: OutcomeSource
  observedStatus: ViewingCheckStatus | null
  note: string
}

export type ProposalFeedbackRecord = {
  proposalId: string
  assessmentId: string
  checkId: string
  modelVersion: string
  original: { status: AiProposableStatus; observation: string; confidence: AiConfidence }
  disposition: Exclude<ProposalDisposition, "PENDING">
  humanCorrection: { status: ViewingCheckStatus; observation: string } | null
  reviewerId: string
  reviewedAt: string
  actualOutcome: ActualOutcome | null // filled in later (survey, quote, works) as a separate, append-only record
}

export type ViewingAssessment = {
  id: string
  dealId: string
  checklistVersion: string
  createdAt: string
  evidence: readonly VideoEvidenceRef[]
}

export type VideoAnalysisInput = {
  assessmentId: string
  evidence: readonly VideoEvidenceRef[]
}

// Replaceable provider boundary. Mock now; a real server-side provider later.
export type VideoAnalysisService = {
  readonly modelVersion: string
  analyse(input: VideoAnalysisInput): Promise<AiFindingsEnvelope>
}

// ---- Persistence / API shapes (Task 2) ----
// Public shapes never include storage keys or private object paths.

export const ANALYSIS_RUN_STATUSES = ["RUNNING", "READY_FOR_REVIEW", "PARTIAL", "FAILED"] as const

export type AnalysisRunStatus = typeof ANALYSIS_RUN_STATUSES[number]

export type ViewingAssessmentRecord = {
  id: string
  dealId: string
  checklistVersion: string
  createdBy: string
  createdAt: string
}

export type ViewingAssetRecord = {
  id: string
  assessmentId: string
  filename: string
  mimeType: string
  sizeBytes: number
  durationSeconds: number
  contentSha256: string | null
  source: "DECLARED_METADATA" // metadata only: no video binary is stored or analysed in this task
  createdAt: string
}

export type NewViewingAsset = Omit<ViewingAssetRecord, "id" | "assessmentId" | "createdAt" | "source">

// "mock" is the Task 2/3 deterministic service; "fixture" is the Task 4A frame-aware simulated provider;
// "claude" is the live provider, which exists behind a disabled flag and has never been called.
export type AnalysisProviderId = "mock" | "fixture" | "claude"

export type AiOutcome = "OK" | "PARTIAL" | "REFUSAL" | "TIMEOUT" | "MALFORMED" | "PROVIDER_ERROR" | "BUDGET"

// One row per finished analysis attempt. Costs are integer micro-dollars (USD x 1,000,000). Simulated rows
// are free by database constraint and never count toward the paid allowance.
export type AiUsageRecord = {
  provider: "fixture" | "claude"
  modelVersion: string
  promptVersion: string
  frameCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costMicros: number
  simulated: boolean
  outcome: AiOutcome
}

// Public-safe description of a stored frame image. The private storage key is deliberately absent.
export type EvidenceBlobMeta = {
  evidenceId: string
  sha256: string
  sizeBytes: number
  mimeType: "image/jpeg"
}

export type AnalysisRunRecord = {
  id: string
  assessmentId: string
  provider: AnalysisProviderId
  modelVersion: string
  status: AnalysisRunStatus
  attemptCount: number
  proposalsCount: number
  rejectedCount: number
  errorCode: string | null
  createdAt: string
  updatedAt: string
}

export type StoredProposal = DraftAiFinding & { runId: string; createdAt: string }

export type StoredReview = {
  id: string
  proposalId: string
  revision: number
  disposition: Exclude<ProposalDisposition, "PENDING">
  editedStatus: ViewingCheckStatus | null
  editedObservation: string | null
  reason: string | null
  reviewerId: string
  reviewedAt: string
}

export type ProposalWithReview = {
  proposal: StoredProposal // original AI prediction, never rewritten
  currentReview: StoredReview | null // latest human decision, if any
  reviewHistory: readonly StoredReview[]
}

// disposition is the human decision recorded by a REVIEW row, or the latest decision at the time for an
// ACTUAL_OUTCOME row (null when the proposal had not been reviewed yet).
export type FeedbackEntry = Omit<ProposalFeedbackRecord, "disposition"> & {
  id: string
  kind: "REVIEW" | "ACTUAL_OUTCOME"
  disposition: Exclude<ProposalDisposition, "PENDING"> | null
}

export type RunUsageEntry = AiUsageRecord & { runId: string; attempt: number; recordedAt: string }

export type ViewingAssessmentSummary = {
  analysisSource: "NONE" | "SIMULATED" | "LIVE" | "MIXED" // derived from the runs actually made; the UI must label simulated results as such
  proposalCount: number
  awaitingReview: number
  accepted: number
  edited: number
  rejected: number
  evidenceFrameCount: number
  checklistTotal: number
  checksWithoutReviewedFinding: number // checks whose state is still NOT_ASSESSED (see lib/viewing-assessment/check-states.ts)
  specialistChecks: number // checks a human has marked as needing specialist inspection
  checksAwaitingReview: number // checks that have an AI suggestion nobody has reviewed yet
}

export type ViewingAssessmentDetail = {
  blobs: readonly EvidenceBlobMeta[] // which evidence frames have a stored image
  feedback: readonly FeedbackEntry[] // append-only: review decisions and recorded actual outcomes
  assessment: ViewingAssessmentRecord
  assets: readonly ViewingAssetRecord[]
  evidence: readonly VideoEvidenceRef[]
  runs: readonly AnalysisRunRecord[]
  proposals: readonly ProposalWithReview[]
  summary: ViewingAssessmentSummary
}
