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
      linked_investor_shield_gate: null,
      evidence_command_type: null,
      title: "Title pack",
      note: "Legal review complete",
      evidence_summary: null,
      status: "RECORDED",
      evidence_status: null,
      evidence_strength: null,
      review_state: null,
      blocker_impact: null,
      linked_professional_gate: null,
      recommended_next_action: null,
      expiry_or_update_date: null,
      source: null,
      mobile_capture_note: null,
      reviewed: false,
      reviewer_note: null,
      created_at: "2026-06-22T10:00:00.000Z",
      updated_at: "2026-06-22T10:00:00.000Z",
      ...overrides,
    }
  }

  it("uses the shared Postgres adapter and keeps the migration draft file-only", () => {
    const repositorySource = readFileSync(
      path.resolve(process.cwd(), "lib/evidence-lite/evidence-lite-repository.ts"),
      "utf8"
    )
    const migrationDraft = readFileSync(
      path.resolve(
        process.cwd(),
        "db/migrations/20260706_phase4g_evidence_command_deal_evidence_extension.sql"
      ),
      "utf8"
    )

    expect(repositorySource).toContain('import { query } from "@/lib/db/postgres"')
    expect(repositorySource).not.toContain("new Pool")
    expect(repositorySource).not.toContain("process.env.DATABASE_URL")
    expect(migrationDraft).toContain("ALTER TABLE brik_by_brik_engine.deal_evidence")
    expect(migrationDraft).toContain("linked_investor_shield_gate")
    expect(migrationDraft).toContain("evidence_command_type")
  })

  it("lists evidence for a deal with legacy rows and derived command fields", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [makeRow({ id: "evidence_b" }), makeRow({ id: "evidence_a" })],
    })

    const result = await listEvidenceLiteForDeal("deal-1")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("FROM brik_by_brik_engine.deal_evidence")
    expect(sql).toContain("WHERE deal_id = $1")
    expect(sql).toContain("ORDER BY created_at DESC, id DESC")
    expect(params).toEqual(["deal-1"])
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: "evidence_b",
      dealId: "deal-1",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
      evidenceCommandType: "TITLE_LEGAL",
      evidenceSummary: "Legal review complete",
      evidenceStatus: "RECEIVED",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "NONE",
      reviewed: false,
    })
    expect(result[1]).toMatchObject({
      id: "evidence_a",
      evidenceCommandType: "TITLE_LEGAL",
      evidenceStatus: "RECEIVED",
    })
  })

  it("returns an empty array when no evidence rows exist", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    const result = await listEvidenceLiteForDeal("deal-1")

    expect(result).toEqual([])
  })

  it("reads a legacy row by deal and id with safe command defaults", async () => {
    queryMock.mockResolvedValueOnce({ rows: [makeRow({ id: "evidence-read-1" })] })

    const result = await getEvidenceLiteById("deal-1", "evidence-read-1")

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("WHERE deal_id = $1")
    expect(sql).toContain("AND id = $2")
    expect(params).toEqual(["deal-1", "evidence-read-1"])
    expect(result).toMatchObject({
      id: "evidence-read-1",
      dealId: "deal-1",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
      evidenceCommandType: "TITLE_LEGAL",
      evidenceSummary: "Legal review complete",
      evidenceStatus: "RECEIVED",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "NONE",
      reviewerNote: null,
    })
    expect(result?.reviewed).toBe(false)
  })

  it("returns null when the evidence row is missing", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })

    const result = await getEvidenceLiteById("deal-1", "missing")

    expect(result).toBeNull()
  })

  it("maps null command columns to safe defaults without implying approval", () => {
    const result = mapEvidenceLiteRow(
      makeRow({
        id: "evidence-safe-defaults",
        status: "MISSING",
        note: "Unreviewed note",
        evidence_summary: null,
        evidence_status: null,
        evidence_strength: null,
        review_state: null,
        blocker_impact: null,
        linked_professional_gate: null,
        reviewed: false,
      })
    )

    expect(result).toMatchObject({
      evidenceStatus: "MISSING",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "NONE",
      evidenceSummary: "Unreviewed note",
      reviewed: false,
    })
  })

  it("maps structured video evidence rows back to command fields", () => {
    const result = mapEvidenceLiteRow(
      makeRow({
        id: "evidence-video",
        evidence_type: "OTHER",
        linked_gate: "SOLICITOR_REVIEW",
        linked_investor_shield_gate: "SOLICITOR_FEEDBACK",
        evidence_command_type: "VIDEO_EVIDENCE",
        evidence_summary: "Video walkthrough",
        status: "REJECTED",
        evidence_status: "INSUFFICIENT",
        evidence_strength: "MODERATE",
        review_state: "REVIEWED_BY_OPERATOR",
        blocker_impact: "CAUTION_ONLY",
        linked_professional_gate: "SURVEYOR_REPORT",
        recommended_next_action: "Upload a clearer clip",
        expiry_or_update_date: "2026-08-01",
        source: "mobile",
        mobile_capture_note: "Recorded on site",
        reviewed: true,
        reviewer_note: "Needs a wider angle",
      })
    )

    expect(result).toMatchObject({
      id: "evidence-video",
      evidenceType: "OTHER",
      linkedGate: "SOLICITOR_REVIEW",
      linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
      evidenceCommandType: "VIDEO_EVIDENCE",
      evidenceSummary: "Video walkthrough",
      status: "REJECTED",
      evidenceStatus: "INSUFFICIENT",
      evidenceStrength: "MODERATE",
      reviewState: "REVIEWED_BY_OPERATOR",
      blockerImpact: "CAUTION_ONLY",
      linkedProfessionalGate: "SURVEYOR_REPORT",
      recommendedNextAction: "Upload a clearer clip",
      expiryOrUpdateDate: "2026-08-01",
      source: "mobile",
      mobileCaptureNote: "Recorded on site",
      reviewed: true,
      reviewerNote: "Needs a wider angle",
    })
  })

  it("creates evidence with mirrored legacy and command columns", async () => {
    randomUUIDMock.mockReturnValue("mock-uuid-1")
    queryMock.mockResolvedValueOnce({
      rows: [
        makeRow({
          id: "evidence_mock-uuid-1",
          linked_investor_shield_gate: "SOLICITOR_FEEDBACK",
          evidence_command_type: "TITLE_LEGAL",
          evidence_summary: "Legal review complete",
          evidence_status: "RECEIVED",
          evidence_strength: "WEAK",
          review_state: "NOT_REVIEWED",
          blocker_impact: "DOES_NOT_BLOCK",
          linked_professional_gate: "NONE",
        }),
      ],
    })

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
    expect(sql).toContain("linked_investor_shield_gate")
    expect(sql).toContain("evidence_command_type")
    expect(sql).toContain("evidence_summary")
    expect(sql).toContain("evidence_status")
    expect(sql).toContain("evidence_strength")
    expect(sql).toContain("review_state")
    expect(sql).toContain("blocker_impact")
    expect(sql).toContain("linked_professional_gate")
    expect(params).toEqual([
      "evidence_mock-uuid-1",
      "deal-1",
      "TITLE_REVIEW",
      "SOLICITOR_REVIEW",
      "SOLICITOR_FEEDBACK",
      "TITLE_LEGAL",
      "Title pack",
      "Legal review complete",
      "Legal review complete",
      "RECORDED",
      "RECEIVED",
      "WEAK",
      "NOT_REVIEWED",
      "DOES_NOT_BLOCK",
      "NONE",
      null,
      null,
      null,
      null,
      false,
    ])
    expect(result).toMatchObject({
      id: "evidence_mock-uuid-1",
      linkedGate: "SOLICITOR_REVIEW",
      linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
      evidenceCommandType: "TITLE_LEGAL",
      evidenceSummary: "Legal review complete",
      evidenceStatus: "RECEIVED",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "NONE",
      reviewed: false,
      reviewerNote: null,
    })
  })

  it("creates command evidence and preserves photo evidence as structured data", async () => {
    randomUUIDMock.mockReturnValue("mock-uuid-2")
    queryMock.mockResolvedValueOnce({
      rows: [
        makeRow({
          id: "evidence_mock-uuid-2",
          evidence_type: "OTHER",
          linked_gate: "SOLICITOR_REVIEW",
          linked_investor_shield_gate: "SOLICITOR_FEEDBACK",
          evidence_command_type: "PHOTO_EVIDENCE",
          evidence_summary: "Photo of roof defect",
          status: "MISSING",
          evidence_status: "REQUESTED",
          evidence_strength: "WEAK",
          review_state: "NOT_REVIEWED",
          blocker_impact: "BLOCKS_PROGRESSION",
          linked_professional_gate: "SURVEYOR_REPORT",
          recommended_next_action: "Capture close-up roof shot",
          expiry_or_update_date: "2026-08-01",
          source: "mobile",
          mobile_capture_note: "Taken on site",
          reviewed: false,
        }),
      ],
    })

    const result = await createEvidenceLite({
      dealId: "deal-1",
      evidenceType: "PHOTO_EVIDENCE",
      linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
      linkedProfessionalGate: "SURVEYOR_REPORT",
      title: "Roof photo",
      evidenceSummary: "Photo of roof defect",
      evidenceStatus: "REQUESTED",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "BLOCKS_PROGRESSION",
      recommendedNextAction: "Capture close-up roof shot",
      expiryOrUpdateDate: "2026-08-01",
      source: "mobile",
      mobileCaptureNote: "Taken on site",
    })

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("evidence_type")
    expect(sql).toContain("evidence_command_type")
    expect(sql).toContain("linked_investor_shield_gate")
    expect(sql).toContain("blocker_impact")
    expect(params).toEqual([
      "evidence_mock-uuid-2",
      "deal-1",
      "OTHER",
      "SOLICITOR_REVIEW",
      "SOLICITOR_FEEDBACK",
      "PHOTO_EVIDENCE",
      "Roof photo",
      "Photo of roof defect",
      "Photo of roof defect",
      "MISSING",
      "REQUESTED",
      "WEAK",
      "NOT_REVIEWED",
      "BLOCKS_PROGRESSION",
      "SURVEYOR_REPORT",
      "Capture close-up roof shot",
      "2026-08-01",
      "mobile",
      "Taken on site",
      false,
    ])
    expect(result).toMatchObject({
      id: "evidence_mock-uuid-2",
      evidenceType: "OTHER",
      linkedGate: "SOLICITOR_REVIEW",
      linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
      evidenceCommandType: "PHOTO_EVIDENCE",
      evidenceSummary: "Photo of roof defect",
      status: "MISSING",
      evidenceStatus: "REQUESTED",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "BLOCKS_PROGRESSION",
      linkedProfessionalGate: "SURVEYOR_REPORT",
      recommendedNextAction: "Capture close-up roof shot",
      expiryOrUpdateDate: "2026-08-01",
      source: "mobile",
      mobileCaptureNote: "Taken on site",
      reviewed: false,
    })
  })

  it("updates legacy evidence and mirrors command columns", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        makeRow({
          note: "Updated note",
          evidence_summary: "Updated note",
          status: "VERIFIED",
          evidence_status: "SUFFICIENT",
        }),
      ],
    })

    const result = await updateEvidenceLite("deal-1", "evidence-1", {
      note: "Updated note",
      status: "VERIFIED",
    })

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("UPDATE brik_by_brik_engine.deal_evidence")
    expect(sql).toContain("note = $1")
    expect(sql).toContain("evidence_summary = $2")
    expect(sql).toContain("status = $3")
    expect(sql).toContain("evidence_status = $4")
    expect(sql).toContain("updated_at = NOW()")
    expect(sql).toContain("WHERE deal_id = $5")
    expect(sql).toContain("AND id = $6")
    expect(params).toEqual(["Updated note", "Updated note", "VERIFIED", "SUFFICIENT", "deal-1", "evidence-1"])
    expect(result).toMatchObject({
      note: "Updated note",
      evidenceSummary: "Updated note",
      status: "VERIFIED",
      evidenceStatus: "SUFFICIENT",
      evidenceCommandType: "TITLE_LEGAL",
    })
  })

  it("updates command evidence and keeps the mirrored legacy values aligned", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        makeRow({
          linked_gate: "SOLICITOR_REVIEW",
          linked_investor_shield_gate: "SOLICITOR_FEEDBACK",
          evidence_status: "SUFFICIENT",
          status: "VERIFIED",
          blocker_impact: "REQUIRES_MANUAL_REVIEW",
          linked_professional_gate: "BROKER_CONFIRMATION",
          source: "mobile",
        }),
      ],
    })

    const result = await updateEvidenceLite("deal-1", "evidence-1", {
      linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
      evidenceStatus: "SUFFICIENT",
      blockerImpact: "REQUIRES_MANUAL_REVIEW",
      linkedProfessionalGate: "BROKER_CONFIRMATION",
      source: "mobile",
    })

    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain("linked_investor_shield_gate = $1")
    expect(sql).toContain("linked_gate = $2")
    expect(sql).toContain("evidence_status = $3")
    expect(sql).toContain("status = $4")
    expect(sql).toContain("blocker_impact = $5")
    expect(sql).toContain("linked_professional_gate = $6")
    expect(sql).toContain("source = $7")
    expect(sql).toContain("updated_at = NOW()")
    expect(sql).toContain("WHERE deal_id = $8")
    expect(sql).toContain("AND id = $9")
    expect(params).toEqual([
      "SOLICITOR_FEEDBACK",
      "SOLICITOR_REVIEW",
      "SUFFICIENT",
      "VERIFIED",
      "REQUIRES_MANUAL_REVIEW",
      "BROKER_CONFIRMATION",
      "mobile",
      "deal-1",
      "evidence-1",
    ])
    expect(result).toMatchObject({
      linkedGate: "SOLICITOR_REVIEW",
      linkedInvestorShieldGate: "SOLICITOR_FEEDBACK",
      evidenceStatus: "SUFFICIENT",
      status: "VERIFIED",
      blockerImpact: "REQUIRES_MANUAL_REVIEW",
      linkedProfessionalGate: "BROKER_CONFIRMATION",
      source: "mobile",
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

  it("maps rejected stored values loudly for legacy and command columns", () => {
    expect(() => mapEvidenceLiteRow(makeRow({ evidence_type: "UNKNOWN" }))).toThrow(
      "Invalid stored Evidence Lite evidence_type: UNKNOWN"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ status: "UNKNOWN" }))).toThrow(
      "Invalid stored Evidence Lite status: UNKNOWN"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ linked_gate: "UNKNOWN" }))).toThrow(
      "Invalid stored Evidence Lite linked_gate: UNKNOWN"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ linked_gate: "SOLICITOR_FEEDBACK" }))).toThrow(
      "Legacy solicitor feedback value must not be stored: linked_gate"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ linked_gate: "GENERAL" }))).toThrow(
      "Invalid Evidence Lite value must not be stored: linked_gate"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ linked_investor_shield_gate: "INVALID" }))).toThrow(
      "Invalid stored Evidence Command linked_investor_shield_gate: INVALID"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ evidence_command_type: "INVALID" }))).toThrow(
      "Invalid stored Evidence Command evidence_command_type: INVALID"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ evidence_status: "INVALID" }))).toThrow(
      "Invalid stored Evidence Command evidence_status: INVALID"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ evidence_strength: "INVALID" }))).toThrow(
      "Invalid stored Evidence Command evidence_strength: INVALID"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ review_state: "INVALID" }))).toThrow(
      "Invalid stored Evidence Command review_state: INVALID"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ blocker_impact: "INVALID" }))).toThrow(
      "Invalid stored Evidence Command blocker_impact: INVALID"
    )
    expect(() => mapEvidenceLiteRow(makeRow({ linked_professional_gate: "INVALID" }))).toThrow(
      "Invalid stored Evidence Command linked_professional_gate: INVALID"
    )
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
