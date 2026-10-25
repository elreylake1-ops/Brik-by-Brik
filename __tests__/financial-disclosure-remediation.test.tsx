// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import RefurbPlanPanel, { type MeasurementSpecRow, type PanelState } from "@/components/refurb-plan/RefurbPlanPanel"
import { MEASUREMENT_SPEC } from "@/lib/data/measurement-spec"
import { buildFinancialProposal } from "@/lib/refurb-integration/financial-proposal"
import { buildWorkProposal } from "@/lib/refurb-integration/findings-to-work"
import { computePlan } from "@/lib/refurb-integration/plan-compute"
import type { FinancialProposalRecord } from "@/types/refurb-financial"
import type { ConfirmedPlanRecord } from "@/types/refurb-integration"
import type { MeasurementSetRecord } from "@/types/refurb-measurements"
import type { ProposalWithReview } from "@/types/viewing-assessment"
import { ASSUMPTIONS, BASICS, makeDeal } from "./fixtures/refurb-seed"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const evidence = [{ id: "f1", assetId: "a1", timestampSeconds: 31, room: "Loft" }]
const reviewed = (id: string, checkId: string): ProposalWithReview => ({
  proposal: { id, assessmentId: "asmt-1", runId: "run-1", createdAt: "2026-10-22T09:00:00.000Z", checkId, status: "CONCERN", observation: "Seen", evidenceIds: ["f1"], confidence: "low", modelVersion: "m", verification: "UNVERIFIED", disposition: "PENDING" },
  currentReview: { id: `rv-${id}`, proposalId: id, revision: 1, disposition: "ACCEPTED", editedStatus: null, editedObservation: null, reason: null, reviewerId: "operator-1", reviewedAt: "2026-10-22T09:30:00.000Z" },
  reviewHistory: [],
})
const spec: MeasurementSpecRow[] = Object.entries(MEASUREMENT_SPEC).map(([key, v]) => ({ key, label: v.label, unit: v.unit, usedByEngine: v.engine, perRoom: Boolean(v.perRoom), values: v.values ?? null }))
const savedSet: MeasurementSetRecord = {
  id: "meas-1", dealId: "deal-1", assessmentId: "asmt-1", version: 1, basedOnVersion: 0, idempotencyKey: "k", warnings: [], changeNote: null, recordedBy: "operator-5", recordedAt: "2026-10-23T09:00:00.000Z",
  entries: [
    { key: "bedrooms", value: 3, unit: "count", basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "" },
    { key: "bathrooms", value: 1, unit: "count", basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "" },
  ],
}

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe("P1 Financial UI Disclosure Remediation", () => {
  it("renders prominent partial-estimate warning, identifies exclusions, and qualifies informational GO when completeness is HAS_EXCLUSIONS_OR_UNRESOLVED_QUANTITIES", () => {
    // Work proposal with an unpriced/specialist item: C01 (Roof) + C08 (External masonry / Facade - unpriced)
    const proposal = buildWorkProposal({ assessmentId: "asmt-1", analysisSource: "SIMULATED", evidence, proposals: [reviewed("p1", "C01"), reviewed("p2", "C08")], checkIds: ["C01", "C08"] })
    const plan: ConfirmedPlanRecord = {
      id: "plan-1", dealId: "deal-1", assessmentId: "asmt-1", version: 1, idempotencyKey: "k", sourceFingerprint: proposal.fingerprint, analysisSource: "SIMULATED",
      acceptedItems: proposal.items.map((i) => ({ itemId: i.itemId, mappingId: i.mappingId, kind: i.kind, label: i.label, area: i.area, scopeEffect: i.scopeEffect, levelChosenByHuman: false, quantityNote: i.quantityNote, sources: i.sources })),
      excluded: proposal.excluded, propertyBasics: BASICS, measurementSetId: "meas-1", measurementSetVersion: 1, financialAssumptions: ASSUMPTIONS,
      computation: computePlan({ accepted: proposal.items, basics: BASICS, assumptions: ASSUMPTIONS, deal: { purchasePrice: 100000, gdv: 190000, refurbCost: 25000 } }),
      confirmedBy: "operator-7", confirmedAt: "2026-10-23T09:30:00.000Z",
    }
    const built = buildFinancialProposal({ plan, measurementSet: savedSet, deal: makeDeal("deal-1") })
    expect(built.content.completeness).toBe("HAS_EXCLUSIONS_OR_UNRESOLVED_QUANTITIES")

    const record: FinancialProposalRecord = { id: "fprop-1", dealId: "deal-1", assessmentId: "asmt-1", planId: "plan-1", version: 1, contentHash: built.contentHash, idempotencyKey: "k", content: built.content, createdBy: "operator-8", createdAt: "2026-10-23T09:45:00.000Z" }
    const proposed = { proposals: [record], latest: record, decision: null, outdated: false, outdatedReasons: [], status: "PROPOSED" as const }
    const current = { record: plan, stale: false, staleReasons: [] }
    const initial: PanelState = { proposal, current, measurements: savedSet, financial: proposed, quoteOverrides: [] }

    act(() => {
      root.render(<RefurbPlanPanel dealId="deal-1" assessmentId="asmt-1" initial={initial} spec={spec} />)
    })

    const text = host.textContent ?? ""
    // 1. Visible partial estimate warning banner
    const alert = host.querySelector('[role="alert"][aria-label="Provisional partial estimate warning"]')
    expect(alert).not.toBeNull()
    expect(alert?.textContent).toMatch(/Provisional Partial Refurbishment Estimate — Unpriced Scope Excluded/)

    // 2. Identifies unpriced excluded work items
    expect(alert?.textContent).toMatch(/Facade and masonry repairs/)

    // 3. States apparent savings are provisional, not verified savings
    expect(alert?.textContent).toMatch(/provisional and not verified savings/)

    // 4. Qualifies informational GO and marks values partial/provisional
    expect(text).toMatch(/\(partial scope\)\*/)
    expect(text).toMatch(/\(provisional\)\*/)

    // 5. Renders backend notes
    expect(text).toMatch(/Proposal notes & disclaimers/)
    expect(text).toMatch(/Unresolved refurbishment scope items require contractor quotation/)
  })

  it("does not render incomplete-scope warning when completeness is COMPLETE", () => {
    // Work proposal with purely priced items and no unpriced exclusions
    const proposal = buildWorkProposal({ assessmentId: "asmt-1", analysisSource: "SIMULATED", evidence, proposals: [reviewed("p1", "C01")], checkIds: ["C01"] })
    const plan: ConfirmedPlanRecord = {
      id: "plan-1", dealId: "deal-1", assessmentId: "asmt-1", version: 1, idempotencyKey: "k", sourceFingerprint: proposal.fingerprint, analysisSource: "SIMULATED",
      acceptedItems: proposal.items.map((i) => ({ itemId: i.itemId, mappingId: i.mappingId, kind: i.kind, label: i.label, area: i.area, scopeEffect: i.scopeEffect, levelChosenByHuman: false, quantityNote: i.quantityNote, sources: i.sources })),
      excluded: proposal.excluded, propertyBasics: BASICS, measurementSetId: "meas-1", measurementSetVersion: 1, financialAssumptions: ASSUMPTIONS,
      computation: computePlan({ accepted: proposal.items, basics: BASICS, assumptions: ASSUMPTIONS, deal: { purchasePrice: 100000, gdv: 190000, refurbCost: 25000 } }),
      confirmedBy: "operator-7", confirmedAt: "2026-10-23T09:30:00.000Z",
    }
    const built = buildFinancialProposal({ plan, measurementSet: savedSet, deal: makeDeal("deal-1") })
    // Force completeness to COMPLETE to verify guard behavior
    const completeContent = { ...built.content, completeness: "COMPLETE" as const, exclusions: [] }

    const record: FinancialProposalRecord = { id: "fprop-1", dealId: "deal-1", assessmentId: "asmt-1", planId: "plan-1", version: 1, contentHash: built.contentHash, idempotencyKey: "k", content: completeContent, createdBy: "operator-8", createdAt: "2026-10-23T09:45:00.000Z" }
    const proposed = { proposals: [record], latest: record, decision: null, outdated: false, outdatedReasons: [], status: "PROPOSED" as const }
    const current = { record: plan, stale: false, staleReasons: [] }
    const initial: PanelState = { proposal, current, measurements: savedSet, financial: proposed, quoteOverrides: [] }

    act(() => {
      root.render(<RefurbPlanPanel dealId="deal-1" assessmentId="asmt-1" initial={initial} spec={spec} />)
    })

    const alert = host.querySelector('[role="alert"][aria-label="Provisional partial estimate warning"]')
    expect(alert).toBeNull()
    expect(host.textContent).not.toMatch(/\(partial scope\)\*/)
  })
})

describe("Legacy QA Script Credential Hygiene", () => {
  const scripts = [
    path.join(__dirname, "..", "scripts", "qa", "cleanup-old-jobs.mjs"),
    path.join(__dirname, "..", "scripts", "qa", "seed-demo-deal.mjs"),
    path.join(__dirname, "..", "scripts", "qa", "task-12d-browser-workflow.mjs"),
  ]

  it("verifies all three legacy scripts contain no hardcoded connection string or password literals", () => {
    for (const file of scripts) {
      expect(existsSync(file)).toBe(true)
      const content = readFileSync(file, "utf8")
      // Check for hardcoded connection strings
      expect(content).not.toMatch(/postgres:\/\/.*@/)
      expect(content).not.toMatch(/postgresql:\/\/.*@/)
      expect(content).not.toMatch(/577c65b75921ef836d117fd1efb05715008a2485d6ddd423/)
      // Check that it imports and uses local QA target validators
      expect(content).toMatch(/assertLocalQaTarget/)
      expect(content).toMatch(/buildLocalQaUrl/)
    }
  })
})
