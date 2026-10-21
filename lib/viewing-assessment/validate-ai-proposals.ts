import type {
  AiConfidence,
  AiFindingInput,
  AiProposableStatus,
  DraftAiFinding,
  ProposalValidationResult,
  RejectedProposal,
  VideoAssetRef,
  VideoEvidenceRef,
} from "@/types/viewing-assessment"
import { VIEWING_CHECKLIST_IDS } from "./checklist-v1"

// Pure adapter: untrusted AI envelope -> validated, UNVERIFIED, PENDING draft proposals.
// Trust comes only from the supplied context (assessment id, real evidence refs, known checklist IDs).
// Anything else in the payload (reviewed flags, reviewer ids, costs, quantities) is ignored.

export const MAX_FINDINGS = 200
export const MAX_FRAMES_PER_FINDING = 10
const MAX_OBSERVATION = 1000
const MAX_SHORT_TEXT = 500

const STATUS_MAP: Record<AiFindingInput["status"], AiProposableStatus> = {
  observed: "OBSERVED",
  concern: "CONCERN",
  specialist: "SPECIALIST_REVIEW",
}
const CONFIDENCES: readonly AiConfidence[] = ["low", "medium", "high"]

export type ProposalValidationContext = {
  assessmentId: string
  evidence: readonly VideoEvidenceRef[]
  assets?: readonly VideoAssetRef[] // when given, evidence timestamps must fall inside the clip
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase()

function optionalText(value: unknown, max: number): string | undefined | null {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string" || value.length > max) return null
  return value.trim() || undefined
}

function envelopeFailure(reason: string): ProposalValidationResult {
  return { proposals: [], rejected: [{ index: -1, reason }] }
}

export function validateAiProposals(
  envelope: unknown,
  context: ProposalValidationContext
): ProposalValidationResult {
  if (!isRecord(envelope) || envelope.kind !== "brik-ai-findings" || envelope.version !== 1) {
    return envelopeFailure("Unsupported envelope kind or version")
  }
  if (envelope.assessmentId !== context.assessmentId) {
    return envelopeFailure("Envelope assessmentId does not match this assessment")
  }
  if (typeof envelope.modelVersion !== "string" || !envelope.modelVersion.trim()) {
    return envelopeFailure("Missing modelVersion")
  }
  if (!Array.isArray(envelope.findings) || envelope.findings.length > MAX_FINDINGS) {
    return envelopeFailure(`findings must be an array of at most ${MAX_FINDINGS}`)
  }

  const modelVersion = envelope.modelVersion.trim()
  const assetDuration = new Map((context.assets ?? []).map((a) => [a.id, a.durationSeconds]))
  const evidenceById = new Map(context.evidence.map((e) => [e.id, e]))
  const isRealEvidence = (e: VideoEvidenceRef | undefined): boolean => {
    if (!e || !Number.isFinite(e.timestampSeconds) || e.timestampSeconds < 0) return false
    if (context.assets === undefined) return true
    const duration = assetDuration.get(e.assetId)
    return duration !== undefined && e.timestampSeconds <= duration
  }

  const proposals: DraftAiFinding[] = []
  const rejected: RejectedProposal[] = []
  const seen = new Map<string, number>() // dedupe key -> index in proposals

  envelope.findings.forEach((raw, index) => {
    const reject = (reason: string, checkId?: unknown) => {
      rejected.push({ index, reason, ...(typeof checkId === "string" ? { checkId } : {}) })
    }

    if (!isRecord(raw)) return reject("Finding is not an object")
    const { checkId } = raw
    if (typeof checkId !== "string" || !VIEWING_CHECKLIST_IDS.has(checkId)) {
      return reject("Unknown checklist ID", checkId)
    }
    if (typeof raw.status !== "string" || !Object.hasOwn(STATUS_MAP, raw.status)) {
      return reject("Unsupported status", checkId)
    }
    const status = STATUS_MAP[raw.status as AiFindingInput["status"]]
    if (
      typeof raw.observation !== "string" ||
      !raw.observation.trim() ||
      raw.observation.length > MAX_OBSERVATION
    ) {
      return reject("Observation missing or too long", checkId)
    }
    if (!CONFIDENCES.includes(raw.confidence as AiConfidence)) {
      return reject("Unsupported confidence", checkId)
    }
    if (
      !Array.isArray(raw.frameIds) ||
      raw.frameIds.length === 0 ||
      raw.frameIds.length > MAX_FRAMES_PER_FINDING ||
      !raw.frameIds.every((id) => typeof id === "string")
    ) {
      return reject(`frameIds must be 1-${MAX_FRAMES_PER_FINDING} strings`, checkId)
    }
    const frameIds = [...new Set(raw.frameIds as string[])]
    if (!frameIds.every((id) => isRealEvidence(evidenceById.get(id)))) {
      return reject("Unknown or invalid evidence reference", checkId)
    }
    const room = optionalText(raw.room, 100)
    const suggestedWork = optionalText(raw.suggestedWork, MAX_SHORT_TEXT)
    if (room === null || suggestedWork === null) {
      return reject("Optional text invalid or too long", checkId)
    }

    const observation = raw.observation.trim()
    const key = `${checkId}|${status}|${normalize(observation)}`
    const existing = seen.get(key)
    if (existing !== undefined) {
      // Duplicate across frames/batches: keep one proposal, retain every source.
      const prior = proposals[existing]
      proposals[existing] = {
        ...prior,
        evidenceIds: [...new Set([...prior.evidenceIds, ...frameIds])],
      }
      return
    }

    seen.set(key, proposals.length)
    proposals.push({
      id: `${context.assessmentId}:P${proposals.length + 1}`,
      assessmentId: context.assessmentId,
      checkId,
      status,
      observation,
      evidenceIds: frameIds,
      ...(room ? { room } : {}),
      confidence: raw.confidence as AiConfidence,
      ...(suggestedWork ? { suggestedWork } : {}),
      modelVersion,
      verification: "UNVERIFIED",
      disposition: "PENDING",
    })
  })

  return { proposals, rejected }
}
