import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import type pg from "pg"
import { assertRehearsalDealTarget, assertRehearsalFixtureAbsent } from "../e2e/clean-rehearsal-fixtures"
import { verifyRehearsalEvidenceOwnership } from "../e2e/rehearsal-evidence-ownership"

const rehearsal = readFileSync(path.resolve(__dirname, "../e2e/november-6-rehearsal.spec.ts"), "utf8")

describe("non-destructive November 6 rehearsal", () => {
  it("does not invoke destructive cleanup or retention updates", () => {
    expect(rehearsal).not.toContain("cleanRehearsalFixtures")
    expect(rehearsal).not.toMatch(/DELETE\s+FROM/i)
    expect(rehearsal).not.toMatch(/UPDATE\s+[^;]*video_jobs/i)
    expect(rehearsal).not.toMatch(/retention_policy/i)
    expect(rehearsal).toContain("assertRehearsalFixtureAbsent")
  })

  it("uses unique fixture and evidence destinations without deleting history", () => {
    expect(rehearsal).toContain("deal-rehearsal-nov6-${randomUUID()}")
    expect(rehearsal).toContain('path.join(root, "docs", "option2", "screenshots", "rehearsal-nov6", randomUUID())')
    expect(rehearsal).toContain('path.join(screenshotsDir, "media")')
    expect(rehearsal).not.toMatch(/\b(?:rmSync|unlinkSync|rmdirSync)\b/)
  })

  it("rejects protected records and pre-existing fixture collisions", async () => {
    expect(() => assertRehearsalDealTarget("deal-wp4b-live-01")).toThrow()
    const client = { query: vi.fn(async () => ({ rowCount: 1, rows: [{ id: 1 }] })) }
    await expect(assertRehearsalFixtureAbsent(client as unknown as pg.Client, "deal-rehearsal-nov6-collision")).rejects.toThrow(/collision/)
    expect(client.query).toHaveBeenCalledTimes(1)
  })

  it("fails closed on unexpected creation ownership", () => {
    expect(rehearsal).toContain("returned no authoritative ID")
    expect(rehearsal).toContain("returned mismatched ownership")
    expect(rehearsal).toContain("record.dealId !== undefined")
    expect(rehearsal).toContain("record.dealId === undefined && scopedDealId !== DEAL_ID")
    expect(rehearsal).toContain("record.assessmentId !== parent.assessmentId")
  })

  it("uses the assessment evidence endpoint's deal-scoped response contract", () => {
    expect(rehearsal).toContain("verifyRehearsalEvidenceOwnership(evidence, DEAL_ID, assessmentId")
    expect(rehearsal).toContain('e.assessment_id AS "assessmentId"')
  })

  it("verifies response IDs against persisted assessment and deal ownership", async () => {
    const records = [{ id: "ev-1", assetId: "asset-1", timestampSeconds: 1 }]
    await expect(
      verifyRehearsalEvidenceOwnership(records, "deal-1", "assessment-1", async () => [
        { id: "ev-1", assessmentId: "assessment-1", dealId: "deal-1" },
      ])
    ).resolves.toEqual(["ev-1"])
  })

  it("rejects missing, duplicate, contradictory, wrong, and ambiguous ownership", async () => {
    const lookup = async () => [{ id: "ev-1", assessmentId: "assessment-2", dealId: "deal-1" }]
    await expect(verifyRehearsalEvidenceOwnership([{}], "deal-1", "assessment-1", lookup)).rejects.toThrow(/missing authoritative ID/)
    await expect(verifyRehearsalEvidenceOwnership([{ id: "ev-1" }, { id: "ev-1" }], "deal-1", "assessment-1", lookup)).rejects.toThrow(/duplicate IDs/)
    await expect(verifyRehearsalEvidenceOwnership([{ id: "ev-1", assessmentId: "assessment-2" }], "deal-1", "assessment-1", lookup)).rejects.toThrow(/mismatched assessment ownership/)
    await expect(verifyRehearsalEvidenceOwnership([{ id: "ev-1" }], "deal-1", "assessment-1", lookup)).rejects.toThrow(/persisted ownership mismatch/)
    await expect(verifyRehearsalEvidenceOwnership([{ id: "ev-1" }], "deal-1", "assessment-1", async () => [])).rejects.toThrow(/missing or ambiguous/)
  })

  it("does not overwrite historical screenshots", () => {
    expect(rehearsal).toContain("if (existsSync(screenshotsDir))")
    expect(rehearsal).toContain("mkdirSync(screenshotsDir)")
    expect(rehearsal).not.toContain("rehearsal-frames-${test.info().project.name}")
  })
})
