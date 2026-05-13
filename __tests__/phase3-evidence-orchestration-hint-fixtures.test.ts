import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import type { EvidenceOrchestrationHints } from "@/types/phase3-evidence"

function loadHintFixture(fileName: string): EvidenceOrchestrationHints {
  const fixturePath = path.resolve(
    process.cwd(),
    "__tests__",
    "fixtures",
    "phase3-evidence-orchestration-hints",
    fileName
  )
  return JSON.parse(readFileSync(fixturePath, "utf8")) as EvidenceOrchestrationHints
}

function assertHintsBundleShape(hints: EvidenceOrchestrationHints) {
  expect(Array.isArray(hints.tasks)).toBe(true)
  expect(Array.isArray(hints.escalationRoutes)).toBe(true)
  expect(Array.isArray(hints.warnings)).toBe(true)
  expect(typeof hints.reviewRequired).toBe("boolean")
  expect(hints.advisoryOnly).toBe(true)
}

describe("phase3 evidence orchestration hint fixtures", () => {
  describe("weak-comparable-evidence-hints", () => {
    const hints = loadHintFixture("weak-comparable-evidence-hints.json")

    it("has valid bundle shape", () => {
      assertHintsBundleShape(hints)
    })

    it("has advisoryOnly true", () => {
      expect(hints.advisoryOnly).toBe(true)
    })

    it("requires review", () => {
      expect(hints.reviewRequired).toBe(true)
    })

    it("has at least one hint task", () => {
      expect(hints.tasks.length).toBeGreaterThan(0)
    })

    it("hint tasks have advisoryOnly true", () => {
      hints.tasks.forEach((t) => expect(t.advisoryOnly).toBe(true))
    })

    it("trigger is weak_evidence", () => {
      expect(hints.tasks[0].trigger).toBe("weak_evidence")
    })

    it("escalation routes include valuation_review", () => {
      expect(hints.escalationRoutes).toContain("valuation_review")
    })

    it("does not contain deterministic approval fields", () => {
      expect("finalClassification" in hints).toBe(false)
      expect("governanceState" in hints).toBe(false)
    })
  })

  describe("conflicting-legal-evidence-hints", () => {
    const hints = loadHintFixture("conflicting-legal-evidence-hints.json")

    it("has valid bundle shape", () => {
      assertHintsBundleShape(hints)
    })

    it("has advisoryOnly true", () => {
      expect(hints.advisoryOnly).toBe(true)
    })

    it("requires review", () => {
      expect(hints.reviewRequired).toBe(true)
    })

    it("trigger is conflicting_evidence", () => {
      expect(hints.tasks[0].trigger).toBe("conflicting_evidence")
    })

    it("escalation routes include legal_review", () => {
      expect(hints.escalationRoutes).toContain("legal_review")
    })

    it("hint tasks have advisoryOnly true", () => {
      hints.tasks.forEach((t) => expect(t.advisoryOnly).toBe(true))
    })
  })

  describe("accepted-operator-note-hints", () => {
    const hints = loadHintFixture("accepted-operator-note-hints.json")

    it("has valid bundle shape", () => {
      assertHintsBundleShape(hints)
    })

    it("has advisoryOnly true", () => {
      expect(hints.advisoryOnly).toBe(true)
    })

    it("does not require review", () => {
      expect(hints.reviewRequired).toBe(false)
    })

    it("trigger is accepted_evidence_awareness", () => {
      expect(hints.tasks[0].trigger).toBe("accepted_evidence_awareness")
    })

    it("suggested task category is limitations_awareness", () => {
      expect(hints.tasks[0].suggestedTaskCategory).toBe("limitations_awareness")
    })

    it("hint tasks have advisoryOnly true", () => {
      hints.tasks.forEach((t) => expect(t.advisoryOnly).toBe(true))
    })

    it("does not contain deterministic approval fields", () => {
      expect("finalClassification" in hints).toBe(false)
      expect("governanceState" in hints).toBe(false)
    })
  })

  describe("missing-lender-evidence-hints", () => {
    const hints = loadHintFixture("missing-lender-evidence-hints.json")

    it("has valid bundle shape", () => {
      assertHintsBundleShape(hints)
    })

    it("has advisoryOnly true", () => {
      expect(hints.advisoryOnly).toBe(true)
    })

    it("requires review", () => {
      expect(hints.reviewRequired).toBe(true)
    })

    it("trigger is missing_evidence", () => {
      expect(hints.tasks[0].trigger).toBe("missing_evidence")
    })

    it("escalation routes include lender_review", () => {
      expect(hints.escalationRoutes).toContain("lender_review")
    })

    it("hint tasks have advisoryOnly true", () => {
      hints.tasks.forEach((t) => expect(t.advisoryOnly).toBe(true))
    })
  })
})
