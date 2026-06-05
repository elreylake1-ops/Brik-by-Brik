import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  INVESTOR_SHIELD_GATE_KEYS,
  INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS,
} from "@/types/investor-shield"
import {
  INVESTOR_SHIELD_DEFAULT_GATES,
  getInvestorShieldGateDefinition,
  getInvestorShieldRefurbSubGateKeys,
  getInvestorShieldRequiredGateKeys,
} from "@/lib/investor-shield/default-gates"

describe("investor shield default gates", () => {
  it("includes every required default gate key exactly once", () => {
    const keys = INVESTOR_SHIELD_DEFAULT_GATES.map((definition) => definition.key)

    expect(keys).toEqual(INVESTOR_SHIELD_GATE_KEYS)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("keeps every gate populated with the required static metadata", () => {
    for (const definition of INVESTOR_SHIELD_DEFAULT_GATES) {
      expect(definition.label.trim().length).toBeGreaterThan(0)
      expect(definition.description.trim().length).toBeGreaterThan(0)
      expect(definition.defaultSeverity).toBeTruthy()
      expect(definition.evidenceTypes.length).toBeGreaterThan(0)
    }
  })

  it("locks REFURB_CERTAINTY to the required sub-gates", () => {
    const refurbCertainty = getInvestorShieldGateDefinition("REFURB_CERTAINTY")

    expect(refurbCertainty).toBeDefined()
    expect(refurbCertainty?.subGates).toEqual(INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS)
    expect(getInvestorShieldRefurbSubGateKeys()).toEqual(INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS)
  })

  it("keeps AI_VISUAL_REVIEW_ADVISORY advisory-only in the static config", () => {
    const defaultGatesSource = readFileSync(
      path.resolve(process.cwd(), "lib/investor-shield/default-gates.ts"),
      "utf8"
    )

    expect(defaultGatesSource).toContain("AI_VISUAL_REVIEW_ADVISORY")
    expect(defaultGatesSource).toContain("INVESTOR_SHIELD_REFURB_ADVISORY_ONLY_SUB_GATES")
    expect(defaultGatesSource).toContain("advisory-only")
    expect(defaultGatesSource).toContain(
      "cannot replace human, professional, builder, document, or measurement evidence"
    )
  })

  it("required gate keys and helper lookups stay aligned with the contract arrays", () => {
    expect(getInvestorShieldRequiredGateKeys()).toEqual(INVESTOR_SHIELD_GATE_KEYS)

    for (const gateKey of INVESTOR_SHIELD_GATE_KEYS) {
      expect(getInvestorShieldGateDefinition(gateKey)?.key).toBe(gateKey)
    }

    for (const subGateKey of INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS) {
      expect(getInvestorShieldRefurbSubGateKeys()).toContain(subGateKey)
    }
  })

  it("returns undefined safely for unknown gate lookups", () => {
    expect(getInvestorShieldGateDefinition("UNKNOWN_GATE")).toBeUndefined()
  })
})
