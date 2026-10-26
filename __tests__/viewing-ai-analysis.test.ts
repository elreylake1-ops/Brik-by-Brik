import Anthropic from "@anthropic-ai/sdk"
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BUDGET, DEFAULT_LIMITS, checkBudget, usdToMicros } from "@/lib/viewing-assessment/ai/budget"
import { createClaudeProvider, type ClaudeClient } from "@/lib/viewing-assessment/ai/claude-provider"
import { FIXTURE_MODEL_VERSION, createFixtureProvider, type FixtureScenario } from "@/lib/viewing-assessment/ai/fixture-provider"
import { MODEL_PRICES, UnknownModelPriceError, costMicros, worstCaseCostMicros } from "@/lib/viewing-assessment/ai/pricing"
import { ZERO_USAGE, type FrameAnalysisProvider, type ProviderOutcome } from "@/lib/viewing-assessment/ai/provider"
import { recoverAbandonedRuns, runProviderAnalysis, type RunAnalysisOutcome } from "@/lib/viewing-assessment/ai/run-analysis"
import { selectAnalysisProvider } from "@/lib/viewing-assessment/ai/select-provider"
import { VIEWING_CHECKLIST_V1 } from "@/lib/viewing-assessment/checklist-v1"
import { createLocalFsBlobStore, sha256Hex } from "@/lib/viewing-assessment/storage/local-fs-blob-store"
import type { PrivateBlobStore } from "@/lib/viewing-assessment/storage/blob-store"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { sha256, tinyJpeg } from "./fixtures/jpeg-fixtures"

const DEAL = "deal-1"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let mem: ReturnType<typeof createInMemoryViewingRepository>
let storeRoot: string
let store: PrivateBlobStore

async function seed(frameCount = 3, withImages = true) {
  const { record } = await mem.repo.createAssessment({ dealId: DEAL, idempotencyKey: "create-key-0001", checklistVersion: "v1", createdBy: "op" })
  const added = await mem.repo.addAsset(DEAL, record.id, {
    asset: { filename: "walk.mp4", mimeType: "video/mp4", sizeBytes: 100, durationSeconds: 60, contentSha256: null },
    frames: Array.from({ length: frameCount }, (_, i) => ({ timestampSeconds: i * 10 + 1, room: `Room ${i}` })),
    createdBy: "op",
  })
  if (added?.status !== "ok") throw new Error("seed failed")
  if (withImages) {
    for (const [i, e] of added.evidence.entries()) {
      const bytes = tinyJpeg(`frame-${i}`)
      const stored = await store.put({ kind: "evidence_frame", bytes, mimeType: "image/jpeg", sha256: sha256(bytes) })
      await mem.repo.putEvidenceBlob(DEAL, record.id, e.id, { storageKey: stored.storageKey, sha256: stored.sha256, sizeBytes: stored.sizeBytes, mimeType: "image/jpeg", createdBy: "op" })
    }
  }
  return { assessmentId: record.id, evidence: added.evidence }
}

const run = (assessmentId: string, provider: FrameAnalysisProvider, over: Record<string, unknown> = {}, key = "run-key-00001") =>
  runProviderAnalysis(mem.repo, { dealId: DEAL, assessmentId, idempotencyKey: key, actor: "op" }, { provider, blobStore: store, ...over })

const okRun = (o: RunAnalysisOutcome) => {
  if (o.status !== "ok") throw new Error(`expected ok, got ${o.status}`)
  return o.run
}

beforeEach(() => {
  mem = createInMemoryViewingRepository()
  storeRoot = mkdtempSync(path.join(tmpdir(), "brik-ai-test-"))
  store = createLocalFsBlobStore(storeRoot)
})
afterEach(() => rmSync(storeRoot, { recursive: true, force: true }))

/** A stand-in for a PAID provider: not simulated, priced, needs pixels. Never touches a network. */
function paidProvider(outcome: ProviderOutcome | ((req: Parameters<FrameAnalysisProvider["analyse"]>[0]) => Promise<ProviderOutcome>), model = "claude-opus-5-5") {
  const analyse = vi.fn(typeof outcome === "function" ? outcome : async () => outcome)
  const provider: FrameAnalysisProvider = { id: "claude", simulated: false, modelVersion: model, promptVersion: "test-prompt-v1", needsImages: true, analyse }
  return { provider, analyse }
}
const okEnvelope = (assessmentId: string, frameIds: string[]) => ({
  kind: "brik-ai-findings",
  version: 1,
  assessmentId,
  modelVersion: "whatever-the-response-claims",
  findings: [{ checkId: "C08", status: "concern", observation: "Render appears cracked.", frameIds, confidence: "low" }],
})

describe("fixture-backed analysis (free, simulated)", () => {
  it("produces UNVERIFIED, PENDING proposals citing real frames, and records a zero-cost simulated ledger row", async () => {
    const s = await seed()
    const done = okRun(await run(s.assessmentId, createFixtureProvider()))
    expect(done).toMatchObject({ status: "READY_FOR_REVIEW", provider: "fixture", modelVersion: FIXTURE_MODEL_VERSION, proposalsCount: 3 })
    const items = (await mem.repo.listProposals(DEAL, s.assessmentId))!
    const frameIds = new Set(s.evidence.map((e) => e.id))
    for (const { proposal } of items) {
      expect(proposal).toMatchObject({ verification: "UNVERIFIED", disposition: "PENDING", modelVersion: FIXTURE_MODEL_VERSION })
      expect(proposal.evidenceIds.every((id) => frameIds.has(id))).toBe(true)
    }
    expect(mem.rows.usage).toHaveLength(1)
    expect(mem.rows.usage[0]).toMatchObject({ provider: "fixture", simulated: true, costMicros: 0, outcome: "OK", promptVersion: "fixture-prompt-v1", frameCount: 3 })
    expect(await mem.repo.getAiUsageSummary("2000-01-01T00:00:00Z")).toEqual({ totalCostMicros: 0, sinceCostMicros: 0, sinceRuns: 0 })
  })

  it("produces complete_flow findings covering roof (C01), bathroom (C41), and facade (C08) with real frame IDs", async () => {
    const s = await seed()
    const done = okRun(await run(s.assessmentId, createFixtureProvider("complete_flow")))
    expect(done).toMatchObject({ status: "READY_FOR_REVIEW", provider: "fixture", modelVersion: FIXTURE_MODEL_VERSION, proposalsCount: 3 })
    const items = (await mem.repo.listProposals(DEAL, s.assessmentId))!
    const frameIds = new Set(s.evidence.map((e) => e.id))
    const checks = items.map((i) => i.proposal.checkId)
    expect(checks).toEqual(["C01", "C41", "C08"])
    for (const { proposal } of items) {
      expect(proposal).toMatchObject({ verification: "UNVERIFIED", disposition: "PENDING" })
      expect(proposal.observation).toMatch(/^Synthetic observation:/)
      expect(proposal.evidenceIds.every((id) => frameIds.has(id))).toBe(true)
    }
  })

  it.each<[FixtureScenario, string]>([
    ["refusal", "PROVIDER_REFUSAL"],
    ["malformed", "PROVIDER_MALFORMED"],
    ["error", "PROVIDER_ERROR"],
  ])("records a %s as a failed run with no proposals (%s)", async (scenario, errorCode) => {
    const s = await seed()
    const done = okRun(await run(s.assessmentId, createFixtureProvider(scenario)))
    expect(done).toMatchObject({ status: "FAILED", errorCode, proposalsCount: 0 })
    expect(mem.rows.proposals).toHaveLength(0)
  })

  it("enforces a hard deadline on a provider that never answers", async () => {
    const s = await seed()
    const done = okRun(await run(s.assessmentId, createFixtureProvider("timeout"), { limits: { ...DEFAULT_LIMITS, timeoutMs: 30 } }))
    expect(done).toMatchObject({ status: "FAILED", errorCode: "PROVIDER_TIMEOUT" })
    expect(mem.rows.proposals).toHaveLength(0)
  })

  it("enforces the deadline even when the provider ignores its abort signal", async () => {
    const s = await seed()
    const stuck: FrameAnalysisProvider = { ...createFixtureProvider(), analyse: () => new Promise<ProviderOutcome>(() => undefined) }
    const done = okRun(await run(s.assessmentId, stuck, { limits: { ...DEFAULT_LIMITS, timeoutMs: 30 } }))
    expect(done).toMatchObject({ status: "FAILED", errorCode: "PROVIDER_TIMEOUT" })
  })

  it("treats a thrown exception as an unexpected failure, not a typed provider error", async () => {
    const s = await seed()
    const boom: FrameAnalysisProvider = { ...createFixtureProvider(), analyse: async () => { throw new Error("kaboom") } }
    expect(okRun(await run(s.assessmentId, boom))).toMatchObject({ status: "FAILED", errorCode: "ANALYSIS_FAILED" })
  })

  it("keeps valid findings and drops findings that cite frames that were never submitted (PARTIAL)", async () => {
    const s = await seed()
    const done = okRun(await run(s.assessmentId, createFixtureProvider("phantom_frames")))
    expect(done).toMatchObject({ status: "PARTIAL", proposalsCount: 1, rejectedCount: 1 })
    const [only] = (await mem.repo.listProposals(DEAL, s.assessmentId))!
    expect(only.proposal.checkId).toBe("C10")
    expect(mem.rows.proposals.some((p) => p.evidenceIds.includes("ghost-frame"))).toBe(false)
  })

  it("merges duplicate findings across frames and keeps every source", async () => {
    const s = await seed()
    okRun(await run(s.assessmentId, createFixtureProvider("duplicates")))
    const items = (await mem.repo.listProposals(DEAL, s.assessmentId))!
    expect(items).toHaveLength(1)
    expect(items[0].proposal.evidenceIds).toHaveLength(2)
  })

  it("cannot be made to verify, approve, cost or govern anything: overreaching fields and statuses are discarded", async () => {
    const s = await seed()
    const done = okRun(await run(s.assessmentId, createFixtureProvider("overreach")))
    expect(done).toMatchObject({ status: "PARTIAL", proposalsCount: 1, rejectedCount: 1 }) // the "pass"/"certified safe" finding is rejected
    const [{ proposal }] = (await mem.repo.listProposals(DEAL, s.assessmentId))!
    expect(proposal).toMatchObject({ verification: "UNVERIFIED", disposition: "PENDING" })
    for (const forbidden of ["reviewed", "reviewerId", "cost", "refurbCost", "governance_state", "investorShield"]) {
      expect(proposal).not.toHaveProperty(forbidden)
    }
    expect(mem.rows.reviews).toHaveLength(0)
    expect(mem.rows.feedback).toHaveLength(0)
  })

  it("refuses a run with more frames than the limit, before calling the provider", async () => {
    const s = await seed(3)
    const spy = vi.spyOn(createFixtureProvider(), "analyse")
    const provider = createFixtureProvider()
    provider.analyse = spy
    const done = okRun(await run(s.assessmentId, provider, { limits: { ...DEFAULT_LIMITS, maxFrames: 2 } }))
    expect(done).toMatchObject({ status: "FAILED", errorCode: "TOO_MANY_FRAMES" })
    expect(spy).not.toHaveBeenCalled()
  })
})

describe("duplicate processing and interrupted runs", () => {
  it("calls the provider once for a repeated idempotency key, sequentially or concurrently", async () => {
    const s = await seed()
    const provider = createFixtureProvider()
    const spy = vi.spyOn(provider, "analyse")
    const first = await run(s.assessmentId, provider)
    const again = await run(s.assessmentId, provider)
    expect(okRun(first).id).toBe(okRun(again).id)
    expect(again).toMatchObject({ status: "ok", replayed: true })

    const s2Key = "run-key-00002"
    const [a, b] = await Promise.all([run(s.assessmentId, provider, {}, s2Key), run(s.assessmentId, provider, {}, s2Key)])
    expect([a.status, b.status].sort()).toEqual(["in_progress", "ok"])
    expect(spy).toHaveBeenCalledTimes(2) // one per distinct key, never per request
  })

  it("re-drives an abandoned run after its lease and discards nothing it should keep", async () => {
    const s = await seed()
    await mem.repo.startRun(DEAL, s.assessmentId, { idempotencyKey: "run-key-00001", modelVersion: FIXTURE_MODEL_VERSION, createdBy: "op", provider: "fixture" })
    const deps = { provider: createFixtureProvider(), blobStore: store }
    expect(await recoverAbandonedRuns(mem.repo, deps, { leaseSeconds: 3600 })).toEqual([]) // lease still live
    await sleep(1100)
    const report = await recoverAbandonedRuns(mem.repo, deps, { leaseSeconds: 1 })
    expect(report).toHaveLength(1)
    expect(report[0].result).toBe("recovered")
    const runs = (await mem.repo.listRuns(DEAL, s.assessmentId))!
    expect(runs[0]).toMatchObject({ status: "READY_FOR_REVIEW", attemptCount: 2, proposalsCount: 3 })
    expect(await recoverAbandonedRuns(mem.repo, deps, { leaseSeconds: 1 })).toEqual([]) // nothing left to recover
  })

  it("never lets a different provider continue another provider's run", async () => {
    const s = await seed()
    await mem.repo.startRun(DEAL, s.assessmentId, { idempotencyKey: "run-key-00001", modelVersion: "claude-opus-5-5", createdBy: "op", provider: "claude" })
    await sleep(1100)
    const report = await recoverAbandonedRuns(mem.repo, { provider: createFixtureProvider(), blobStore: store }, { leaseSeconds: 1 })
    expect(report).toEqual([{ runId: expect.any(String), result: "skipped_other_provider" }])
    expect((await mem.repo.listRuns(DEAL, s.assessmentId))![0]).toMatchObject({ status: "RUNNING", attemptCount: 1 })
  })
})

describe("paid-provider controls (exercised with a fake: no network, no key)", () => {
  it("sends the stored pixels, validates the answer, and records exact cost from the reported usage", async () => {
    const s = await seed(2)
    const seen: Uint8Array[] = []
    const { provider, analyse } = paidProvider(async ({ frames, assessmentId }) => {
      frames.forEach((f) => seen.push(f.jpeg!))
      return { kind: "ok", envelope: okEnvelope(assessmentId, [frames[0].id]), usage: { inputTokens: 70_000, outputTokens: 20_000, cacheReadTokens: 0, cacheWriteTokens: 0 } }
    })
    const done = okRun(await run(s.assessmentId, provider))
    expect(analyse).toHaveBeenCalledTimes(1)
    expect(seen.map((b) => sha256(b))).toEqual([sha256(tinyJpeg("frame-0")), sha256(tinyJpeg("frame-1"))]) // exactly what was stored
    expect(done).toMatchObject({ status: "READY_FOR_REVIEW", provider: "claude", modelVersion: "claude-opus-5-5" })
    expect(mem.rows.usage[0]).toMatchObject({ simulated: false, costMicros: 680_000, outcome: "OK", promptVersion: "test-prompt-v1" }) // 70K*$4 + 20K*$20 = $0.68
    const [{ proposal }] = (await mem.repo.listProposals(DEAL, s.assessmentId))!
    expect(proposal.modelVersion).toBe("claude-opus-5-5") // the model WE called, not what the response claimed
    expect(proposal.verification).toBe("UNVERIFIED")
    expect((await mem.repo.getAiUsageSummary("2000-01-01T00:00:00Z")).totalCostMicros).toBe(680_000)
  })

  it("stops at the hard stop BEFORE sending anything, and records why", async () => {
    const s0 = await seed(1)
    // prior paid spend just under the hard stop
    const prior = (await mem.repo.startRun(DEAL, s0.assessmentId, { idempotencyKey: "prior-run-0001", modelVersion: "claude-opus-5-5", createdBy: "op", provider: "claude" }))!.run
    await mem.repo.completeRun(prior.id, { attempt: 1, status: "READY_FOR_REVIEW", proposals: [], rejectedCount: 0, usage: { provider: "claude", modelVersion: "claude-opus-5-5", promptVersion: "p", frameCount: 1, inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, costMicros: usdToMicros(BUDGET.hardStopUsd) - 1000, simulated: false, outcome: "OK" } })
    const { provider, analyse } = paidProvider({ kind: "ok", envelope: {}, usage: ZERO_USAGE })
    const done = okRun(await run(s0.assessmentId, provider, {}, "next-run-0001"))
    expect(done).toMatchObject({ status: "FAILED", errorCode: "BUDGET_HARD_STOP" })
    expect(analyse).not.toHaveBeenCalled()
    expect(mem.rows.usage.at(-1)).toMatchObject({ outcome: "BUDGET", costMicros: 0 })
  })

  it("refuses an unpriced model, missing storage, a missing frame image, and a tampered frame image: all before sending", async () => {
    const s = await seed(2)
    const unpriced = paidProvider({ kind: "ok", envelope: {}, usage: ZERO_USAGE }, "claude-mystery-9")
    expect(okRun(await run(s.assessmentId, unpriced.provider, {}, "k-unpriced-01")).errorCode).toBe("UNPRICED_MODEL")

    const good = paidProvider({ kind: "ok", envelope: {}, usage: ZERO_USAGE })
    expect(okRun(await run(s.assessmentId, good.provider, { blobStore: null }, "k-nostore-001")).errorCode).toBe("STORAGE_UNAVAILABLE")

    const bare = await (async () => {
      const { record } = await mem.repo.createAssessment({ dealId: DEAL, idempotencyKey: "create-key-0002", checklistVersion: "v1", createdBy: "op" })
      await mem.repo.addAsset(DEAL, record.id, { asset: { filename: "b.mp4", mimeType: "video/mp4", sizeBytes: 1, durationSeconds: 10, contentSha256: null }, frames: [{ timestampSeconds: 1 }], createdBy: "op" })
      return record.id
    })()
    expect(okRun(await run(bare, good.provider, {}, "k-noimage-001")).errorCode).toBe("FRAME_IMAGE_MISSING")

    // tamper with a stored file on disk: checksum no longer matches what was recorded
    const file = readdirSync(storeRoot, { recursive: true }).map(String).find((f) => f.includes("blob_") && !f.endsWith(".tmp"))!
    writeFileSync(path.join(storeRoot, file), tinyJpeg("TAMPERED"))
    expect(okRun(await run(s.assessmentId, good.provider, {}, "k-tampered-01")).errorCode).toBe("FRAME_IMAGE_UNAVAILABLE")
    expect(unpriced.analyse).not.toHaveBeenCalled()
    expect(good.analyse).not.toHaveBeenCalled()
  })

  it("accounts for a timed-out paid request at its worst-case cost rather than assuming it was free", async () => {
    const s = await seed(2)
    const { provider } = paidProvider({ kind: "timeout" })
    const done = okRun(await run(s.assessmentId, provider))
    expect(done).toMatchObject({ status: "FAILED", errorCode: "PROVIDER_TIMEOUT" })
    expect(mem.rows.usage[0]).toMatchObject({ outcome: "TIMEOUT", costMicros: worstCaseCostMicros("claude-opus-5-5", 2, DEFAULT_LIMITS), simulated: false })
    expect(mem.rows.usage[0].costMicros).toBeGreaterThan(0)
  })

  it("bills a refusal for the tokens it actually used", async () => {
    const s = await seed(1)
    const { provider } = paidProvider({ kind: "refusal", usage: { inputTokens: 5_000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }, category: "cyber" })
    expect(okRun(await run(s.assessmentId, provider)).errorCode).toBe("PROVIDER_REFUSAL")
    expect(mem.rows.usage[0]).toMatchObject({ outcome: "REFUSAL", costMicros: 5_000 * 4 + 100 * 20 })
  })
})

describe("budget and pricing configuration", () => {
  it("keeps the proposed testing allocations within the approved USD 150", () => {
    const planned = Object.values(BUDGET.allocationsUsd).reduce((a, b) => a + b, 0)
    expect(BUDGET.totalAllowanceUsd).toBe(150)
    expect(planned).toBe(BUDGET.hardStopUsd)
    expect(planned + BUDGET.reserveUsd).toBeLessThanOrEqual(BUDGET.totalAllowanceUsd)
    expect(BUDGET.hardStopUsd + BUDGET.reserveUsd).toBeLessThanOrEqual(BUDGET.totalAllowanceUsd)
  })

  it("a single worst-case run on every priced model is a small fraction of the allowance", () => {
    for (const model of Object.keys(MODEL_PRICES)) {
      const worst = worstCaseCostMicros(model, DEFAULT_LIMITS.maxFrames, DEFAULT_LIMITS)
      expect(worst, model).toBeLessThan(usdToMicros(BUDGET.totalAllowanceUsd) / 50)
    }
  })

  it("computes cost exactly from tokens, including cache pricing and the Haiku long-prompt tier", () => {
    const u = (inputTokens: number, outputTokens: number, cacheReadTokens = 0, cacheWriteTokens = 0) => ({ inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens })
    expect(costMicros("claude-opus-5-5", u(1_000_000, 0))).toBe(4_000_000)
    expect(costMicros("claude-opus-5-5", u(0, 1_000_000))).toBe(20_000_000)
    expect(costMicros("claude-opus-5-5", u(0, 0, 1_000_000))).toBe(200_000) // $0.20 / MTok cache read
    expect(costMicros("claude-opus-5-5", u(0, 0, 0, 1_000_000))).toBe(5_000_000) // 1.25 x input
    expect(costMicros("claude-sonnet-5-5", u(70_000, 20_000))).toBe(70_000 * 2 + 20_000 * 10)
    expect(costMicros("claude-haiku-5-5", u(50_000, 10_000))).toBe(50_000 * 0.1 + 10_000 * 0.5)
    expect(costMicros("claude-haiku-5-5", u(150_000, 10_000))).toBe(150_000 * 0.5 + 10_000 * 2.5) // above the 100K prompt tier
    expect(costMicros("claude-haiku-5-5", u(0, 0, 1_000_000))).toBe(500_000) // unconfirmed cache price => charged as input, deliberately pessimistic
    expect(() => costMicros("claude-mystery-9", u(1, 1))).toThrow(UnknownModelPriceError)
  })

  it("checkBudget enforces the hard stop and the daily run cap", () => {
    const base = { spentMicros: 0, worstCaseMicros: 1_000_000, runsToday: 0 }
    expect(checkBudget(base)).toEqual({ allowed: true })
    expect(checkBudget({ ...base, spentMicros: usdToMicros(119.5), worstCaseMicros: usdToMicros(1) })).toEqual({ allowed: false, reason: "HARD_STOP" })
    expect(checkBudget({ ...base, spentMicros: usdToMicros(119), worstCaseMicros: usdToMicros(1) })).toEqual({ allowed: true }) // exactly at the stop is allowed
    expect(checkBudget({ ...base, runsToday: BUDGET.maxPaidRunsPerDay })).toEqual({ allowed: false, reason: "DAILY_RUN_CAP" })
  })
})

describe("provider selection fails closed", () => {
  const key = "sk-ant-THIS-IS-A-FAKE-SECRET-VALUE"
  const paid = { VIEWING_AI_PROVIDER: "claude", VIEWING_AI_ENABLED: "true", ANTHROPIC_API_KEY: key, VIEWING_AI_MODEL: "claude-opus-5-5", VIEWING_CHECKLIST_WORDING_APPROVED: "true" }
  const fakeClient: ClaudeClient = { messages: { stream: vi.fn() } }

  it("defaults to the free simulated fixture", () => {
    const sel = selectAnalysisProvider({ NODE_ENV: "development" })
    expect(sel.ok && sel.provider).toMatchObject({ id: "fixture", simulated: true })
  })

  it("never selects a paid provider unless every requirement is met, naming each unmet requirement and no values", () => {
    const missing = selectAnalysisProvider({ VIEWING_AI_PROVIDER: "claude", ANTHROPIC_API_KEY: key })
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.reasons.join(" | ")).toMatch(/VIEWING_AI_ENABLED/)
      expect(missing.reasons.join(" | ")).toMatch(/VIEWING_AI_MODEL/)
      expect(missing.reasons.join(" | ")).toMatch(/VIEWING_CHECKLIST_WORDING_APPROVED/)
      expect(JSON.stringify(missing)).not.toContain(key)
    }
    for (const [name, value] of [["VIEWING_AI_ENABLED", "false"], ["VIEWING_AI_ENABLED", undefined], ["ANTHROPIC_API_KEY", undefined], ["VIEWING_AI_MODEL", "claude-mystery-9"], ["VIEWING_AI_MODEL", undefined], ["VIEWING_CHECKLIST_WORDING_APPROVED", "false"]] as const) {
      const sel = selectAnalysisProvider({ ...paid, [name]: value })
      expect(sel.ok, `${name}=${value}`).toBe(false)
    }
  })

  it("keeps live AI blocked until atomic budget reservation is implemented", () => {
    const sel = selectAnalysisProvider(paid, { client: fakeClient })
    expect(sel.ok).toBe(false)
    if (!sel.ok) expect(sel.reasons).toContain("atomic budget reservation is not available")
    expect(fakeClient.messages.stream).not.toHaveBeenCalled()
  })

  it("refuses the fixture in a deployed environment unless explicitly allowed, rejects unknown providers and scenarios", () => {
    expect(selectAnalysisProvider({ NODE_ENV: "production" }).ok).toBe(false)
    expect(selectAnalysisProvider({ NODE_ENV: "production", VIEWING_AI_ALLOW_FIXTURE_IN_PRODUCTION: "true" }).ok).toBe(true)
    expect(selectAnalysisProvider({ VIEWING_AI_PROVIDER: "openai" }).ok).toBe(false)
    expect(selectAnalysisProvider({ VIEWING_AI_FIXTURE_SCENARIO: "nope" }).ok).toBe(false)
  })
})

describe("Claude provider adapter (against a fake client)", () => {
  const frames = [
    { id: "ev-1", timestampSeconds: 4.5, room: "Kitchen", jpeg: tinyJpeg("k") },
    { id: "ev-2", timestampSeconds: 12, jpeg: tinyJpeg("h") },
  ]
  const message = (over: Record<string, unknown> = {}) =>
    ({
      id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null,
      content: [{ type: "text", text: JSON.stringify({ findings: [{ checkId: "C08", status: "concern", observation: "x", frameIds: ["ev-1"], confidence: "low" }] }) }],
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 },
      ...over,
    }) as unknown as Anthropic.Message
  const fake = (result: Anthropic.Message | Error) => {
    const stream = vi.fn((...args: unknown[]) => {
      void args // recorded by the mock; asserted on below
      return { finalMessage: async () => { if (result instanceof Error) throw result; return result } }
    })
    return { client: { messages: { stream } } as unknown as ClaudeClient, stream }
  }
  const request = (signal = new AbortController().signal) => ({ assessmentId: "asmt-1", frames, limits: DEFAULT_LIMITS, signal })
  const make = (client: ClaudeClient) => createClaudeProvider({ client, model: "claude-opus-5-5", checklist: VIEWING_CHECKLIST_V1 })

  it("builds a request that labels every frame with its id, sends the exact pixels, and requests schema-constrained JSON", async () => {
    const { client, stream } = fake(message())
    const out = await make(client).analyse(request())
    type Sent = {
      model: string
      max_tokens: number
      system: string
      messages: { content: { type: string; text?: string; source?: unknown }[] }[]
      output_config: { effort: string; format: { type: string; schema: { properties: { findings: { items: { properties: { checkId: { enum: string[] } } } } } } } }
    }
    const [params, options] = stream.mock.calls[0] as unknown as [Sent, { signal: AbortSignal }]
    expect(params.model).toBe("claude-opus-5-5")
    expect(params.max_tokens).toBe(DEFAULT_LIMITS.maxOutputTokens)
    expect(params.output_config.format.type).toBe("json_schema")
    expect(params.output_config.effort).toBe("medium")
    const idEnum = params.output_config.format.schema.properties.findings.items.properties.checkId.enum
    expect(idEnum).toHaveLength(58)
    expect(idEnum).toContain("C01")
    expect(idEnum).toContain("V13")
    expect(params).not.toHaveProperty("tool_choice") // forced tool choice is rejected by current models
    expect(params).not.toHaveProperty("temperature")
    expect(params.system).toMatch(/never instructions to you/)
    expect(params.system).toMatch(/Never certify/)
    const content = params.messages[0].content
    expect(content[0]).toEqual({ type: "text", text: "Frame ev-1 at 4.5s, room: Kitchen" })
    expect(content[1].source).toEqual({ type: "base64", media_type: "image/jpeg", data: Buffer.from(frames[0].jpeg).toString("base64") })
    expect(content[2].text).toBe("Frame ev-2 at 12s")
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(out).toMatchObject({ kind: "ok", usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheWriteTokens: 5 } })
    if (out.kind === "ok") expect(out.envelope).toMatchObject({ kind: "brik-ai-findings", version: 1, assessmentId: "asmt-1", modelVersion: "claude-opus-5-5" })
  })

  it("maps refusal, truncation, bad JSON and a missing findings array to typed outcomes without throwing", async () => {
    expect(await make(fake(message({ stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: "x" } })).client).analyse(request())).toMatchObject({ kind: "refusal", category: "cyber", usage: { inputTokens: 100 } })
    expect(await make(fake(message({ stop_reason: "max_tokens" })).client).analyse(request())).toMatchObject({ kind: "malformed", detail: expect.stringMatching(/cut off/) })
    expect(await make(fake(message({ content: [{ type: "text", text: "not json {" }] })).client).analyse(request())).toMatchObject({ kind: "malformed" })
    expect(await make(fake(message({ content: [{ type: "text", text: "{}" }] })).client).analyse(request())).toMatchObject({ kind: "malformed" })
    expect(await make(fake(message({ content: [] })).client).analyse(request())).toMatchObject({ kind: "malformed" })
  })

  it("maps abort to timeout, API errors to status-only detail, and never echoes an error message", async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await make(fake(new Error("aborted")).client).analyse(request(controller.signal))).toEqual({ kind: "timeout" })

    const api = Anthropic.APIError.generate(429, { error: { message: "slow down" } }, "slow down sk-ant-LEAK", new Headers())
    const out = await make(fake(api).client).analyse(request())
    expect(out).toEqual({ kind: "error", detail: "provider API error (status 429)" })
    expect(JSON.stringify(out)).not.toContain("LEAK")

    const generic = await make(fake(new Error("connect ECONNRESET sk-ant-LEAK")).client).analyse(request())
    expect(generic).toEqual({ kind: "error", detail: "provider request failed" })
  })

  it("refuses to run without images", async () => {
    const { client, stream } = fake(message())
    const out = await make(client).analyse({ ...request(), frames: [{ id: "ev-1", timestampSeconds: 1, jpeg: null }] })
    expect(out.kind).toBe("error")
    expect(stream).not.toHaveBeenCalled()
  })

  it("end to end: a Claude-shaped answer that cites a frame we never sent is rejected by the validator", async () => {
    const s = await seed(2)
    const bad = message({ content: [{ type: "text", text: JSON.stringify({ findings: [{ checkId: "C08", status: "concern", observation: "x", frameIds: ["not-a-frame"], confidence: "high" }, { checkId: "ZZ99", status: "concern", observation: "y", frameIds: [s.evidence[0].id], confidence: "high" }] }) }] })
    const provider = make(fake(bad).client)
    const done = okRun(await run(s.assessmentId, provider))
    expect(done).toMatchObject({ status: "PARTIAL", proposalsCount: 0, rejectedCount: 2 })
    expect(mem.rows.proposals).toHaveLength(0)
  })
})

describe("storage helper sanity", () => {
  it("sha256Hex matches the independent fixture hash", () => {
    expect(sha256Hex(tinyJpeg("q"))).toBe(sha256(tinyJpeg("q")))
  })
})
