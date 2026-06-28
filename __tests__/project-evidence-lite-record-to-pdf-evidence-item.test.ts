import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { projectEvidenceLiteRecordToPdfEvidenceItem } from "@/lib/pdf-evidence-pack/project-evidence-lite-record-to-pdf-evidence-item"
import type { EvidenceLiteRecord } from "@/types/evidence-lite"

function makeRecord(overrides?: Partial<EvidenceLiteRecord> & Record<string, unknown>): EvidenceLiteRecord {
  return {
    id: "evidence_123",
    dealId: "deal-1",
    evidenceType: "TITLE_REVIEW",
    linkedGate: "SOLICITOR_REVIEW",
    title: "Title pack",
    note: "Canonical title review note",
    status: "RECORDED",
    reviewed: false,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:15:00.000Z",
    ...overrides,
  }
}

describe("projectEvidenceLiteRecordToPdfEvidenceItem", () => {
  it("projects the canonical Evidence Lite record fields without authority inference", () => {
    const item = projectEvidenceLiteRecordToPdfEvidenceItem(makeRecord())

    expect(item).toEqual({
      evidenceId: "evidence_123",
      evidenceType: "TITLE_REVIEW",
      title: "Title pack",
      description: "Canonical title review note",
      provenanceLabel: "Evidence Lite",
      capturedAt: "2026-06-22T10:00:00.000Z",
      reviewedAt: null,
      reviewStatus: "RECORDED",
      relatedGateIds: ["SOLICITOR_REVIEW"],
      controlledReferenceState: "MISSING",
      controlledReferenceLabel: "Controlled reference unavailable",
    })
  })

  it("does not treat reviewed evidence as controlled-reference availability", () => {
    const item = projectEvidenceLiteRecordToPdfEvidenceItem(
      makeRecord({
        reviewed: true,
        status: "VERIFIED",
        updatedAt: "2026-06-22T11:15:00.000Z",
      })
    )

    expect(item.controlledReferenceState).toBe("MISSING")
    expect(item.controlledReferenceLabel).toBe("Controlled reference unavailable")
    expect(item.reviewedAt).toBeNull()
    expect(JSON.stringify(item)).not.toContain("signedUrl")
    expect(JSON.stringify(item)).not.toContain("privatePath")
    expect(JSON.stringify(item)).not.toContain("downloadToken")
    expect(JSON.stringify(item)).not.toContain("AVAILABLE")
  })

  it("does not derive reviewedAt from updatedAt", () => {
    const item = projectEvidenceLiteRecordToPdfEvidenceItem(
      makeRecord({
        reviewed: true,
        status: "REVIEWED",
        updatedAt: "2026-06-22T11:15:00.000Z",
      })
    )

    expect(item.reviewedAt).toBeNull()
  })

  it.each(["RECORDED", "MISSING", "REJECTED"] as const)(
    "keeps controlled-reference state unavailable for status %s",
    (status) => {
      const item = projectEvidenceLiteRecordToPdfEvidenceItem(
        makeRecord({
          reviewed: false,
          status,
        })
      )

      expect(item.controlledReferenceState).toBe("MISSING")
      expect(item.controlledReferenceLabel).toBe("Controlled reference unavailable")
      expect(item.reviewedAt).toBeNull()
    }
  )

  it("uses only the canonical linkedGate relationship and ignores enriched gate lists", () => {
    const item = projectEvidenceLiteRecordToPdfEvidenceItem(
      makeRecord({
        relatedGateIds: ["TITLE", "LEASEHOLD", "LENDER_CRITERIA"],
      })
    )

    expect(item.relatedGateIds).toEqual(["SOLICITOR_REVIEW"])
  })

  it("preserves nulls and keeps unsafe enriched fields out of the output", () => {
    const record = makeRecord({
      note: null as unknown as string,
      createdAt: null as unknown as string,
      privateStoragePath: "C:\\Users\\user\\secret\\file.pdf",
      signedUrl: "https://example.invalid/private.pdf?token=secret",
      contactEmail: "private@example.com",
      ocrText: "OCR should not leak",
      aiSummary: "AI summary should not leak",
      sql: "select * from evidence",
      traceId: "trace-123",
    }) as EvidenceLiteRecord & Record<string, unknown>

    const item = projectEvidenceLiteRecordToPdfEvidenceItem(record)
    const serialized = JSON.stringify(item)

    expect(item.description).toBeNull()
    expect(item.capturedAt).toBeNull()
    expect(item.reviewedAt).toBeNull()
    expect(serialized).not.toContain("privateStoragePath")
    expect(serialized).not.toContain("signedUrl")
    expect(serialized).not.toContain("contactEmail")
    expect(serialized).not.toContain("ocrText")
    expect(serialized).not.toContain("aiSummary")
    expect(serialized).not.toContain("select *")
    expect(serialized).not.toContain("trace-123")
    expect(item.provenanceLabel).toBe("Evidence Lite")
  })

  it("keeps the projection pure and source-bound", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/pdf-evidence-pack/project-evidence-lite-record-to-pdf-evidence-item.ts"
      ),
      "utf8"
    )

    expect(source).toContain('from "@/types/evidence-lite"')
    expect(source).toContain("EvidenceLiteRecord")
    expect(source).not.toContain("EvidenceLiteGateKey")
    expect(source).not.toContain("PdfEvidencePackReferenceState")
    expect(source).not.toContain("relatedGateIds?:")
    expect(source).not.toContain("record.reviewed")
    expect(source).not.toContain("record.updatedAt")
    expect(source).not.toContain("reviewedAt: projection.updatedAt")
    expect(source).not.toContain("@/lib/db/postgres")
    expect(source).not.toContain("new Pool")
    expect(source).not.toContain("query(")
    expect(source).not.toContain("fetch(")
    expect(source).not.toContain("route.ts")
    expect(source).not.toContain("render")
  })
})
