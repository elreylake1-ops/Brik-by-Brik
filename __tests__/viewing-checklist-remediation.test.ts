import { describe, expect, it } from "vitest"
import { FINDING_WORK_MAPPINGS, MAPPED_CHECK_IDS, mappingForCheck } from "@/lib/data/finding-work-mapping"
import { VIEWING_CHECKLIST_IDS, VIEWING_CHECKLIST_V1, VIEWING_CHECKLIST_VERSION } from "@/lib/viewing-assessment/checklist-v1"
import { VIEWING_CHECKLIST_SOURCES } from "@/types/viewing-assessment"
import { createFixtureProvider } from "@/lib/viewing-assessment/ai/fixture-provider"
import { buildOutputSchema, buildSystemPrompt } from "@/lib/viewing-assessment/ai/prompt"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { buildDefaultInvestorShieldChecks } from "@/lib/investor-shield/default-checks"

describe("Task 9C-2B: Original Checklist Wording Remediation", () => {
  it("preserves exactly 58 items with unique C01-C45 and V01-V13 identifiers", () => {
    expect(VIEWING_CHECKLIST_V1).toHaveLength(58)
    const pad = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`)
    const expectedIds = [...pad("C", 45), ...pad("V", 13)]
    const actualIds = VIEWING_CHECKLIST_V1.map((item) => item.id)

    expect(actualIds).toEqual(expectedIds)
    expect(new Set(actualIds).size).toBe(58)
    expect(VIEWING_CHECKLIST_IDS.size).toBe(58)
    for (const id of expectedIds) {
      expect(VIEWING_CHECKLIST_IDS.has(id)).toBe(true)
    }
  })

  it("conforms to the ChecklistItem schema and source constraints", () => {
    expect(VIEWING_CHECKLIST_VERSION).toBe("viewing-checklist-v1")

    for (const item of VIEWING_CHECKLIST_V1) {
      expect(item.id).toMatch(/^(C[0-4][0-9]|V[0-1][0-9])$/)
      expect(typeof item.group).toBe("string")
      expect(item.group.trim().length).toBeGreaterThanOrEqual(3)
      expect(typeof item.title).toBe("string")
      expect(item.title.trim().length).toBeGreaterThanOrEqual(5)
      expect(typeof item.prompt).toBe("string")
      expect(item.prompt.trim().length).toBeGreaterThanOrEqual(20)

      expect(VIEWING_CHECKLIST_SOURCES).toContain(item.source)
      if (item.id.startsWith("C")) {
        expect(item.source).toBe("45-check inspection")
      } else {
        expect(item.source).toBe("Viewing supplement")
      }
    }
  })

  it("resolves all finding-work mappings without error", () => {
    const allMappedCheckIds = FINDING_WORK_MAPPINGS.flatMap((m) => m.checkIds)
    for (const checkId of allMappedCheckIds) {
      expect(VIEWING_CHECKLIST_IDS.has(checkId), `Mapped check ${checkId} not in checklist`).toBe(true)
      const mapping = mappingForCheck(checkId)
      expect(mapping).toBeDefined()
      expect(mapping?.checkIds).toContain(checkId)
    }
    expect(MAPPED_CHECK_IDS.size).toBe(allMappedCheckIds.length)
  })

  it("ensures prompt generator and output schema accept all 58 checklist items", () => {
    const systemPrompt = buildSystemPrompt(VIEWING_CHECKLIST_V1)
    expect(systemPrompt).toContain("C01 [Roof]")
    expect(systemPrompt).toContain("V13 [Property details]")
    expect(systemPrompt.length).toBeGreaterThan(2000)

    const schema = buildOutputSchema(VIEWING_CHECKLIST_V1.map((c) => c.id))
    expect(schema.properties.findings.items.properties.checkId.enum).toHaveLength(58)
    expect(schema.properties.findings.items.properties.checkId.enum).toContain("C01")
    expect(schema.properties.findings.items.properties.checkId.enum).toContain("V13")
  })

  it("contains no third-party attribution or known restricted phrases in checklist-v1.ts", () => {
    const restrictedFragments = [
      "Martin Rapley",
      "Refurbishment Mastery",
      "Brik_by_Brik_Viewing_Module",
      "Private working adaptation: confirm reuse permissions",
      "Film roof slopes from ground level; note missing or damaged coverings.",
      "Record apparent leaning from a safe ground-level position.",
      "Look for displaced pots, missing masonry or vegetation.",
      "Separate glazing-unit from frame replacement.",
      "Flag sampling needs before disturbing suspect materials.",
      "Use a suitable level or measurement; camera perspective is insufficient.",
    ]

    for (const item of VIEWING_CHECKLIST_V1) {
      for (const phrase of restrictedFragments) {
        expect(item.title.toLowerCase().includes(phrase.toLowerCase())).toBe(false)
        expect(item.prompt.toLowerCase().includes(phrase.toLowerCase())).toBe(false)
      }
    }
  })

  it("preserves deterministic fixture behavior", async () => {
    const fixture = createFixtureProvider("complete_flow")
    const outcome = await fixture.analyse({
      assessmentId: "test-assessment",
      frames: [
        { id: "F1", timestampSeconds: 2, jpeg: null },
        { id: "F2", timestampSeconds: 5, jpeg: null },
        { id: "F3", timestampSeconds: 10, jpeg: null },
      ],
      limits: { maxFrames: 10, maxOutputTokens: 1000, timeoutMs: 5000 },
      signal: new AbortController().signal,
    })

    expect(outcome.kind).toBe("ok")
    if (outcome.kind === "ok") {
      const envelope = outcome.envelope as { findings: Array<{ checkId: string }> }
      expect(envelope.findings.length).toBe(3)
      for (const finding of envelope.findings) {
        expect(VIEWING_CHECKLIST_IDS.has(finding.checkId)).toBe(true)
      }
    }
  })

  it("preserves financial calculations and Investor Shield invariants", () => {
    const refurbResult = calculateRefurbCost([])
    expect(refurbResult.totalRefurbCost).toBe(0)

    const defaultChecks = buildDefaultInvestorShieldChecks("deal-1")
    expect(defaultChecks.length).toBeGreaterThan(0)

    const shieldResult = evaluateInvestorShield({
      dealId: "deal-1",
      checks: defaultChecks,
      evidenceItems: [],
      riskFlags: [],
      manualOverrides: [],
    })
    expect(shieldResult).toBeDefined()
    expect(typeof shieldResult.overallStatus).toBe("string")
  })
})



