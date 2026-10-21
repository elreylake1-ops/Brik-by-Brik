// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DealPassportView from "@/components/refurb-plan/DealPassportView"
import RefurbPlanPanel, { type MeasurementSpecRow, type PanelState } from "@/components/refurb-plan/RefurbPlanPanel"
import { MEASUREMENT_SPEC } from "@/lib/data/measurement-spec"
import { buildDealPassport } from "@/lib/refurb-integration/deal-passport"
import { buildFinancialProposal } from "@/lib/refurb-integration/financial-proposal"
import { buildWorkProposal } from "@/lib/refurb-integration/findings-to-work"
import { computePlan } from "@/lib/refurb-integration/plan-compute"
import type { FinancialDecisionEvent, FinancialProposalRecord } from "@/types/refurb-financial"
import type { ConfirmedPlanRecord } from "@/types/refurb-integration"
import type { MeasurementSetRecord } from "@/types/refurb-measurements"
import type { ProposalWithReview } from "@/types/viewing-assessment"
import { PDF_EVIDENCE_PACK_COMPLETE_FIXTURE } from "./fixtures/pdf-evidence-pack-fixtures"
import { ASSUMPTIONS, BASICS, makeDeal } from "./fixtures/refurb-seed"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const evidence = [{ id: "f1", assetId: "a1", timestampSeconds: 31, room: "Loft" }]
const reviewed = (id: string, checkId: string): ProposalWithReview => ({
  proposal: { id, assessmentId: "asmt-1", runId: "run-1", createdAt: "2026-10-22T09:00:00.000Z", checkId, status: "CONCERN", observation: "Seen", evidenceIds: ["f1"], confidence: "low", modelVersion: "m", verification: "UNVERIFIED", disposition: "PENDING" },
  currentReview: { id: `rv-${id}`, proposalId: id, revision: 1, disposition: "ACCEPTED", editedStatus: null, editedObservation: null, reason: null, reviewerId: "operator-1", reviewedAt: "2026-10-22T09:30:00.000Z" },
  reviewHistory: [],
})
const proposal = buildWorkProposal({ assessmentId: "asmt-1", analysisSource: "SIMULATED", evidence, proposals: [reviewed("p1", "C01"), reviewed("p2", "C41")], checkIds: ["C01", "C41"] })
const spec: MeasurementSpecRow[] = Object.entries(MEASUREMENT_SPEC).map(([key, v]) => ({ key, label: v.label, unit: v.unit, usedByEngine: v.engine, perRoom: Boolean(v.perRoom), values: v.values ?? null }))
const noFinancial = { proposals: [], latest: null, decision: null, outdated: false, outdatedReasons: [], status: "NONE" as const }
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

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })
const setValue = (el: Element, value: string) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!
  act(() => {
    setter.call(el, value)
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }))
  })
}
const click = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })) })
const byText = (tag: string, text: string) => [...host.querySelectorAll(tag)].find((e) => e.textContent?.includes(text)) as HTMLElement
const labelled = (label: string) => host.querySelector(`[aria-label='${label}']`) as HTMLInputElement
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function mount(over: Partial<PanelState> = {}, fetchImpl: typeof fetch = vi.fn() as unknown as typeof fetch) {
  const initial: PanelState = { proposal, current: null, measurements: null, financial: noFinancial, ...over }
  act(() => root.render(<RefurbPlanPanel dealId="deal-1" assessmentId="asmt-1" initial={initial} spec={spec} fetchImpl={fetchImpl} />))
}

describe("RefurbPlanPanel: measurements", () => {
  it("offers the four engine quantities, shows what is for builders only, and never offers a video source", () => {
    mount()
    for (const label of ["Bedrooms", "Bathrooms", "Total floor area", "Kitchen size"]) expect(labelled(`${label} value`), label).toBeTruthy()
    expect(host.textContent).toMatch(/entered by you, never read from video/)
    const sources = [...host.querySelectorAll("select[aria-label='Bedrooms source'] option")].map((o) => o.textContent)
    expect(sources).toContain("TAPE_MEASURE")
    expect(sources.join(" ")).not.toMatch(/VIDEO/i)
    const add = [...host.querySelectorAll("select[aria-label='Add a measurement'] option")].map((o) => o.textContent).join(" | ")
    expect(add).toMatch(/Room length/)
    expect(add).not.toMatch(/Bedrooms/) // engine quantities are already on the form
  })

  it("saves exactly what was typed, with how it is known, and the version it is based on", async () => {
    const fetchMock = vi.fn(async (url: string) => (String(url).endsWith("/measurements") && fetchMock.mock.calls.length === 1
      ? json({ success: true, measurementSet: { version: 1, warnings: [] } }, 201)
      : url.includes("/refurb-plan") ? json({ proposal, current: null }) : url.includes("/measurements") ? json({ current: savedSet }) : json({ ...noFinancial })))
    mount({}, fetchMock as unknown as typeof fetch)
    setValue(labelled("Bedrooms value"), "3")
    setValue(labelled("Bathrooms value"), "1")
    setValue(labelled("Total floor area value"), "85")
    setValue(labelled("Total floor area basis"), "OPERATOR_ESTIMATE")
    setValue(labelled("Total floor area source"), "EPC_OR_LISTING")
    setValue(labelled("Total floor area note"), "From the listing")
    click(byText("button", "Save measurements"))
    await flush()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/saved-deals/deal-1/viewing-assessments/asmt-1/measurements")
    const sent = JSON.parse(init.body as string)
    expect(sent.basedOnVersion).toBe(0)
    expect(sent).not.toHaveProperty("changeNote")
    expect(sent.entries).toEqual([
      { key: "bedrooms", value: 3, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "" },
      { key: "bathrooms", value: 1, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "" },
      { key: "floorAreaSqm", value: 85, basis: "OPERATOR_ESTIMATE", source: "EPC_OR_LISTING", confidence: "high", note: "From the listing" },
    ])
    expect(JSON.stringify(sent)).not.toMatch(/frame|video|reviewer|verdict|cost/i)
    expect(host.querySelector("[role=status]")?.textContent).toMatch(/Measurements saved \(version 1\)/)
  })

  it("an UNKNOWN answer is sent as unknown, with no value, source or confidence", async () => {
    const fetchMock = vi.fn(async () => json({ success: false, error: "x" }, 400))
    mount({}, fetchMock as unknown as typeof fetch)
    setValue(labelled("Bedrooms value"), "3")
    setValue(labelled("Bathrooms value"), "1")
    setValue(labelled("Total floor area basis"), "UNKNOWN")
    setValue(labelled("Total floor area note"), "Not visited yet")
    click(byText("button", "Save measurements"))
    await flush()
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(sent.entries.find((e: { key: string }) => e.key === "floorAreaSqm")).toEqual({ key: "floorAreaSqm", value: null, basis: "UNKNOWN", source: null, confidence: null, note: "Not visited yet" })
  })

  it("a correction asks what was wrong and is based on the saved version", async () => {
    const fetchMock = vi.fn(async () => json({ success: false, error: "x" }, 400))
    mount({ measurements: savedSet }, fetchMock as unknown as typeof fetch)
    expect((labelled("Bedrooms value")).value).toBe("3")
    expect(host.textContent).toMatch(/saved version 1/)
    setValue(labelled("What was wrong with the previous version"), "There is a fourth bedroom")
    setValue(labelled("Bedrooms value"), "4")
    click(byText("button", "Save measurements"))
    await flush()
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(sent).toMatchObject({ basedOnVersion: 1, changeNote: "There is a fourth bedroom" })
    expect(sent.entries[0]).toMatchObject({ key: "bedrooms", value: 4 })
  })

  it("shows the server's reason when a value is refused", async () => {
    const fetchMock = vi.fn(async () => json({ success: false, validation: { errors: ["entries[0] (Bedrooms): 12 is outside the usual range 1 to 8 count."] } }, 400))
    mount({}, fetchMock as unknown as typeof fetch)
    setValue(labelled("Bedrooms value"), "12")
    click(byText("button", "Save measurements"))
    await flush()
    expect(host.querySelector("[role=alert]")?.textContent).toMatch(/outside the usual range/)
  })
})

describe("RefurbPlanPanel: scope", () => {
  it("lists reviewed proposals with frames, reviewers and the simulated-data warning; accepts nothing by default", () => {
    mount()
    expect(host.textContent).toContain("Roof works")
    expect(host.textContent).toMatch(/31s \(Loft\)/)
    expect(host.textContent).toMatch(/reviewed by operator-1/)
    expect(host.textContent).toMatch(/SIMULATED analysis/)
    expect([...host.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].filter((c) => c.getAttribute("aria-label")?.startsWith("Accept ")).every((c) => !c.checked)).toBe(true)
    expect((byText("button", "Confirm selected scope") as HTMLButtonElement).disabled).toBe(true)
  })

  it("refuses to confirm a scope until measurements are saved", async () => {
    const fetchMock = vi.fn()
    mount({}, fetchMock as unknown as typeof fetch)
    click(host.querySelector("input[aria-label='Accept Roof works']")!)
    click(byText("button", "Confirm selected scope"))
    await flush()
    expect(host.querySelector("[role=alert]")?.textContent).toMatch(/Record and save measurements first/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("confirms against the saved measurement set with the fingerprint it was shown; one key across a failed attempt and its retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(json({ success: true, plan: { version: 1 } }, 201))
      .mockResolvedValue(json({ success: true, proposal, current: null, ...noFinancial }))
    mount({ measurements: savedSet }, fetchMock as unknown as typeof fetch)
    click(host.querySelector("input[aria-label='Accept Roof works']")!)
    click(byText("button", "Confirm selected scope"))
    await flush()
    expect(host.querySelector("[role=alert]")?.textContent).toMatch(/Request failed/)
    click(byText("button", "Confirm selected scope"))
    await flush()
    const bodies = fetchMock.mock.calls.slice(0, 2).map((c) => JSON.parse((c[1] as RequestInit).body as string))
    expect(bodies[0].idempotencyKey).toBe(bodies[1].idempotencyKey)
    expect(bodies[0]).toMatchObject({ expectedFingerprint: proposal.fingerprint, measurementSetId: "meas-1", accepted: [{ itemId: "roof" }], financialAssumptions: null })
    expect(bodies[0]).not.toHaveProperty("propertyBasics")
    expect(host.querySelector("[role=status]")?.textContent).toMatch(/Scope confirmed \(version 1\)\. Nothing on the Saved Deal/)
  })

  it("explains stale findings and stale measurements instead of confirming", async () => {
    for (const [error, pattern] of [["STALE_FINDINGS", /reviewed again since you opened this/], ["STALE_MEASUREMENTS", /measurements changed since you opened this/]] as const) {
      const fetchMock = vi.fn(async () => json({ success: false, error }, 409))
      mount({ measurements: savedSet }, fetchMock as unknown as typeof fetch)
      click(host.querySelector("input[aria-label='Accept Roof works']")!)
      click(byText("button", "Confirm selected scope"))
      await flush()
      expect(host.querySelector("[role=alert]")?.textContent).toMatch(pattern)
      act(() => root.render(<div />))
    }
  })
})

describe("RefurbPlanPanel: financial-impact proposal", () => {
  const plan: ConfirmedPlanRecord = {
    id: "plan-1", dealId: "deal-1", assessmentId: "asmt-1", version: 1, idempotencyKey: "k", sourceFingerprint: proposal.fingerprint, analysisSource: "SIMULATED",
    acceptedItems: proposal.items.map((i) => ({ itemId: i.itemId, mappingId: i.mappingId, kind: i.kind, label: i.label, area: i.area, scopeEffect: i.scopeEffect, levelChosenByHuman: false, quantityNote: i.quantityNote, sources: i.sources })),
    excluded: proposal.excluded, propertyBasics: BASICS, measurementSetId: "meas-1", measurementSetVersion: 1, financialAssumptions: ASSUMPTIONS,
    computation: computePlan({ accepted: [], basics: BASICS, assumptions: ASSUMPTIONS, deal: { purchasePrice: 100000, gdv: 190000, refurbCost: 25000 } }),
    confirmedBy: "operator-7", confirmedAt: "2026-10-23T09:30:00.000Z",
  }
  const built = buildFinancialProposal({ plan, measurementSet: savedSet, deal: makeDeal("deal-1") })
  const record: FinancialProposalRecord = { id: "fprop-1", dealId: "deal-1", assessmentId: "asmt-1", planId: "plan-1", version: 1, contentHash: built.contentHash, idempotencyKey: "k", content: built.content, createdBy: "operator-8", createdAt: "2026-10-23T09:45:00.000Z" }
  const proposed = { proposals: [record], latest: record, decision: null, outdated: false, outdatedReasons: [], status: "PROPOSED" as const }
  const current = { record: plan, stale: false, staleReasons: [] }

  it("shows the Saved Deal, its recalculation and the proposal side by side, with what changed, what is excluded and what is unresolved", () => {
    mount({ current, measurements: savedSet, financial: proposed })
    const text = host.textContent ?? ""
    expect(text).toMatch(/Saved Deal \(stored\).*Saved Deal \(recalculated\).*Proposed/)
    expect(text).toMatch(/Not authoritative: the Saved Deal figures are/)
    expect(text).toMatch(/What changed/)
    expect(text).toMatch(/Built from scope version 1 confirmed by operator-7; findings reviewed by operator-1/)
    expect(text).toMatch(/Unresolved quantities/)
  })

  it("will not enable confirmation until the not-a-write-back statement and every listed caveat are acknowledged", () => {
    mount({ current, measurements: savedSet, financial: proposed })
    const confirm = byText("button", "Confirm proposed adjustment") as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    const boxes = [...host.querySelectorAll("fieldset[class*='border'] input[type=checkbox]")] as HTMLInputElement[]
    expect(boxes.length).toBeGreaterThanOrEqual(2)
    click(boxes[0])
    expect((byText("button", "Confirm proposed adjustment") as HTMLButtonElement).disabled).toBe(built.content.unresolvedQuantities.length || built.content.exclusions.length ? true : false)
    for (const b of boxes.slice(1)) click(b)
    expect((byText("button", "Confirm proposed adjustment") as HTMLButtonElement).disabled).toBe(false)
    expect(host.textContent).toMatch(/does not change the Saved Deal, Investor Shield or any approval/)
  })

  it("sends the proposal hash it showed, the acknowledgements and a stable key; no figure and no actor", async () => {
    const fetchMock = vi.fn(async (url: string) => (String(url).includes("/decision") ? json({ success: true, decision: {} }, 201) : json({ proposal, current: null, ...noFinancial })))
    mount({ current, measurements: savedSet, financial: proposed }, fetchMock as unknown as typeof fetch)
    for (const b of [...host.querySelectorAll("fieldset[class*='border'] input[type=checkbox]")] as HTMLInputElement[]) click(b)
    setValue(labelled("Decision note"), "Agreed")
    click(byText("button", "Confirm proposed adjustment"))
    await flush()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/saved-deals/deal-1/viewing-assessments/asmt-1/financial-proposal/fprop-1/decision")
    const sent = JSON.parse(init.body as string)
    expect(sent).toMatchObject({ decision: "CONFIRMED", proposalHash: record.contentHash, note: "Agreed", acknowledge: { notWriteBack: true } })
    expect(Object.keys(sent).sort()).toEqual(["acknowledge", "decision", "idempotencyKey", "note", "proposalHash"])
    expect(host.querySelector("[role=status]")?.textContent).toMatch(/The Saved Deal figures were not changed/)
  })

  it("shows an existing decision as final and offers no further buttons for it", () => {
    const decision: FinancialDecisionEvent = { id: "d1", dealId: "deal-1", assessmentId: "asmt-1", proposalId: "fprop-1", decision: "CONFIRMED", actor: "operator-9", note: null, idempotencyKey: "k", requestHash: "a".repeat(64), acknowledged: { notWriteBack: true, exclusions: true, unresolvedQuantities: true }, baselineFingerprint: "b".repeat(64), sameOperatorAsScopeConfirmer: false, occurredAt: "2026-10-23T11:00:00.000Z" }
    mount({ current, measurements: savedSet, financial: { ...proposed, decision, status: "CONFIRMED" } })
    expect(host.textContent).toMatch(/Decision: CONFIRMED by operator-9/)
    expect(host.textContent).toMatch(/approves a proposed adjustment only; the Saved Deal is unchanged/)
    expect(byText("button", "Confirm proposed adjustment")).toBeUndefined()
  })

  it("will not offer a proposal from a stale scope, and shows why a proposal is out of date", () => {
    mount({ current: { ...current, stale: true, staleReasons: ["MEASUREMENTS_CHANGED"] }, measurements: savedSet, financial: { ...proposed, outdated: true, outdatedReasons: ["Measurements have been recorded since the scope was confirmed."], status: "OUTDATED" } })
    expect((byText("button", "Create proposal from the confirmed scope") as HTMLButtonElement).disabled).toBe(true)
    expect(host.textContent).toMatch(/Re-confirm the scope first/)
    expect(host.textContent).toMatch(/Measurements have been recorded since the scope was confirmed/)
    expect((byText("button", "Confirm proposed adjustment") as HTMLButtonElement).disabled).toBe(true)
  })

  it("contains no hard-coded money, rates or financial arithmetic", async () => {
    const { readFileSync } = await import("node:fs")
    const src = readFileSync("components/refurb-plan/RefurbPlanPanel.tsx", "utf8").replace(/^\s*\/\/.*$/gm, "")
    expect(src).not.toMatch(/£|\bdayRate\b|\* *0\.\d|\* *1\.\d/)
  })
})

describe("DealPassportView", () => {
  it("renders three separate, labelled layers: authoritative Saved Deal, confirmed scope, and the proposal with its approval", () => {
    const plan: ConfirmedPlanRecord = {
      id: "plan-1", dealId: "deal-1", assessmentId: "asmt-1", version: 1, idempotencyKey: "k", sourceFingerprint: proposal.fingerprint, analysisSource: "SIMULATED",
      acceptedItems: proposal.items.map((i) => ({ itemId: i.itemId, mappingId: i.mappingId, kind: i.kind, label: i.label, area: i.area, scopeEffect: i.scopeEffect, levelChosenByHuman: false, quantityNote: i.quantityNote, sources: i.sources })),
      excluded: proposal.excluded, propertyBasics: BASICS, measurementSetId: "meas-1", measurementSetVersion: 1, financialAssumptions: ASSUMPTIONS,
      computation: computePlan({ accepted: [], basics: BASICS, assumptions: ASSUMPTIONS, deal: { purchasePrice: 100000, gdv: 190000, refurbCost: 25000 } }),
      confirmedBy: "operator-7", confirmedAt: "2026-10-23T09:30:00.000Z",
    }
    const deal = makeDeal("deal-1")
    const built = buildFinancialProposal({ plan, measurementSet: savedSet, deal })
    const rec: FinancialProposalRecord = { id: "fprop-1", dealId: "deal-1", assessmentId: "asmt-1", planId: "plan-1", version: 1, contentHash: built.contentHash, idempotencyKey: "k", content: built.content, createdBy: "operator-8", createdAt: "2026-10-23T09:45:00.000Z" }
    const decision: FinancialDecisionEvent = { id: "d1", dealId: "deal-1", assessmentId: "asmt-1", proposalId: "fprop-1", decision: "CONFIRMED", actor: "operator-9", note: null, idempotencyKey: "k", requestHash: "a".repeat(64), acknowledged: { notWriteBack: true, exclusions: true, unresolvedQuantities: true }, baselineFingerprint: "b".repeat(64), sameOperatorAsScopeConfirmer: false, occurredAt: "2026-10-23T11:00:00.000Z" }
    const passport = buildDealPassport({
      generatedAt: "2026-10-23T12:00:00.000Z", pack: PDF_EVIDENCE_PACK_COMPLETE_FIXTURE, deal, inspection: null, plan: { record: plan, stale: false, staleReasons: [] }, planHistory: [plan],
      measurements: { current: savedSet, history: [{ record: savedSet, changesFromPrevious: [] }], engineQuantities: { basics: BASICS, blockedBy: [], basisNotes: ["Bedrooms: 3, measured"], unresolved: [] } },
      financial: { proposals: [rec], latest: rec, decision, outdated: false, outdatedReasons: [], status: "CONFIRMED" },
    })
    const html = renderToStaticMarkup(<DealPassportView passport={passport} />)
    const a = html.indexOf("1. Authoritative"), b = html.indexOf("2. Confirmed scope"), c = html.indexOf("3. Proposal")
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
    expect(html).toMatch(/Draft · not approved · internal use only/)
    expect(html).toMatch(/Decision: <strong>CONFIRMED<\/strong> by operator-9/)
    expect(html).toMatch(/approves a proposed adjustment only; the Saved Deal figures above are unchanged/)
    expect(html).toMatch(/Investor Shield \(unchanged\)/)
    expect(html).toMatch(/not authoritative/)
    expect(html).not.toMatch(/<button|<input|<form/)
  })
})
