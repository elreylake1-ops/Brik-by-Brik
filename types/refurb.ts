export type Trade =
  | "builder"
  | "labourer"
  | "electrician"
  | "plumber"
  | "plasterer"
  | "decorator"
  | "roofer"
  | "carpenter"
  | "tiler"
  | "gas_engineer"
  | "waste_removal"

// Phase 1B supplier list (manually maintained; no live feeds)
export type Supplier = "B&Q" | "Wickes" | "Screwfix" | "Manual/Composite"

// How a task's cost scales with property variables
export type ScalingRule =
  | "fixed"         // One-off cost regardless of property size
  | "per_room"      // Multiply by number of relevant rooms
  | "per_bedroom"   // Multiply by bedroom count
  | "per_bathroom"  // Multiply by bathroom count
  | "per_sqm"       // Multiply by floor area in sqm

export type TaskMaterialItemReference = {
  materialId: string
  quantity?: number
  notes?: string
}

// Base template - lives in the task-cost-library config file
export type RefurbTaskTemplate = {
  id: string
  room: string       // e.g. "kitchen", "bathroom", "bedroom", "whole_property"
  scope: string      // e.g. "full_replace", "cosmetic_refresh", "rewire"
  taskName: string
  trade: Trade
  labourDays: number // Days required for this trade for this task (base unit)
  dayRate: number    // Day rate in GBP - matches TRADE_RATES baseline, can be overridden
  materialCost: number // Material cost in GBP per base unit
  scalingRule: ScalingRule
  dependency?: string  // ID of a task that must run before this one
  notes?: string       // Assumption explanation - only added when non-obvious
  materialItems?: TaskMaterialItemReference[]
}

// Phase 1B cost-data schema (kept local/config-only in this phase)
export type TradeRateEntry = {
  trade: Trade
  dayRateLow: number
  dayRateMid: number
  dayRateHigh: number
  defaultDayRate: number
  notes: string
  lastUpdated: string // YYYY-MM-DD
  isActive: boolean
}

export type MaterialBaselineEntry = {
  id: string
  itemName: string
  category: string
  supplier: Supplier
  unit: string
  lowPrice: number
  midPrice: number
  highPrice: number
  selectedPrice: number
  notes: string
  lastUpdated: string // YYYY-MM-DD
}

export type TaskCostLibraryEntry = {
  id: string
  taskName: string
  roomType: string
  scopeLevel: string
  tradeRequired: Trade
  labourDays: number
  materialItems: TaskMaterialItemReference[]
  scalingRule: ScalingRule
  dependencyNotes: string
  riskNotes: string
  // Compatibility fields preserved for existing Phase 1A engine behavior
  materialCost: number
  dependencyTaskId?: string
}

// Generated task after scope inputs are applied - used in calculation output
export type GeneratedRefurbTask = RefurbTaskTemplate & {
  quantity: number          // Number of units (rooms, sqm, etc.) this task applies to
  labourCost: number        // labourDays x dayRate x quantity
  totalCost: number         // labourCost + (materialCost x quantity)
  assumptionsUsed: string[] // Human-readable list of assumptions applied
  warnings: string[]        // Flags for anything that needs user verification
}

// Timeline types - output of the timeline engine

export type TradeSchedule = {
  trade: Trade
  totalLabourDays: number
  phase: 1 | 2 | 3
}

export type RefurbPhase = {
  phase: 1 | 2 | 3
  label: string
  trades: Trade[]
  workingDays: number  // max labour days among trades in this phase (parallel working)
}

export type RefurbTimeline = {
  totalCalendarWeeks: number
  totalWorkingDays: number
  totalWorkingDaysWithContingency: number
  phases: RefurbPhase[]
  tradeSchedule: TradeSchedule[]
  contingencyFactor: number
  assumptions: string[]
  warnings: string[]
}
