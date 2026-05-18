import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  PHASE3_AUTHORITY_DOCTRINE,
  PHASE3_AUTHORITY_HIERARCHY,
  PHASE3_ESCALATION_PRIORITY,
  type Phase3AuthorityDoctrine,
} from "@/types/phase3-authority"
import * as authorityContractModule from "@/lib/engine/phase3-authority-contract"
import { validatePhase3AuthorityDoctrine } from "@/lib/engine/phase3-authority-contract"

function loadAuthorityFixture(): Phase3AuthorityDoctrine {
  const fixturePath = path.resolve(
    process.cwd(),
    "__tests__",
    "fixtures",
    "phase3-authority",
    "authority-doctrine.json"
  )
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Phase3AuthorityDoctrine
}

describe("phase3 authority contracts", () => {
  it("permanent rule text exists", () => {
    expect(PHASE3_AUTHORITY_DOCTRINE.permanentRule).toContain(
      "Advisory outputs may increase review burden, but they may not reduce deterministic risk."
    )
  })

  it("hierarchy order preserves deterministic governance dominance", () => {
    expect(PHASE3_AUTHORITY_HIERARCHY).toEqual([
      "deterministic_governance",
      "capital_protection",
      "deal_classification",
      "workflow_orchestration",
      "evidence_advisory",
      "ui_presentation",
      "future_ai_assistance",
    ])
  })

  it("authoritative outputs include deterministic source-of-truth outputs", () => {
    expect(PHASE3_AUTHORITY_DOCTRINE.authoritativeOutputs).toEqual(
      expect.arrayContaining([
        "true_mao",
        "finance_calculation",
        "capital_protection",
        "governance_threshold",
        "deal_classification",
        "fatal_risk_detection",
      ])
    )
  })

  it("advisory outputs include evidence/advisory review outputs", () => {
    expect(PHASE3_AUTHORITY_DOCTRINE.advisoryOutputs).toEqual(
      expect.arrayContaining([
        "evidence_hint",
        "advisory_task",
        "ai_commentary",
        "merged_advisory_output",
        "developer_review_surface_output",
      ])
    )
  })

  it("escalation priority starts with fatal then reject before manual review", () => {
    expect(PHASE3_ESCALATION_PRIORITY[0]).toBe("fatal")
    expect(PHASE3_ESCALATION_PRIORITY[1]).toBe("reject")
    expect(PHASE3_ESCALATION_PRIORITY.indexOf("manual_review_required")).toBeGreaterThan(1)
  })

  it("state ownership rules can mark deterministic states as authoritative", () => {
    expect(
      PHASE3_AUTHORITY_DOCTRINE.stateOwnershipRules.some(
        (rule) =>
          rule.stateName === "true_mao" &&
          rule.authorityLevel === "authoritative" &&
          rule.owningLayer === "deterministic_engine"
      )
    ).toBe(true)
  })

  it("advisory/ui/future ai layers are prohibited modifiers for deterministic states", () => {
    const deterministicRules = PHASE3_AUTHORITY_DOCTRINE.stateOwnershipRules.filter((rule) =>
      ["true_mao", "finance_result", "final_classification", "fatal_risk"].includes(rule.stateName)
    )

    for (const rule of deterministicRules) {
      expect(rule.mayNotBeModifiedBy).toEqual(
        expect.arrayContaining(["advisory_layer", "ui_layer", "future_ai_layer"])
      )
    }
  })

  it("safe-fail actions can require manual review or block advisory upgrade", () => {
    expect(
      PHASE3_AUTHORITY_DOCTRINE.stateOwnershipRules.some(
        (rule) => rule.safeFailAction === "require_manual_review"
      )
    ).toBe(true)
    expect(
      PHASE3_AUTHORITY_DOCTRINE.stateOwnershipRules.some(
        (rule) => rule.safeFailAction === "block_advisory_upgrade"
      )
    ).toBe(true)
  })

  it("doctrine advisoryOnly is true", () => {
    expect(PHASE3_AUTHORITY_DOCTRINE.advisoryOnly).toBe(true)
  })

  it("doctrine constants do not include runtime enforcement fields", () => {
    const forbiddenKeys = ["execute", "apply", "mutate", "override", "persist", "fetch", "api", "aiModel"]
    const topLevelKeys = Object.keys(PHASE3_AUTHORITY_DOCTRINE)
    const stateRuleKeys = PHASE3_AUTHORITY_DOCTRINE.stateOwnershipRules.flatMap((rule) =>
      Object.keys(rule)
    )
    const allKeys = [...topLevelKeys, ...stateRuleKeys]

    for (const forbidden of forbiddenKeys) {
      expect(allKeys).not.toContain(forbidden)
    }
  })

  it("matches authority doctrine fixture", () => {
    expect(PHASE3_AUTHORITY_DOCTRINE).toEqual(loadAuthorityFixture())
  })

  it("validates doctrine as valid", () => {
    const result = validatePhase3AuthorityDoctrine(PHASE3_AUTHORITY_DOCTRINE)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.advisoryOnly).toBe(true)
  })

  it("invalid hierarchy returns error", () => {
    const invalid = {
      ...PHASE3_AUTHORITY_DOCTRINE,
      hierarchy: [
        "capital_protection",
        "deterministic_governance",
        ...PHASE3_AUTHORITY_DOCTRINE.hierarchy.filter(
          (layer) => layer !== "capital_protection" && layer !== "deterministic_governance"
        ),
      ],
    } as Phase3AuthorityDoctrine

    const result = validatePhase3AuthorityDoctrine(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes("doctrine.hierarchy"))).toBe(true)
  })

  it("missing permanent rule returns error", () => {
    const invalid = {
      ...PHASE3_AUTHORITY_DOCTRINE,
      permanentRule: "Permanent rule unavailable.",
    } as Phase3AuthorityDoctrine

    const result = validatePhase3AuthorityDoctrine(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes("permanentRule"))).toBe(true)
  })

  it("missing authoritative output returns error", () => {
    const invalid = {
      ...PHASE3_AUTHORITY_DOCTRINE,
      authoritativeOutputs: PHASE3_AUTHORITY_DOCTRINE.authoritativeOutputs.filter(
        (output) => output !== "true_mao"
      ),
    } as Phase3AuthorityDoctrine

    const result = validatePhase3AuthorityDoctrine(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes("missing authoritative output: true_mao"))).toBe(true)
  })

  it("advisory layer allowed to modify deterministic state returns error", () => {
    const invalid = {
      ...PHASE3_AUTHORITY_DOCTRINE,
      stateOwnershipRules: PHASE3_AUTHORITY_DOCTRINE.stateOwnershipRules.map((rule) =>
        rule.stateName === "true_mao"
          ? {
              ...rule,
              mayNotBeModifiedBy: rule.mayNotBeModifiedBy.filter((layer) => layer !== "advisory_layer"),
            }
          : rule
      ),
    } as Phase3AuthorityDoctrine

    const result = validatePhase3AuthorityDoctrine(invalid)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.includes("deterministic authoritative rule must prohibit advisory/ui/future_ai modifiers")
      )
    ).toBe(true)
  })

  it("runtime/enforcement-like keys return error", () => {
    const invalid = {
      ...PHASE3_AUTHORITY_DOCTRINE,
      execute: true,
    } as Phase3AuthorityDoctrine & { execute: boolean }

    const result = validatePhase3AuthorityDoctrine(invalid)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) => error.includes("runtime/enforcement-like keys"))
    ).toBe(true)
  })

  it("validation does not mutate input", () => {
    const input = loadAuthorityFixture()
    const before = JSON.stringify(input)

    validatePhase3AuthorityDoctrine(input)

    expect(JSON.stringify(input)).toBe(before)
  })

  it("validation result is deterministic", () => {
    const first = validatePhase3AuthorityDoctrine(PHASE3_AUTHORITY_DOCTRINE)
    const second = validatePhase3AuthorityDoctrine(PHASE3_AUTHORITY_DOCTRINE)
    expect(first).toEqual(second)
  })

  it("helper does not expose apply/enforce/mutate behavior", () => {
    expect(Object.keys(authorityContractModule)).toEqual(["validatePhase3AuthorityDoctrine"])
  })
})
