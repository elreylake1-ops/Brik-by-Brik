import { describe, expect, it } from "vitest"
import { buildDefaultInvestorShieldChecks } from "@/lib/investor-shield/default-checks"
import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"

describe("investor shield default checks", () => {
  it("creates one check per default gate and starts each as REQUIRED", () => {
    const checks = buildDefaultInvestorShieldChecks("deal-123")

    expect(checks).toHaveLength(INVESTOR_SHIELD_DEFAULT_GATES.length)
    expect(checks.every((check) => check.status === "REQUIRED")).toBe(true)
  })

  it("copies the provided dealId string exactly", () => {
    const checks = buildDefaultInvestorShieldChecks("deal-text-id")

    expect(checks.every((check) => check.dealId === "deal-text-id")).toBe(true)
    expect(checks.every((check) => typeof check.dealId === "string")).toBe(true)
  })

  it("starts every check with UNKNOWN confidence", () => {
    const checks = buildDefaultInvestorShieldChecks("deal-123")

    expect(checks.every((check) => check.confidence === "UNKNOWN")).toBe(true)
  })

  it("maps severity and requiredEvidence from the default gate definitions", () => {
    const checks = buildDefaultInvestorShieldChecks("deal-123")

    for (const gate of INVESTOR_SHIELD_DEFAULT_GATES) {
      const check = checks.find((item) => item.gateKey === gate.key)
      expect(check).toBeDefined()
      expect(check?.severity).toBe(gate.defaultSeverity)
      expect(check?.requiredEvidence).toEqual(gate.evidenceTypes)
    }
  })

  it("does not assume UUID conversion, numeric ids, or top-level sub-gate records", () => {
    const checks = buildDefaultInvestorShieldChecks("text-id-001")

    expect(checks.every((check) => check.id === undefined)).toBe(true)
    expect(checks.every((check) => check.subGateKey === undefined)).toBe(true)
    expect(checks.every((check) => !/^[0-9]+$/.test(check.dealId))).toBe(true)
  })
})
