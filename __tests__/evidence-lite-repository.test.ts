import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { queryMock, randomUUIDMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  randomUUIDMock: vi.fn(),
}))

vi.mock("@/lib/db/postgres", () => ({
  query: queryMock,
}))

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock,
}))

import {
  createEvidenceLite,
  getEvidenceLiteById,
  listEvidenceLiteForDeal,
  mapEvidenceLiteRow,
  updateEvidenceLite,
} from "@/lib/evidence-lite/evidence-lite-repository"

describe("evidence lite repository", () => {
  beforeEach(() => {
    queryMock.mockReset()
    randomUUIDMock.mockReset()
  })

  function makeRow(overrides?: Partial<Record<string, unknown>>) {
    return {
      id: "evidence_123",
      deal_id: "deal-1",
      evidence_type: "TITLE_REVIEW",
      linked_gate: "SOLICITOR_REVIEW",
      title: "Title pack",
      note: "Legal review complete",
      status: "RECORDED",
      reviewed: false,
      reviewer_note: null,
      created_at: "2026-06-22T10:00:00.000Z",
      updated_at: "2026-06-22T10:00:00.000Z",
      ...overrides,
    }
  }

  it("uses the shared Postgres adapter and avoids a second pool", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "lib/evidence-lite/evidence-lite-repository.ts"),
      "utf8"
    )

    expect(source).toContain('import { query } from "@/lib/db/postgres"')
    expect(source).not.toContain("new Pool")
    expect(source).not.toContain("process.env.DATABASE_URL")
  })

  it("lists evidence for a deal with deterministic ordering and mapping", async () => {
    queryMock.mockResolvedValueOnce({ rows: [makeRow({ id: "evidence_b" }), makeRow({ id: "evidence_a" })] })

    const result = await listEvidenceLiteForDeal("deal-1")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("FROM brik_by_brik_engine.deal_evidence")
    expect(sql).toContain("WHERE deal_id = $1")
    expect(sql).toContain("ORDER BY created_at DESC, id DESC")
    expect(params).toEqual(["deal-1"])
    expect(result).toEqual([
      {
        id: "evidence_b",
        dealId: "deal-1",
        evidenceType: "TITLE_REVIEW",
        linkedGate: "SOLICITOR_REVIEW",
        title: "Title pack",
        note: "Legal review complete",
        status: "RECORDED",
        reviewed: false,
        reviewerNote: null,
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
      },
      {
        id: "evidence_a",
        dealId: "deal-1",
        evidenceType: "TITLE_REVIEW",
        linkedGate: "SOLICITOR_REVIEW",
        title: "Title pack",
        note: "Legal review complete",
        status: "RECORDED",
        reviewed: false,
        reviewerNote: null,
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
      },
    ])
  })

  it("returns an empty array when no evidence rows exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    const result = await listEvidenceLiteForDeal("deal-1")

    expect(result).toEqual([])
  })

  it("reads one evidence row by deal and evidence id", async () => {
    const row = makeRow({ id: "evidence-read-1" })
    queryMock.mockResolvedValueOnce({ rows: [row] })

    const result = await getEvidenceLiteById("deal-1", "evidence-read-1")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("WHERE deal_id = $1")
    expect(sql).toContain("AND id = $2")
    expect(params).toEqual(["deal-1", "evidence-read-1"])
    expect(result).toEqual({
      id: "evidence-read-1",
      dealId: "deal-1",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      title: "Title pack",
      note: "Legal review complete",
      status: "RECORDED",
      reviewed: false,
      reviewerNote: null,
      createdAt: "2026-06-22T10:00:00.000Z",
      updatedAt: "2026-06-22T10:00:00.000Z",
    })
  })

  it("returns null when the evidence row is missing", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    const result = await getEvidenceLiteById("deal-1", "missing")

    expect(result).toBeNull()
  })

  it("does not allow reading another deal's evidence by id alone", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    await getEvidenceLiteById("deal-1", "evidence-shared")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("WHERE deal_id = $1")
    expect(sql).toContain("AND id = $2")
    expect(params).toEqual(["deal-1", "evidence-shared"])
  })

  it("creates evidence with a generated text id and canonical fields", async () => {
    randomUUIDMock.mockReturnValue("mock-uuid-1")
    queryMock.mockResolvedValueOnce({ rows: [makeRow({ id: "evidence_mock-uuid-1" })] })

    const result = await createEvidenceLite({
      dealId: "deal-1",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      title: "Title pack",
      note: "Legal review complete",
      status: "RECORDED",
      reviewed: false,
    })

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("INSERT INTO brik_by_brik_engine.deal_evidence")
    expect(sql).toContain("evidence_type")
    expect(sql).toContain("linked_gate")
    expect(sql).toContain("title")
    expect(sql).toContain("note")
    expect(sql).toContain("status")
    expect(sql).toContain("reviewed")
    expect(sql).toContain("reviewer_note")
    expect(params).toEqual([
      "evidence_mock-uuid-1",
      "deal-1",
      "TITLE_REVIEW",
      "SOLICITOR_REVIEW",
      "Title pack",
      "Legal review complete",
      "RECORDED",
      false,
    ])
    expect(result.id).toBe("evidence_mock-uuid-1")
    expect(result.linkedGate).toBe("SOLICITOR_REVIEW")
    expect(result.reviewerNote).toBeNull()
  })

  it("does not write legacy solicitor feedback or other forbidden fields on create", async () => {
    randomUUIDMock.mockReturnValue("mock-uuid-2")
    queryMock.mockResolvedValueOnce({ rows: [makeRow({ id: "evidence_mock-uuid-2" })] })

    await createEvidenceLite({
      dealId: "deal-1",
      evidenceType: "SOLD_COMP",
      linkedGate: "SOLD_COMPS",
      title: "Sold comps",
      note: "Comparable set",
      status: "MISSING",
      reviewed: false,
    })

    const sqlTexts = queryMock.mock.calls.map(([sql]) => String(sql)).join("\n")
    expect(sqlTexts).not.toContain("SOLICITOR_FEEDBACK")
    expect(sqlTexts).not.toContain("deal_tasks")
    expect(sqlTexts).not.toContain("deal_offers")
    expect(sqlTexts).not.toContain("investor_shield_checks")
    expect(sqlTexts).not.toContain("manual_overrides")
    expect(sqlTexts).not.toContain("pipeline_state")
  })

  it("updates only supplied allowed fields and always sets updated_at", async () => {
    queryMock.mockResolvedValueOnce({ rows: [makeRow({ note: "Updated note", status: "VERIFIED" })] })

    const result = await updateEvidenceLite("deal-1", "evidence-1", {
      note: "Updated note",
      status: "VERIFIED",
    })

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("UPDATE brik_by_brik_engine.deal_evidence")
    expect(sql).toContain("note = $1")
    expect(sql).toContain("status = $2")
    expect(sql).toContain("updated_at = NOW()")
    expect(sql).toContain("reviewer_note")
    expect(sql).not.toContain("reviewer_note =")
    expect(sql).toContain("WHERE deal_id = $3")
    expect(sql).toContain("AND id = $4")
    expect(params).toEqual(["Updated note", "VERIFIED", "deal-1", "evidence-1"])
    expect(result).toEqual({
      id: "evidence_123",
      dealId: "deal-1",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      title: "Title pack",
      note: "Updated note",
      status: "VERIFIED",
      reviewed: false,
      reviewerNote: null,
      createdAt: "2026-06-22T10:00:00.000Z",
      updatedAt: "2026-06-22T10:00:00.000Z",
    })
  })

  it("returns null when an update target is missing", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    const result = await updateEvidenceLite("deal-1", "missing", {
      reviewed: true,
    })

    expect(result).toBeNull()
  })

  it("does not permit identity-field changes in updates", async () => {
    queryMock.mockResolvedValueOnce({ rows: [makeRow({ reviewed: true })] })

    await updateEvidenceLite("deal-1", "evidence-1", {
      reviewed: true,
    })

    const [sql] = queryMock.mock.calls[0]
    expect(sql).not.toContain("SET id =")
    expect(sql).not.toContain("SET deal_id =")
    expect(sql).not.toContain("SET created_at =")
  })

  it("maps rejected stored values loudly and rejects legacy values", () => {
    expect(() =>
      mapEvidenceLiteRow(makeRow({ evidence_type: "UNKNOWN" }))
    ).toThrow("Invalid stored Evidence Lite evidence_type: UNKNOWN")
    expect(() =>
      mapEvidenceLiteRow(makeRow({ status: "UNKNOWN" }))
    ).toThrow("Invalid stored Evidence Lite status: UNKNOWN")
    expect(() =>
      mapEvidenceLiteRow(makeRow({ linked_gate: "UNKNOWN" }))
    ).toThrow("Invalid stored Evidence Lite linked_gate: UNKNOWN")
    expect(() =>
      mapEvidenceLiteRow(makeRow({ linked_gate: "SOLICITOR_FEEDBACK" }))
    ).toThrow("Legacy solicitor feedback value must not be stored: linked_gate")
    expect(() =>
      mapEvidenceLiteRow(makeRow({ linked_gate: "GENERAL" }))
    ).toThrow("Invalid Evidence Lite value must not be stored: linked_gate")
  })

  it("maps reviewer_note null and non-null stored values", () => {
    expect(mapEvidenceLiteRow(makeRow()).reviewerNote).toBeNull()
    expect(
      mapEvidenceLiteRow(
        makeRow({
          reviewer_note: "Reviewed by James",
        })
      ).reviewerNote
    ).toBe("Reviewed by James")
  })

  it("repository SQL does not target tasks, offers, or Investor Shield mutation tables", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await listEvidenceLiteForDeal("deal-1")

    const sqlTexts = queryMock.mock.calls.map(([sql]) => String(sql)).join("\n")
    expect(sqlTexts).not.toContain("deal_tasks")
    expect(sqlTexts).not.toContain("deal_offers")
    expect(sqlTexts).not.toContain("investor_shield_checks")
    expect(sqlTexts).not.toContain("manual_overrides")
    expect(sqlTexts).not.toContain("pipeline_state")
  })

  it("repository source stays on the shared adapter and local helpers", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "lib/evidence-lite/evidence-lite-repository.ts"),
      "utf8"
    )

    expect(source).toContain("query")
    expect(source).toContain("randomUUID")
    expect(source).not.toContain("pg.Pool")
    expect(source).not.toContain("new Pool")
    expect(source).not.toContain("DATABASE_URL")
  })
})
