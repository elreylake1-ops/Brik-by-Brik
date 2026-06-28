import { describe, expect, it } from "vitest"
import {
  PDF_EVIDENCE_PACK_AUDIENCE,
  PDF_EVIDENCE_PACK_GENERATION_MODE,
  PDF_EVIDENCE_PACK_PURPOSE,
  PDF_EVIDENCE_PACK_SCHEMA_VERSION,
} from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import {
  PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
  PDF_EVIDENCE_PACK_COMPLETE_FIXTURE,
  PDF_EVIDENCE_PACK_EMPTY_FIXTURE,
  PDF_EVIDENCE_PACK_FIXTURES,
  PDF_EVIDENCE_PACK_NULL_VS_ZERO_FIXTURE,
  PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE,
} from "./fixtures/pdf-evidence-pack-fixtures"

describe("PDF evidence pack canonical type contract", () => {
  it("exports the locked MVP literals and top-level sections", () => {
    expect(PDF_EVIDENCE_PACK_FIXTURES).toHaveLength(5)
    expect(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.meta.schemaVersion).toBe(PDF_EVIDENCE_PACK_SCHEMA_VERSION)
    expect(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.meta.audience).toBe(PDF_EVIDENCE_PACK_AUDIENCE)
    expect(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.meta.purpose).toBe(PDF_EVIDENCE_PACK_PURPOSE)
    expect(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.meta.generationMode).toBe(
      PDF_EVIDENCE_PACK_GENERATION_MODE
    )
    expect(Object.keys(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE).sort()).toEqual([
      "disclaimers",
      "evidenceIndex",
      "identity",
      "investorShield",
      "investorSummary",
      "meta",
    ])
  })

  it("serializes and parses without runtime-only values", () => {
    const parsed = JSON.parse(JSON.stringify(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE)) as typeof PDF_EVIDENCE_PACK_COMPLETE_FIXTURE

    expect(parsed.meta.generatedAt).toBe("2026-06-14T12:00:00.000Z")
    expect(parsed.evidenceIndex[0]?.controlledReferenceState).toBe("AVAILABLE")
    expect(parsed.disclaimers[0]?.required).toBe(true)
  })

  it("preserves blocked status and the null-versus-zero boundary", () => {
    expect(PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorShield.overallStatus).toBe("BLOCKED")
    expect(PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorShield.blockingGateKeys).toContain("TITLE")
    expect(PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorSummary.latestOffer?.amount).toBe(118000)

    expect(PDF_EVIDENCE_PACK_NULL_VS_ZERO_FIXTURE.investorSummary.gdvRange.realistic).toBeNull()
    expect(PDF_EVIDENCE_PACK_NULL_VS_ZERO_FIXTURE.investorSummary.latestOffer?.amount).toBe(0)
    expect(PDF_EVIDENCE_PACK_NULL_VS_ZERO_FIXTURE.investorSummary.trueMao.twentyPercent).toBeNull()
  })

  it("keeps the evidence boundary metadata-only", () => {
    for (const evidence of PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.evidenceIndex) {
      expect(evidence.evidenceId).toMatch(/^evi-pdf-/)
      expect(evidence.controlledReferenceState).toBe("AVAILABLE")
      expect(evidence.relatedGateIds.length).toBeGreaterThan(0)
    }

    const serialized = JSON.stringify(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.evidenceIndex)
    const forbiddenKeys = [
      "fileBytes",
      "buffer",
      "signedUrl",
      "storageBucket",
      "privatePath",
      "attachmentPayload",
      "ocrText",
      "aiSummary",
    ]

    for (const forbiddenKey of forbiddenKeys) {
      expect(serialized).not.toContain(`"${forbiddenKey}"`)
    }
  })

  it("does not require personal or diagnostic data", () => {
    const fixtures = [
      PDF_EVIDENCE_PACK_COMPLETE_FIXTURE,
      PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
      PDF_EVIDENCE_PACK_NULL_VS_ZERO_FIXTURE,
      PDF_EVIDENCE_PACK_EMPTY_FIXTURE,
      PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE,
    ]

    const forbiddenFragments = [
      "DATABASE_URL",
      "select *",
      "stack trace",
      "traceId",
      "project-ref",
      "C:\\Users\\",
      "email",
      "phone",
      "broker",
      "owner name",
      "saved-deals-repository",
      "deal-offers-repository",
      "deal-tasks-repository",
    ]

    for (const fixture of fixtures) {
      const serialized = JSON.stringify(fixture)
      for (const fragment of forbiddenFragments) {
        expect(serialized).not.toContain(fragment)
      }
    }
  })
})
