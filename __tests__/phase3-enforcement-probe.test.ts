// Phase 3A-3 Step 6 — Enforcement Probe Against Existing Phase 3 Outputs
// Advisory-only. No runtime enforcement wired to any app flow.
// Tests confirm existing Phase 3 outputs satisfy authority doctrine and bad scenarios are detected.

import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { runPhase3EnforcementProbe } from "../lib/validation/run-phase3-enforcement-probe"
import { validatePhase3EnforcementResult } from "../lib/engine/phase3-enforcement-contract"
import type { Phase3EnforcementResult } from "../types/phase3-enforcement"

const FIXTURE_BASE = join(__dirname, "fixtures", "phase3-enforcement-probe")

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURE_BASE, name), "utf-8")) as T
}

type ProbeSummaryFixture = {
  scenarioCount: number
  passedCount: number
  violationCount: number
  warnings: string[]
  advisoryOnly: true
}

// --- Probe execution ---

describe("runPhase3EnforcementProbe — execution", () => {
  it("runs without error and returns a probe result", () => {
    const result = runPhase3EnforcementProbe()
    expect(result).toBeDefined()
    expect(result.advisoryOnly).toBe(true)
  })

  it("returns 8 total scenarios", () => {
    const result = runPhase3EnforcementProbe()
    expect(result.scenarioCount).toBe(8)
    expect(result.results).toHaveLength(8)
  })

  it("returns 4 passed and 4 violations", () => {
    const result = runPhase3EnforcementProbe()
    expect(result.passedCount).toBe(4)
    expect(result.violationCount).toBe(4)
  })
})

// --- Fixture comparison ---

describe("runPhase3EnforcementProbe — summary fixture match", () => {
  it("aggregate numbers match locked enforcement-probe-summary.json", () => {
    const probe = runPhase3EnforcementProbe()
    const expected = loadFixture<ProbeSummaryFixture>("enforcement-probe-summary.json")
    expect(probe.scenarioCount).toBe(expected.scenarioCount)
    expect(probe.passedCount).toBe(expected.passedCount)
    expect(probe.violationCount).toBe(expected.violationCount)
    expect(probe.warnings).toEqual(expected.warnings)
    expect(probe.advisoryOnly).toBe(expected.advisoryOnly)
  })

  it("bad scenario results match locked enforcement-probe-bad-scenarios.json", () => {
    const probe = runPhase3EnforcementProbe()
    const expectedBad = loadFixture<Phase3EnforcementResult[]>("enforcement-probe-bad-scenarios.json")
    const actualBad = probe.results.filter((r) => !r.valid)
    expect(actualBad).toEqual(expectedBad)
  })
})

// --- Clean scenario checks ---

describe("runPhase3EnforcementProbe — existing Phase 3 outputs", () => {
  it("no-deal fixture scenario returns passed (capital protection preserved)", () => {
    const probe = runPhase3EnforcementProbe()
    const noDealResult = probe.results.find(
      (_, i) => i === 0
    )
    expect(noDealResult?.valid).toBe(true)
    expect(noDealResult?.outcome).toBe("passed")
  })

  it("review-required fixture scenario returns passed", () => {
    const probe = runPhase3EnforcementProbe()
    expect(probe.results[1].valid).toBe(true)
    expect(probe.results[1].outcome).toBe("passed")
  })

  it("clean proceed fixture scenario returns passed (advisory contained)", () => {
    const probe = runPhase3EnforcementProbe()
    expect(probe.results[2].valid).toBe(true)
    expect(probe.results[2].outcome).toBe("passed")
  })

  it("intake missing lender fixture scenario returns passed", () => {
    const probe = runPhase3EnforcementProbe()
    expect(probe.results[3].valid).toBe(true)
    expect(probe.results[3].outcome).toBe("passed")
  })

  it("all clean scenario results have empty violations", () => {
    const probe = runPhase3EnforcementProbe()
    const cleanResults = probe.results.slice(0, 4)
    for (const r of cleanResults) {
      expect(r.violations).toHaveLength(0)
    }
  })
})

// --- Bad scenario checks ---

describe("runPhase3EnforcementProbe — intentionally bad scenarios", () => {
  it("advisory overrides governance probe returns violation", () => {
    const probe = runPhase3EnforcementProbe()
    const result = probe.results[4]
    expect(result.valid).toBe(false)
    expect(result.violations[0].violationType).toBe("advisory_overrides_governance")
    expect(result.outcome).toBe("blocked")
  })

  it("workflow overrides capital protection probe returns violation and blocked outcome", () => {
    const probe = runPhase3EnforcementProbe()
    const result = probe.results[5]
    expect(result.valid).toBe(false)
    expect(result.violations[0].violationType).toBe("workflow_overrides_capital_protection")
    expect(result.outcome).toBe("blocked")
  })

  it("UI softens fatal classification probe returns violation", () => {
    const probe = runPhase3EnforcementProbe()
    const result = probe.results[6]
    expect(result.valid).toBe(false)
    expect(result.violations[0].violationType).toBe("ui_softens_fatal_classification")
    expect(result.outcome).toBe("review_required")
  })

  it("capital protection replacement attempt is blocked", () => {
    const probe = runPhase3EnforcementProbe()
    const result = probe.results[7]
    expect(result.valid).toBe(false)
    expect(result.violations[0].violationType).toBe("advisory_route_replaces_capital_protection")
    expect(result.outcome).toBe("blocked")
    expect(result.violations[0].protectedAuthority).toBe("capital_protection")
  })

  it("all bad scenario violations carry advisoryOnly true", () => {
    const probe = runPhase3EnforcementProbe()
    const badResults = probe.results.slice(4)
    for (const r of badResults) {
      expect(r.advisoryOnly).toBe(true)
      expect(r.violations[0].advisoryOnly).toBe(true)
    }
  })
})

// --- Validation helper integration ---

describe("runPhase3EnforcementProbe — validatePhase3EnforcementResult on all results", () => {
  it("all probe results pass validatePhase3EnforcementResult", () => {
    const probe = runPhase3EnforcementProbe()
    for (const result of probe.results) {
      const validation = validatePhase3EnforcementResult(result)
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(validation.advisoryOnly).toBe(true)
    }
  })
})

// --- Immutability and determinism ---

describe("runPhase3EnforcementProbe — determinism and immutability", () => {
  it("produces identical output on repeated calls", () => {
    const first = runPhase3EnforcementProbe()
    const second = runPhase3EnforcementProbe()
    expect(first).toEqual(second)
  })

  it("fixture JSON is not mutated by probe execution", () => {
    const badFixture = loadFixture<Phase3EnforcementResult[]>("enforcement-probe-bad-scenarios.json")
    const snapshot = JSON.stringify(badFixture)
    runPhase3EnforcementProbe()
    expect(JSON.stringify(badFixture)).toBe(snapshot)
  })
})

// --- Output field boundary ---

describe("runPhase3EnforcementProbe — output field boundary", () => {
  it("probe result carries no timestamps or random fields", () => {
    const probe = runPhase3EnforcementProbe()
    const forbidden = ["timestamp", "createdAt", "updatedAt", "id", "random", "uuid"]
    for (const key of forbidden) {
      expect(Object.keys(probe)).not.toContain(key)
    }
  })

  it("probe result carries no API, database, or AI fields", () => {
    const probe = runPhase3EnforcementProbe()
    const forbidden = ["api", "database", "aiModel", "routeHandler", "handler", "fetch", "persist"]
    for (const key of forbidden) {
      expect(Object.keys(probe)).not.toContain(key)
    }
  })

  it("probe result carries advisoryOnly true", () => {
    const probe = runPhase3EnforcementProbe()
    expect(probe.advisoryOnly).toBe(true)
  })
})

// --- Module export surface ---

describe("run-phase3-enforcement-probe module export surface", () => {
  it("does not export apply, enforce, wire, execute, or mutate functions", async () => {
    const mod = await import("../lib/validation/run-phase3-enforcement-probe")
    const keys = Object.keys(mod)
    const forbidden = ["apply", "enforce", "wire", "execute", "mutate", "persist", "handler"]
    for (const f of forbidden) {
      expect(keys).not.toContain(f)
    }
  })
})
