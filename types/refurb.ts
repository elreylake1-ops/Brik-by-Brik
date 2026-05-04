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

// How a task's cost scales with property variables
export type ScalingRule =
  | "fixed"         // One-off cost regardless of property size
  | "per_room"      // Multiply by number of relevant rooms
  | "per_bedroom"   // Multiply by bedroom count
  | "per_bathroom"  // Multiply by bathroom count
  | "per_sqm"       // Multiply by floor area in sqm

// Base template — lives in the task-cost-library config file
export type RefurbTaskTemplate = {
  id: string
  room: string       // e.g. "kitchen", "bathroom", "bedroom", "whole_property"
  scope: string      // e.g. "full_replace", "cosmetic_refresh", "rewire"
  taskName: string
  trade: Trade
  labourDays: number // Days required for this trade for this task (base unit)
  dayRate: number    // Day rate in £ — matches TRADE_RATES baseline, can be overridden
  materialCost: number // Material cost in £ per base unit
  scalingRule: ScalingRule
  dependency?: string  // ID of a task that must run before this one
  notes?: string       // Assumption explanation — only added when non-obvious
}

// Generated task after scope inputs are applied — used in calculation output
export type GeneratedRefurbTask = RefurbTaskTemplate & {
  quantity: number          // Number of units (rooms, sqm, etc.) this task applies to
  labourCost: number        // labourDays × dayRate × quantity
  totalCost: number         // labourCost + (materialCost × quantity)
  assumptionsUsed: string[] // Human-readable list of assumptions applied
  warnings: string[]        // Flags for anything that needs user verification
}
