import { existsSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT,
  PHASE3_REVIEW_SURFACE_FIXTURE_PAIRS,
} from "@/lib/fixtures/phase3-review-surface-fixtures"

describe("phase3 review surface display contract", () => {
  it("uses the developer route and developer fixture review mode", () => {
    expect(PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.routeName).toBe("/phase-3-dev-review")
    expect(PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.mode).toBe("developer_fixture_review")
    expect(PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.advisoryOnly).toBe(true)
  })

  it("places deterministic_decision first and has no action CTA section", () => {
    expect(PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.sections[0]).toBe("deterministic_decision")
    expect(PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.sections).not.toContain("approve_deal")
    expect(PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.sections).not.toContain("send_offer")
    expect(PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.sections).not.toContain("actions")
  })

  it("includes all four fixture ids", () => {
    const ids = PHASE3_REVIEW_SURFACE_FIXTURE_PAIRS.map((pair) => pair.id)

    expect(ids).toEqual([
      "no_deal_with_weak_comparable_hints",
      "review_required_with_legal_conflict_hints",
      "clean_proceed_with_accepted_operator_note",
      "intake_with_missing_lender_hints",
    ])
  })

  it("fixture pairs point to merged fixture path strings and are advisory-only", () => {
    for (const pair of PHASE3_REVIEW_SURFACE_FIXTURE_PAIRS) {
      expect(typeof pair.mergedFixturePath).toBe("string")
      expect(pair.mergedFixturePath.length).toBeGreaterThan(0)
      expect(pair.advisoryOnly).toBe(true)
      const absolutePath = path.resolve(process.cwd(), pair.mergedFixturePath)
      expect(existsSync(absolutePath)).toBe(true)
    }
  })

  it("guardrails mention developer-only, advisory, and capital protection", () => {
    const guardrailText = PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT.guardrails.join(" ").toLowerCase()

    expect(guardrailText).toContain("developer-only")
    expect(guardrailText).toContain("advisory")
    expect(guardrailText).toContain("capital protection")
  })

  it("does not include runtime, persistence, ai, or integration fields", () => {
    const contract = PHASE3_REVIEW_SURFACE_DISPLAY_CONTRACT as unknown as Record<string, unknown>

    expect("runtime" in contract).toBe(false)
    expect("persistence" in contract).toBe(false)
    expect("database" in contract).toBe(false)
    expect("ai" in contract).toBe(false)
    expect("integration" in contract).toBe(false)
  })
})
