// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import RefurbPlanPanel, { type MeasurementSpecRow, type PanelState } from "@/components/refurb-plan/RefurbPlanPanel"
import { MEASUREMENT_SPEC } from "@/lib/data/measurement-spec"
import { buildWorkProposal } from "@/lib/refurb-integration/findings-to-work"
import type { ProposalWithReview } from "@/types/viewing-assessment"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const evidence = [{ id: "f1", assetId: "a1", timestampSeconds: 25, room: "Bathroom" }]
const reviewed = (id: string, checkId: string): ProposalWithReview => ({
  proposal: {
    id,
    assessmentId: "asmt-wp4b",
    runId: "run-1",
    createdAt: "2026-10-23T09:00:00.000Z",
    checkId,
    status: "CONCERN",
    observation: "Observed refurbishment scope item",
    evidenceIds: ["f1"],
    confidence: "medium",
    modelVersion: "m1",
    verification: "UNVERIFIED",
    disposition: "PENDING",
  },
  currentReview: {
    id: `rv-${id}`,
    proposalId: id,
    revision: 1,
    disposition: "ACCEPTED",
    editedStatus: null,
    editedObservation: null,
    reason: null,
    reviewerId: "operator-wp4b",
    reviewedAt: "2026-10-23T09:30:00.000Z",
  },
  reviewHistory: [],
})

const proposal = buildWorkProposal({
  assessmentId: "asmt-wp4b",
  analysisSource: "SIMULATED",
  evidence,
  proposals: [
    reviewed("p1", "C41"), // Bathroom works -> partial (unpriced stub)
    reviewed("p2", "C39"), // Kitchen works -> refresh (unpriced stub)
  ],
  checkIds: ["C41", "C39"],
})

const spec: MeasurementSpecRow[] = Object.entries(MEASUREMENT_SPEC).map(([key, v]) => ({
  key,
  label: v.label,
  unit: v.unit,
  usedByEngine: v.engine,
  perRoom: Boolean(v.perRoom),
  values: v.values ?? null,
}))

const noFinancial = { proposals: [], latest: null, decision: null, outdated: false, outdatedReasons: [], status: "NONE" as const }

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

const flush = () =>
  act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

const setValue = (el: Element, value: string) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!
  act(() => {
    setter.call(el, value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  })
}

const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })

const byText = (tag: string, text: string) =>
  [...host.querySelectorAll(tag)].find((e) => e.textContent?.includes(text)) as HTMLElement

const labelled = (label: string) => host.querySelector(`[aria-label='${label}']`) as HTMLInputElement
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe("RefurbPlanPanel: contractor quote approval browser workflow", () => {
  it("renders contractor quote approval controls for proposed scope items", () => {
    const initial: PanelState = { proposal, current: null, measurements: null, financial: noFinancial }
    act(() => root.render(<RefurbPlanPanel dealId="deal-wp4b" assessmentId="asmt-wp4b" initial={initial} spec={spec} />))

    expect(labelled("Contractor quote reference for Bathroom works")).toBeTruthy()
    expect(labelled("Approved price for Bathroom works")).toBeTruthy()
    expect(byText("button", "Approve Contractor Quote")).toBeTruthy()
  })

  it("approves contractor quote price and sends POST request to quote-overrides endpoint", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/quote-overrides") && init?.method === "POST") {
        return Promise.resolve(
          json({
            success: true,
            override: {
              id: "cvr-001",
              dealId: "deal-wp4b",
              assessmentId: "asmt-wp4b",
              itemId: "bathroom",
              taskId: "bathroom-partial-unsupported",
              quoteRef: "Apex Contractors APX-3500",
              approvedAmount: 3500,
              approvedBy: "operator-wp4b",
              approvedAt: "2026-10-23T10:00:00.000Z",
              status: "APPROVED",
              supersededBy: null,
            },
          })
        )
      }
      if (url.includes("/refurb-plan")) {
        return Promise.resolve(
          json({
            success: true,
            proposal,
            current: null,
            quoteOverrides: [
              {
                id: "cvr-001",
                dealId: "deal-wp4b",
                assessmentId: "asmt-wp4b",
                itemId: "bathroom",
                taskId: "bathroom-partial-unsupported",
                quoteRef: "Apex Contractors APX-3500",
                approvedAmount: 3500,
                approvedBy: "operator-wp4b",
                approvedAt: "2026-10-23T10:00:00.000Z",
                status: "APPROVED",
                supersededBy: null,
              },
            ],
          })
        )
      }
      if (url.includes("/measurements")) {
        return Promise.resolve(json({ success: true, current: null }))
      }
      if (url.includes("/financial-proposal")) {
        return Promise.resolve(json({ success: true, ...noFinancial }))
      }
      return Promise.resolve(json({ success: true }))
    })

    const initial: PanelState = { proposal, current: null, measurements: null, financial: noFinancial }
    act(() =>
      root.render(
        <RefurbPlanPanel
          dealId="deal-wp4b"
          assessmentId="asmt-wp4b"
          initial={initial}
          spec={spec}
          fetchImpl={fetchMock as unknown as typeof fetch}
        />
      )
    )

    const refInput = labelled("Contractor quote reference for Bathroom works")
    const priceInput = labelled("Approved price for Bathroom works")
    setValue(refInput, "Apex Contractors APX-3500")
    setValue(priceInput, "3500")

    const approveButton = labelled("Approve contractor quote for Bathroom works")
    expect(approveButton).toBeTruthy()
    click(approveButton)
    await flush()

    // Verifies the exact POST body and route
    const postCall = fetchMock.mock.calls.find(([u, init]) => u.includes("/quote-overrides") && init?.method === "POST")
    expect(postCall).toBeDefined()
    const [, postInit] = postCall as unknown as [string, RequestInit]
    const body = JSON.parse(postInit.body as string)
    expect(body).toEqual({
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Apex Contractors APX-3500",
      approvedAmount: 3500,
    })

    // Verifies approved badge is displayed after reload
    expect(host.textContent).toMatch(/Approved contractor quote:/)
    expect(host.textContent).toMatch(/Apex Contractors APX-3500/)
    expect(host.textContent).toMatch(/operator-wp4b/)

    // Verifies audit table is rendered
    expect(host.textContent).toMatch(/Contractor quote overrides \(persisted audit trail\)/)
  })

  it("displays existing approved quote badge and enables superseding via operator toggle", async () => {
    const existingOverride = {
      id: "cvr-initial",
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Apex Contractors Initial #APX-4200",
      approvedAmount: 4200,
      approvedBy: "operator-1",
      approvedAt: "2026-10-23T08:00:00.000Z",
      status: "APPROVED" as const,
      supersededBy: null,
    }

    const initial: PanelState = {
      proposal,
      current: null,
      measurements: null,
      financial: noFinancial,
      quoteOverrides: [existingOverride],
    }

    act(() =>
      root.render(
        <RefurbPlanPanel
          dealId="deal-wp4b"
          assessmentId="asmt-wp4b"
          initial={initial}
          spec={spec}
        />
      )
    )

    expect(host.textContent).toMatch(/Approved contractor quote:/)
    expect(host.textContent).toMatch(/Apex Contractors Initial #APX-4200/)
    expect(byText("button", "Supersede quote")).toBeTruthy()
  })
})
