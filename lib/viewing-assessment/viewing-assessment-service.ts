import type {
  ProposalWithReview,
  ReviewDecision,
  FeedbackEntry,
  OutcomeInput,
  VideoAnalysisService,
  ViewingAssessmentDetail,
} from "@/types/viewing-assessment"
import { buildCheckStates, summariseChecks } from "./check-states"
import { VIEWING_CHECKLIST_V1 } from "./checklist-v1"
import { buildEvaluationDataset, type AssessmentData, type EvaluationDataset } from "./evaluation/dataset"
import { mockVideoAnalysisService } from "./mock-video-analysis-service"
import type { ReviewBody } from "./request-validation"
import { reviewProposal } from "./review-proposal"
import { ZERO_USAGE, type FrameAnalysisProvider } from "./ai/provider"
import { runProviderAnalysis, type RunAnalysisOutcome } from "./ai/run-analysis"
import type { ViewingAssessmentRepository } from "./viewing-assessment-repository"

// Orchestration only: no finance engine, Investor Shield or evidence-gate imports by design.
// Analysis output can only ever become UNVERIFIED PENDING proposals; only reviewProposalAction writes
// a human decision, and it takes reviewer identity from the caller's server-side principal.

export type { RunAnalysisOutcome } from "./ai/run-analysis"

/**
 * Task 2/3 entry point, kept for its callers and tests: runs a plain VideoAnalysisService (no pixels, no ledger)
 * through the same orchestration as every provider, so the lease, fencing, validation and failure handling
 * are one code path.
 */
export async function runMockAnalysis(
  repo: ViewingAssessmentRepository,
  args: { dealId: string; assessmentId: string; idempotencyKey: string; actor: string; leaseSeconds?: number },
  service: VideoAnalysisService = mockVideoAnalysisService
): Promise<RunAnalysisOutcome> {
  const provider: FrameAnalysisProvider = {
    id: "mock",
    simulated: true,
    modelVersion: service.modelVersion,
    promptVersion: "mock",
    needsImages: false,
    analyse: async ({ assessmentId, frames }) => ({
      kind: "ok",
      usage: ZERO_USAGE,
      // A throw here is an unexpected failure (recorded as ANALYSIS_FAILED), not a typed provider error.
      envelope: await service.analyse({
        assessmentId,
        evidence: frames.map((f) => ({ id: f.id, assetId: "mock", timestampSeconds: f.timestampSeconds, ...(f.room ? { room: f.room } : {}) })),
      }),
    }),
  }
  return runProviderAnalysis(repo, args, { provider, blobStore: null })
}

export type ReviewOutcome =
  | { status: "not_found" }
  | { status: "stale_revision" }
  | { status: "ok"; item: ProposalWithReview }

export async function reviewProposalAction(
  repo: ViewingAssessmentRepository,
  args: {
    dealId: string
    assessmentId: string
    proposalId: string
    body: ReviewBody
    reviewerId: string
    now?: Date
  }
): Promise<ReviewOutcome> {
  const { dealId, assessmentId, proposalId, body, reviewerId } = args
  const items = await repo.listProposals(dealId, assessmentId)
  const target = items?.find((i) => i.proposal.id === proposalId)
  if (!target) return { status: "not_found" }

  const reviewedAt = (args.now ?? new Date()).toISOString()
  const reason = "reason" in body && body.reason ? { reason: body.reason } : {}
  const decision: ReviewDecision =
    body.disposition === "EDITED"
      ? {
          disposition: "EDITED",
          reviewerId,
          reviewedAt,
          status: body.status,
          observation: body.observation,
          ...reason,
        }
      : body.disposition === "REJECTED"
        ? { disposition: "REJECTED", reviewerId, reviewedAt, reason: body.reason }
        : { disposition: "ACCEPTED", reviewerId, reviewedAt, ...reason }

  // Reuses the Task 1 pure function to validate the decision and build the feedback record.
  const { feedback } = reviewProposal(target.proposal, decision)
  const result = await repo.recordReview(dealId, assessmentId, proposalId, {
    expectedRevision: body.expectedRevision,
    decision,
    feedback,
  })
  if (!result) return { status: "not_found" }
  if (result.status === "stale_revision") return { status: "stale_revision" }

  return {
    status: "ok",
    item: {
      proposal: target.proposal,
      currentReview: result.review,
      reviewHistory: [...target.reviewHistory, result.review],
    },
  }
}

export async function loadAssessmentDetail(
  repo: ViewingAssessmentRepository,
  dealId: string,
  assessmentId: string
): Promise<ViewingAssessmentDetail | null> {
  const assessment = await repo.getAssessment(dealId, assessmentId)
  if (!assessment) return null
  const [assets, context, runs, proposals, blobs, feedback] = await Promise.all([
    repo.listAssets(dealId, assessmentId),
    repo.getEvidenceContext(dealId, assessmentId),
    repo.listRuns(dealId, assessmentId),
    repo.listProposals(dealId, assessmentId),
    repo.listEvidenceBlobs(dealId, assessmentId),
    repo.listFeedback(dealId, assessmentId),
  ])
  if (!assets || !context || !runs || !proposals || !blobs || !feedback) return null

  const dispositionOf = (p: ProposalWithReview) => p.currentReview?.disposition
  // One definition of per-check state, shared with the review UI.
  const states = buildCheckStates(VIEWING_CHECKLIST_V1.map((c) => c.id), proposals)
  const checks = summariseChecks(states)
  const providers = new Set(runs.map((r) => (r.provider === "claude" ? "LIVE" : "SIMULATED")))
  return {
    assessment,
    assets,
    evidence: context.evidence,
    blobs,
    feedback,
    runs,
    proposals,
    summary: {
      analysisSource: providers.size === 0 ? "NONE" : providers.size > 1 ? "MIXED" : (providers.values().next().value as "LIVE" | "SIMULATED"),
      proposalCount: proposals.length,
      awaitingReview: proposals.filter((p) => !p.currentReview).length,
      accepted: proposals.filter((p) => dispositionOf(p) === "ACCEPTED").length,
      edited: proposals.filter((p) => dispositionOf(p) === "EDITED").length,
      rejected: proposals.filter((p) => dispositionOf(p) === "REJECTED").length,
      evidenceFrameCount: context.evidence.length,
      checklistTotal: VIEWING_CHECKLIST_V1.length,
      checksWithoutReviewedFinding: checks.notAssessed,
      specialistChecks: checks.specialist,
      checksAwaitingReview: checks.awaitingReview,
    },
  }
}

export type OutcomeResultOutcome = { status: "not_found" } | { status: "ok"; entry: FeedbackEntry }

/** Appends what actually turned out. Never changes the prediction, the reviews, or anything financial. */
export async function recordOutcomeAction(
  repo: ViewingAssessmentRepository,
  args: { dealId: string; assessmentId: string; proposalId: string; input: OutcomeInput; recordedBy: string; now?: Date }
): Promise<OutcomeResultOutcome> {
  const recordedAt = (args.now ?? new Date()).toISOString() // the application clock, same source as review times
  const entry = await repo.recordOutcome(args.dealId, args.assessmentId, args.proposalId, { ...args.input, recordedBy: args.recordedBy, recordedAt })
  return entry ? { status: "ok", entry } : { status: "not_found" }
}

/**
 * Builds the structured evaluation dataset for one deal. Read-only. Simulated predictions are excluded unless asked
 * for, and no identities, storage keys or image bytes are included (see evaluation/dataset.ts).
 */
export async function exportEvaluationDataset(
  repo: ViewingAssessmentRepository,
  args: { dealId: string; includeSimulated: boolean; now?: Date }
): Promise<EvaluationDataset> {
  const assessments = await repo.listAssessments(args.dealId)
  const data: AssessmentData[] = []
  for (const assessment of assessments) {
    const [context, runs, proposals, blobs, feedback, usage] = await Promise.all([
      repo.getEvidenceContext(args.dealId, assessment.id),
      repo.listRuns(args.dealId, assessment.id),
      repo.listProposals(args.dealId, assessment.id),
      repo.listEvidenceBlobs(args.dealId, assessment.id),
      repo.listFeedback(args.dealId, assessment.id),
      repo.listRunUsage(args.dealId, assessment.id),
    ])
    if (!context || !runs || !proposals || !blobs || !feedback || !usage) continue
    data.push({ assessment, proposals, runs, evidence: context.evidence, blobs, feedback, usage })
  }
  return buildEvaluationDataset({ dealId: args.dealId, assessments: data, includeSimulated: args.includeSimulated, generatedAt: args.now ?? new Date() })
}
