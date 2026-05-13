import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { mapEvidenceBundleToOrchestrationHints } from "@/lib/engine/phase3-evidence-orchestration-adapter"
import type {
  EvidenceOrchestrationHints,
  Phase3EvidenceBundle,
} from "@/types/phase3-evidence"

function loadEvidenceFixture(fileName: string): Phase3EvidenceBundle {
  const p = path.resolve(process.cwd(), "__tests__", "fixtures", "phase3-evidence", fileName)
  return JSON.parse(readFileSync(p, "utf8")) as Phase3EvidenceBundle
}

function loadHintFixture(fileName: string): EvidenceOrchestrationHints {
  const p = path.resolve(
    process.cwd(),
    "__tests__",
    "fixtures",
    "phase3-evidence-orchestration-hints",
    fileName
  )
  return JSON.parse(readFileSync(p, "utf8")) as EvidenceOrchestrationHints
}

const EMPTY_BUNDLE: Phase3EvidenceBundle = {
  items: [],
  missingCriticalEvidence: [],
  conflictingEvidence: [],
  reviewRequired: false,
  confidence: "unknown",
  advisoryOnly: true,
}

describe("mapEvidenceBundleToOrchestrationHints", () => {
  describe("weak-comparable-evidence", () => {
    const input = loadEvidenceFixture("weak-comparable-evidence.json")
    const expected = loadHintFixture("weak-comparable-evidence-hints.json")

    it("matches locked expected fixture exactly", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect(result).toEqual(expected)
    })

    it("produces deterministic output on repeated calls", () => {
      const a = mapEvidenceBundleToOrchestrationHints(input)
      const b = mapEvidenceBundleToOrchestrationHints(input)
      expect(a).toEqual(b)
    })

    it("does not mutate input bundle", () => {
      const copy = JSON.parse(JSON.stringify(input)) as Phase3EvidenceBundle
      mapEvidenceBundleToOrchestrationHints(input)
      expect(input).toEqual(copy)
    })

    it("output has no timestamps or random fields", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      const resultStr = JSON.stringify(result)
      expect(resultStr).not.toMatch(/timestamp|createdAt|updatedAt|Date\.now|random/i)
    })

    it("advisoryOnly is true on bundle and all tasks", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect(result.advisoryOnly).toBe(true)
      result.tasks.forEach((t) => expect(t.advisoryOnly).toBe(true))
    })
  })

  describe("conflicting-legal-evidence", () => {
    const input = loadEvidenceFixture("conflicting-legal-evidence.json")
    const expected = loadHintFixture("conflicting-legal-evidence-hints.json")

    it("matches locked expected fixture exactly", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect(result).toEqual(expected)
    })

    it("produces deterministic output on repeated calls", () => {
      const a = mapEvidenceBundleToOrchestrationHints(input)
      const b = mapEvidenceBundleToOrchestrationHints(input)
      expect(a).toEqual(b)
    })

    it("does not mutate input bundle", () => {
      const copy = JSON.parse(JSON.stringify(input)) as Phase3EvidenceBundle
      mapEvidenceBundleToOrchestrationHints(input)
      expect(input).toEqual(copy)
    })

    it("advisoryOnly is true on bundle and all tasks", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect(result.advisoryOnly).toBe(true)
      result.tasks.forEach((t) => expect(t.advisoryOnly).toBe(true))
    })
  })

  describe("accepted-operator-note", () => {
    const input = loadEvidenceFixture("accepted-operator-note.json")
    const expected = loadHintFixture("accepted-operator-note-hints.json")

    it("matches locked expected fixture exactly", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect(result).toEqual(expected)
    })

    it("does not require review", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect(result.reviewRequired).toBe(false)
    })

    it("does not imply deterministic approval", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect("finalClassification" in result).toBe(false)
      expect("governanceState" in result).toBe(false)
      result.tasks.forEach((t) => {
        expect("finalClassification" in t).toBe(false)
        expect("governanceState" in t).toBe(false)
      })
    })

    it("task category is limitations_awareness", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect(result.tasks[0].suggestedTaskCategory).toBe("limitations_awareness")
    })

    it("advisoryOnly is true on bundle and all tasks", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect(result.advisoryOnly).toBe(true)
      result.tasks.forEach((t) => expect(t.advisoryOnly).toBe(true))
    })
  })

  describe("missing-lender-evidence", () => {
    const input = loadEvidenceFixture("missing-lender-evidence.json")
    const expected = loadHintFixture("missing-lender-evidence-hints.json")

    it("matches locked expected fixture exactly", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect(result).toEqual(expected)
    })

    it("produces deterministic output on repeated calls", () => {
      const a = mapEvidenceBundleToOrchestrationHints(input)
      const b = mapEvidenceBundleToOrchestrationHints(input)
      expect(a).toEqual(b)
    })

    it("does not mutate input bundle", () => {
      const copy = JSON.parse(JSON.stringify(input)) as Phase3EvidenceBundle
      mapEvidenceBundleToOrchestrationHints(input)
      expect(input).toEqual(copy)
    })

    it("advisoryOnly is true on bundle and all tasks", () => {
      const result = mapEvidenceBundleToOrchestrationHints(input)
      expect(result.advisoryOnly).toBe(true)
      result.tasks.forEach((t) => expect(t.advisoryOnly).toBe(true))
    })
  })

  describe("empty bundle", () => {
    it("returns deterministic output with no tasks and no escalation routes", () => {
      const result = mapEvidenceBundleToOrchestrationHints(EMPTY_BUNDLE)
      expect(result.tasks).toHaveLength(0)
      expect(result.escalationRoutes).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
      expect(result.reviewRequired).toBe(false)
      expect(result.advisoryOnly).toBe(true)
    })

    it("is deterministic on repeated calls", () => {
      const a = mapEvidenceBundleToOrchestrationHints(EMPTY_BUNDLE)
      const b = mapEvidenceBundleToOrchestrationHints(EMPTY_BUNDLE)
      expect(a).toEqual(b)
    })
  })

  describe("reserved source label", () => {
    it("produces reserved_source_review hint for future_ai_extracted source", () => {
      const bundle: Phase3EvidenceBundle = {
        ...EMPTY_BUNDLE,
        items: [
          {
            id: "ev-reserved-1",
            category: "system_generated_evidence",
            status: "provided",
            source: "future_ai_extracted",
            confidence: "unknown",
            label: "AI extracted evidence — reserved",
            stableCode: "RESERVED_AI_001",
            advisoryOnly: true,
          },
        ],
      }
      const result = mapEvidenceBundleToOrchestrationHints(bundle)
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].trigger).toBe("reserved_source_review")
      expect(result.tasks[0].advisoryOnly).toBe(true)
    })

    it("produces reserved_source_review hint for future_integration source", () => {
      const bundle: Phase3EvidenceBundle = {
        ...EMPTY_BUNDLE,
        items: [
          {
            id: "ev-reserved-2",
            category: "market_evidence",
            status: "provided",
            source: "future_integration",
            confidence: "unknown",
            label: "Integration evidence — reserved",
            advisoryOnly: true,
          },
        ],
      }
      const result = mapEvidenceBundleToOrchestrationHints(bundle)
      expect(result.tasks[0].trigger).toBe("reserved_source_review")
      expect(result.tasks[0].advisoryOnly).toBe(true)
    })

    it("reserved source hint does not imply deterministic approval", () => {
      const bundle: Phase3EvidenceBundle = {
        ...EMPTY_BUNDLE,
        items: [
          {
            id: "ev-reserved-3",
            category: "comparable_evidence",
            status: "accepted",
            source: "future_ai_extracted",
            confidence: "unknown",
            label: "Reserved AI source",
            advisoryOnly: true,
          },
        ],
      }
      const result = mapEvidenceBundleToOrchestrationHints(bundle)
      expect("finalClassification" in result).toBe(false)
      expect("governanceState" in result).toBe(false)
    })
  })

  describe("duplicate item IDs", () => {
    it("produces a duplicate_evidence hint when duplicate IDs detected", () => {
      const bundle: Phase3EvidenceBundle = {
        ...EMPTY_BUNDLE,
        items: [
          {
            id: "ev-dup-1",
            category: "comparable_evidence",
            status: "weak",
            source: "operator_entered",
            confidence: "low",
            label: "Duplicate comparable",
            advisoryOnly: true,
          },
          {
            id: "ev-dup-1",
            category: "comparable_evidence",
            status: "weak",
            source: "operator_entered",
            confidence: "low",
            label: "Duplicate comparable repeated",
            advisoryOnly: true,
          },
        ],
        reviewRequired: true,
      }
      const result = mapEvidenceBundleToOrchestrationHints(bundle)
      const dupHint = result.tasks.find((t) => t.trigger === "duplicate_evidence")
      expect(dupHint).toBeDefined()
      expect(dupHint?.advisoryOnly).toBe(true)
    })
  })
})
