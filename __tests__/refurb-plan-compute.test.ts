import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { calculateTimeline } from "@/lib/engine/timeline-engine"
import { FINDING_WORK_MAPPINGS } from "@/lib/data/finding-work-mapping"
import { computePlan, deriveScope } from "@/lib/refurb-integration/plan-compute"
import type { ConfirmedWorkItem, ScopeField, ScopeLevel } from "@/types/refurb-integration"
import { ASSUMPTIONS, BASICS } from "./fixtures/refurb-seed"

// The plan layer must add NO calculation of its own: every number below is compared with what the existing engine
// returns when called directly.

const DEAL = { purchasePrice: 100000, gdv: 190000, refurbCost: 25000 }

function confirmed(mappingId: string, level?: ScopeLevel): ConfirmedWorkItem {
  const m = FINDING_WORK_MAPPINGS.find((x) => x.id === mappingId)!
  return {
    itemId: m.id,
    mappingId: m.id,
    kind: m.kind,
    label: m.label,
    area: m.area,
    scopeEffect: m.scopeField ? { field: m.scopeField as ScopeField, level: level ?? (m.proposedLevel as ScopeLevel) } : null,
    levelChosenByHuman: level !== undefined,
    quantityNote: m.quantityNote,
    sources: [],
  }
}
const inspection = (mappingId: string): ConfirmedWorkItem => ({ ...confirmed(mappingId), itemId: `${mappingId}:inspect`, kind: "SPECIALIST_INSPECTION", scopeEffect: null })

describe("estimate and schedule come from the existing engine", () => {
  const items = [confirmed("roof"), confirmed("heating"), confirmed("electrics"), confirmed("kitchen", "full_replace"), confirmed("bathroom", "full_replace"), confirmed("flooring")]
  const run = () => computePlan({ accepted: items, basics: BASICS, assumptions: ASSUMPTIONS, deal: DEAL })

  it("the estimate equals the engine's own result for the derived scope, to the penny", () => {
    const plan = run()
    const scope = deriveScope(items, BASICS)
    const direct = calculateRefurbCost(generateTasksFromScope(scope))
    expect(plan.estimate.status).toBe("COMPUTED")
    expect(plan.estimate.totalRefurbCost).toBe(direct.totalRefurbCost)
    expect(plan.estimate.labourCost).toBe(direct.labourCost)
    expect(plan.estimate.materialCost).toBe(direct.materialCost)
    expect(plan.estimate.lines.map((l) => l.taskId)).toEqual(direct.taskList.map((t) => t.id))
  })

  it("every pound is traceable to a confirmed work item", () => {
    const plan = run()
    const ids = new Set(items.map((i) => i.itemId))
    expect(plan.estimate.lines.every((l) => l.itemId && ids.has(l.itemId))).toBe(true)
    const sum = plan.estimate.lines.reduce((s, l) => s + l.totalCost, 0)
    expect(sum).toBeCloseTo(plan.estimate.totalRefurbCost as number, 2)
    for (const item of items) expect(plan.estimate.lines.some((l) => l.itemId === item.itemId && l.priced), item.itemId).toBe(true)
  })

  it("the schedule is the engine's timeline for the same tasks, and its labour days match the cost lines", () => {
    const plan = run()
    const tasks = generateTasksFromScope(deriveScope(items, BASICS))
    expect(plan.schedule.timeline).toEqual(calculateTimeline(tasks))
    const lineDays = plan.estimate.lines.reduce((s, l) => s + l.labourDays, 0)
    const tradeDays = plan.schedule.timeline!.tradeSchedule.reduce((s, t) => s + t.totalLabourDays, 0)
    expect(lineDays).toBeCloseTo(tradeDays, 6)
  })

  it("financial impact is the canonical analyzeDealWithRefurb result, before and after", () => {
    const plan = run()
    const inputs = { ...DEAL, ...ASSUMPTIONS }
    const before = analyzeDealWithRefurb({ ...inputs, refurbCost: DEAL.refurbCost })
    const after = analyzeDealWithRefurb(inputs, deriveScope(items, BASICS))
    const fi = plan.financialImpact
    expect(fi.status).toBe("COMPUTED")
    expect(fi.baseline).toMatchObject({ refurbCost: DEAL.refurbCost, totalCost: before.deal.totalCost, profit: before.deal.profit, profitMargin: before.deal.profitMargin, verdictStatus: before.verdict.status, trueMao: before.deal.trueMao })
    expect(fi.scenario).toMatchObject({ refurbCost: after.refurb!.totalRefurbCost, totalCost: after.deal.totalCost, profit: after.deal.profit, profitMargin: after.deal.profitMargin, verdictStatus: after.verdict.status, trueMao: after.deal.trueMao })
    expect(fi.delta).toEqual({
      refurbCost: after.refurb!.totalRefurbCost - DEAL.refurbCost,
      totalCost: after.deal.totalCost - before.deal.totalCost,
      profit: after.deal.profit - before.deal.profit,
      profitMargin: after.deal.profitMargin - before.deal.profitMargin,
    })
    expect(fi.savedDealUnchanged).toBe(true)
    expect(plan.estimate.totalRefurbCost).toBe(fi.scenario!.refurbCost) // one cost figure everywhere
  })

  it("is deterministic and does not mutate its inputs", () => {
    const frozen = structuredClone(items)
    run()
    expect(items).toEqual(frozen)
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })
})

describe("unknown quantities, provisional allowances and unpriced work are stated, not hidden", () => {
  it("without property basics nothing is costed or scheduled, and it says why", () => {
    const plan = computePlan({ accepted: [confirmed("roof")], basics: null, assumptions: ASSUMPTIONS, deal: DEAL })
    expect(plan.estimate).toMatchObject({ status: "BLOCKED", blockedBy: ["PROPERTY_BASICS_MISSING"], totalRefurbCost: null, lines: [] })
    expect(plan.schedule).toMatchObject({ status: "BLOCKED", timeline: null })
    expect(plan.financialImpact).toMatchObject({ status: "BLOCKED", baseline: null, scenario: null, delta: null })
    expect(plan.scopeInput).toBeNull()
    expect(plan.warnings.join(" ")).toMatch(/not read from the video/)
  })

  it("without deal assumptions the estimate is computed but no financial impact is invented", () => {
    const plan = computePlan({ accepted: [confirmed("roof")], basics: BASICS, assumptions: null, deal: DEAL })
    expect(plan.estimate.status).toBe("COMPUTED")
    expect(plan.financialImpact).toMatchObject({ status: "BLOCKED", blockedBy: ["FINANCIAL_ASSUMPTIONS_MISSING"], scenario: null })
  })

  it.each([
    ["no price", { purchasePrice: null, gdv: 190000, refurbCost: 1 }],
    ["zero GDV", { purchasePrice: 100000, gdv: 0, refurbCost: 1 }],
    ["missing both", { purchasePrice: null, gdv: null, refurbCost: null }],
  ])("a Saved Deal with %s blocks the financial impact", (_n, deal) => {
    const plan = computePlan({ accepted: [confirmed("roof")], basics: BASICS, assumptions: ASSUMPTIONS, deal })
    expect(plan.financialImpact).toMatchObject({ status: "BLOCKED", blockedBy: ["DEAL_PRICE_OR_GDV_MISSING"] })
  })

  it("levels the engine has no templates for are listed as unpriced with the engine's own reason, and cost nothing", () => {
    const plan = computePlan({ accepted: [confirmed("kitchen"), confirmed("bathroom")], basics: BASICS, assumptions: ASSUMPTIONS, deal: DEAL })
    expect(plan.estimate.totalRefurbCost).toBe(0)
    expect(plan.estimate.lines.every((l) => !l.priced && l.totalCost === 0)).toBe(true)
    expect(plan.estimate.unpricedItems.map((u) => u.itemId).sort()).toEqual(["bathroom", "kitchen"])
    expect(plan.estimate.unpricedItems[0].reason).toMatch(/no task templates/)
    expect(plan.schedule.unscheduledItems.map((u) => u.itemId).sort()).toEqual(["bathroom", "kitchen"])
  })

  it("unpriced works and specialist inspections carry no price and no duration", () => {
    const plan = computePlan({ accepted: [confirmed("external-walls"), inspection("drainage"), confirmed("roof")], basics: BASICS, assumptions: ASSUMPTIONS, deal: DEAL })
    expect(plan.estimate.unpricedItems.map((u) => u.itemId).sort()).toEqual(["drainage:inspect", "external-walls"])
    expect(plan.estimate.lines.every((l) => l.itemId === "roof")).toBe(true)
    expect(plan.schedule.unscheduledItems.map((u) => u.itemId).sort()).toEqual(["drainage:inspect", "external-walls"])
    // the schedule contains exactly the trades of the priced lines: nothing is scheduled for unpriced work
    expect(plan.schedule.timeline!.tradeSchedule.map((t) => t.trade).sort()).toEqual([...new Set(plan.estimate.lines.map((l) => l.trade))].sort())
  })

  it("priced items are marked as provisional allowances, with the unknown extent stated", () => {
    const plan = computePlan({ accepted: [confirmed("roof"), confirmed("flooring")], basics: { ...BASICS, floorAreaSqm: undefined }, assumptions: ASSUMPTIONS, deal: DEAL })
    expect(plan.estimate.provisionalAllowances).toHaveLength(2)
    expect(plan.estimate.provisionalAllowances.join(" ")).toMatch(/provisional allowance/)
    expect(plan.estimate.confidenceFlags.join(" ")).toMatch(/Floor area was not provided/) // the engine's own warning is passed through
    expect(plan.assumptions.join(" ")).toMatch(/operator-supplied/)
    expect(plan.assumptions.join(" ")).toMatch(/absence of a reviewed finding/)
  })

  it("a higher human-chosen level raises the engine cost; the engine, not this layer, sets the figure", () => {
    const low = computePlan({ accepted: [confirmed("kitchen", "refresh")], basics: BASICS, assumptions: ASSUMPTIONS, deal: DEAL })
    const high = computePlan({ accepted: [confirmed("kitchen", "full_replace")], basics: BASICS, assumptions: ASSUMPTIONS, deal: DEAL })
    expect(low.estimate.totalRefurbCost).toBe(0)
    expect(high.estimate.totalRefurbCost).toBeGreaterThan(0)
    expect(high.estimate.totalRefurbCost).toBe(calculateRefurbCost(generateTasksFromScope(deriveScope([confirmed("kitchen", "full_replace")], BASICS))).totalRefurbCost)
  })
})

describe("the plan layer cannot reach governance or deal state", () => {
  const dir = path.resolve(__dirname, "..", "lib", "refurb-integration")
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"))

  it("imports and calls no writer for Saved Deals, Investor Shield, pipeline, offers, tasks or the operator guard", () => {
    // module specifiers and call sites only: prose in notes ("does not update the Saved Deal ... pipeline") is not code
    const forbiddenModules = /investor-shield-repository|persist-investor-shield|evaluate-operator-guard|guard-investor-shield-pipeline|deal-offers-repository|deal-tasks-repository|operator-command-repository/
    const forbiddenCalls = /\b(createSavedDeal|updateSavedDeal|archiveSavedDeal|insertInvestorShield\w*|persistInvestorShield\w*|evaluateOperatorGuard|createOffer|createTask|update\w*Pipeline\w*|move\w*Pipeline\w*)\s*\(/
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
      const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).join("\n")
      expect(imports, f).not.toMatch(forbiddenModules)
      expect(src, f).not.toMatch(forbiddenCalls)
    }
  })

  it("the only Saved Deals import is the read function and the record type", () => {
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), "utf8")
      const imports = [...src.matchAll(/import[^;\n]*from\s+"@\/lib\/operator-command\/saved-deals-repository"/g)].map((m) => m[0])
      for (const line of imports) expect(line, f).toMatch(/import type|\{ getSavedDealById \}/)
    }
  })

  it("contains no financial arithmetic of its own: no rates, percentages or contingency constants", () => {
    for (const f of files.filter((x) => x !== "deal-passport.ts")) {
      const src = readFileSync(path.join(dir, f), "utf8").replace(/^\s*\/\/.*$/gm, "")
      expect(src, f).not.toMatch(/\b(dayRate|CONTINGENCY|0\.[12]\d*\s*\*|\*\s*1\.[0-9]+)\b/)
    }
  })

  it("does not import AI providers or the viewing module's own calculators", () => {
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), "utf8")
      expect(src, f).not.toMatch(/viewing-assessment\/ai\/|@anthropic-ai/)
    }
  })
})
