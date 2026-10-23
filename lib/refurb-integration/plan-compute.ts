import { FINDING_WORK_MAPPINGS, SCOPE_DEFAULTS } from "@/lib/data/finding-work-mapping"
import { analyzeDealWithRefurb, type DealWithRefurbResult } from "@/lib/engine/analyze-deal-with-refurb"
import { applyCostOverrides } from "@/lib/engine/apply-overrides"
import { calculateRefurbCost, isTaskUnpriced } from "@/lib/engine/refurb-cost-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { calculateTimeline } from "@/lib/engine/timeline-engine"
import type { DealInputs } from "@/types/deal"
import type { CostOverride } from "@/types/overrides"
import type { BathroomScope, KitchenScope, RefurbScopeInput } from "@/types/scope"
import type {
  ConfirmedWorkItem,
  CostLine,
  FinancialAssumptions,
  FinancialImpact,
  FinancialSnapshot,
  PlanComputation,
  PlanEstimate,
  PlanSchedule,
  PropertyBasics,
  ScopeField,
  ScopeLevel,
} from "@/types/refurb-integration"

// Turns CONFIRMED work items into a scope, then asks the EXISTING engine for cost, schedule and financial impact.
// There is no cost, duration or verdict arithmetic in this file beyond subtracting two engine results for the delta.
// It never writes anything: no Saved Deal, Investor Shield, governance or pipeline state is touched or even importable here.

const PRICING_NOTE =
  "Preview from the existing deal engine (analyzeDealWithRefurb). It does not change the Saved Deal, Investor Shield, governance state or pipeline, and it is not an investment decision."

const ordinal = (mappingId: string, level: ScopeLevel): number => {
  const levels = FINDING_WORK_MAPPINGS.find((m) => m.id === mappingId)?.levels ?? []
  return levels.indexOf(level)
}

/** Applies one confirmed item to a scope. A higher level never gets lowered by a lower one. */
function applyEffect(scope: RefurbScopeInput, item: ConfirmedWorkItem): void {
  if (!item.scopeEffect) return
  const { field, level } = item.scopeEffect as { field: ScopeField; level: ScopeLevel }
  switch (field) {
    case "majorWorks.roof":
      scope.majorWorks.roof = scope.majorWorks.roof || level === true
      break
    case "majorWorks.rewire":
      scope.majorWorks.rewire = scope.majorWorks.rewire || level === true
      break
    case "majorWorks.boiler":
      scope.majorWorks.boiler = scope.majorWorks.boiler || level === true
      break
    case "flooring.replaceWholeProperty":
      scope.flooring.replaceWholeProperty = scope.flooring.replaceWholeProperty || level === true
      break
    case "kitchen.scope":
      if (ordinal(item.mappingId, level) > ordinal(item.mappingId, scope.kitchen.scope)) scope.kitchen.scope = level as KitchenScope
      break
    case "bathroom.scope":
      if (ordinal(item.mappingId, level) > ordinal(item.mappingId, scope.bathroom.scope)) scope.bathroom.scope = level as BathroomScope
      break
  }
}

export function deriveScope(accepted: readonly ConfirmedWorkItem[], basics: PropertyBasics): RefurbScopeInput {
  const scope: RefurbScopeInput = {
    bedrooms: basics.bedrooms,
    bathrooms: basics.bathrooms,
    ...(basics.floorAreaSqm !== undefined ? { floorAreaSqm: basics.floorAreaSqm } : {}),
    kitchen: { scope: SCOPE_DEFAULTS.kitchenScope, size: basics.kitchenSize ?? SCOPE_DEFAULTS.kitchenSizeWhenNotCosted },
    bathroom: { scope: SCOPE_DEFAULTS.bathroomScope },
    bedroom: { scope: SCOPE_DEFAULTS.bedroomScope },
    flooring: { replaceWholeProperty: false },
    majorWorks: { rewire: false, boiler: false, roof: false },
  }
  for (const item of accepted) applyEffect(scope, item)
  return scope
}

function snapshot(inputs: DealInputs, result: DealWithRefurbResult): FinancialSnapshot {
  return {
    refurbCost: result.refurbSource === "generated" ? (result.refurb?.totalRefurbCost ?? inputs.refurbCost) : inputs.refurbCost,
    totalCost: result.deal.totalCost,
    profit: result.deal.profit,
    profitMargin: result.deal.profitMargin,
    trueMao: { ...result.deal.trueMao },
    verdictStatus: result.verdict.status,
    verdictReason: result.verdict.reason,
    confidenceBand: result.confidence.band,
  }
}

export type DealFigures = { purchasePrice: number | null; gdv: number | null; refurbCost: number | null }

const blockedImpact = (blockedBy: string[], inputs: FinancialImpact["inputs"]): FinancialImpact => ({
  status: "BLOCKED",
  blockedBy,
  baseline: null,
  scenario: null,
  delta: null,
  inputs,
  savedDealUnchanged: true,
  note: PRICING_NOTE,
})

export type ComputePlanInput = {
  accepted: readonly ConfirmedWorkItem[]
  basics: PropertyBasics | null
  assumptions: FinancialAssumptions | null
  deal: DealFigures
  overrides?: CostOverride[]
}

export function computePlan({ accepted, basics, assumptions, deal, overrides = [] }: ComputePlanInput): PlanComputation {
  const baselineRefurb = deal.refurbCost ?? 0
  const impactInputs: FinancialImpact["inputs"] = {
    purchasePrice: deal.purchasePrice ?? 0,
    gdv: deal.gdv ?? 0,
    baselineRefurbCost: baselineRefurb,
    ...(assumptions ?? {}),
  }

  const unpriced: { itemId: string; label: string; reason: string }[] = []
  for (const item of accepted) {
    if (item.kind === "UNPRICED") unpriced.push({ itemId: item.itemId, label: item.label, reason: "The existing cost engine has no scope for this work. Price to be provided by a builder." })
    if (item.kind === "SPECIALIST_INSPECTION") unpriced.push({ itemId: item.itemId, label: item.label, reason: "Specialist inspection required first; nothing is priced or scheduled." })
  }

  const blockedPlan = (blocked: string[], warning: string): PlanComputation => ({
    scopeInput: null,
    estimate: { status: "BLOCKED", blockedBy: blocked, totalRefurbCost: null, labourCost: null, materialCost: null, lines: [], unpricedItems: unpriced, provisionalAllowances: [], confidenceFlags: [] },
    schedule: { status: "BLOCKED", timeline: null, unscheduledItems: unpriced.map(({ itemId, label }) => ({ itemId, label })), assumptions: [] },
    financialImpact: blockedImpact(blocked, impactInputs),
    assumptions: [SCOPE_DEFAULTS.note],
    warnings: [warning],
    engineInputs: { dealInputs: null, scope: null },
  })

  if (!basics) return blockedPlan(["PROPERTY_BASICS_MISSING"], "Bedrooms and bathrooms are needed before any engine cost can be produced. They are not read from the video.")

  const scope = deriveScope(accepted, basics)
  if (scope.kitchen.scope === "full_replace" && !basics.kitchenSize) return blockedPlan(["KITCHEN_SIZE_MISSING"], "A kitchen replacement is in scope but no kitchen size has been recorded; it cannot be costed until it is.")
  const baseTasks = generateTasksFromScope(scope)
  const overrideResult = applyCostOverrides(baseTasks, overrides)
  const tasks = overrideResult.tasks
  const refurb = calculateRefurbCost(tasks)
  const timeline = calculateTimeline(tasks)

  // Attribute every engine task to the confirmed item whose scope field produced it.
  const selectors = accepted.flatMap((item) => {
    const mapping = FINDING_WORK_MAPPINGS.find((m) => m.id === item.mappingId)
    return (mapping?.engineTaskSelector ?? []).map((sel) => ({ item, sel }))
  })
  const lines: CostLine[] = refurb.taskList.map((task) => {
    const owner = selectors.find(({ sel }) => sel.room === task.room && sel.scope === task.scope)
    if (!owner) throw new Error(`Engine task ${task.id} is not attributable to any confirmed work item`) // invariant
    const priced = task.totalCost > 0 && !isTaskUnpriced(task)
    return {
      itemId: owner.item.itemId,
      taskId: task.id,
      taskName: task.taskName,
      room: task.room,
      trade: task.trade,
      quantity: task.quantity,
      labourDays: task.labourDays * task.quantity,
      labourCost: task.labourCost,
      materialCost: task.materialCost * task.quantity,
      totalCost: task.totalCost,
      priced,
      warnings: task.warnings,
    }
  })

  const provisional: string[] = []
  for (const item of accepted) {
    if (item.kind !== "ENGINE_SCOPE") continue
    const own = lines.filter((l) => l.itemId === item.itemId && l.priced)
    if (own.length === 0) {
      unpriced.push({
        itemId: item.itemId,
        label: item.label,
        reason: `The existing cost engine has no task templates for this level (${String(item.scopeEffect?.level)}); no cost is included. Price to be provided by a builder.`,
      })
    } else {
      provisional.push(`${item.label}: provisional allowance from the engine's standard rates. ${item.quantityNote}`)
    }
  }

  const estimate: PlanEstimate = {
    status: "COMPUTED",
    blockedBy: [],
    totalRefurbCost: refurb.totalRefurbCost,
    labourCost: refurb.labourCost,
    materialCost: refurb.materialCost,
    lines,
    unpricedItems: unpriced,
    provisionalAllowances: provisional,
    confidenceFlags: refurb.confidenceFlags,
  }
  const schedule: PlanSchedule = {
    status: "COMPUTED",
    timeline,
    unscheduledItems: unpriced.map(({ itemId, label }) => ({ itemId, label })),
    assumptions: timeline.assumptions,
  }

  const assumptionsList = [
    ...new Set([
      ...tasks.flatMap((t) => t.assumptionsUsed),
      ...timeline.assumptions,
      SCOPE_DEFAULTS.note,
      "Bedrooms, bathrooms, floor area and kitchen size are operator-supplied, not read from the video.",
      ...(basics.kitchenSize ? [] : ["Kitchen size was not recorded; it is not used because no kitchen replacement is in scope."]),
      "Every item is provisional until a builder verifies quantities on site.",
    ]),
  ]
  const warnings = [...new Set([...refurb.confidenceFlags, ...timeline.warnings])]

  // ---- financial impact through the canonical pathway
  let financialImpact: FinancialImpact
  let dealInputs: DealInputs | null = null
  const blockedBy: string[] = []
  if (!(deal.purchasePrice && deal.purchasePrice > 0) || !(deal.gdv && deal.gdv > 0)) blockedBy.push("DEAL_PRICE_OR_GDV_MISSING")
  if (!assumptions) blockedBy.push("FINANCIAL_ASSUMPTIONS_MISSING")
  if (blockedBy.length > 0) {
    financialImpact = blockedImpact(blockedBy, impactInputs)
  } else {
    dealInputs = { purchasePrice: deal.purchasePrice as number, gdv: deal.gdv as number, refurbCost: baselineRefurb, ...(assumptions as FinancialAssumptions) }
    const before = analyzeDealWithRefurb(dealInputs)
    const after = analyzeDealWithRefurb(dealInputs, scope, overrides)
    if (Math.abs((after.refurb?.totalRefurbCost ?? NaN) - refurb.totalRefurbCost) > 0.005) {
      throw new Error("Estimate and canonical financial pathway disagree on refurbishment cost") // invariant
    }
    const b = snapshot(dealInputs, before)
    const s = snapshot(dealInputs, after)
    financialImpact = {
      status: "COMPUTED",
      blockedBy: [],
      baseline: b,
      scenario: s,
      delta: { refurbCost: s.refurbCost - b.refurbCost, totalCost: s.totalCost - b.totalCost, profit: s.profit - b.profit, profitMargin: s.profitMargin - b.profitMargin },
      inputs: impactInputs,
      savedDealUnchanged: true,
      note: PRICING_NOTE,
    }
  }

  return { scopeInput: scope, estimate, schedule, financialImpact, assumptions: assumptionsList, warnings, engineInputs: { dealInputs, scope } }
}
