import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { FinancialProposalRepository, NewFinancialDecision, NewFinancialProposal } from "@/lib/refurb-integration/financial-proposal-repository"
import type { MeasurementRepository, NewMeasurementSet } from "@/lib/refurb-integration/measurement-repository"
import { FINANCIAL_PROPOSAL_VERSION, type FinancialProposalContent } from "@/types/refurb-financial"
import type { MeasurementEntry } from "@/types/refurb-measurements"

// Behavioural contracts for the measurement and financial-proposal repositories: the in-memory doubles and real PostgreSQL
// must agree.

const hex = (c: string) => c.repeat(64)

// ------------------------------------------------------------------ measurements

export type MeasurementContractEnv = {
  measurements: MeasurementRepository
  dealA: string
  dealB: string
  assessmentA1: string
  assessmentA2: string
  assessmentB1: string
  cleanup: () => Promise<void>
}

const entries = (bedrooms = 3): MeasurementEntry[] => [
  { key: "bedrooms", value: bedrooms, unit: "count", basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "" },
  { key: "floorAreaSqm", value: null, unit: "sqm", basis: "UNKNOWN", source: null, confidence: null, note: "Not yet visited" },
]

export function measurementInput(env: MeasurementContractEnv, over: Partial<NewMeasurementSet> = {}): NewMeasurementSet {
  return {
    dealId: env.dealA,
    assessmentId: env.assessmentA1,
    basedOnVersion: 0,
    idempotencyKey: "measure-key-0001",
    requestHash: hex("a"),
    entries: entries(),
    warnings: [{ code: "FLOOR_AREA_UNKNOWN", key: "floorAreaSqm", message: "unknown" }],
    changeNote: null,
    recordedBy: "operator-1",
    recordedAt: "2026-10-23T10:00:00.000Z",
    ...over,
  }
}

export function defineMeasurementRepositoryContract(label: string, setup: () => Promise<MeasurementContractEnv>) {
  describe(`MeasurementRepository contract: ${label}`, () => {
    let env: MeasurementContractEnv
    beforeEach(async () => {
      env = await setup()
    })
    afterEach(async () => {
      await env.cleanup()
    })

    it("stores version 1 and round-trips every field, including UNKNOWN values as null", async () => {
      const input = measurementInput(env)
      const r = await env.measurements.create(input)
      expect(r.status).toBe("created")
      if (r.status !== "created") return
      expect(r.record).toMatchObject({ dealId: env.dealA, assessmentId: env.assessmentA1, version: 1, basedOnVersion: 0, idempotencyKey: "measure-key-0001", changeNote: null, recordedBy: "operator-1", recordedAt: "2026-10-23T10:00:00.000Z" })
      expect(r.record.entries).toEqual(input.entries)
      expect(r.record.warnings).toEqual(input.warnings)
      expect(await env.measurements.getCurrent(env.dealA, env.assessmentA1)).toEqual(r.record)
      expect(await env.measurements.getById(env.dealA, env.assessmentA1, r.record.id)).toEqual(r.record)
    })

    it("accepts a new version only when it is based on the current one, and keeps every earlier version", async () => {
      const v1 = await env.measurements.create(measurementInput(env))
      expect(await env.measurements.create(measurementInput(env, { idempotencyKey: "measure-key-0002", requestHash: hex("b"), basedOnVersion: 0 }))).toEqual({ status: "stale_base", currentVersion: 1 })
      expect(await env.measurements.create(measurementInput(env, { idempotencyKey: "measure-key-0003", requestHash: hex("c"), basedOnVersion: 5 }))).toEqual({ status: "stale_base", currentVersion: 1 })
      const v2 = await env.measurements.create(measurementInput(env, { idempotencyKey: "measure-key-0004", requestHash: hex("d"), basedOnVersion: 1, entries: entries(4), changeNote: "There is a fourth bedroom" }))
      expect(v2.status === "created" && [v2.record.version, v2.record.basedOnVersion, v2.record.changeNote]).toEqual([2, 1, "There is a fourth bedroom"])
      const list = await env.measurements.list(env.dealA, env.assessmentA1)
      expect(list.map((x) => x.version)).toEqual([2, 1])
      expect(v1.status === "created" && list[1]).toEqual(v1.status === "created" ? v1.record : null)
      expect(list[1].entries[0].value).toBe(3)
    })

    it("treats the same key and request as a replay and a different request as key reuse", async () => {
      const first = await env.measurements.create(measurementInput(env))
      const again = await env.measurements.create(measurementInput(env))
      expect(again.status).toBe("replayed")
      expect(first.status === "created" && again.status === "replayed" && again.record).toEqual(first.status === "created" ? first.record : null)
      expect(await env.measurements.create(measurementInput(env, { requestHash: hex("e") }))).toEqual({ status: "key_reused" })
      expect((await env.measurements.list(env.dealA, env.assessmentA1)).length).toBe(1)
      const found = await env.measurements.findByKey(env.dealA, env.assessmentA1, "measure-key-0001")
      expect(found?.requestHash).toBe(hex("a"))
      expect(await env.measurements.findByKey(env.dealA, env.assessmentA1, "no-such-key")).toBeNull()
    })

    it("lets exactly one of several concurrent writers win a version", async () => {
      const racers = await Promise.all(Array.from({ length: 5 }, (_, i) => env.measurements.create(measurementInput(env, { idempotencyKey: `measure-race-000${i}`, requestHash: hex(String(i)) }))))
      expect(racers.filter((r) => r.status === "created")).toHaveLength(1)
      expect(racers.filter((r) => r.status === "stale_base")).toHaveLength(4)
      const same = await Promise.all(Array.from({ length: 5 }, () => env.measurements.create(measurementInput(env, { idempotencyKey: "measure-same-key", requestHash: hex("f"), basedOnVersion: 1, changeNote: "Correcting the first set" }))))
      expect(same.filter((r) => r.status === "created")).toHaveLength(1)
      expect(same.filter((r) => r.status === "replayed")).toHaveLength(4)
    })

    it("numbers versions per assessment and scopes every read by deal AND assessment", async () => {
      await env.measurements.create(measurementInput(env))
      const other = await env.measurements.create(measurementInput(env, { assessmentId: env.assessmentA2 }))
      expect(other.status === "created" && other.record.version).toBe(1)
      expect(await env.measurements.getCurrent(env.dealB, env.assessmentA1)).toBeNull()
      expect(await env.measurements.getCurrent(env.dealA, env.assessmentB1)).toBeNull()
      expect(await env.measurements.list(env.dealB, env.assessmentA1)).toEqual([])
      const mine = await env.measurements.getCurrent(env.dealA, env.assessmentA1)
      expect(await env.measurements.getById(env.dealB, env.assessmentA1, mine!.id)).toBeNull()
      expect(await env.measurements.getById(env.dealA, env.assessmentA2, mine!.id)).toBeNull()
      expect(await env.measurements.findByKey(env.dealB, env.assessmentA1, "measure-key-0001")).toBeNull()
    })
  })
}

// ------------------------------------------------------------------ financial proposals and decisions

export type FinancialContractEnv = {
  proposals: FinancialProposalRepository
  dealA: string
  dealB: string
  assessmentA1: string
  assessmentB1: string
  /** plans that exist: planA1 and planA1b belong to dealA/assessmentA1, planB1 to dealB/assessmentB1 */
  planA1: string
  planA1b: string
  planB1: string
  cleanup: () => Promise<void>
}

export function proposalContent(over: Partial<FinancialProposalContent> = {}): FinancialProposalContent {
  return {
    version: FINANCIAL_PROPOSAL_VERSION,
    nonAuthoritative: true,
    plan: { planId: "p", planVersion: 1, confirmedBy: "operator-1", confirmedAt: "2026-10-23T09:00:00.000Z", analysisSource: "SIMULATED", measurementSetId: null, measurementSetVersion: null, sourceReviewers: ["operator-1"], acceptedItems: [] },
    authoritative: { dealId: "d", storedUpdatedAt: "2026-10-01T09:30:00.000Z", purchasePrice: 100000, gdvRealistic: 190000, refurbCost: 25000, classification: "C", governanceState: "G", capitalProtectionState: "P", pipelineState: "UNDER_ANALYSIS", storedEngineResult: null },
    recalculatedBaseline: null,
    proposed: null,
    delta: null,
    storedVersusRecalculated: { comparable: false, consistent: null, differences: [] },
    changedAssumptions: ["a"],
    exclusions: [{ itemId: "x", label: "X", reason: "no template" }],
    unresolvedQuantities: ["q"],
    blockedBy: [],
    completeness: "HAS_EXCLUSIONS_OR_UNRESOLVED_QUANTITIES",
    notes: ["n"],
    ...over,
  }
}

export function proposalInput(env: FinancialContractEnv, over: Partial<NewFinancialProposal> = {}): NewFinancialProposal {
  return {
    dealId: env.dealA,
    assessmentId: env.assessmentA1,
    planId: env.planA1,
    contentHash: hex("a"),
    idempotencyKey: "proposal-key-0001",
    content: proposalContent(),
    createdBy: "operator-1",
    createdAt: "2026-10-23T10:00:00.000Z",
    ...over,
  }
}

export function decisionInput(env: FinancialContractEnv, proposalId: string, over: Partial<NewFinancialDecision> = {}): NewFinancialDecision {
  return {
    dealId: env.dealA,
    assessmentId: env.assessmentA1,
    proposalId,
    decision: "CONFIRMED",
    actor: "operator-2",
    note: "ok",
    idempotencyKey: "decision-key-0001",
    requestHash: hex("d"),
    acknowledged: { notWriteBack: true, exclusions: true, unresolvedQuantities: true },
    baselineFingerprint: hex("e"),
    sameOperatorAsScopeConfirmer: false,
    occurredAt: "2026-10-23T11:00:00.000Z",
    ...over,
  }
}

export function defineFinancialRepositoryContract(label: string, setup: () => Promise<FinancialContractEnv>) {
  describe(`FinancialProposalRepository contract: ${label}`, () => {
    let env: FinancialContractEnv
    beforeEach(async () => {
      env = await setup()
    })
    afterEach(async () => {
      await env.cleanup()
    })

    it("stores a proposal as version 1 and round-trips its content exactly", async () => {
      const input = proposalInput(env)
      const r = await env.proposals.createProposal(input)
      expect(r.status).toBe("created")
      expect(r.record).toMatchObject({ dealId: env.dealA, assessmentId: env.assessmentA1, planId: env.planA1, version: 1, contentHash: hex("a"), createdBy: "operator-1", createdAt: "2026-10-23T10:00:00.000Z" })
      expect(r.record.content).toEqual(input.content)
      expect(await env.proposals.getProposal(env.dealA, env.assessmentA1, r.record.id)).toEqual(r.record)
    })

    it("returns identical content for the same plan instead of duplicating it, and versions anything different", async () => {
      const first = await env.proposals.createProposal(proposalInput(env))
      const same = await env.proposals.createProposal(proposalInput(env, { idempotencyKey: "proposal-key-0002" }))
      expect(same.status).toBe("replayed")
      expect(same.record.id).toBe(first.record.id)
      const changed = await env.proposals.createProposal(proposalInput(env, { contentHash: hex("b"), idempotencyKey: "proposal-key-0003" }))
      expect(changed.status === "created" && changed.record.version).toBe(2)
      const otherPlan = await env.proposals.createProposal(proposalInput(env, { planId: env.planA1b, idempotencyKey: "proposal-key-0004" })) // same hash, different plan: not a duplicate
      expect(otherPlan.status === "created" && otherPlan.record.version).toBe(3)
      expect((await env.proposals.listProposals(env.dealA, env.assessmentA1)).map((p) => p.version)).toEqual([3, 2, 1])
    })

    it("scopes every read by deal AND assessment", async () => {
      const r = await env.proposals.createProposal(proposalInput(env))
      expect(await env.proposals.getProposal(env.dealB, env.assessmentA1, r.record.id)).toBeNull()
      expect(await env.proposals.getProposal(env.dealA, env.assessmentB1, r.record.id)).toBeNull()
      expect(await env.proposals.listProposals(env.dealB, env.assessmentA1)).toEqual([])
      expect(await env.proposals.listProposals(env.dealB, env.assessmentB1)).toEqual([])
    })

    it("records one decision per proposal: created, replayed for the same key, refused for another key or changed content", async () => {
      const { record } = await env.proposals.createProposal(proposalInput(env))
      const first = await env.proposals.appendDecision(decisionInput(env, record.id))
      expect(first.status).toBe("created")
      expect(first.status === "created" && first.event).toMatchObject({ proposalId: record.id, decision: "CONFIRMED", actor: "operator-2", note: "ok", acknowledged: { notWriteBack: true, exclusions: true, unresolvedQuantities: true }, baselineFingerprint: hex("e"), sameOperatorAsScopeConfirmer: false, occurredAt: "2026-10-23T11:00:00.000Z" })
      const replay = await env.proposals.appendDecision(decisionInput(env, record.id))
      expect(replay.status).toBe("replayed")
      expect(await env.proposals.appendDecision(decisionInput(env, record.id, { requestHash: hex("f") }))).toEqual({ status: "key_reused" })
      const other = await env.proposals.appendDecision(decisionInput(env, record.id, { idempotencyKey: "decision-key-0002", decision: "DECLINED" }))
      expect(other.status).toBe("already_decided")
      expect(await env.proposals.getDecision(env.dealA, env.assessmentA1, record.id)).toMatchObject({ decision: "CONFIRMED", actor: "operator-2" })
    })

    it("lets exactly one of several concurrent deciders win", async () => {
      const { record } = await env.proposals.createProposal(proposalInput(env))
      const results = await Promise.all(Array.from({ length: 5 }, (_, i) => env.proposals.appendDecision(decisionInput(env, record.id, { idempotencyKey: `decision-race-000${i}`, actor: `operator-${i}` }))))
      expect(results.filter((r) => r.status === "created")).toHaveLength(1)
      expect(results.filter((r) => r.status === "already_decided")).toHaveLength(4)
    })

    it("cannot record a decision against a proposal of another deal or assessment", async () => {
      const { record } = await env.proposals.createProposal(proposalInput(env))
      await expect(env.proposals.appendDecision(decisionInput(env, record.id, { dealId: env.dealB, assessmentId: env.assessmentB1 }))).rejects.toThrow()
      await expect(env.proposals.appendDecision(decisionInput(env, "no-such-proposal"))).rejects.toThrow()
      expect(await env.proposals.getDecision(env.dealB, env.assessmentB1, record.id)).toBeNull()
    })
  })
}
