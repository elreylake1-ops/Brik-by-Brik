import { describe, expect, it } from "vitest"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { buildDefaultInvestorShieldChecks } from "@/lib/investor-shield/default-checks"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { VIEWING_CHECKLIST_V1 } from "@/lib/viewing-assessment/checklist-v1"
import {
  MOCK_MODEL_VERSION,
  mockVideoAnalysisService,
} from "@/lib/viewing-assessment/mock-video-analysis-service"
import { reviewProposal } from "@/lib/viewing-assessment/review-proposal"
import { validateAiProposals } from "@/lib/viewing-assessment/validate-ai-proposals"
import type { VideoEvidenceRef } from "@/types/viewing-assessment"

const ASSESSMENT_ID = "assessment-1"
const evidence: VideoEvidenceRef[] = [
  { id: "F1", assetId: "A1", clipFilename: "IMG_8329.mp4", timestampSeconds: 4, room: "Front" },
  { id: "F2", assetId: "A1", clipFilename: "IMG_8329.mp4", timestampSeconds: 12, room: "Kitchen" },
  { id: "F3", assetId: "A1", clipFilename: "IMG_8329.mp4", timestampSeconds: 99 },
]
const assets = [{ id: "A1", durationSeconds: 60 }]
const ctx = { assessmentId: ASSESSMENT_ID, evidence, assets }

const finding = (over: Record<string, unknown> = {}) => ({
  checkId: "C08",
  status: "concern",
  observation: "Cracked render by the porch.",
  frameIds: ["F1"],
  confidence: "medium",
  ...over,
})
const envelope = (findings: unknown[], over: Record<string, unknown> = {}) => ({
  kind: "brik-ai-findings",
  version: 1,
  assessmentId: ASSESSMENT_ID,
  modelVersion: "m-1",
  findings,
  ...over,
})

describe("checklist v1", () => {
  it("has C01-C45 and V01-V13 exactly once", () => {
    const ids = VIEWING_CHECKLIST_V1.map((i) => i.id)
    const pad = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${String(i + 1).padStart(2, "0")}`)
    expect(ids).toEqual([...pad("C", 45), ...pad("V", 13)])
  })
})

describe("validateAiProposals", () => {
  it("accepts a valid finding as UNVERIFIED/PENDING with traceable evidence and model version", () => {
    const { proposals, rejected } = validateAiProposals(envelope([finding()]), ctx)
    expect(rejected).toEqual([])
    expect(proposals).toHaveLength(1)
    expect(proposals[0]).toMatchObject({
      checkId: "C08",
      status: "CONCERN",
      evidenceIds: ["F1"],
      modelVersion: "m-1",
      verification: "UNVERIFIED",
      disposition: "PENDING",
    })
  })

  it("ignores AI-supplied review/cost fields", () => {
    const { proposals } = validateAiProposals(
      envelope([finding({ reviewed: true, reviewerId: "ai", disposition: "ACCEPTED", cost: 5000 })]),
      ctx
    )
    expect(proposals[0].disposition).toBe("PENDING")
    expect(proposals[0]).not.toHaveProperty("reviewed")
    expect(proposals[0]).not.toHaveProperty("reviewerId")
    expect(proposals[0]).not.toHaveProperty("cost")
  })

  it("rejects unknown checklist IDs, unsupported status and unknown evidence", () => {
    const { proposals, rejected } = validateAiProposals(
      envelope([
        finding({ checkId: "C99" }),
        finding({ checkId: "X01" }),
        finding({ status: "pass" }),
        finding({ status: "constructor" }),
        finding({ frameIds: ["nope"] }),
        finding({ frameIds: [] }),
        finding({ frameIds: ["F3"] }), // timestamp beyond clip duration
        finding({ observation: "  " }),
        "garbage",
      ]),
      ctx
    )
    expect(proposals).toEqual([])
    expect(rejected.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it("keeps valid findings when siblings are rejected", () => {
    const { proposals, rejected } = validateAiProposals(
      envelope([finding({ checkId: "C99" }), finding({ checkId: "C10", frameIds: ["F2"] })]),
      ctx
    )
    expect(proposals.map((p) => p.checkId)).toEqual(["C10"])
    expect(rejected).toHaveLength(1)
  })

  it("rejects the whole envelope on wrong assessment, version, kind or oversize", () => {
    for (const bad of [
      envelope([finding()], { assessmentId: "other" }),
      envelope([finding()], { version: 2 }),
      envelope([finding()], { kind: "x" }),
      envelope([finding()], { modelVersion: "" }),
      envelope(Array(201).fill(finding())),
      null,
    ]) {
      const r = validateAiProposals(bad, ctx)
      expect(r.proposals).toEqual([])
      expect(r.rejected[0].index).toBe(-1)
    }
  })

  it("merges duplicate proposals and keeps every evidence source; conflicting statuses stay separate", () => {
    const { proposals } = validateAiProposals(
      envelope([
        finding({ frameIds: ["F1"] }),
        finding({ observation: "  cracked   RENDER by the porch. ", frameIds: ["F2", "F1"] }),
        finding({ status: "observed", frameIds: ["F2"] }),
      ]),
      ctx
    )
    expect(proposals).toHaveLength(2)
    expect(proposals[0].evidenceIds).toEqual(["F1", "F2"])
    expect(proposals[1].status).toBe("OBSERVED")
  })
})

describe("reviewProposal", () => {
  const draft = validateAiProposals(envelope([finding()]), ctx).proposals[0]
  const base = { reviewerId: "user-1", reviewedAt: "2026-10-20T10:00:00Z" }

  it("accepts and records feedback linking model, prediction and (empty) outcome", () => {
    const { finding: f, feedback } = reviewProposal(draft, { ...base, disposition: "ACCEPTED" })
    expect(f.disposition).toBe("ACCEPTED")
    expect(f.verification).toBe("UNVERIFIED")
    expect(feedback).toMatchObject({
      modelVersion: "m-1",
      original: { status: "CONCERN", observation: draft.observation },
      humanCorrection: null,
      actualOutcome: null,
    })
  })

  it("stores an edit as a correction and preserves the original prediction", () => {
    const { finding: f, feedback } = reviewProposal(draft, {
      ...base,
      disposition: "EDITED",
      status: "SPECIALIST_REVIEW",
      observation: "Structural crack; surveyor needed.",
    })
    expect(f.status).toBe("CONCERN")
    expect(feedback.humanCorrection).toEqual({
      status: "SPECIALIST_REVIEW",
      observation: "Structural crack; surveyor needed.",
    })
  })

  it("records rejection with reason and requires one", () => {
    const { finding: f, feedback } = reviewProposal(draft, { ...base, disposition: "REJECTED", reason: "Shadow" })
    expect(f.disposition).toBe("REJECTED")
    expect(feedback.disposition).toBe("REJECTED")
    expect(() => reviewProposal(draft, { ...base, disposition: "REJECTED", reason: " " })).toThrow()
    expect(() => reviewProposal(draft, { reviewerId: "", reviewedAt: "x", disposition: "ACCEPTED" })).toThrow()
  })
})

describe("mock video analysis service", () => {
  it("is deterministic, and every output validates against the supplied evidence", async () => {
    const input = { assessmentId: ASSESSMENT_ID, evidence: evidence.slice(0, 2) }
    const a = await mockVideoAnalysisService.analyse(input)
    const b = await mockVideoAnalysisService.analyse({ ...input, evidence: [...input.evidence].reverse() })
    expect(a).toEqual(b)
    const { proposals, rejected } = validateAiProposals(a, ctx)
    expect(rejected).toEqual([])
    expect(proposals).toHaveLength(2)
    expect(proposals.every((p) => p.modelVersion === MOCK_MODEL_VERSION)).toBe(true)
  })

  it("invents nothing without evidence", async () => {
    const a = await mockVideoAnalysisService.analyse({ assessmentId: ASSESSMENT_ID, evidence: [] })
    expect(a.findings).toEqual([])
  })
})

describe("existing finance and Investor Shield outputs are unchanged", () => {
  const deal = {
    purchasePrice: 150000,
    gdv: 250000,
    refurbCost: 30000,
    stampDuty: 4500,
    legalCosts: 2500,
    saleCosts: 5000,
    bridgeTermMonths: 6,
  }
  const shieldInput = {
    dealId: "deal-1",
    checks: buildDefaultInvestorShieldChecks("deal-1"),
    evidenceItems: [],
    riskFlags: [],
    manualOverrides: [],
  }

  it("runs the whole viewing flow without altering either engine's results", async () => {
    const dealBefore = JSON.stringify(analyzeDealWithRefurb(deal))
    const shieldBefore = JSON.stringify(evaluateInvestorShield(shieldInput))

    const raw = await mockVideoAnalysisService.analyse({ assessmentId: ASSESSMENT_ID, evidence })
    const { proposals } = validateAiProposals(raw, ctx)
    proposals.forEach((p) =>
      reviewProposal(p, { reviewerId: "u", reviewedAt: "2026-10-20T10:00:00Z", disposition: "ACCEPTED" })
    )

    expect(JSON.stringify(analyzeDealWithRefurb(deal))).toBe(dealBefore)
    expect(JSON.stringify(evaluateInvestorShield(shieldInput))).toBe(shieldBefore)
  })
})
