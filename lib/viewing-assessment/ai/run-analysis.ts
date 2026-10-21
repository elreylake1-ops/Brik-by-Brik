import type { AiOutcome, AiUsageRecord, AnalysisRunRecord, DraftAiFinding } from "@/types/viewing-assessment"
import type { PrivateBlobStore } from "../storage/blob-store"
import { sha256Hex } from "../storage/local-fs-blob-store"
import { validateAiProposals } from "../validate-ai-proposals"
import { RUN_LEASE_SECONDS, RunLeaseLostError, type ViewingAssessmentRepository } from "../viewing-assessment-repository"
import { DEFAULT_LIMITS, checkBudget, startOfUtcDay } from "./budget"
import { UnknownModelPriceError, costMicros, worstCaseCostMicros } from "./pricing"
import { ZERO_USAGE, type AnalysisLimits, type FrameAnalysisProvider, type FrameForAnalysis, type ProviderOutcome, type ProviderUsage } from "./provider"

// Orchestrates one analysis run end to end. Trust boundaries, in order:
//   1. startRun         idempotent + leased; a replay returns the stored run, never re-calls the provider
//   2. limits + budget  checked BEFORE any frame is loaded or anything is sent (paid providers only)
//   3. frames           read from private storage and re-verified against their recorded checksum
//   4. provider         hard deadline; whatever it returns is untrusted
//   5. validation       validateAiProposals: known checklist ids, real submitted frame ids, enum checks, dedupe
//   6. completeRun      fenced by attempt number; the usage ledger row is written in the same transaction
// Nothing here imports finance, Investor Shield or governance code, and proposals are always UNVERIFIED/PENDING.

export type RunAnalysisOutcome =
  | { status: "not_found" }
  | { status: "no_evidence" }
  | { status: "in_progress"; run: AnalysisRunRecord }
  | { status: "lease_lost" } // another attempt reclaimed this run; this attempt's work was discarded
  | { status: "ok"; run: AnalysisRunRecord; replayed: boolean }

export type AnalysisDeps = {
  provider: FrameAnalysisProvider
  blobStore: PrivateBlobStore | null
  limits?: AnalysisLimits
  now?: () => Date
}

export type RunAnalysisArgs = {
  dealId: string
  assessmentId: string
  idempotencyKey: string
  actor: string
  leaseSeconds?: number
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

/** Resolves with a timeout outcome after `ms` even if the provider never looks at its abort signal. */
async function withDeadline(
  run: (signal: AbortSignal) => Promise<ProviderOutcome>,
  ms: number
): Promise<ProviderOutcome> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<ProviderOutcome>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve({ kind: "timeout" })
    }, ms)
  })
  try {
    return await Promise.race([run(controller.signal), deadline])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function runProviderAnalysis(
  repo: ViewingAssessmentRepository,
  args: RunAnalysisArgs,
  deps: AnalysisDeps
): Promise<RunAnalysisOutcome> {
  const { dealId, assessmentId, idempotencyKey, actor, leaseSeconds } = args
  const { provider } = deps
  const limits = deps.limits ?? DEFAULT_LIMITS
  const now = deps.now ?? (() => new Date())

  const context = await repo.getEvidenceContext(dealId, assessmentId)
  if (!context) return { status: "not_found" }
  if (context.evidence.length === 0) return { status: "no_evidence" }

  const started = await repo.startRun(dealId, assessmentId, {
    idempotencyKey,
    modelVersion: provider.modelVersion,
    createdBy: actor,
    provider: provider.id,
    ...(leaseSeconds === undefined ? {} : { leaseSeconds }),
  })
  if (!started) return { status: "not_found" }
  if (!started.created) {
    return started.run.status === "RUNNING"
      ? { status: "in_progress", run: started.run }
      : { status: "ok", run: started.run, replayed: true }
  }

  const { run } = started
  const frameCount = context.evidence.length
  const ledger = provider.id !== "mock" // the legacy deterministic service predates the ledger

  const usageRecord = (outcome: AiOutcome, usage: ProviderUsage, cost: number): AiUsageRecord | undefined =>
    ledger
      ? {
          provider: provider.id as "fixture" | "claude",
          modelVersion: provider.modelVersion,
          promptVersion: provider.promptVersion,
          frameCount,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          costMicros: provider.simulated ? 0 : cost,
          simulated: provider.simulated,
          outcome,
        }
      : undefined

  const finish = async (
    status: AnalysisRunRecord["status"],
    extra: { proposals?: DraftAiFinding[]; rejectedCount?: number; errorCode?: string; usage?: AiUsageRecord } = {}
  ): Promise<RunAnalysisOutcome> => ({
    status: "ok",
    replayed: false,
    run: await repo.completeRun(run.id, {
      attempt: run.attemptCount,
      status,
      proposals: extra.proposals ?? [],
      rejectedCount: extra.rejectedCount ?? 0,
      ...(extra.errorCode ? { errorCode: extra.errorCode } : {}),
      ...(extra.usage ? { usage: extra.usage } : {}),
    }),
  })

  try {
    // 2. limits and budget: before frames are loaded or anything is sent
    if (frameCount > limits.maxFrames) return await finish("FAILED", { errorCode: "TOO_MANY_FRAMES" })

    let worstCase = 0
    if (!provider.simulated) {
      try {
        worstCase = worstCaseCostMicros(provider.modelVersion, frameCount, limits)
      } catch (error) {
        if (error instanceof UnknownModelPriceError) return await finish("FAILED", { errorCode: "UNPRICED_MODEL" })
        throw error
      }
      const spend = await repo.getAiUsageSummary(startOfUtcDay(now()))
      const decision = checkBudget({ spentMicros: spend.totalCostMicros, worstCaseMicros: worstCase, runsToday: spend.sinceRuns })
      if (!decision.allowed) {
        return await finish("FAILED", { errorCode: `BUDGET_${decision.reason}`, usage: usageRecord("BUDGET", ZERO_USAGE, 0) })
      }
    }

    // 3. frames from private storage, re-verified against the recorded checksum
    const frames: FrameForAnalysis[] = []
    for (const e of context.evidence) {
      let jpeg: Uint8Array | null = null
      if (provider.needsImages) {
        if (!deps.blobStore) return await finish("FAILED", { errorCode: "STORAGE_UNAVAILABLE" })
        const location = await repo.getEvidenceBlobLocation(dealId, assessmentId, e.id)
        if (!location) return await finish("FAILED", { errorCode: "FRAME_IMAGE_MISSING" })
        jpeg = await deps.blobStore.get(location.storageKey)
        if (!jpeg || sha256Hex(jpeg) !== location.sha256) return await finish("FAILED", { errorCode: "FRAME_IMAGE_UNAVAILABLE" })
      }
      frames.push({ id: e.id, timestampSeconds: e.timestampSeconds, ...(e.room ? { room: e.room } : {}), jpeg })
    }

    // 4. provider call under a hard deadline
    const outcome = await withDeadline((signal) => provider.analyse({ assessmentId, frames, limits, signal }), limits.timeoutMs)

    // 5/6. map the untrusted outcome to a stored result
    switch (outcome.kind) {
      case "refusal":
        return await finish("FAILED", { errorCode: "PROVIDER_REFUSAL", usage: usageRecord("REFUSAL", outcome.usage, safeCost(provider, outcome.usage)) })
      case "timeout":
        // Billing for an aborted request is unknown: account for the worst case rather than assume it was free.
        return await finish("FAILED", { errorCode: "PROVIDER_TIMEOUT", usage: usageRecord("TIMEOUT", ZERO_USAGE, worstCase) })
      case "malformed":
        return await finish("FAILED", { errorCode: "PROVIDER_MALFORMED", usage: usageRecord("MALFORMED", outcome.usage, safeCost(provider, outcome.usage)) })
      case "error":
        return await finish("FAILED", { errorCode: "PROVIDER_ERROR", usage: usageRecord("PROVIDER_ERROR", ZERO_USAGE, 0) })
      case "ok": {
        // The recorded model is the one WE called, never one the response claims.
        const envelope = isRecord(outcome.envelope) ? { ...outcome.envelope, modelVersion: provider.modelVersion } : outcome.envelope
        const { proposals, rejected } = validateAiProposals(envelope, { assessmentId, evidence: context.evidence, assets: context.assets })
        const stamped = proposals.map((p, i) => ({ ...p, id: `${run.id}:P${i + 1}` }))
        const status = rejected.length > 0 ? "PARTIAL" : "READY_FOR_REVIEW"
        return await finish(status, {
          proposals: stamped,
          rejectedCount: rejected.length,
          usage: usageRecord(status === "PARTIAL" ? "PARTIAL" : "OK", outcome.usage, safeCost(provider, outcome.usage)),
        })
      }
    }
  } catch (error) {
    if (error instanceof RunLeaseLostError) return { status: "lease_lost" }
    try {
      return await finish("FAILED", { errorCode: "ANALYSIS_FAILED" })
    } catch (inner) {
      if (inner instanceof RunLeaseLostError) return { status: "lease_lost" }
      throw inner
    }
  }
}

function safeCost(provider: FrameAnalysisProvider, usage: ProviderUsage): number {
  return provider.simulated ? 0 : costMicros(provider.modelVersion, usage)
}

export type RecoveryReport = { runId: string; result: "recovered" | "skipped_other_provider" | RunAnalysisOutcome["status"] }[]

/**
 * Re-drives runs whose processing lease expired (a crashed or abandoned attempt). Safe to call repeatedly and
 * concurrently: startRun's atomic reclaim lets exactly one caller win each run, and completeRun is fenced.
 * Only runs created by the SAME provider are re-driven, so a paid run is never silently continued by another provider.
 * This is the function a scheduled worker would invoke; the scheduler and its machine credential are a separate decision.
 */
export async function recoverAbandonedRuns(
  repo: ViewingAssessmentRepository,
  deps: AnalysisDeps,
  options: { leaseSeconds?: number; limit?: number } = {}
): Promise<RecoveryReport> {
  const abandoned = await repo.listAbandonedRuns({ leaseSeconds: options.leaseSeconds ?? RUN_LEASE_SECONDS, limit: options.limit ?? 10 })
  const report: RecoveryReport = []
  for (const run of abandoned) {
    if (run.provider !== deps.provider.id) {
      report.push({ runId: run.runId, result: "skipped_other_provider" })
      continue
    }
    const outcome = await runProviderAnalysis(
      repo,
      { dealId: run.dealId, assessmentId: run.assessmentId, idempotencyKey: run.idempotencyKey, actor: "system:recovery", ...(options.leaseSeconds === undefined ? {} : { leaseSeconds: options.leaseSeconds }) },
      deps
    )
    report.push({ runId: run.runId, result: outcome.status === "ok" ? "recovered" : outcome.status })
  }
  return report
}
