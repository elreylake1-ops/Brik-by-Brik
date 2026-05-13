import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { validatePhase3EvidenceBundle } from "@/lib/engine/phase3-evidence-contract"
import type {
  Phase3EvidenceBundle,
  Phase3EvidenceBundleValidationResult,
  Phase3EvidenceItem,
} from "@/types/phase3-evidence"

function loadFixture(fileName: string): Phase3EvidenceBundle {
  const fixturePath = path.resolve(
    process.cwd(),
    "__tests__",
    "fixtures",
    "phase3-evidence",
    fileName
  )
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Phase3EvidenceBundle
}

function loadValidationFixture(fileName: string): Phase3EvidenceBundleValidationResult {
  const fixturePath = path.resolve(
    process.cwd(),
    "__tests__",
    "fixtures",
    "phase3-evidence-validation",
    fileName
  )
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Phase3EvidenceBundleValidationResult
}

function createItem(overrides?: Partial<Phase3EvidenceItem>): Phase3EvidenceItem {
  return {
    id: "ev-base-1",
    category: "operator_note",
    status: "provided",
    source: "operator_entered",
    confidence: "medium",
    label: "Base evidence item",
    advisoryOnly: true,
    ...overrides,
  }
}

describe("phase3 evidence contract validation", () => {
  it("matches locked validation output fixture for weak comparable evidence", () => {
    const bundle = loadFixture("weak-comparable-evidence.json")
    const expected = loadValidationFixture("weak-comparable-evidence-validation.json")
    const result = validatePhase3EvidenceBundle(bundle)

    expect(result).toEqual(expected)
  })

  it("matches locked validation output fixture for conflicting legal evidence", () => {
    const bundle = loadFixture("conflicting-legal-evidence.json")
    const expected = loadValidationFixture("conflicting-legal-evidence-validation.json")
    const result = validatePhase3EvidenceBundle(bundle)

    expect(result).toEqual(expected)
  })

  it("matches locked validation output fixture for accepted operator note evidence", () => {
    const bundle = loadFixture("accepted-operator-note.json")
    const expected = loadValidationFixture("accepted-operator-note-validation.json")
    const result = validatePhase3EvidenceBundle(bundle)

    expect(result).toEqual(expected)
  })

  it("matches locked validation output fixture for missing lender evidence", () => {
    const bundle = loadFixture("missing-lender-evidence.json")
    const expected = loadValidationFixture("missing-lender-evidence-validation.json")
    const result = validatePhase3EvidenceBundle(bundle)

    expect(result).toEqual(expected)
  })

  it("validation output field order and warning order are stable", () => {
    const bundle = loadFixture("accepted-operator-note.json")
    const result = validatePhase3EvidenceBundle(bundle)

    expect(Object.keys(result)).toEqual(["valid", "errors", "warnings", "requiresReview"])
    expect(result.warnings).toEqual([
      "accepted evidence is advisory only and does not imply deterministic approval: ev-note-accepted-1",
    ])
  })

  it("repeated validation for the same fixture returns identical results", () => {
    const bundle = loadFixture("accepted-operator-note.json")
    const first = validatePhase3EvidenceBundle(bundle)
    const second = validatePhase3EvidenceBundle(bundle)

    expect(second).toEqual(first)
  })

  it("reserved future source warning text remains stable", () => {
    const bundle: Phase3EvidenceBundle = {
      items: [createItem({ id: "reserved-ai-1", source: "future_ai_extracted" })],
      missingCriticalEvidence: [],
      conflictingEvidence: [],
      reviewRequired: false,
      confidence: "unknown",
      advisoryOnly: true,
    }

    const result = validatePhase3EvidenceBundle(bundle)
    expect(result.valid).toBe(true)
    expect(result.warnings).toEqual([
      "reserved source label only: reserved-ai-1 uses future_ai_extracted",
    ])
  })

  it("loads and validates weak comparable evidence fixture", () => {
    const bundle = loadFixture("weak-comparable-evidence.json")
    const result = validatePhase3EvidenceBundle(bundle)

    expect(result.valid).toBe(true)
    expect(result.requiresReview).toBe(true)
    expect(bundle.reviewRequired).toBe(true)
  })

  it("loads and validates conflicting legal evidence fixture", () => {
    const bundle = loadFixture("conflicting-legal-evidence.json")
    const result = validatePhase3EvidenceBundle(bundle)

    expect(result.valid).toBe(true)
    expect(result.requiresReview).toBe(true)
    expect(bundle.reviewRequired).toBe(true)
  })

  it("loads and validates accepted operator note fixture as non-decisioning", () => {
    const bundle = loadFixture("accepted-operator-note.json")
    const result = validatePhase3EvidenceBundle(bundle)

    expect(result.valid).toBe(true)
    expect(result.requiresReview).toBe(false)
    expect(
      result.warnings.some((warning) =>
        warning.includes("accepted evidence is advisory only and does not imply deterministic approval")
      )
    ).toBe(true)
  })

  it("loads and validates missing lender evidence fixture", () => {
    const bundle = loadFixture("missing-lender-evidence.json")
    const result = validatePhase3EvidenceBundle(bundle)

    expect(result.valid).toBe(true)
    expect(result.requiresReview).toBe(true)
    expect(bundle.reviewRequired).toBe(true)
  })

  it("weak comparable evidence requires review", () => {
    const bundle: Phase3EvidenceBundle = {
      items: [createItem({ id: "ev-weak-1", category: "comparable_evidence", status: "weak" })],
      missingCriticalEvidence: ["comparable_date"],
      conflictingEvidence: [],
      reviewRequired: true,
      confidence: "low",
      advisoryOnly: true,
    }

    const result = validatePhase3EvidenceBundle(bundle)
    expect(result.valid).toBe(true)
    expect(result.requiresReview).toBe(true)
  })

  it("conflicting legal evidence requires review", () => {
    const bundle: Phase3EvidenceBundle = {
      items: [
        createItem({
          id: "ev-legal-1",
          category: "legal_survey_evidence",
          status: "conflicting",
        }),
      ],
      missingCriticalEvidence: [],
      conflictingEvidence: ["boundary_conflict"],
      reviewRequired: true,
      confidence: "low",
      advisoryOnly: true,
    }

    const result = validatePhase3EvidenceBundle(bundle)
    expect(result.valid).toBe(true)
    expect(result.requiresReview).toBe(true)
  })

  it("missing lender evidence requires review", () => {
    const bundle: Phase3EvidenceBundle = {
      items: [
        createItem({
          id: "ev-lender-1",
          category: "lender_refinance_evidence",
          status: "missing",
          source: "unknown",
        }),
      ],
      missingCriticalEvidence: ["refinance_term_sheet"],
      conflictingEvidence: [],
      reviewRequired: true,
      confidence: "low",
      advisoryOnly: true,
    }

    const result = validatePhase3EvidenceBundle(bundle)
    expect(result.valid).toBe(true)
    expect(result.requiresReview).toBe(true)
  })

  it("duplicate item IDs produce warning", () => {
    const bundle: Phase3EvidenceBundle = {
      items: [createItem({ id: "dup-1" }), createItem({ id: "dup-1", label: "Duplicate id item" })],
      missingCriticalEvidence: [],
      conflictingEvidence: [],
      reviewRequired: false,
      confidence: "medium",
      advisoryOnly: true,
    }

    const result = validatePhase3EvidenceBundle(bundle)
    expect(result.valid).toBe(true)
    expect(result.warnings.some((warning) => warning.includes("duplicate item id detected"))).toBe(true)
  })

  it("reserved future source labels produce warning only, not failure", () => {
    const bundle: Phase3EvidenceBundle = {
      items: [
        createItem({ id: "reserved-ai-1", source: "future_ai_extracted" }),
        createItem({ id: "reserved-int-1", source: "future_integration" }),
      ],
      missingCriticalEvidence: [],
      conflictingEvidence: [],
      reviewRequired: false,
      confidence: "unknown",
      advisoryOnly: true,
    }

    const result = validatePhase3EvidenceBundle(bundle)
    expect(result.valid).toBe(true)
    expect(result.warnings.some((warning) => warning.includes("reserved source label only"))).toBe(true)
  })

  it("weak, conflicting, and missing review behavior remains locked", () => {
    const weak = validatePhase3EvidenceBundle(loadFixture("weak-comparable-evidence.json"))
    const conflicting = validatePhase3EvidenceBundle(loadFixture("conflicting-legal-evidence.json"))
    const missing = validatePhase3EvidenceBundle(loadFixture("missing-lender-evidence.json"))

    expect(weak.requiresReview).toBe(true)
    expect(conflicting.requiresReview).toBe(true)
    expect(missing.requiresReview).toBe(true)
  })

  it("validation does not mutate input", () => {
    const bundle = loadFixture("weak-comparable-evidence.json")
    const before = JSON.stringify(bundle)

    validatePhase3EvidenceBundle(bundle)

    expect(JSON.stringify(bundle)).toBe(before)
  })

  it("empty bundle behavior is deterministic", () => {
    const validEmpty: Phase3EvidenceBundle = {
      items: [],
      missingCriticalEvidence: [],
      conflictingEvidence: [],
      reviewRequired: false,
      confidence: "unknown",
      advisoryOnly: true,
    }
    const warnedEmpty: Phase3EvidenceBundle = {
      items: [],
      missingCriticalEvidence: [],
      conflictingEvidence: [],
      reviewRequired: false,
      confidence: "medium",
      advisoryOnly: true,
    }

    const validResult = validatePhase3EvidenceBundle(validEmpty)
    const warnedResult = validatePhase3EvidenceBundle(warnedEmpty)
    const repeatWarnedResult = validatePhase3EvidenceBundle(warnedEmpty)

    expect(validResult.valid).toBe(true)
    expect(validResult.warnings).toEqual([])
    expect(warnedResult.valid).toBe(true)
    expect(
      warnedResult.warnings.some((warning) =>
        warning.includes("empty evidence bundle should use confidence 'unknown'")
      )
    ).toBe(true)
    expect(repeatWarnedResult).toEqual(warnedResult)
  })

  it("missing, weak, or conflicting evidence with reviewRequired false is invalid", () => {
    const bundle: Phase3EvidenceBundle = {
      items: [createItem({ id: "ev-invalid-1", status: "weak" })],
      missingCriticalEvidence: [],
      conflictingEvidence: [],
      reviewRequired: false,
      confidence: "low",
      advisoryOnly: true,
    }

    const result = validatePhase3EvidenceBundle(bundle)

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.includes("bundle.reviewRequired must be true when missing, weak, or conflicting evidence exists")
      )
    ).toBe(true)
  })
})
