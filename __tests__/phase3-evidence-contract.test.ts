import { describe, expect, it } from "vitest"
import type {
  Phase3EvidenceBundle,
  Phase3EvidenceItem,
  EvidenceSource,
} from "@/types/phase3-evidence"

function makeEvidenceItem(overrides?: Partial<Phase3EvidenceItem>): Phase3EvidenceItem {
  return {
    id: "ev-1",
    category: "comparable_evidence",
    status: "provided",
    source: "operator_entered",
    confidence: "medium",
    label: "Comparable sold evidence",
    advisoryOnly: true,
    ...overrides,
  }
}

describe("phase3 evidence contracts", () => {
  it("supports a valid evidence item object shape", () => {
    const item = makeEvidenceItem({
      stableCode: "COMP_SOLD_001",
      relatedField: "gdvRealistic",
      issues: ["stale_sold_date"],
      warnings: ["operator_entered_value"],
    })

    expect(item.id).toBe("ev-1")
    expect(item.category).toBe("comparable_evidence")
    expect(item.status).toBe("provided")
    expect(item.source).toBe("operator_entered")
    expect(item.advisoryOnly).toBe(true)
  })

  it("supports a valid evidence bundle object shape", () => {
    const bundle: Phase3EvidenceBundle = {
      items: [
        makeEvidenceItem(),
        makeEvidenceItem({
          id: "ev-2",
          category: "legal_survey_evidence",
          status: "weak",
          confidence: "low",
        }),
      ],
      missingCriticalEvidence: ["survey_report"],
      conflictingEvidence: [],
      reviewRequired: true,
      confidence: "low",
      advisoryOnly: true,
    }

    expect(bundle.items).toHaveLength(2)
    expect(bundle.reviewRequired).toBe(true)
    expect(bundle.advisoryOnly).toBe(true)
  })

  it("requires advisoryOnly true on evidence item and bundle contracts", () => {
    const item = makeEvidenceItem()
    const bundle: Phase3EvidenceBundle = {
      items: [item],
      missingCriticalEvidence: [],
      conflictingEvidence: [],
      reviewRequired: false,
      confidence: "medium",
      advisoryOnly: true,
    }

    expect(item.advisoryOnly).toBe(true)
    expect(bundle.advisoryOnly).toBe(true)
  })

  it("allows future_ai_extracted as reserved source label with no behavior", () => {
    const source: EvidenceSource = "future_ai_extracted"
    const item = makeEvidenceItem({
      id: "ev-ai-reserved",
      source,
      label: "Reserved source label only",
    })

    expect(item.source).toBe("future_ai_extracted")
    expect(item.advisoryOnly).toBe(true)
  })

  it("allows future_integration as reserved source label with no behavior", () => {
    const source: EvidenceSource = "future_integration"
    const item = makeEvidenceItem({
      id: "ev-int-reserved",
      source,
      label: "Reserved integration label only",
    })

    expect(item.source).toBe("future_integration")
    expect(item.advisoryOnly).toBe(true)
  })

  it("supports reviewRequired true for weak or conflicting evidence", () => {
    const weakItem = makeEvidenceItem({
      id: "ev-weak",
      status: "weak",
      confidence: "low",
    })
    const conflictingItem = makeEvidenceItem({
      id: "ev-conflict",
      status: "conflicting",
      issues: ["valuation_mismatch"],
      confidence: "low",
    })
    const bundle: Phase3EvidenceBundle = {
      items: [weakItem, conflictingItem],
      missingCriticalEvidence: ["title_document"],
      conflictingEvidence: ["valuation_mismatch"],
      reviewRequired: true,
      confidence: "low",
      advisoryOnly: true,
    }

    expect(bundle.reviewRequired).toBe(true)
    expect(bundle.confidence).toBe("low")
  })

  it("accepted evidence does not imply deterministic approval", () => {
    const acceptedItem = makeEvidenceItem({
      id: "ev-accepted",
      status: "accepted",
      confidence: "high",
    })
    const bundle: Phase3EvidenceBundle = {
      items: [acceptedItem],
      missingCriticalEvidence: [],
      conflictingEvidence: [],
      reviewRequired: false,
      confidence: "high",
      advisoryOnly: true,
    }

    expect(bundle.items[0]?.status).toBe("accepted")
    expect(bundle.advisoryOnly).toBe(true)
    expect("finalClassification" in bundle).toBe(false)
  })

  it("uses readonly arrays without mutation in helper-free contract usage", () => {
    const issues = Object.freeze(["stale_comparable"])
    const warnings = Object.freeze(["manual_entry"])
    const item = makeEvidenceItem({
      id: "ev-readonly",
      issues,
      warnings,
    })
    const missingCriticalEvidence = Object.freeze(["survey"])
    const conflictingEvidence = Object.freeze(["survey_date_mismatch"])
    const bundle: Phase3EvidenceBundle = {
      items: Object.freeze([item]),
      missingCriticalEvidence,
      conflictingEvidence,
      reviewRequired: true,
      confidence: "medium",
      advisoryOnly: true,
    }

    const before = JSON.stringify(bundle)
    const seenIssue = bundle.items[0]?.issues?.[0]
    const seenConflict = bundle.conflictingEvidence[0]

    expect(seenIssue).toBe("stale_comparable")
    expect(seenConflict).toBe("survey_date_mismatch")
    expect(JSON.stringify(bundle)).toBe(before)
  })
})
