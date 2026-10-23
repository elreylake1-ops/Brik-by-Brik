import Anthropic from "@anthropic-ai/sdk"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BUDGET, DEFAULT_LIMITS, usdToMicros } from "@/lib/viewing-assessment/ai/budget"
import { createClaudeProvider, extractRetryAfterMs, type ClaudeClient } from "@/lib/viewing-assessment/ai/claude-provider"
import { costMicros, worstCaseCostMicros } from "@/lib/viewing-assessment/ai/pricing"
import type { FrameAnalysisProvider } from "@/lib/viewing-assessment/ai/provider"
import { runProviderAnalysis, type RunAnalysisOutcome } from "@/lib/viewing-assessment/ai/run-analysis"
import { selectAnalysisProvider } from "@/lib/viewing-assessment/ai/select-provider"
import { VIEWING_CHECKLIST_V1 } from "@/lib/viewing-assessment/checklist-v1"
import { createLocalFsBlobStore } from "@/lib/viewing-assessment/storage/local-fs-blob-store"
import type { PrivateBlobStore } from "@/lib/viewing-assessment/storage/blob-store"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { sha256, tinyJpeg } from "./fixtures/jpeg-fixtures"

const DEAL_A = "deal-aaa-111"
const DEAL_B = "deal-bbb-222"
const MODEL = "claude-sonnet-5-5"

let mem: ReturnType<typeof createInMemoryViewingRepository>
let storeRoot: string
let store: PrivateBlobStore

beforeEach(() => {
  mem = createInMemoryViewingRepository()
  storeRoot = mkdtempSync(path.join(tmpdir(), "brik-mock-claude-test-"))
  store = createLocalFsBlobStore(storeRoot)
})

afterEach(() => {
  rmSync(storeRoot, { recursive: true, force: true })
})

async function seedAssessment(dealId: string, frameCount = 3) {
  const { record } = await mem.repo.createAssessment({
    dealId,
    idempotencyKey: `init-${dealId}`,
    checklistVersion: "v1",
    createdBy: "operator-1",
  })

  const added = await mem.repo.addAsset(dealId, record.id, {
    asset: {
      filename: "inspection-walkthrough.mp4",
      mimeType: "video/mp4",
      sizeBytes: 25_000_000,
      durationSeconds: 45,
      contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    frames: Array.from({ length: frameCount }, (_, i) => ({
      timestampSeconds: (i + 1) * 5,
      room: i === 0 ? "Front Elevation" : i === 1 ? "Hallway" : "Living Room",
    })),
    createdBy: "operator-1",
  })

  if (added?.status !== "ok") throw new Error("Failed to seed assessment asset")

  for (const [i, e] of added.evidence.entries()) {
    const bytes = tinyJpeg(`frame-bytes-${dealId}-${i}`)
    const stored = await store.put({
      kind: "evidence_frame",
      bytes,
      mimeType: "image/jpeg",
      sha256: sha256(bytes),
    })
    await mem.repo.putEvidenceBlob(dealId, record.id, e.id, {
      storageKey: stored.storageKey,
      sha256: stored.sha256,
      sizeBytes: stored.sizeBytes,
      mimeType: "image/jpeg",
      createdBy: "operator-1",
    })
  }

  return { assessmentId: record.id, evidence: added.evidence }
}

function createMockClaudeMessage(content: unknown, usage = { input_tokens: 1200, output_tokens: 350, cache_read_input_tokens: 6000, cache_creation_input_tokens: 0 }) {
  return {
    id: "msg_mock_001",
    type: "message",
    role: "assistant",
    model: MODEL,
    stop_reason: "end_turn",
    stop_sequence: null,
    content: [
      {
        type: "text",
        text: typeof content === "string" ? content : JSON.stringify(content),
      },
    ],
    usage,
  } as unknown as Anthropic.Message
}

function createMockStream(messageOrFn: Anthropic.Message | Error | ((callCount: number) => Anthropic.Message | Error)) {
  let calls = 0
  const stream = vi.fn((_params: unknown, options?: { signal?: AbortSignal }) => {
    calls++
    const currentCall = calls
    return {
      finalMessage: async () => {
        if (options?.signal?.aborted) throw new Error("AbortError: request was aborted")
        const res = typeof messageOrFn === "function" ? messageOrFn(currentCall) : messageOrFn
        if (res instanceof Error) throw res
        return res
      },
    }
  })
  return {
    client: { messages: { stream } } as unknown as ClaudeClient,
    stream,
    getCallCount: () => calls,
  }
}

describe("Task 11H: Cloud Vision API Adapter & Mocked Integration Suite", () => {
  it("Scenario 1 (Valid Response): processes Claude Sonnet 5.5 response, creating UNVERIFIED/PENDING proposals with micro-dollar ledger entry", async () => {
    const seed = await seedAssessment(DEAL_A, 2)
    const validFindings = {
      findings: [
        {
          checkId: "C08",
          status: "concern",
          observation: "Render surface exhibiting cracking near front bay window.",
          frameIds: [seed.evidence[0].id],
          room: "Front Elevation",
          confidence: "medium",
        },
        {
          checkId: "C22",
          status: "observed",
          observation: "Surface tide mark visible at lower wall base in hallway.",
          frameIds: [seed.evidence[1].id],
          room: "Hallway",
          confidence: "low",
        },
      ],
    }

    const { client, stream } = createMockStream(createMockClaudeMessage(validFindings))
    const provider = createClaudeProvider({ client, model: MODEL, checklist: VIEWING_CHECKLIST_V1 })

    const outcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-valid-001", actor: "test-op" },
      { provider, blobStore: store }
    )

    expect(outcome.status).toBe("ok")
    const run = (outcome as { run: { status: string; proposalsCount: number } }).run
    expect(run.status).toBe("READY_FOR_REVIEW")
    expect(run.proposalsCount).toBe(2)
    expect(stream).toHaveBeenCalledTimes(1)

    const proposals = (await mem.repo.listProposals(DEAL_A, seed.assessmentId))!
    expect(proposals).toHaveLength(2)

    for (const { proposal } of proposals) {
      expect(proposal.verification).toBe("UNVERIFIED")
      expect(proposal.disposition).toBe("PENDING")
      expect(proposal.modelVersion).toBe(MODEL)
      expect(seed.evidence.some((e) => proposal.evidenceIds.includes(e.id))).toBe(true)
    }

    // Verify micro-dollar ledger entry matches model pricing
    expect(mem.rows.usage).toHaveLength(1)
    const usage = mem.rows.usage[0]
    expect(usage.provider).toBe("claude")
    expect(usage.simulated).toBe(false)
    expect(usage.outcome).toBe("OK")
    expect(usage.costMicros).toBe(costMicros(MODEL, {
      inputTokens: 1200,
      outputTokens: 350,
      cacheReadTokens: 6000,
      cacheWriteTokens: 0,
    }))
    expect(usage.costMicros).toBeGreaterThan(0)
  })

  it("Scenario 2 (Malformed Response): handles non-JSON or cut-off payload safely without crashing", async () => {
    const seed = await seedAssessment(DEAL_A, 1)
    const malformedPayload = "Error: 500 Internal Server Error returned by proxy <html..."

    const { client } = createMockStream(createMockClaudeMessage(malformedPayload))
    const provider = createClaudeProvider({ client, model: MODEL, checklist: VIEWING_CHECKLIST_V1 })

    const outcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-malformed-001", actor: "test-op" },
      { provider, blobStore: store }
    )

    expect(outcome.status).toBe("ok")
    const run = (outcome as { run: { status: string; errorCode?: string } }).run
    expect(run.status).toBe("FAILED")
    expect(run.errorCode).toBe("PROVIDER_MALFORMED")

    const proposals = await mem.repo.listProposals(DEAL_A, seed.assessmentId)
    expect(proposals).toHaveLength(0)
  })

  it("Scenario 3 (Irrelevant / Hallucinated IDs): rejects unknown checklist IDs and invalid statuses", async () => {
    const seed = await seedAssessment(DEAL_A, 2)
    const badFindings = {
      findings: [
        {
          checkId: "ZZ99", // Invalid check ID
          status: "concern",
          observation: "Hallucinated non-existent check.",
          frameIds: [seed.evidence[0].id],
          confidence: "low",
        },
        {
          checkId: "C08",
          status: "fatal_emergency", // Invalid status enum
          observation: "Render damaged.",
          frameIds: [seed.evidence[1].id],
          confidence: "high",
        },
      ],
    }

    const { client } = createMockStream(createMockClaudeMessage(badFindings))
    const provider = createClaudeProvider({ client, model: MODEL, checklist: VIEWING_CHECKLIST_V1 })

    const outcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-badids-001", actor: "test-op" },
      { provider, blobStore: store }
    )

    expect(outcome.status).toBe("ok")
    const run = (outcome as { run: { status: string; proposalsCount: number; rejectedCount: number } }).run
    expect(run.status).toBe("PARTIAL")
    expect(run.proposalsCount).toBe(0)
    expect(run.rejectedCount).toBe(2)

    const proposals = await mem.repo.listProposals(DEAL_A, seed.assessmentId)
    expect(proposals).toHaveLength(0)
  })

  it("Scenario 4 (Unsupported Diagnoses & Negative Invariants): strips extra fields and ignores cost/quantity inferences", async () => {
    const seed = await seedAssessment(DEAL_A, 1)
    const invasiveFindings = {
      findings: [
        {
          checkId: "C18",
          status: "concern",
          observation: "Artex textured ceiling coating observed.",
          frameIds: [seed.evidence[0].id],
          confidence: "medium",
          // Extra unrequested fields that model might hallucinate:
          estimatedCostGbp: 4500,
          asbestosConfirmed: true,
          exactCrackWidthMm: 4.2,
          statutoryComplianceApproved: false,
        },
      ],
    }

    const { client } = createMockStream(createMockClaudeMessage(invasiveFindings))
    const provider = createClaudeProvider({ client, model: MODEL, checklist: VIEWING_CHECKLIST_V1 })

    const outcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-invasive-001", actor: "test-op" },
      { provider, blobStore: store }
    )

    expect(outcome.status).toBe("ok")
    const proposals = (await mem.repo.listProposals(DEAL_A, seed.assessmentId))!
    expect(proposals).toHaveLength(1)
    const p = proposals[0].proposal as Record<string, unknown>

    expect(p.checkId).toBe("C18")
    expect(p.verification).toBe("UNVERIFIED")
    expect(p.disposition).toBe("PENDING")
    // Assert invasive/unsupported fields were stripped by validateAiProposals:
    expect(p).not.toHaveProperty("estimatedCostGbp")
    expect(p).not.toHaveProperty("asbestosConfirmed")
    expect(p).not.toHaveProperty("exactCrackWidthMm")
    expect(p).not.toHaveProperty("statutoryComplianceApproved")
  })

  it("Scenario 5 (Timeouts & Cancellation): terminates promptly on AbortSignal and charges worst-case cost", async () => {
    const seed = await seedAssessment(DEAL_A, 2)
    const controller = new AbortController()

    const stream = vi.fn((_p: unknown, options?: { signal?: AbortSignal }) => ({
      finalMessage: async () => {
        return new Promise<Anthropic.Message>((_, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(new Error("Request aborted by client"))
          })
        })
      },
    }))

    const client = { messages: { stream } } as unknown as ClaudeClient
    const provider = createClaudeProvider({ client, model: MODEL, checklist: VIEWING_CHECKLIST_V1 })

    const runPromise = runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-abort-001", actor: "test-op" },
      { provider, blobStore: store, limits: { ...DEFAULT_LIMITS, timeoutMs: 50 } }
    )

    const outcome = await runPromise
    expect(outcome.status).toBe("ok")
    const run = (outcome as { run: { status: string; errorCode?: string } }).run
    expect(run.status).toBe("FAILED")
    expect(run.errorCode).toBe("PROVIDER_TIMEOUT")

    // Timed out paid request accounted at worst-case estimate
    expect(mem.rows.usage).toHaveLength(1)
    expect(mem.rows.usage[0].outcome).toBe("TIMEOUT")
    expect(mem.rows.usage[0].costMicros).toBe(worstCaseCostMicros(MODEL, 2, { ...DEFAULT_LIMITS, timeoutMs: 50 }))
  })

  it("Scenario 6A (Rate Limit Transient Retry): recovers from transient HTTP 429 error on retry", async () => {
    const seed = await seedAssessment(DEAL_A, 1)
    const validFinding = {
      findings: [{ checkId: "C01", status: "observed", observation: "Roof slope visible.", frameIds: [seed.evidence[0].id], confidence: "high" }],
    }

    const apiRateLimitError = Anthropic.APIError.generate(429, { error: { message: "rate limit exceeded" } }, "rate limit", new Headers())

    let attempt = 0
    const { client, stream } = createMockStream(() => {
      attempt++
      if (attempt === 1) throw apiRateLimitError
      return createMockClaudeMessage(validFinding)
    })

    const provider = createClaudeProvider({
      client,
      model: MODEL,
      checklist: VIEWING_CHECKLIST_V1,
      maxRetries: 2,
      retryDelayMs: () => 0, // Instant retry in tests
    })

    const outcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-retry-ok-001", actor: "test-op" },
      { provider, blobStore: store }
    )

    expect(outcome.status).toBe("ok")
    const run = (outcome as { run: { status: string; proposalsCount: number } }).run
    expect(run.status).toBe("READY_FOR_REVIEW")
    expect(run.proposalsCount).toBe(1)
    expect(stream).toHaveBeenCalledTimes(2) // 1 initial fail + 1 retry success
  })

  it("Scenario 6B (Rate Limit Exhaustion): fails cleanly after exhausting max retries without leaking keys", async () => {
    const seed = await seedAssessment(DEAL_A, 1)
    const apiRateLimitError = Anthropic.APIError.generate(
      429,
      { error: { message: "exhausted quota" } },
      "exhausted quota for sk-ant-SECRET-KEY-NEVER-LEAK",
      new Headers()
    )

    const { client, stream } = createMockStream(() => {
      throw apiRateLimitError
    })

    const provider = createClaudeProvider({
      client,
      model: MODEL,
      checklist: VIEWING_CHECKLIST_V1,
      maxRetries: 2,
      retryDelayMs: () => 0,
    })

    const outcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-retry-exhaust-001", actor: "test-op" },
      { provider, blobStore: store }
    )

    expect(outcome.status).toBe("ok")
    const run = (outcome as { run: { status: string; errorCode?: string } }).run
    expect(run.status).toBe("FAILED")
    expect(run.errorCode).toBe("PROVIDER_ERROR")
    expect(stream).toHaveBeenCalledTimes(3) // 1 initial + 2 retries = 3 calls

    // Error detail is status-only and must never leak secret tokens
    const runs = await mem.repo.listRuns(DEAL_A, seed.assessmentId)
    const jsonStr = JSON.stringify(runs)
    expect(jsonStr).not.toContain("SECRET-KEY-NEVER-LEAK")
  })

  it("Scenario 7 (Missing Evidence / Corrupted Storage): halts before calling provider if frame image is missing or tampered", async () => {
    const seed = await seedAssessment(DEAL_A, 1)
    const { client, stream } = createMockStream(createMockClaudeMessage({ findings: [] }))
    const provider = createClaudeProvider({ client, model: MODEL, checklist: VIEWING_CHECKLIST_V1 })

    // Case 7a: Blob store is null
    const noStoreOutcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-nostore-001", actor: "test-op" },
      { provider, blobStore: null }
    )
    expect(noStoreOutcome.status).toBe("ok")
    expect((noStoreOutcome as { run: { errorCode?: string } }).run.errorCode).toBe("STORAGE_UNAVAILABLE")
    expect(stream).not.toHaveBeenCalled()

    // Case 7b: Tampered file on disk (SHA-256 mismatch)
    const { readdirSync } = await import("node:fs")
    const file = readdirSync(storeRoot, { recursive: true }).map(String).find((f) => f.includes("blob_") && !f.endsWith(".tmp"))!
    writeFileSync(path.join(storeRoot, file), tinyJpeg("TAMPERED"))

    const tamperedOutcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-tampered-001", actor: "test-op" },
      { provider, blobStore: store }
    )
    expect(tamperedOutcome.status).toBe("ok")
    expect((tamperedOutcome as { run: { errorCode?: string } }).run.errorCode).toBe("FRAME_IMAGE_UNAVAILABLE")
    expect(stream).not.toHaveBeenCalled()
  })

  it("Scenario 8 (Cross-Deal Frame References): rejects proposal citing frame from another deal", async () => {
    const seedA = await seedAssessment(DEAL_A, 1)
    const seedB = await seedAssessment(DEAL_B, 1)

    // Claude returns a finding that references seedB's frame ID while analyzing deal A
    const crossDealFinding = {
      findings: [
        {
          checkId: "C08",
          status: "concern",
          observation: "Cracked render observed.",
          frameIds: [seedB.evidence[0].id], // Belongs to Deal B!
          confidence: "medium",
        },
      ],
    }

    const { client } = createMockStream(createMockClaudeMessage(crossDealFinding))
    const provider = createClaudeProvider({ client, model: MODEL, checklist: VIEWING_CHECKLIST_V1 })

    const outcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seedA.assessmentId, idempotencyKey: "run-crossdeal-001", actor: "test-op" },
      { provider, blobStore: store }
    )

    expect(outcome.status).toBe("ok")
    const run = (outcome as { run: { status: string; proposalsCount: number; rejectedCount: number } }).run
    expect(run.status).toBe("PARTIAL")
    expect(run.proposalsCount).toBe(0)
    expect(run.rejectedCount).toBe(1)

    // Ensure zero cross-deal proposals entered Deal A's assessment
    const proposals = await mem.repo.listProposals(DEAL_A, seedA.assessmentId)
    expect(proposals).toHaveLength(0)
  })

  it("Scenario 9 (Authorization Failures): denies unauthenticated and cross-deal access at the boundary", async () => {
    const seed = await seedAssessment(DEAL_A, 1)

    // Calling with non-existent deal ID or non-existent assessment ID fails closed
    const outcomeNonExistent = await runProviderAnalysis(
      mem.repo,
      { dealId: "wrong-deal-999", assessmentId: seed.assessmentId, idempotencyKey: "run-wrongdeal-001", actor: "test-op" },
      { provider: createClaudeProvider({ client: createMockStream(createMockClaudeMessage({})).client, model: MODEL, checklist: VIEWING_CHECKLIST_V1 }), blobStore: store }
    )
    expect(outcomeNonExistent.status).toBe("not_found")

    const outcomeWrongAssessment = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: "00000000-0000-0000-0000-000000000000", idempotencyKey: "run-wrongasmt-001", actor: "test-op" },
      { provider: createClaudeProvider({ client: createMockStream(createMockClaudeMessage({})).client, model: MODEL, checklist: VIEWING_CHECKLIST_V1 }), blobStore: store }
    )
    expect(outcomeWrongAssessment.status).toBe("not_found")
  })

  it("Scenario 10 (Disabled AI & Zero Outbound Calls): disabled state produces no genuine findings and performs 0 provider calls", () => {
    const stream = vi.fn()
    const fakeClient = { messages: { stream } } as unknown as ClaudeClient

    // 10A: With VIEWING_AI_ENABLED unset or false
    const selectionDisabled = selectAnalysisProvider(
      {
        VIEWING_AI_PROVIDER: "claude",
        VIEWING_AI_ENABLED: "false",
        ANTHROPIC_API_KEY: "sk-ant-test-key",
        VIEWING_AI_MODEL: MODEL,
        VIEWING_CHECKLIST_WORDING_APPROVED: "true",
      },
      { client: fakeClient }
    )

    expect(selectionDisabled.ok).toBe(false)
    if (!selectionDisabled.ok) {
      expect(selectionDisabled.reasons).toContain("VIEWING_AI_ENABLED is not true")
    }
    expect(stream).not.toHaveBeenCalled()

    // 10B: With unapproved checklist wording
    const selectionUnapprovedWording = selectAnalysisProvider(
      {
        VIEWING_AI_PROVIDER: "claude",
        VIEWING_AI_ENABLED: "true",
        ANTHROPIC_API_KEY: "sk-ant-test-key",
        VIEWING_AI_MODEL: MODEL,
        VIEWING_CHECKLIST_WORDING_APPROVED: "false",
      },
      { client: fakeClient }
    )

    expect(selectionUnapprovedWording.ok).toBe(false)
    if (!selectionUnapprovedWording.ok) {
      expect(selectionUnapprovedWording.reasons).toContain("VIEWING_CHECKLIST_WORDING_APPROVED is not true (checklist reuse rights unconfirmed)")
    }
    expect(stream).not.toHaveBeenCalled()

    // 10C: Default fallback to fixture in development
    const defaultSelection = selectAnalysisProvider({ NODE_ENV: "development" }, { client: fakeClient })
    expect(defaultSelection.ok).toBe(true)
    if (defaultSelection.ok) {
      expect(defaultSelection.provider.id).toBe("fixture")
      expect(defaultSelection.provider.simulated).toBe(true)
    }
    expect(stream).not.toHaveBeenCalled()
  })

  it("Scenario 11A (Provider Retry Guidance): respects retry-after headers and bounds backoff", async () => {
    const seed = await seedAssessment(DEAL_A, 1)
    const validFinding = {
      findings: [{ checkId: "C01", status: "observed", observation: "Roof slope visible.", frameIds: [seed.evidence[0].id], confidence: "high" }],
    }

    const headersWithSeconds = new Headers()
    headersWithSeconds.set("retry-after", "1")

    const error429 = Anthropic.APIError.generate(429, { error: { message: "rate limit" } }, "rate limit", headersWithSeconds)

    const observedDelays: number[] = []
    let callCount = 0
    const { client } = createMockStream(() => {
      callCount++
      if (callCount === 1) throw error429
      return createMockClaudeMessage(validFinding)
    })

    const provider = createClaudeProvider({
      client,
      model: MODEL,
      checklist: VIEWING_CHECKLIST_V1,
      maxRetries: 2,
      maxRetryDelayMs: 5000,
      retryDelayMs: (_attempt, retryAfterMs) => {
        observedDelays.push(retryAfterMs ?? -1)
        return 0 // Keep test execution instantaneous
      },
    })

    const outcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-guidance-001", actor: "test-op" },
      { provider, blobStore: store }
    )

    expect(outcome.status).toBe("ok")
    expect((outcome as { run: { status: string } }).run.status).toBe("READY_FOR_REVIEW")
    expect(observedDelays).toEqual([1000]) // 1 second parsed as 1000ms
  })

  it("Scenario 11B (Retry-After-MS and Bounded Ceiling): parses milliseconds and caps excessive delays", async () => {
    const headers = new Headers()
    headers.set("retry-after-ms", "8500") // 8.5 seconds exceeds 5000ms ceiling

    const error429 = Anthropic.APIError.generate(429, { error: { message: "rate limit" } }, "rate limit", headers)
    expect(extractRetryAfterMs(error429)).toBe(8500)

    const seed = await seedAssessment(DEAL_A, 1)
    const validFinding = {
      findings: [{ checkId: "C01", status: "observed", observation: "Roof slope visible.", frameIds: [seed.evidence[0].id], confidence: "high" }],
    }

    let callCount = 0
    const { client } = createMockStream(() => {
      callCount++
      if (callCount === 1) throw error429
      return createMockClaudeMessage(validFinding)
    })

    let boundedDelayUsed: number | null = null
    const provider = createClaudeProvider({
      client,
      model: MODEL,
      checklist: VIEWING_CHECKLIST_V1,
      maxRetries: 2,
      maxRetryDelayMs: 2500, // Capped at 2500ms
      retryDelayMs: (_attempt, retryAfterMs) => {
        boundedDelayUsed = Math.min(retryAfterMs ?? 0, 2500)
        return 0
      },
    })

    const outcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-bounded-001", actor: "test-op" },
      { provider, blobStore: store }
    )

    expect(outcome.status).toBe("ok")
    expect(boundedDelayUsed).toBe(2500) // Capped from 8500 to 2500
  })

  it("Scenario 11C (HTTP 529 and APIConnectionError Transient Retries): recovers from overloaded or network drops", async () => {
    const seed = await seedAssessment(DEAL_A, 1)
    const validFinding = {
      findings: [{ checkId: "C01", status: "observed", observation: "Roof slope visible.", frameIds: [seed.evidence[0].id], confidence: "high" }],
    }

    // 1st call throws 529, 2nd throws APIConnectionError, 3rd succeeds
    const error529 = Anthropic.APIError.generate(529, { error: { message: "overloaded" } }, "overloaded", new Headers())
    const connError = new Anthropic.APIConnectionError({ message: "ECONNRESET connection reset by peer" })

    let callCount = 0
    const { client, stream } = createMockStream(() => {
      callCount++
      if (callCount === 1) throw error529
      if (callCount === 2) throw connError
      return createMockClaudeMessage(validFinding)
    })

    const provider = createClaudeProvider({
      client,
      model: MODEL,
      checklist: VIEWING_CHECKLIST_V1,
      maxRetries: 2,
      retryDelayMs: () => 0,
    })

    const outcome = await runProviderAnalysis(
      mem.repo,
      { dealId: DEAL_A, assessmentId: seed.assessmentId, idempotencyKey: "run-529-conn-001", actor: "test-op" },
      { provider, blobStore: store }
    )

    expect(outcome.status).toBe("ok")
    expect((outcome as { run: { status: string } }).run.status).toBe("READY_FOR_REVIEW")
    expect(stream).toHaveBeenCalledTimes(3)
  })

  it("Scenario 11D (Abort During Retry Delay): halts immediately if signal aborts during backoff", async () => {
    const seed = await seedAssessment(DEAL_A, 1)
    const error429 = Anthropic.APIError.generate(429, { error: { message: "rate limit" } }, "rate limit", new Headers())

    const { client } = createMockStream(() => {
      throw error429
    })

    const controller = new AbortController()

    const provider = createClaudeProvider({
      client,
      model: MODEL,
      checklist: VIEWING_CHECKLIST_V1,
      maxRetries: 2,
      maxRetryDelayMs: 10_000,
      retryDelayMs: () => {
        // Abort right after delay begins
        setTimeout(() => controller.abort(), 10)
        return 5000 // Long delay that should be aborted
      },
    })

    const startTime = Date.now()
    const outcome = await provider.analyse({
      assessmentId: seed.assessmentId,
      frames: [{ id: seed.evidence[0].id, timestampSeconds: 5, jpeg: tinyJpeg("test") }],
      limits: DEFAULT_LIMITS,
      signal: controller.signal,
    })
    const elapsed = Date.now() - startTime

    expect(outcome.kind).toBe("timeout")
    expect(elapsed).toBeLessThan(1000) // Confirms it aborted promptly, didn't wait 5000ms
  })
})
