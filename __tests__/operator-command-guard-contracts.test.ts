import { describe, expect, it } from "vitest"
import {
  OPERATOR_GUARD_INPUT_FIXTURE,
  OPERATOR_GUARD_RESULT_FIXTURE,
} from "./fixtures/operator-command/operator-guard-fixtures"

describe("Phase 4A operator guard contracts", () => {
  it("guard input has deal_id", () => {
    expect(OPERATOR_GUARD_INPUT_FIXTURE.deal_id.length).toBeGreaterThan(0)
  })

  it("guard input has workflow_action", () => {
    expect(OPERATOR_GUARD_INPUT_FIXTURE.workflow_action.length).toBeGreaterThan(0)
  })

  it("guard result has decision", () => {
    expect(OPERATOR_GUARD_RESULT_FIXTURE.decision.length).toBeGreaterThan(0)
  })

  it("guard result has allowed boolean", () => {
    expect(typeof OPERATOR_GUARD_RESULT_FIXTURE.allowed).toBe("boolean")
  })

  it("guard result has reasons array", () => {
    expect(Array.isArray(OPERATOR_GUARD_RESULT_FIXTURE.reasons)).toBe(true)
  })

  it("no fixture contains forbidden runtime keys", () => {
    const forbiddenKeys = ["apiUrl", "database", "aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]
    const fixtures = [OPERATOR_GUARD_INPUT_FIXTURE, OPERATOR_GUARD_RESULT_FIXTURE]

    for (const fixture of fixtures) {
      const serialized = JSON.stringify(fixture)
      for (const forbiddenKey of forbiddenKeys) {
        expect(serialized).not.toContain(`"${forbiddenKey}"`)
      }
    }
  })
})
