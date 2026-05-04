import type { RefurbTaskTemplate, GeneratedRefurbTask } from "@/types/refurb"
import type { RefurbScopeInput, KitchenSize } from "@/types/scope"
import { TASK_TEMPLATES } from "@/lib/data/task-cost-library"

// All default assumptions named here — nothing hidden in logic
const DEFAULTS = {
  // Flooring: sqm-based path
  FLOORING_MATERIAL_RATE_PER_SQM: 18,      // budget laminate £12 + underlay £3 + 10% wastage
  FLOORING_LABOUR_DAYS_PER_SQM: 0.5 / 40,  // 0.5 carpenter-day per 40sqm room → 0.0125/sqm
  // Flooring: room-count fallback (when floorAreaSqm not provided)
  FLOORING_EXTRA_ROOMS: 2,                  // kitchen + living/dining counted alongside bed/bath
} as const

const KITCHEN_SIZE_MULTIPLIER: Record<KitchenSize, number> = {
  small: 0.8,
  medium: 1.0,
  large: 1.25,
}

function filterTemplates(room: string, scope: string): RefurbTaskTemplate[] {
  return TASK_TEMPLATES.filter((t) => t.room === room && t.scope === scope)
}

// Produces a GeneratedRefurbTask from a (possibly modified) template + quantity.
// materialCost in the generated task remains the per-unit value; totalCost scales it.
function generateTask(
  template: RefurbTaskTemplate,
  quantity: number,
  assumptions: string[],
  warnings: string[]
): GeneratedRefurbTask {
  const labourCost = template.labourDays * template.dayRate * quantity
  const totalCost = labourCost + template.materialCost * quantity
  return {
    ...template,
    quantity,
    labourCost,
    totalCost,
    assumptionsUsed: assumptions,
    warnings,
  }
}

// Returns a warning-only stub task when a scope is selected but has no templates yet.
function unsupportedScopeStub(
  room: string,
  scope: string,
  quantity: number
): GeneratedRefurbTask {
  return {
    id: `${room}-${scope}-unsupported`,
    room,
    scope,
    taskName: `${room} ${scope} — no templates yet`,
    trade: "builder",
    labourDays: 0,
    dayRate: 0,
    materialCost: 0,
    scalingRule: "fixed",
    quantity,
    labourCost: 0,
    totalCost: 0,
    assumptionsUsed: [],
    warnings: [
      `Scope "${scope}" for "${room}" has no task templates in Phase 1A. Cost not included. Add templates to task-cost-library.ts.`,
    ],
  }
}

export function generateTasksFromScope(scopeInput: RefurbScopeInput): GeneratedRefurbTask[] {
  const { bedrooms, bathrooms, floorAreaSqm, kitchen, bathroom, bedroom, flooring, majorWorks } =
    scopeInput
  const tasks: GeneratedRefurbTask[] = []

  // ── Kitchen ────────────────────────────────────────────────────────────────
  if (kitchen.scope === "full_replace") {
    const multiplier = KITCHEN_SIZE_MULTIPLIER[kitchen.size]
    const templates = filterTemplates("kitchen", "full_replace")
    for (const tpl of templates) {
      // Apply size modifier to both labour and materials before generating
      const scaled: RefurbTaskTemplate = {
        ...tpl,
        labourDays: tpl.labourDays * multiplier,
        materialCost: tpl.materialCost * multiplier,
      }
      tasks.push(
        generateTask(
          scaled,
          1,
          [`Kitchen size: ${kitchen.size} (×${multiplier} applied to labour days and material cost)`],
          []
        )
      )
    }
  } else if (kitchen.scope === "refresh" || kitchen.scope === "upgrade") {
    tasks.push(unsupportedScopeStub("kitchen", kitchen.scope, 1))
  }
  // "keep" → no tasks generated

  // ── Bathroom ───────────────────────────────────────────────────────────────
  if (bathroom.scope === "full_replace") {
    const templates = filterTemplates("bathroom", "full_replace")
    for (const tpl of templates) {
      tasks.push(
        generateTask(tpl, bathrooms, [`Bathrooms: ${bathrooms}`], [])
      )
    }
  } else if (bathroom.scope === "partial") {
    tasks.push(unsupportedScopeStub("bathroom", "partial", bathrooms))
  }
  // "cosmetic" → no templates yet, not flagged (low-cost scope — manual estimate)

  // ── Bedroom ────────────────────────────────────────────────────────────────
  if (bedroom.scope === "cosmetic_refresh") {
    const templates = filterTemplates("bedroom", "cosmetic_refresh")
    for (const tpl of templates) {
      tasks.push(
        generateTask(tpl, bedrooms, [`Bedrooms: ${bedrooms}`], [])
      )
    }
  } else if (bedroom.scope === "full_refurb") {
    tasks.push(unsupportedScopeStub("bedroom", "full_refurb", bedrooms))
  }
  // "none", "paint", "flooring" → no templates yet, silently skip

  // ── Flooring ───────────────────────────────────────────────────────────────
  if (flooring.replaceWholeProperty) {
    const templates = filterTemplates("whole_property", "flooring_replacement")

    if (floorAreaSqm !== undefined && floorAreaSqm > 0) {
      // Sqm path: override template values with per-sqm rates
      for (const tpl of templates) {
        const sqmMaterialRate =
          tpl.id === "flooring-whole-property-laminate"
            ? DEFAULTS.FLOORING_MATERIAL_RATE_PER_SQM
            : 0 // prep task has no material cost
        const sqmTemplate: RefurbTaskTemplate = {
          ...tpl,
          labourDays: DEFAULTS.FLOORING_LABOUR_DAYS_PER_SQM,
          materialCost: sqmMaterialRate,
          scalingRule: "per_sqm",
        }
        tasks.push(
          generateTask(sqmTemplate, floorAreaSqm, [
            `Floor area provided: ${floorAreaSqm} sqm`,
            `Material rate: £${DEFAULTS.FLOORING_MATERIAL_RATE_PER_SQM}/sqm (budget laminate + underlay)`,
            `Labour rate: ${DEFAULTS.FLOORING_LABOUR_DAYS_PER_SQM.toFixed(5)} carpenter-days/sqm (0.5 day per 40sqm)`,
          ], [])
        )
      }
    } else {
      // Room-count fallback when floorAreaSqm not provided
      const roomCount = bedrooms + bathrooms + DEFAULTS.FLOORING_EXTRA_ROOMS
      for (const tpl of templates) {
        tasks.push(
          generateTask(tpl, roomCount, [
            `floorAreaSqm not provided — using room count: ${roomCount} rooms`,
            `Breakdown: ${bedrooms} bed + ${bathrooms} bath + ${DEFAULTS.FLOORING_EXTRA_ROOMS} other (kitchen/living)`,
          ], [
            `floorAreaSqm not provided. Floor costs estimated at ${roomCount} rooms. Provide floorAreaSqm for a more accurate figure.`,
          ])
        )
      }
    }
  }

  // ── Major Works: Rewire ────────────────────────────────────────────────────
  if (majorWorks.rewire) {
    const templates = filterTemplates("whole_property", "rewire")
    for (const tpl of templates) {
      tasks.push(
        generateTask(tpl, 1, [
          `Full rewire — baseline assumes 3-bed property. Adjust template if property differs.`,
        ], [])
      )
    }
  }

  // ── Major Works: Boiler ────────────────────────────────────────────────────
  if (majorWorks.boiler) {
    const templates = filterTemplates("whole_property", "boiler")
    for (const tpl of templates) {
      tasks.push(
        generateTask(tpl, 1, [
          `Boiler replacement — like-for-like combi swap assumed.`,
        ], [])
      )
    }
  }

  // ── Major Works: Roof ──────────────────────────────────────────────────────
  if (majorWorks.roof) {
    const templates = filterTemplates("whole_property", "roof")
    for (const tpl of templates) {
      tasks.push(
        generateTask(tpl, 1, [
          `Roof works — placeholder estimate only.`,
        ], [
          `Roof costs vary significantly (£1,500–£12,000+). This is a placeholder. Always obtain 3 live quotes before relying on this figure.`,
        ])
      )
    }
  }

  return tasks
}
