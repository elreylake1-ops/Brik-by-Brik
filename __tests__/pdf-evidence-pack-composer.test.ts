import { describe, expect, it } from "vitest"
import {
  PDF_EVIDENCE_PACK_AUDIENCE,
  PDF_EVIDENCE_PACK_GENERATION_MODE,
  PDF_EVIDENCE_PACK_PURPOSE,
  PDF_EVIDENCE_PACK_SCHEMA_VERSION,
} from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import { composePdfEvidencePack, type ComposePdfEvidencePackInput } from "@/lib/pdf-evidence-pack/compose-pdf-evidence-pack"
import {
  PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
  PDF_EVIDENCE_PACK_COMPLETE_FIXTURE,
  PDF_EVIDENCE_PACK_EMPTY_FIXTURE,
  PDF_EVIDENCE_PACK_NULL_VS_ZERO_FIXTURE,
  PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE,
} from "./fixtures/pdf-evidence-pack-fixtures"

type ComposerInput = ComposePdfEvidencePackInput

function makeBaseInput(): ComposerInput {
  return {
    generatedAt: "2026-06-14T13:30:00.000Z",
    confidentialityLabel: "INTERNAL USE ONLY",
    investorSummary: PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.investorSummary,
    investorShield: PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.investorShield,
    evidenceIndex: PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.evidenceIndex,
    disclaimers: PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.disclaimers,
  }
}

describe("composePdfEvidencePack", () => {
  it("composes the complete deterministic pack", () => {
    const input = makeBaseInput()
    const pack = composePdfEvidencePack(input)

    expect(Object.keys(pack).sort()).toEqual([
      "disclaimers",
      "evidenceIndex",
      "identity",
      "investorShield",
      "investorSummary",
      "meta",
    ])
    expect(pack.meta.schemaVersion).toBe(PDF_EVIDENCE_PACK_SCHEMA_VERSION)
    expect(pack.meta.audience).toBe(PDF_EVIDENCE_PACK_AUDIENCE)
    expect(pack.meta.purpose).toBe(PDF_EVIDENCE_PACK_PURPOSE)
    expect(pack.meta.generationMode).toBe(PDF_EVIDENCE_PACK_GENERATION_MODE)
    expect(pack.meta.generatedAt).toBe(input.generatedAt)
    expect(pack.meta.confidentialityLabel).toBe(input.confidentialityLabel)
    expect(pack.meta.savedDealId).toBe(input.investorSummary.deal.dealId)
    expect(pack.identity).toBe(input.investorSummary.deal)
    expect(pack.investorSummary).toBe(input.investorSummary)
    expect(pack.investorShield).toBe(input.investorShield)
    expect(pack.evidenceIndex).toBe(input.evidenceIndex)
    expect(pack.disclaimers).toBe(input.disclaimers)
  })

  it("keeps a single identity authority", () => {
    const input = makeBaseInput()
    const pack = composePdfEvidencePack(input)

    expect(pack.identity).toBe(input.investorSummary.deal)
    expect(pack.meta.savedDealId).toBe(input.investorSummary.deal.dealId)
    expect("identity" in input).toBe(false)
  })

  it("preserves blocked state and null-versus-zero semantics", () => {
    const pack = composePdfEvidencePack({
      generatedAt: "2026-06-14T13:45:00.000Z",
      confidentialityLabel: "INTERNAL USE ONLY",
      investorSummary: PDF_EVIDENCE_PACK_NULL_VS_ZERO_FIXTURE.investorSummary,
      investorShield: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.investorShield,
      evidenceIndex: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.evidenceIndex,
      disclaimers: PDF_EVIDENCE_PACK_BLOCKED_FIXTURE.disclaimers,
    })

    expect(pack.investorShield.overallStatus).toBe("BLOCKED")
    expect(pack.investorShield.blockingGateKeys).toEqual(["TITLE", "REFURB_CERTAINTY"])
    expect(pack.investorSummary.gdvRange.realistic).toBeNull()
    expect(pack.investorSummary.latestOffer?.amount).toBe(0)
    expect(pack.investorSummary.trueMao.twentyPercent).toBeNull()
  })

  it("preserves empty-state ordering and canonical arrays", () => {
    const pack = composePdfEvidencePack({
      generatedAt: "2026-06-14T14:00:00.000Z",
      confidentialityLabel: "INTERNAL USE ONLY",
      investorSummary: PDF_EVIDENCE_PACK_EMPTY_FIXTURE.investorSummary,
      investorShield: PDF_EVIDENCE_PACK_EMPTY_FIXTURE.investorShield,
      evidenceIndex: PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE.evidenceIndex,
      disclaimers: PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE.disclaimers,
    })

    expect(pack.evidenceIndex).toEqual(PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE.evidenceIndex)
    expect(pack.disclaimers).toEqual(PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE.disclaimers)
    expect(pack.investorSummary.activeTasks).toEqual([])
    expect(pack.investorSummary.latestOffer).toBeNull()
    expect(pack.investorShield.taskRecommendations).toEqual([])
  })

  it("returns JSON-safe output and does not require private diagnostics", () => {
    const pack = composePdfEvidencePack(makeBaseInput())
    const parsed = JSON.parse(JSON.stringify(pack)) as typeof pack

    expect(parsed.meta.generatedAt).toBe("2026-06-14T13:30:00.000Z")
    expect(parsed.identity).toEqual(pack.identity)
    expect(JSON.stringify(pack)).not.toContain("DATABASE_URL")
    expect(JSON.stringify(pack)).not.toContain("stack trace")
    expect(JSON.stringify(pack)).not.toContain("signedUrl")
    expect(JSON.stringify(pack)).not.toContain("C:\\Users\\")
  })

  it("does not widen the input contract beyond the approved fields", () => {
    const input = makeBaseInput()
    const keys = Object.keys(input).sort()

    expect(keys).toEqual([
      "confidentialityLabel",
      "disclaimers",
      "evidenceIndex",
      "generatedAt",
      "investorShield",
      "investorSummary",
    ])
  })
})
