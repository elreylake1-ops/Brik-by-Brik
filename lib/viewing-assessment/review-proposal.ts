import type {
  DraftAiFinding,
  ProposalFeedbackRecord,
  ReviewDecision,
  ReviewedFinding,
} from "@/types/viewing-assessment"

// Pure: applies a human review decision to a draft proposal and emits the feedback record.
// Reviewer identity comes from the caller (authenticated server side later), never from AI output.
// The original prediction is preserved; an edit is stored as a correction beside it.

export function reviewProposal(
  finding: DraftAiFinding,
  decision: ReviewDecision
): { finding: ReviewedFinding; feedback: ProposalFeedbackRecord } {
  if (!decision.reviewerId.trim() || Number.isNaN(Date.parse(decision.reviewedAt))) {
    throw new Error("Review requires reviewerId and a valid reviewedAt")
  }
  if (decision.disposition === "REJECTED" && !decision.reason.trim()) {
    throw new Error("Rejection requires a reason")
  }
  if (decision.disposition === "EDITED" && !decision.observation.trim()) {
    throw new Error("Edit requires an observation")
  }

  return {
    finding: { ...finding, disposition: decision.disposition, review: decision },
    feedback: {
      proposalId: finding.id,
      assessmentId: finding.assessmentId,
      checkId: finding.checkId,
      modelVersion: finding.modelVersion,
      original: {
        status: finding.status,
        observation: finding.observation,
        confidence: finding.confidence,
      },
      disposition: decision.disposition,
      humanCorrection:
        decision.disposition === "EDITED"
          ? { status: decision.status, observation: decision.observation.trim() }
          : null,
      reviewerId: decision.reviewerId,
      reviewedAt: decision.reviewedAt,
      actualOutcome: null,
    },
  }
}
