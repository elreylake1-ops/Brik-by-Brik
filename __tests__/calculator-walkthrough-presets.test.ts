import { describe, expect, it } from "vitest"
import {
  CALCULATOR_WALKTHROUGH_PRESETS,
  getCalculatorWalkthroughPresetState,
} from "@/lib/calculator-walkthrough-presets"

describe("calculator walkthrough presets", () => {
  it("contains the validated 15 walkthrough presets", () => {
    expect(CALCULATOR_WALKTHROUGH_PRESETS).toHaveLength(15)
  })

  it("loading zero-refurb preset switches to manual mode and sets refurb cost to 0", () => {
    const preset = getCalculatorWalkthroughPresetState("07-zero-refurb-edge-case")

    expect(preset).toBeDefined()
    expect(preset?.useScope).toBe(false)
    expect(preset?.inputs.refurbCost).toBe(0)
  })

  it("loading unsupported-scope preset switches to task mode and sets refresh/cosmetic scopes", () => {
    const preset = getCalculatorWalkthroughPresetState("08-unsupported-scope-warning")

    expect(preset).toBeDefined()
    expect(preset?.useScope).toBe(true)
    expect(preset?.scope.kitchen.scope).toBe("refresh")
    expect(preset?.scope.bathroom.scope).toBe("cosmetic")
    expect(preset?.scope.bedroom.scope).toBe("cosmetic_refresh")
    expect(preset?.scope.flooring.replaceWholeProperty).toBe(false)
  })

  it("loading the standard profitable preset sets full replacement and rewire values", () => {
    const preset = getCalculatorWalkthroughPresetState("01-strong-profitable-deal")

    expect(preset).toBeDefined()
    expect(preset?.useScope).toBe(true)
    expect(preset?.scope.kitchen).toEqual({
      scope: "full_replace",
      size: "medium",
    })
    expect(preset?.scope.bathroom.scope).toBe("full_replace")
    expect(preset?.scope.bedroom.scope).toBe("cosmetic_refresh")
    expect(preset?.scope.flooring.replaceWholeProperty).toBe(true)
    expect(preset?.scope.majorWorks).toEqual({
      rewire: true,
      boiler: false,
      roof: false,
    })
  })
})
