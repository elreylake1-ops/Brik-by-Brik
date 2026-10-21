import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  MAX_RUN_ATTEMPTS,
  RunLeaseLostError,
  type ViewingAssessmentRepository,
} from "@/lib/viewing-assessment/viewing-assessment-repository"
import type { DraftAiFinding, ProposalFeedbackRecord, ReviewDecision } from "@/types/viewing-assessment"

// Behavioural contract every ViewingAssessmentRepository implementation must satisfy.
// Run against the in-memory double on every test run, and against Postgres only in an explicitly
// confirmed, isolated QA database (see __tests__/postgres/). Same assertions, so the double cannot
// silently drift from the real implementation.

export type ContractEnv = {
  repo: ViewingAssessmentRepository
  dealA: string
  dealB: string
  cleanup: () => Promise<void>
}

const clip = { filename: "a.mp4", mimeType: "video/mp4", sizeBytes: 10, durationSeconds: 60, contentSha256: "a".repeat(64) }
const decision = (over: Partial<ReviewDecision> = {}) =>
  ({ disposition: "ACCEPTED", reviewerId: "operator-1", reviewedAt: "2026-10-20T10:00:00.000Z", ...over }) as ReviewDecision
const feedbackFor = (p: DraftAiFinding, d: ReviewDecision): ProposalFeedbackRecord => ({
  proposalId: p.id,
  assessmentId: p.assessmentId,
  checkId: p.checkId,
  modelVersion: p.modelVersion,
  original: { status: p.status, observation: p.observation, confidence: p.confidence },
  disposition: d.disposition,
  humanCorrection: d.disposition === "EDITED" ? { status: d.status, observation: d.observation } : null,
  reviewerId: d.reviewerId,
  reviewedAt: d.reviewedAt,
  actualOutcome: null,
})

export function defineViewingRepositoryContract(label: string, setup: () => Promise<ContractEnv>) {
  describe(`ViewingAssessmentRepository contract: ${label}`, () => {
    let env: ContractEnv
    beforeEach(async () => {
      env = await setup()
    })
    afterEach(async () => {
      await env.cleanup()
    })

    async function seed(dealId = env.dealA) {
      const { repo } = env
      const { record } = await repo.createAssessment({ dealId, idempotencyKey: "key-0001-abcd", checklistVersion: "v1", createdBy: "op" })
      const added = await repo.addAsset(dealId, record.id, { asset: clip, frames: [{ timestampSeconds: 4, room: "Kitchen" }, { timestampSeconds: 9 }], createdBy: "op" })
      if (added?.status !== "ok") throw new Error("seed asset failed")
      const started = await repo.startRun(dealId, record.id, { idempotencyKey: "run-0001-abcd", modelVersion: "m-1", createdBy: "op" })
      const runId = started!.run.id
      const draft = (n: number): DraftAiFinding => ({
        id: `${runId}:P${n}`,
        assessmentId: record.id,
        checkId: n === 1 ? "C08" : "C10",
        status: "CONCERN",
        observation: `finding ${n}`,
        evidenceIds: [added.evidence[0].id],
        confidence: "low",
        modelVersion: "m-1",
        verification: "UNVERIFIED",
        disposition: "PENDING",
      })
      await repo.completeRun(runId, { attempt: 1, status: "READY_FOR_REVIEW", proposals: [draft(1), draft(2)], rejectedCount: 0 })
      return { assessmentId: record.id, runId, evidence: added.evidence, proposalIds: [`${runId}:P1`, `${runId}:P2`] }
    }

    it("creates assessments idempotently per deal and key", async () => {
      const { repo, dealA, dealB } = env
      const input = { idempotencyKey: "key-0001-abcd", checklistVersion: "v1", createdBy: "op" }
      const first = await repo.createAssessment({ dealId: dealA, ...input })
      const again = await repo.createAssessment({ dealId: dealA, ...input })
      const other = await repo.createAssessment({ dealId: dealB, ...input })
      expect([first.created, again.created, other.created]).toEqual([true, false, true])
      expect(again.record.id).toBe(first.record.id)
      expect(other.record.id).not.toBe(first.record.id)
      expect((await repo.listAssessments(dealA)).map((a) => a.id)).toEqual([first.record.id])
    })

    it("scopes every read and write by deal", async () => {
      const { repo, dealB } = env
      const s = await seed()
      expect(await repo.getAssessment(dealB, s.assessmentId)).toBeNull()
      expect(await repo.listAssets(dealB, s.assessmentId)).toBeNull()
      expect(await repo.getEvidenceContext(dealB, s.assessmentId)).toBeNull()
      expect(await repo.listRuns(dealB, s.assessmentId)).toBeNull()
      expect(await repo.listProposals(dealB, s.assessmentId)).toBeNull()
      expect(await repo.listFeedback(dealB, s.assessmentId)).toBeNull()
      expect(await repo.addAsset(dealB, s.assessmentId, { asset: { ...clip, contentSha256: "b".repeat(64) }, frames: [{ timestampSeconds: 1 }], createdBy: "x" })).toBeNull()
      expect(await repo.startRun(dealB, s.assessmentId, { idempotencyKey: "run-9999-abcd", modelVersion: "m", createdBy: "x" })).toBeNull()
      const d = decision()
      expect(await repo.recordReview(dealB, s.assessmentId, s.proposalIds[0], { expectedRevision: 0, decision: d, feedback: feedbackFor((await repo.listProposals(env.dealA, s.assessmentId))![0].proposal, d) })).toBeNull()
    })

    it("stores clip metadata and frames, and rejects a duplicate clip hash without adding frames", async () => {
      const { repo, dealA } = env
      const s = await seed()
      const ctx = await repo.getEvidenceContext(dealA, s.assessmentId)
      expect(ctx!.evidence).toHaveLength(2)
      expect(ctx!.assets).toEqual([{ id: expect.any(String), durationSeconds: 60 }])
      expect(ctx!.evidence[0]).toMatchObject({ clipFilename: "a.mp4", timestampSeconds: 4, room: "Kitchen" })
      const dup = await repo.addAsset(dealA, s.assessmentId, { asset: clip, frames: [{ timestampSeconds: 1 }], createdBy: "op" })
      expect(dup).toEqual({ status: "duplicate_asset" })
      expect((await repo.getEvidenceContext(dealA, s.assessmentId))!.evidence).toHaveLength(2)
      const assets = await repo.listAssets(dealA, s.assessmentId)
      expect(JSON.stringify(assets).toLowerCase()).not.toContain("storage")
    })

    it("round-trips frame-capture provenance without changing evidence ids", async () => {
      const { repo, dealA } = env
      const { record } = await repo.createAssessment({ dealId: dealA, idempotencyKey: "provenance-key", checklistVersion: "v1", createdBy: "op" })
      const added = await repo.addAsset(dealA, record.id, {
        asset: clip,
        frames: [{ timestampSeconds: 11.52, requestedTimestampSeconds: 11.5, captureMethod: "video-frame-callback", captureConfidence: "presented-frame-confirmed" }],
        createdBy: "op",
      })
      expect(added?.status).toBe("ok")
      if (!added || added.status !== "ok") return
      const stored = (await repo.getEvidenceContext(dealA, record.id))!.evidence[0]
      expect(stored).toMatchObject({
        id: added.evidence[0].id,
        timestampSeconds: 11.52,
        requestedTimestampSeconds: 11.5,
        captureMethod: "video-frame-callback",
        captureConfidence: "presented-frame-confirmed",
      })
    })

    it("replays a run key, completes once, and reopens a failed run with a higher attempt count", async () => {
      const { repo, dealA } = env
      const s = await seed()
      const replay = await repo.startRun(dealA, s.assessmentId, { idempotencyKey: "run-0001-abcd", modelVersion: "m-1", createdBy: "op" })
      expect(replay).toMatchObject({ created: false, run: { id: s.runId, status: "READY_FOR_REVIEW", proposalsCount: 2 } })
      await expect(repo.completeRun(s.runId, { attempt: 1, status: "READY_FOR_REVIEW", proposals: [], rejectedCount: 0 })).rejects.toThrow(RunLeaseLostError)

      const failing = await repo.startRun(dealA, s.assessmentId, { idempotencyKey: "run-0002-abcd", modelVersion: "m-1", createdBy: "op" })
      await repo.completeRun(failing!.run.id, { attempt: 1, status: "FAILED", proposals: [], rejectedCount: 0, errorCode: "ANALYSIS_FAILED" })
      const reopened = await repo.startRun(dealA, s.assessmentId, { idempotencyKey: "run-0002-abcd", modelVersion: "m-1", createdBy: "op" })
      expect(reopened).toMatchObject({ created: true, run: { id: failing!.run.id, status: "RUNNING", attemptCount: 2 } })
    })

    describe("processing lease", () => {
      const key = { idempotencyKey: "lease-key-0001", modelVersion: "m-1", createdBy: "op" }
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
      const finish = (runId: string, attempt: number, status: "FAILED" | "READY_FOR_REVIEW" = "FAILED") =>
        env.repo.completeRun(runId, { attempt, status, proposals: [], rejectedCount: 0 })
      async function assessment() {
        const { record } = await env.repo.createAssessment({ dealId: env.dealA, idempotencyKey: "key-0001-abcd", checklistVersion: "v1", createdBy: "op" })
        return record.id
      }

      it("does not reclaim a RUNNING run inside its lease", async () => {
        const id = await assessment()
        const first = await env.repo.startRun(env.dealA, id, key)
        const again = await env.repo.startRun(env.dealA, id, { ...key, leaseSeconds: 3600 })
        expect(again).toMatchObject({ created: false, run: { id: first!.run.id, status: "RUNNING", attemptCount: 1 } })
      })

      it("reclaims an abandoned run after the lease, and fences out the zombie attempt", async () => {
        const id = await assessment()
        const first = await env.repo.startRun(env.dealA, id, key)
        await sleep(1100)
        const reclaimed = await env.repo.startRun(env.dealA, id, { ...key, leaseSeconds: 1 })
        expect(reclaimed).toMatchObject({ created: true, run: { id: first!.run.id, status: "RUNNING", attemptCount: 2 } })
        await expect(finish(first!.run.id, 1, "READY_FOR_REVIEW")).rejects.toThrow(RunLeaseLostError) // zombie
        await expect(finish(first!.run.id, 2, "READY_FOR_REVIEW")).resolves.toMatchObject({ status: "READY_FOR_REVIEW" })
      })

      it("lets exactly one of two concurrent claimants reclaim a stale run", async () => {
        const id = await assessment()
        await env.repo.startRun(env.dealA, id, key)
        await sleep(1100)
        const results = await Promise.all([
          env.repo.startRun(env.dealA, id, { ...key, leaseSeconds: 1 }),
          env.repo.startRun(env.dealA, id, { ...key, leaseSeconds: 1 }),
        ])
        expect(results.map((r) => r?.created).sort()).toEqual([false, true])
        expect(results.map((r) => r?.run.attemptCount)).toEqual([2, 2])
      })

      it("stops retrying a failing run after the attempt bound", async () => {
        const id = await assessment()
        let run = (await env.repo.startRun(env.dealA, id, key))!.run
        for (let attempt = 1; attempt < MAX_RUN_ATTEMPTS; attempt++) {
          await finish(run.id, attempt)
          const next = await env.repo.startRun(env.dealA, id, key)
          expect(next).toMatchObject({ created: true, run: { attemptCount: attempt + 1 } })
          run = next!.run
        }
        await finish(run.id, MAX_RUN_ATTEMPTS)
        const exhausted = await env.repo.startRun(env.dealA, id, key)
        expect(exhausted).toMatchObject({ created: false, run: { status: "FAILED", attemptCount: MAX_RUN_ATTEMPTS } })
      })

      it("parks a stale run that has no attempts left instead of leaving it in progress", async () => {
        const id = await assessment()
        let run = (await env.repo.startRun(env.dealA, id, key))!.run
        for (let attempt = 1; attempt < MAX_RUN_ATTEMPTS; attempt++) {
          await finish(run.id, attempt)
          run = (await env.repo.startRun(env.dealA, id, key))!.run
        }
        await sleep(1100) // attempt MAX is RUNNING and abandoned
        const parked = await env.repo.startRun(env.dealA, id, { ...key, leaseSeconds: 1 })
        expect(parked).toMatchObject({ created: false, run: { status: "FAILED", errorCode: "MAX_ATTEMPTS_EXCEEDED" } })
      })
    })

    describe("deterministic ordering (never by generated ids)", () => {
      it("returns proposals in submission order even when ids sort the opposite way and exceed nine", async () => {
        const { repo, dealA } = env
        const { record } = await repo.createAssessment({ dealId: dealA, idempotencyKey: "key-0001-abcd", checklistVersion: "v1", createdBy: "op" })
        const added = await repo.addAsset(dealA, record.id, { asset: clip, frames: [{ timestampSeconds: 1 }], createdBy: "op" })
        if (added?.status !== "ok") throw new Error("seed asset failed")
        const run = (await repo.startRun(dealA, record.id, { idempotencyKey: "run-0001-abcd", modelVersion: "m-1", createdBy: "op" }))!.run
        // ids 'z', 'y', 'x', ... : alphabetical order is the REVERSE of submission order
        const drafts: DraftAiFinding[] = Array.from({ length: 14 }, (_, i) => ({
          id: `${run.id}:${String.fromCharCode(122 - i)}`,
          assessmentId: record.id,
          checkId: "C08",
          status: "CONCERN" as const,
          observation: `finding ${i}`,
          evidenceIds: [added.evidence[0].id],
          confidence: "low" as const,
          modelVersion: "m-1",
          verification: "UNVERIFIED" as const,
          disposition: "PENDING" as const,
        }))
        await repo.completeRun(run.id, { attempt: 1, status: "READY_FOR_REVIEW", proposals: drafts, rejectedCount: 0 })
        for (let read = 0; read < 3; read++) {
          const items = (await repo.listProposals(dealA, record.id))!
          expect(items.map((i) => i.proposal.observation)).toEqual(drafts.map((d) => d.observation))
        }
      })

      it("returns frames by clip upload order, then time, then submission order, including equal timestamps", async () => {
        const { repo, dealA } = env
        const { record } = await repo.createAssessment({ dealId: dealA, idempotencyKey: "key-0001-abcd", checklistVersion: "v1", createdBy: "op" })
        const rooms = ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7"]
        await repo.addAsset(dealA, record.id, { asset: clip, frames: rooms.map((room) => ({ timestampSeconds: 5, room })), createdBy: "op" })
        await repo.addAsset(dealA, record.id, { asset: { ...clip, filename: "b.mp4", contentSha256: "b".repeat(64) }, frames: [{ timestampSeconds: 30, room: "b-late" }, { timestampSeconds: 2, room: "b-early" }], createdBy: "op" })
        for (let read = 0; read < 3; read++) {
          const ctx = (await repo.getEvidenceContext(dealA, record.id))!
          expect(ctx.evidence.map((e) => e.room)).toEqual([...rooms, "b-early", "b-late"])
        }
      })
    })

    describe("frame images, usage ledger and abandoned runs", () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
      const key = (n: number) => `blob_${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`
      const blob = (n: number, sha = String(n).repeat(64).slice(0, 64)) => ({ storageKey: key(n), sha256: sha, sizeBytes: 1000 + n, mimeType: "image/jpeg" as const, createdBy: "op" })
      const usage = (over: Record<string, unknown> = {}) => ({
        provider: "claude" as const, modelVersion: "claude-opus-5-5", promptVersion: "p-1", frameCount: 2,
        inputTokens: 1000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0, costMicros: 14_000,
        simulated: false, outcome: "OK" as const, ...over,
      })

      it("stores one immutable image record per frame: identical replay is idempotent, a different image conflicts", async () => {
        const { repo, dealA } = env
        const s = await seed()
        const frame = s.evidence[0].id
        const created = await repo.putEvidenceBlob(dealA, s.assessmentId, frame, blob(1))
        expect(created).toMatchObject({ status: "created", meta: { evidenceId: frame, sha256: "1".repeat(64), sizeBytes: 1001, mimeType: "image/jpeg" } })
        expect(await repo.putEvidenceBlob(dealA, s.assessmentId, frame, blob(2, "1".repeat(64)))).toMatchObject({ status: "exists_same" })
        expect(await repo.putEvidenceBlob(dealA, s.assessmentId, frame, blob(3, "3".repeat(64)))).toEqual({ status: "conflict" })
        expect((await repo.getEvidenceBlobLocation(dealA, s.assessmentId, frame))!.sha256).toBe("1".repeat(64)) // the first image stands
      })

      it("keeps the storage key internal: the list exposes only non-secret metadata", async () => {
        const { repo, dealA } = env
        const s = await seed()
        await repo.putEvidenceBlob(dealA, s.assessmentId, s.evidence[0].id, blob(1))
        const location = await repo.getEvidenceBlobLocation(dealA, s.assessmentId, s.evidence[0].id)
        expect(location).toMatchObject({ storageKey: key(1) })
        const listed = (await repo.listEvidenceBlobs(dealA, s.assessmentId))!
        expect(listed).toHaveLength(1)
        expect(Object.keys(listed[0]).sort()).toEqual(["evidenceId", "mimeType", "sha256", "sizeBytes"])
        expect(JSON.stringify(listed)).not.toContain("blob_")
      })

      it("scopes image records by deal and assessment, and refuses unknown frames", async () => {
        const { repo, dealA, dealB } = env
        const s = await seed()
        const frame = s.evidence[0].id
        expect(await repo.putEvidenceBlob(dealB, s.assessmentId, frame, blob(1))).toBeNull()
        expect(await repo.putEvidenceBlob(dealA, s.assessmentId, "no-such-frame", blob(1))).toBeNull()
        await repo.putEvidenceBlob(dealA, s.assessmentId, frame, blob(1))
        expect(await repo.getEvidenceBlobLocation(dealB, s.assessmentId, frame)).toBeNull()
        expect(await repo.getEvidenceBlobLocation(dealA, "other-assessment", frame)).toBeNull()
        expect(await repo.listEvidenceBlobs(dealB, s.assessmentId)).toBeNull()
        expect(await repo.getEvidenceBlobLocation(dealA, s.assessmentId, s.evidence[1].id)).toBeNull() // no image stored for it yet
      })

      it("appends usage in the same step as the run result and totals only PAID usage", async () => {
        const { repo, dealA } = env
        const s = await seed()
        const paid = (await repo.startRun(dealA, s.assessmentId, { idempotencyKey: "paid-run-0001", modelVersion: "claude-opus-5-5", createdBy: "op", provider: "claude" }))!.run
        await repo.completeRun(paid.id, { attempt: 1, status: "READY_FOR_REVIEW", proposals: [], rejectedCount: 0, usage: usage() })
        const sim = (await repo.startRun(dealA, s.assessmentId, { idempotencyKey: "sim-run-00001", modelVersion: "fixture-v1", createdBy: "op", provider: "fixture" }))!.run
        await repo.completeRun(sim.id, { attempt: 1, status: "READY_FOR_REVIEW", proposals: [], rejectedCount: 0, usage: usage({ provider: "fixture", simulated: true, costMicros: 0 }) })
        const all = await repo.getAiUsageSummary("2000-01-01T00:00:00Z")
        expect(all).toMatchObject({ totalCostMicros: 14_000, sinceCostMicros: 14_000, sinceRuns: 1 }) // the simulated run is free and not counted
        expect(await repo.getAiUsageSummary("2999-01-01T00:00:00Z")).toEqual({ totalCostMicros: 14_000, sinceCostMicros: 0, sinceRuns: 0 })
        const runs = (await repo.listRuns(dealA, s.assessmentId))!
        expect(runs.map((r) => r.provider).sort()).toEqual(["claude", "fixture", "mock"])
      })

      it("records no usage when the run result is rejected (a fenced-out attempt writes nothing)", async () => {
        const { repo, dealA } = env
        const s = await seed()
        const run = (await repo.startRun(dealA, s.assessmentId, { idempotencyKey: "fence-run-0001", modelVersion: "claude-opus-5-5", createdBy: "op", provider: "claude" }))!.run
        await repo.completeRun(run.id, { attempt: 1, status: "FAILED", proposals: [], rejectedCount: 0, errorCode: "X" })
        await expect(repo.completeRun(run.id, { attempt: 1, status: "READY_FOR_REVIEW", proposals: [], rejectedCount: 0, usage: usage({ costMicros: 5_000_000 }) })).rejects.toThrow(RunLeaseLostError)
        expect((await repo.getAiUsageSummary("2000-01-01T00:00:00Z")).totalCostMicros).toBe(0)
      })

      it("lists RUNNING runs whose lease expired, with what a worker needs to re-drive them", async () => {
        const { repo, dealA } = env
        const s = await seed()
        const run = (await repo.startRun(dealA, s.assessmentId, { idempotencyKey: "stale-run-0001", modelVersion: "fixture-v1", createdBy: "op", provider: "fixture" }))!.run
        expect(await repo.listAbandonedRuns({ leaseSeconds: 3600, limit: 10 })).toEqual([])
        await sleep(1100)
        expect(await repo.listAbandonedRuns({ leaseSeconds: 1, limit: 10 })).toEqual([
          { runId: run.id, dealId: dealA, assessmentId: s.assessmentId, idempotencyKey: "stale-run-0001", attemptCount: 1, provider: "fixture" },
        ])
        await repo.completeRun(run.id, { attempt: 1, status: "READY_FOR_REVIEW", proposals: [], rejectedCount: 0 })
        expect(await repo.listAbandonedRuns({ leaseSeconds: 1, limit: 10 })).toEqual([]) // finished runs are not abandoned
      })
    })

    describe("actual outcomes and usage accounting", () => {
      const outcome = (over: Record<string, unknown> = {}) => ({
        result: "CONFIRMED" as const, source: "SURVEY" as const, observedStatus: "SPECIALIST_REVIEW" as const,
        note: "Surveyor confirmed movement.", recordedBy: "op-2", recordedAt: "2026-10-20T09:00:00.000Z", ...over,
      })

      it("appends an outcome that snapshots the prediction and the human decision at that moment", async () => {
        const { repo, dealA } = env
        const s = await seed()
        const target = (await repo.listProposals(dealA, s.assessmentId))![0].proposal
        const first = await repo.recordOutcome(dealA, s.assessmentId, target.id, outcome())
        expect(first).toMatchObject({
          kind: "ACTUAL_OUTCOME", proposalId: target.id, checkId: target.checkId, modelVersion: target.modelVersion,
          original: { status: target.status, observation: target.observation, confidence: target.confidence },
          disposition: null, humanCorrection: null, // not reviewed yet
          actualOutcome: { result: "CONFIRMED", source: "SURVEY", observedStatus: "SPECIALIST_REVIEW", note: "Surveyor confirmed movement." },
        })

        const edit = decision({ disposition: "EDITED", status: "SPECIALIST_REVIEW", observation: "corrected" } as Partial<ReviewDecision>)
        await repo.recordReview(dealA, s.assessmentId, target.id, { expectedRevision: 0, decision: edit, feedback: feedbackFor(target, edit) })
        const second = await repo.recordOutcome(dealA, s.assessmentId, target.id, outcome({ result: "PARTIALLY_CONFIRMED", observedStatus: null, note: "Only partly.", recordedAt: "2026-10-20T11:00:00.000Z" }))
        expect(second).toMatchObject({ disposition: "EDITED", humanCorrection: { status: "SPECIALIST_REVIEW", observation: "corrected" }, actualOutcome: { result: "PARTIALLY_CONFIRMED", observedStatus: null } })

        const history = (await repo.listFeedback(dealA, s.assessmentId))!
        expect(history.map((f) => f.kind)).toEqual(["ACTUAL_OUTCOME", "REVIEW", "ACTUAL_OUTCOME"])
        expect(history[0]).toMatchObject({ disposition: null, humanCorrection: null }) // the earlier snapshot was not rewritten by the later review
        expect(history[2].actualOutcome).toMatchObject({ result: "PARTIALLY_CONFIRMED" })
      })

      it("never touches the proposal or its reviews", async () => {
        const { repo, dealA } = env
        const s = await seed()
        const before = JSON.stringify(await repo.listProposals(dealA, s.assessmentId))
        await repo.recordOutcome(dealA, s.assessmentId, s.proposalIds[0], outcome())
        await repo.recordOutcome(dealA, s.assessmentId, s.proposalIds[1], outcome({ result: "NOT_CONFIRMED" }))
        expect(JSON.stringify(await repo.listProposals(dealA, s.assessmentId))).toBe(before)
      })

      it("is scoped by deal and refuses unknown proposals", async () => {
        const { repo, dealA, dealB } = env
        const s = await seed()
        expect(await repo.recordOutcome(dealB, s.assessmentId, s.proposalIds[0], outcome())).toBeNull()
        expect(await repo.recordOutcome(dealA, s.assessmentId, "no-such-proposal", outcome())).toBeNull()
        expect(await repo.recordOutcome(dealA, "no-such-assessment", s.proposalIds[0], outcome())).toBeNull()
        expect((await repo.listFeedback(dealA, s.assessmentId))!.filter((f) => f.kind === "ACTUAL_OUTCOME")).toHaveLength(0)
      })

      it("returns usage accounting rows (prompt version, tokens, cost), scoped by deal", async () => {
        const { repo, dealA, dealB } = env
        const s = await seed()
        const run = (await repo.startRun(dealA, s.assessmentId, { idempotencyKey: "usage-run-0001", modelVersion: "claude-opus-5-5", createdBy: "op", provider: "claude" }))!.run
        await repo.completeRun(run.id, {
          attempt: 1, status: "READY_FOR_REVIEW", proposals: [], rejectedCount: 0,
          usage: { provider: "claude", modelVersion: "claude-opus-5-5", promptVersion: "viewing-prompt-v1", frameCount: 3, inputTokens: 15_600, outputTokens: 4_000, cacheReadTokens: 10, cacheWriteTokens: 20, costMicros: 142_400, simulated: false, outcome: "OK" },
        })
        const rows = (await repo.listRunUsage(dealA, s.assessmentId))!
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ runId: run.id, attempt: 1, provider: "claude", promptVersion: "viewing-prompt-v1", frameCount: 3, inputTokens: 15_600, outputTokens: 4_000, cacheReadTokens: 10, cacheWriteTokens: 20, costMicros: 142_400, simulated: false, outcome: "OK" })
        expect(typeof rows[0].recordedAt).toBe("string")
        expect(await repo.listRunUsage(dealB, s.assessmentId)).toBeNull()
      })
    })

    it("lists proposals as UNVERIFIED and PENDING with their evidence", async () => {
      const s = await seed()
      const items = (await env.repo.listProposals(env.dealA, s.assessmentId))!
      expect(items).toHaveLength(2)
      expect(items[0].proposal).toMatchObject({ verification: "UNVERIFIED", disposition: "PENDING", evidenceIds: [s.evidence[0].id] })
      expect(items.every((i) => i.currentReview === null && i.reviewHistory.length === 0)).toBe(true)
    })

    it("appends review revisions with optimistic concurrency and keeps the original prediction", async () => {
      const { repo, dealA } = env
      const s = await seed()
      const original = (await repo.listProposals(dealA, s.assessmentId))![0].proposal
      const edit = decision({ disposition: "EDITED", status: "SPECIALIST_REVIEW", observation: "corrected" } as Partial<ReviewDecision>)
      const reject = decision({ disposition: "REJECTED", reason: "shadow" } as Partial<ReviewDecision>)

      const first = await repo.recordReview(dealA, s.assessmentId, original.id, { expectedRevision: 0, decision: edit, feedback: feedbackFor(original, edit) })
      expect(first).toMatchObject({ status: "ok", review: { revision: 1, disposition: "EDITED", editedStatus: "SPECIALIST_REVIEW", editedObservation: "corrected" } })
      const stale = await repo.recordReview(dealA, s.assessmentId, original.id, { expectedRevision: 0, decision: reject, feedback: feedbackFor(original, reject) })
      expect(stale).toEqual({ status: "stale_revision" })
      const second = await repo.recordReview(dealA, s.assessmentId, original.id, { expectedRevision: 1, decision: reject, feedback: feedbackFor(original, reject) })
      expect(second).toMatchObject({ status: "ok", review: { revision: 2, disposition: "REJECTED", reason: "shadow" } })
      expect(await repo.recordReview(dealA, s.assessmentId, "no-such-proposal", { expectedRevision: 0, decision: edit, feedback: feedbackFor(original, edit) })).toBeNull()

      const after = (await repo.listProposals(dealA, s.assessmentId))![0]
      expect(after.proposal.observation).toBe(original.observation)
      expect(after.proposal.status).toBe(original.status)
      expect(after.reviewHistory.map((r) => r.revision)).toEqual([1, 2])
      expect(after.currentReview?.disposition).toBe("REJECTED")

      const feedback = (await repo.listFeedback(dealA, s.assessmentId))!
      expect(feedback).toHaveLength(2)
      expect(feedback[0]).toMatchObject({ kind: "REVIEW", original: { observation: original.observation }, humanCorrection: { status: "SPECIALIST_REVIEW", observation: "corrected" }, actualOutcome: null })
      expect(feedback[1]).toMatchObject({ disposition: "REJECTED", humanCorrection: null })
    })
  })
}
