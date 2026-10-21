import type {
  AnalysisRunRecord,
  FeedbackEntry,
  EvidenceBlobMeta,
  OutcomeResult,
  OutcomeSource,
  ProposalWithReview,
  RunUsageEntry,
  VideoEvidenceRef,
  ViewingAssessmentRecord,
  ViewingCheckStatus,
} from "@/types/viewing-assessment"

// Structured evaluation dataset: one record per AI prediction, joining what the model said (and with which model and
// prompt version, on which exact frames), what the human decided and corrected, and what actually turned out.
// It is built from append-only records and is read-only: exporting never changes anything, and nothing here trains
// or updates a model.
//
// Privacy and safety choices (deliberate):
//  - no reviewer or operator identities, no storage keys or paths, no image bytes (frames are referenced by id, time
//    and checksum only);
//  - simulated (fixture) predictions are excluded unless explicitly requested, so test data cannot contaminate an
//    evaluation of a real model;
//  - the two labels are kept separate: what the human DECIDED, and what ACTUALLY happened. They are never merged.

export const EVALUATION_DATASET_VERSION = "viewing-eval-dataset-v1"

export type HumanLabel = "UNREVIEWED" | "HUMAN_AGREES" | "HUMAN_CORRECTED" | "HUMAN_REJECTED"
export type OutcomeLabel = "NO_OUTCOME" | "TRUE_POSITIVE" | "PARTIAL" | "FALSE_POSITIVE" | "UNKNOWN"

export type EvaluationRecord = {
  recordId: string // the proposal id
  assessmentId: string
  checkId: string
  simulated: boolean
  run: { runId: string; provider: string; modelVersion: string; promptVersion: string | null; attempt: number | null }
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    costMicros: number
    costBasis: "provider_reported_usage" | "simulated_free"
  } | null
  prediction: { status: ViewingCheckStatus; observation: string; confidence: string; suggestedWork: string | null }
  evidence: { evidenceId: string; timestampSeconds: number | null; room: string | null; clipFilename: string | null; imageSha256: string | null }[]
  humanReview: {
    label: HumanLabel
    revisions: { revision: number; disposition: string; status: ViewingCheckStatus | null; observation: string | null; reason: string | null; reviewedAt: string }[]
  }
  outcomes: { recordedAt: string; result: OutcomeResult; source: OutcomeSource; observedStatus: ViewingCheckStatus | null; note: string }[]
  outcomeLabel: OutcomeLabel
}

export type EvaluationDataset = {
  datasetVersion: typeof EVALUATION_DATASET_VERSION
  generatedAt: string
  scope: { dealId: string; includeSimulated: boolean }
  excludedSimulated: number
  records: EvaluationRecord[]
  summary: {
    records: number
    byHumanLabel: Record<HumanLabel, number>
    byOutcomeLabel: Record<OutcomeLabel, number>
    byProvider: Record<string, number>
  }
}

export type AssessmentData = {
  assessment: ViewingAssessmentRecord
  proposals: readonly ProposalWithReview[]
  runs: readonly AnalysisRunRecord[]
  evidence: readonly VideoEvidenceRef[]
  blobs: readonly EvidenceBlobMeta[]
  feedback: readonly FeedbackEntry[]
  usage: readonly RunUsageEntry[]
}

const humanLabelOf = (item: ProposalWithReview): HumanLabel => {
  switch (item.currentReview?.disposition) {
    case "ACCEPTED":
      return "HUMAN_AGREES"
    case "EDITED":
      return "HUMAN_CORRECTED"
    case "REJECTED":
      return "HUMAN_REJECTED"
    default:
      return "UNREVIEWED"
  }
}

const outcomeLabelOf = (outcomes: EvaluationRecord["outcomes"]): OutcomeLabel => {
  const latest = outcomes[outcomes.length - 1]
  if (!latest) return "NO_OUTCOME"
  switch (latest.result) {
    case "CONFIRMED":
      return "TRUE_POSITIVE"
    case "PARTIALLY_CONFIRMED":
      return "PARTIAL"
    case "NOT_CONFIRMED":
      return "FALSE_POSITIVE"
    default:
      return "UNKNOWN"
  }
}

export function buildEvaluationDataset(args: {
  dealId: string
  assessments: readonly AssessmentData[]
  includeSimulated: boolean
  generatedAt: Date
}): EvaluationDataset {
  const records: EvaluationRecord[] = []
  let excludedSimulated = 0

  for (const data of args.assessments) {
    const runById = new Map(data.runs.map((r) => [r.id, r]))
    const evidenceById = new Map(data.evidence.map((e) => [e.id, e]))
    const shaByEvidence = new Map(data.blobs.map((b) => [b.evidenceId, b.sha256]))
    // the usage row of the attempt that produced the stored result
    const usageByRun = new Map<string, RunUsageEntry>()
    for (const u of data.usage) {
      const current = usageByRun.get(u.runId)
      if (!current || u.attempt >= current.attempt) usageByRun.set(u.runId, u)
    }

    for (const item of data.proposals) {
      const run = runById.get(item.proposal.runId)
      const usage = usageByRun.get(item.proposal.runId)
      const provider = run?.provider ?? "unknown"
      // mock/fixture providers produce made-up findings; a live provider is the only non-simulated source
      const simulated = provider !== "claude"
      if (simulated && !args.includeSimulated) {
        excludedSimulated++
        continue
      }

      const outcomes = data.feedback
        .filter((f) => f.kind === "ACTUAL_OUTCOME" && f.proposalId === item.proposal.id && f.actualOutcome)
        .map((f) => ({
          recordedAt: f.actualOutcome!.recordedAt,
          result: f.actualOutcome!.result,
          source: f.actualOutcome!.source,
          observedStatus: f.actualOutcome!.observedStatus,
          note: f.actualOutcome!.note,
        }))
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))

      records.push({
        recordId: item.proposal.id,
        assessmentId: data.assessment.id,
        checkId: item.proposal.checkId,
        simulated,
        run: {
          runId: item.proposal.runId,
          provider,
          modelVersion: item.proposal.modelVersion,
          promptVersion: usage?.promptVersion ?? null,
          attempt: usage?.attempt ?? run?.attemptCount ?? null,
        },
        usage: usage
          ? {
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              cacheReadTokens: usage.cacheReadTokens,
              cacheWriteTokens: usage.cacheWriteTokens,
              costMicros: usage.costMicros,
              costBasis: usage.simulated ? "simulated_free" : "provider_reported_usage",
            }
          : null,
        prediction: {
          status: item.proposal.status,
          observation: item.proposal.observation,
          confidence: item.proposal.confidence,
          suggestedWork: item.proposal.suggestedWork ?? null,
        },
        evidence: item.proposal.evidenceIds.map((id) => {
          const e = evidenceById.get(id)
          return { evidenceId: id, timestampSeconds: e?.timestampSeconds ?? null, room: e?.room ?? null, clipFilename: e?.clipFilename ?? null, imageSha256: shaByEvidence.get(id) ?? null }
        }),
        humanReview: {
          label: humanLabelOf(item),
          revisions: item.reviewHistory.map((r) => ({
            revision: r.revision,
            disposition: r.disposition,
            status: r.editedStatus,
            observation: r.editedObservation,
            reason: r.reason,
            reviewedAt: r.reviewedAt,
          })),
        },
        outcomes,
        outcomeLabel: outcomeLabelOf(outcomes),
      })
    }
  }

  const count = <K extends string>(keys: readonly K[], pick: (r: EvaluationRecord) => K) =>
    Object.fromEntries(keys.map((k) => [k, records.filter((r) => pick(r) === k).length])) as Record<K, number>
  const providers: Record<string, number> = {}
  for (const r of records) providers[r.run.provider] = (providers[r.run.provider] ?? 0) + 1

  return {
    datasetVersion: EVALUATION_DATASET_VERSION,
    generatedAt: args.generatedAt.toISOString(),
    scope: { dealId: args.dealId, includeSimulated: args.includeSimulated },
    excludedSimulated,
    records,
    summary: {
      records: records.length,
      byHumanLabel: count(["UNREVIEWED", "HUMAN_AGREES", "HUMAN_CORRECTED", "HUMAN_REJECTED"], (r) => r.humanReview.label),
      byOutcomeLabel: count(["NO_OUTCOME", "TRUE_POSITIVE", "PARTIAL", "FALSE_POSITIVE", "UNKNOWN"], (r) => r.outcomeLabel),
      byProvider: providers,
    },
  }
}
