import type { Trade, GeneratedRefurbTask } from "@/types/refurb"

export type KitchenScope = "keep" | "refresh" | "upgrade" | "full_replace"
export type KitchenSize = "small" | "medium" | "large"
export type BathroomScope = "cosmetic" | "partial" | "full_replace"
export type BedroomScope = "none" | "paint" | "flooring" | "full_refurb" | "cosmetic_refresh"

export type RefurbScopeInput = {
  bedrooms: number
  bathrooms: number
  floorAreaSqm?: number
  kitchen: {
    scope: KitchenScope
    size: KitchenSize
  }
  bathroom: {
    scope: BathroomScope
  }
  bedroom: {
    scope: BedroomScope
  }
  flooring: {
    replaceWholeProperty: boolean
  }
  majorWorks: {
    rewire: boolean
    boiler: boolean
    roof: boolean
  }
}

export type RefurbCostResult = {
  totalRefurbCost: number
  labourCost: number
  materialCost: number
  roomBreakdown: Record<string, number>         // e.g. { kitchen: 8500, bathroom: 4200 }
  tradeBreakdown: Partial<Record<Trade, number>> // e.g. { plumber: 800, electrician: 1600 }
  taskList: GeneratedRefurbTask[]
  confidenceFlags: string[]                      // Warnings about low-confidence assumptions
}
