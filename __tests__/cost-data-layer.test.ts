import { describe, expect, it } from "vitest"
import { MATERIAL_BASELINES } from "@/lib/data/material-baselines"
import { PHASE_1B_TASK_LIBRARY, TASK_TEMPLATES } from "@/lib/data/task-cost-library"
import { REQUIRED_TRADES, TRADE_RATES } from "@/lib/data/trade-rates"
import { validateCostDataLayer } from "@/lib/data/validate-cost-data"
import type { Supplier, Trade } from "@/types/refurb"

const SUPPLIERS: Supplier[] = ["B&Q", "Wickes", "Screwfix", "Manual/Composite"]

describe("Phase 1B Step 1 cost data layer", () => {
  it("contains all required trades", () => {
    const tradeKeys = Object.keys(TRADE_RATES) as Trade[]

    REQUIRED_TRADES.forEach((trade) => {
      expect(tradeKeys).toContain(trade)
    })

    expect(new Set(tradeKeys).size).toBe(REQUIRED_TRADES.length)
  })

  it("trade rates include all required Phase 1B fields", () => {
    for (const [tradeKey, rate] of Object.entries(TRADE_RATES)) {
      expect(rate.trade).toBe(tradeKey)
      expect(rate.dayRateLow).toBeTypeOf("number")
      expect(rate.dayRateMid).toBeTypeOf("number")
      expect(rate.dayRateHigh).toBeTypeOf("number")
      expect(rate.defaultDayRate).toBeTypeOf("number")
      expect(rate.notes.trim().length).toBeGreaterThan(0)
      expect(rate.lastUpdated.trim().length).toBeGreaterThan(0)
      expect(rate.isActive).toBeTypeOf("boolean")
    }
  })

  it("no active trade has defaultDayRate <= 0", () => {
    Object.values(TRADE_RATES)
      .filter((rate) => rate.isActive)
      .forEach((rate) => {
        expect(rate.defaultDayRate).toBeGreaterThan(0)
      })
  })

  it("material baselines include required fields and supported suppliers", () => {
    MATERIAL_BASELINES.forEach((material) => {
      expect(material.itemName.trim().length).toBeGreaterThan(0)
      expect(material.category.trim().length).toBeGreaterThan(0)
      expect(SUPPLIERS).toContain(material.supplier)
      expect(material.unit.trim().length).toBeGreaterThan(0)
      expect(material.lowPrice).toBeTypeOf("number")
      expect(material.midPrice).toBeTypeOf("number")
      expect(material.highPrice).toBeTypeOf("number")
      expect(material.selectedPrice).toBeTypeOf("number")
      expect(material.notes.trim().length).toBeGreaterThan(0)
      expect(material.lastUpdated.trim().length).toBeGreaterThan(0)
    })
  })

  it("no selected material price is negative", () => {
    MATERIAL_BASELINES.forEach((material) => {
      expect(material.selectedPrice).toBeGreaterThanOrEqual(0)
    })
  })

  it("task templates reference valid trades and material items", () => {
    const tradeSet = new Set(Object.keys(TRADE_RATES))
    const materialSet = new Set(MATERIAL_BASELINES.map((material) => material.id))

    PHASE_1B_TASK_LIBRARY.forEach((task) => {
      expect(tradeSet.has(task.tradeRequired)).toBe(true)
      expect(task.scalingRule).toBeTruthy()

      task.materialItems.forEach((materialRef) => {
        expect(materialSet.has(materialRef.materialId)).toBe(true)
      })
    })
  })

  it("keeps compatibility mapping for Phase 1A engine templates", () => {
    expect(TASK_TEMPLATES.length).toBe(PHASE_1B_TASK_LIBRARY.length)
    TASK_TEMPLATES.forEach((task) => {
      expect(task.dayRate).toBeGreaterThan(0)
      expect(task.scalingRule).toBeTruthy()
    })
  })

  it("passes cost data validation helper", () => {
    const result = validateCostDataLayer()
    expect(result.errors).toEqual([])
    expect(result.isValid).toBe(true)
  })
})
