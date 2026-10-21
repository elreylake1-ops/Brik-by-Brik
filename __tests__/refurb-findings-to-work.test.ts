import { describe, expect, it } from "vitest"
import { FINDING_WORK_MAPPINGS, MAPPED_CHECK_IDS } from "@/lib/data/finding-work-mapping"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { loadWorkProposal, type PlanDeps } from "@/lib/refurb-integration/plan-service"
import { VIEWING_CHECKLIST_V1 } from "@/lib/viewing-assessment/checklist-v1"
import { deriveScope } from "@/lib/refurb-integration/plan-compute"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { ACCEPT, seedAssessment, type SeedFinding } from "./fixtures/refurb-seed"

// The adapter, exercised against genuinely stored (in-memory repository) findings and reviews.

const DEAL = "deal-a"
async function propose(findings: SeedFinding[]) {
  const { repo: viewing } = createInMemoryViewingRepository()
  const seeded = await seedAssessment(viewing, DEAL, findings)
  const loaded = await loadWorkProposal({ viewing } as unknown as PlanDeps, DEAL, seeded.assessmentId)
  return { viewing, seeded, ...loaded! }
}

describe("only human-reviewed findings can become proposed work", () => {
  it("unreviewed suggestions produce no work and are listed as excluded", async () => {
    const { proposal, seeded } = await propose([{ checkId: "C01", status: "CONCERN" }, { checkId: "C37", status: "CONCERN" }])
    expect(proposal.items).toEqual([])
    expect(proposal.excluded).toEqual([
      { proposalId: seeded.proposalIds[0], checkId: "C01", reason: "UNREVIEWED" },
      { proposalId: seeded.proposalIds[1], checkId: "C37", reason: "UNREVIEWED" },
    ])
  })

  it("rejected suggestions produce no work", async () => {
    const { proposal } = await propose([{ checkId: "C01", status: "CONCERN", review: { disposition: "REJECTED", reason: "Not a roof" } }])
    expect(proposal.items).toEqual([])
    expect(proposal.excluded.map((e) => e.reason)).toEqual(["REJECTED"])
  })

  it("an accepted concern becomes ONE proposed item carrying its full source trail", async () => {
    const { proposal, seeded } = await propose([{ checkId: "C01", status: "CONCERN", observation: "Slipped tiles on the rear slope", frames: [3], review: { ...ACCEPT, reason: "Clear in the frame" } }])
    expect(proposal.items).toHaveLength(1)
    const item = proposal.items[0]
    expect(item).toMatchObject({ itemId: "roof", kind: "ENGINE_SCOPE", scopeEffect: { field: "majorWorks.roof", level: true }, provisional: true, needsBuilderVerification: true })
    expect(item.sources).toHaveLength(1)
    expect(item.sources[0]).toMatchObject({
      proposalId: seeded.proposalIds[0],
      checkId: "C01",
      disposition: "ACCEPTED",
      effectiveStatus: "CONCERN",
      reviewedObservation: "Slipped tiles on the rear slope",
      reviewerId: "operator-1",
      reviewRevision: 1,
      reviewReason: "Clear in the frame",
      modelVersion: "fixture-frame-analysis-v1",
    })
    expect(item.sources[0].evidence).toEqual([{ evidenceId: seeded.evidenceIds[3], assetId: expect.any(String), timestampSeconds: 31, room: "Loft" }])
    expect(item.sources[0].reviewedAt).toBe("2026-10-21T09:00:00.000Z")
  })

  it("an edit changes what the human says, and the item uses the human's words and status", async () => {
    const { proposal } = await propose([
      { checkId: "C39", status: "OBSERVED", observation: "Kitchen visible", review: { disposition: "EDITED", status: "CONCERN", observation: "Units are water damaged" } },
    ])
    expect(proposal.items).toHaveLength(1)
    expect(proposal.items[0]).toMatchObject({ itemId: "kitchen", scopeEffect: { field: "kitchen.scope", level: "refresh" }, allowedLevels: ["refresh", "upgrade", "full_replace"] })
    expect(proposal.items[0].sources[0]).toMatchObject({ aiProposedStatus: "OBSERVED", effectiveStatus: "CONCERN", disposition: "EDITED", reviewedObservation: "Units are water damaged", aiObservation: "Kitchen visible" })
  })

  it("an accepted OBSERVED suggestion is not work (and is never a pass)", async () => {
    const { proposal } = await propose([{ checkId: "C01", status: "OBSERVED", review: ACCEPT }])
    expect(proposal.items).toEqual([])
    expect(proposal.excluded[0].reason).toBe("OBSERVED_ONLY")
  })

  it("an edit to not-accessible / not-applicable is not work, and not-accessible is reported as an inspection gap", async () => {
    const { proposal } = await propose([
      { checkId: "C01", status: "CONCERN", review: { disposition: "EDITED", status: "NOT_ACCESSIBLE", observation: "Could not see the roof" } },
      { checkId: "C37", status: "CONCERN", review: { disposition: "EDITED", status: "NOT_APPLICABLE", observation: "Not relevant" } },
    ])
    expect(proposal.items).toEqual([])
    expect(proposal.excluded.map((e) => e.reason)).toEqual(["NOT_A_CONCERN", "NOT_A_CONCERN"])
    expect(proposal.openInspectionGaps).toContainEqual({ checkId: "C01", state: "NOT_ACCESSIBLE", awaitingReview: false })
  })

  it("a specialist-review finding proposes an inspection, never priced works", async () => {
    const { proposal } = await propose([{ checkId: "C37", status: "SPECIALIST_REVIEW", review: ACCEPT }])
    expect(proposal.items).toHaveLength(1)
    expect(proposal.items[0]).toMatchObject({ itemId: "electrics:inspect", kind: "SPECIALIST_INSPECTION", scopeEffect: null, allowedLevels: [] })
  })

  it("when a check is both concern and specialist, the more cautious state wins and the other is excluded", async () => {
    const { proposal, seeded } = await propose([
      { checkId: "C37", status: "CONCERN", review: ACCEPT },
      { checkId: "C37", status: "SPECIALIST_REVIEW", review: ACCEPT },
    ])
    expect(proposal.items.map((i) => i.itemId)).toEqual(["electrics:inspect"])
    expect(proposal.excluded).toEqual([{ proposalId: seeded.proposalIds[0], checkId: "C37", reason: "NOT_EFFECTIVE_STATE" }])
  })

  it("a claim with no frame behind it cannot become work", async () => {
    const { proposal } = await propose([{ checkId: "C01", status: "CONCERN", frames: [], review: ACCEPT }])
    expect(proposal.items).toEqual([])
    expect(proposal.excluded[0].reason).toBe("NO_EVIDENCE")
  })

  it("concerns on checks that are not physical works (sale, legal, finance) never create work", async () => {
    const { proposal } = await propose([
      { checkId: "V09", status: "CONCERN", review: ACCEPT },
      { checkId: "V12", status: "CONCERN", review: ACCEPT },
      { checkId: "V13", status: "CONCERN", review: ACCEPT },
    ])
    expect(proposal.items).toEqual([])
    expect(proposal.excluded.map((e) => e.reason)).toEqual(["NOT_A_WORKS_CHECK", "NOT_A_WORKS_CHECK", "NOT_A_WORKS_CHECK"])
  })

  it("several checks in one area merge into one item with every source kept", async () => {
    const { proposal } = await propose([
      { checkId: "C24", status: "CONCERN", frames: [0], review: ACCEPT },
      { checkId: "C26", status: "CONCERN", frames: [1], review: ACCEPT },
    ])
    expect(proposal.items).toHaveLength(1)
    expect(proposal.items[0].itemId).toBe("flooring")
    expect(proposal.items[0].sources.map((s) => s.checkId)).toEqual(["C24", "C26"])
  })

  it("works the engine has no scope for become UNPRICED items: listed for builders, with no figure", async () => {
    const { proposal } = await propose([{ checkId: "C08", status: "CONCERN", review: ACCEPT }, { checkId: "C31", status: "CONCERN", review: ACCEPT }])
    expect(proposal.items.map((i) => [i.itemId, i.kind, i.scopeEffect])).toEqual([
      ["external-walls", "UNPRICED", null],
      ["drainage", "UNPRICED", null],
    ])
    // no money anywhere in a proposal: no monetary key and no currency symbol
    const keys: string[] = []
    JSON.stringify(proposal, (k, v) => (keys.push(k), v))
    expect(keys.filter((k) => /cost|price|labour|amount|total/i.test(k))).toEqual([])
    expect(JSON.stringify(proposal)).not.toContain("£")
  })

  it("the proposal's fingerprint changes when a review changes, and not otherwise", async () => {
    const { viewing, seeded, proposal } = await propose([{ checkId: "C01", status: "CONCERN" }])
    const again = await loadWorkProposal({ viewing } as unknown as PlanDeps, DEAL, seeded.assessmentId)
    expect(again!.proposal.fingerprint).toBe(proposal.fingerprint)
    const { reviewProposalAction } = await import("@/lib/viewing-assessment/viewing-assessment-service")
    await reviewProposalAction(viewing, { dealId: DEAL, assessmentId: seeded.assessmentId, proposalId: seeded.proposalIds[0], body: { expectedRevision: 0, disposition: "ACCEPTED" }, reviewerId: "operator-1" })
    const after = await loadWorkProposal({ viewing } as unknown as PlanDeps, DEAL, seeded.assessmentId)
    expect(after!.proposal.fingerprint).not.toBe(proposal.fingerprint)
    expect(after!.proposal.items).toHaveLength(1)
  })

  it("labels simulated analysis so everything derived from it can be labelled", async () => {
    const { proposal } = await propose([{ checkId: "C01", status: "CONCERN", review: ACCEPT }])
    expect(proposal.analysisSource).toBe("SIMULATED")
  })
})

describe("the mapping configuration is consistent with the checklist and with the existing engine", () => {
  const checklistIds = new Set(VIEWING_CHECKLIST_V1.map((c) => c.id))

  it("references only real checks, each at most once", () => {
    const all = FINDING_WORK_MAPPINGS.flatMap((m) => m.checkIds)
    expect(all.every((id) => checklistIds.has(id))).toBe(true)
    expect(new Set(all).size).toBe(all.length)
    expect([...MAPPED_CHECK_IDS].sort()).toEqual([...new Set(all)].sort())
  })

  it("does not map sale, legal, finance, services or property-detail checks to works", () => {
    for (const id of ["V01", "V02", "V03", "V04", "V06", "V07", "V08", "V09", "V10", "V11", "V12", "V13"]) expect(MAPPED_CHECK_IDS.has(id)).toBe(false)
  })

  it("every engine-scope mapping has ordered levels and a task selector", () => {
    for (const m of FINDING_WORK_MAPPINGS.filter((x) => x.kind === "ENGINE_SCOPE")) {
      expect(m.scopeField, m.id).toBeTruthy()
      expect(m.levels!.length, m.id).toBeGreaterThan(1)
      expect(m.levels, m.id).toContain(m.proposedLevel)
      expect(m.engineTaskSelector!.length, m.id).toBeGreaterThan(0)
    }
  })

  it("the task selectors match what the existing engine actually generates (drift guard)", () => {
    const base = { bedrooms: 3, bathrooms: 1, floorAreaSqm: 80, kitchen: { scope: "keep", size: "medium" }, bathroom: { scope: "cosmetic" }, bedroom: { scope: "none" }, flooring: { replaceWholeProperty: false }, majorWorks: { rewire: false, boiler: false, roof: false } } as const
    const cases: Array<[string, Parameters<typeof generateTasksFromScope>[0]]> = [
      ["roof", { ...base, majorWorks: { ...base.majorWorks, roof: true } }],
      ["electrics", { ...base, majorWorks: { ...base.majorWorks, rewire: true } }],
      ["heating", { ...base, majorWorks: { ...base.majorWorks, boiler: true } }],
      ["flooring", { ...base, flooring: { replaceWholeProperty: true } }],
      ["kitchen", { ...base, kitchen: { scope: "full_replace", size: "medium" } }],
      ["kitchen", { ...base, kitchen: { scope: "refresh", size: "medium" } }],
      ["bathroom", { ...base, bathroom: { scope: "full_replace" } }],
      ["bathroom", { ...base, bathroom: { scope: "partial" } }],
    ]
    for (const [id, scope] of cases) {
      const selectors = FINDING_WORK_MAPPINGS.find((m) => m.id === id)!.engineTaskSelector!
      const tasks = generateTasksFromScope(scope)
      expect(tasks.length, id).toBeGreaterThan(0)
      for (const t of tasks) expect(selectors.some((s) => s.room === t.room && s.scope === t.scope), `${id}: ${t.id}`).toBe(true)
    }
  })

  it("contains none of the checklist's own wording: labels are this project's neutral text", () => {
    const groups = [...new Set(VIEWING_CHECKLIST_V1.map((c) => c.group))].filter((g) => g.split(/s+/).length >= 2)
    // phrases of a real length: very short fragments occur in any English sentence and prove nothing
    const wording = [...VIEWING_CHECKLIST_V1.flatMap((c) => [c.title, c.prompt]), ...groups].filter((w) => w.length >= 11)
    for (const m of FINDING_WORK_MAPPINGS) {
      for (const w of wording) {
        expect([m.label, m.area, m.quantityNote].some((t) => t.toLowerCase().includes(w.toLowerCase())), `${m.id} reuses checklist wording: ${w.length} chars, ${w.split(/s+/).length} words`).toBe(false)
      }
    }
  })

  it("deriveScope never lowers a level and sets only what was confirmed", () => {
    const item = (mappingId: string, field: string, level: string | boolean) => ({ itemId: mappingId, mappingId, kind: "ENGINE_SCOPE" as const, label: "x", area: "x", scopeEffect: { field, level } as never, levelChosenByHuman: false, quantityNote: "", sources: [] })
    const basics = { bedrooms: 2, bathrooms: 1, kitchenSize: "small" as const }
    const scope = deriveScope([item("kitchen", "kitchen.scope", "full_replace"), item("kitchen", "kitchen.scope", "refresh"), item("roof", "majorWorks.roof", true)], basics)
    expect(scope).toMatchObject({ kitchen: { scope: "full_replace", size: "small" }, majorWorks: { roof: true, rewire: false, boiler: false }, bathroom: { scope: "cosmetic" }, flooring: { replaceWholeProperty: false } })
    expect(scope).not.toHaveProperty("floorAreaSqm")
  })
})
