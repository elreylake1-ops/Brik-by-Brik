import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import type pg from "pg"
import { assertRehearsalDealTarget, assertRehearsalFixtureAbsent } from "../e2e/clean-rehearsal-fixtures"

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
    expect(rehearsal).toContain("record.dealId !== DEAL_ID")
    expect(rehearsal).toContain("record.assessmentId !== parent.assessmentId")
  })

  it("does not overwrite historical screenshots", () => {
    expect(rehearsal).toContain("if (existsSync(screenshotsDir))")
    expect(rehearsal).toContain("mkdirSync(screenshotsDir)")
    expect(rehearsal).not.toContain("rehearsal-frames-${test.info().project.name}")
  })
})
