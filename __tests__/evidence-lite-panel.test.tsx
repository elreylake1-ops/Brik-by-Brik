// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import path from "node:path"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import Home from "@/app/page"
import EvidenceLitePanel, {
  loadEvidenceLiteRecords,
} from "@/components/evidence-lite/EvidenceLitePanel"
import type { EvidenceLiteRecord } from "@/types/evidence-lite"

function makeJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  })
}

function makeEvidenceRecord(overrides: Partial<EvidenceLiteRecord> = {}): EvidenceLiteRecord {
  return {
    id: "evidence-1",
    dealId: "deal-1",
    evidenceType: "TITLE_REVIEW",
    linkedGate: "TITLE",
    title: "Title pack",
    note: "Reviewed locally",
    status: "RECORDED",
    reviewed: false,
    reviewerNote: null,
    createdAt: "2026-06-26T00:00:00.000Z",
    updatedAt: "2026-06-26T00:00:00.000Z",
    ...overrides,
  }
}

let mountedRoot: Root | null = null
let mountedContainer: HTMLDivElement | null = null

afterEach(() => {
  mountedRoot?.unmount()
  mountedRoot = null
  mountedContainer?.remove()
  mountedContainer = null
  vi.unstubAllGlobals()
  document.body.innerHTML = ""
})

async function flushEffects(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function renderPanel(
  fetchMock: ReturnType<typeof vi.fn>,
  props: { savedDealId: string; dealAddress?: string } = { savedDealId: "deal-1", dealAddress: "10 Brik Street" }
): Promise<HTMLElement> {
  document.body.innerHTML = ""
  vi.stubGlobal("fetch", fetchMock)

  mountedContainer = document.createElement("div")
  document.body.appendChild(mountedContainer)
  mountedRoot = createRoot(mountedContainer)

  await act(async () => {
    mountedRoot?.render(<EvidenceLitePanel savedDealId={props.savedDealId} dealAddress={props.dealAddress} />)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  await flushEffects()
  return mountedContainer
}

function getRecordArticles(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll("article"))
}

async function clickElement(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function getRequestPath(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return new URL(input, "http://localhost").pathname
  }

  if (input instanceof URL) {
    return input.pathname
  }

  return new URL(input.url).pathname
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

async function renderHome(fetchMock: ReturnType<typeof vi.fn>): Promise<HTMLElement> {
  document.body.innerHTML = ""
  vi.stubGlobal("fetch", fetchMock)

  mountedContainer = document.createElement("div")
  document.body.appendChild(mountedContainer)
  mountedRoot = createRoot(mountedContainer)

  await act(async () => {
    mountedRoot?.render(<Home />)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  await flushEffects()
  return mountedContainer
}

function getViewButtonForAddress(container: HTMLElement, address: string): HTMLButtonElement {
  const row = Array.from(container.querySelectorAll("tr")).find((candidate) =>
    (candidate.textContent ?? "").includes(address)
  )

  if (!row) {
    throw new Error(`row not found for address: ${address}`)
  }

  const button = row.querySelector("button")
  if (!button) {
    throw new Error(`view button not found for address: ${address}`)
  }

  return button as HTMLButtonElement
}

function getEvidencePanel(container: HTMLElement): HTMLElement {
  const section = Array.from(container.querySelectorAll("section")).find((candidate) => {
    const text = candidate.textContent ?? ""
    return text.includes("Evidence Lite") && text.includes("Recorded evidence")
  })

  if (!section) {
    throw new Error("Evidence Lite panel not found")
  }

  return section as HTMLElement
}

async function waitForText(container: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (container.textContent?.includes(text)) {
      return
    }

    await flushEffects()
  }

  throw new Error(`text not found: ${text}`)
}

describe("EvidenceLitePanel", () => {
  it("renders the production-safe read-only shell and excludes gate-satisfaction wording", () => {
    const html = renderToStaticMarkup(
      <EvidenceLitePanel savedDealId="deal-1" dealAddress="10 Brik Street" />
    )

    expect(html).toContain("Evidence Lite")
    expect(html).toContain(
      "Deal-linked evidence notes for review and follow-up. Evidence Lite is read-only and informational only. It does not satisfy, waive, approve, or override Investor Shield requirements."
    )
    expect(html).toContain("Evidence Lite does not replace required Investor Shield evidence.")
    expect(html).toContain("Recorded evidence")
    expect(html).toContain("Loading Evidence Lite records...")
    expect(html).not.toContain("Development-only review panel")
    expect(html).not.toContain("Record evidence")
    expect(html).not.toContain("Record Evidence")
    expect(html).not.toContain("local review only")
    expect(html).not.toContain("Gate passed")
    expect(html).not.toContain("Approved")
    expect(html).not.toContain("Requirement complete")
    expect(html).not.toContain("Blocker removed")
  })

  it("loads the empty state for a saved deal", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        evidence: [],
      })
    )

    const container = await renderPanel(fetchMock)

    expect(fetchMock).toHaveBeenCalledWith("/api/saved-deals/deal-1/evidence", {
      headers: { accept: "application/json" },
    })
    expect(container.textContent).toContain("No Evidence Lite records have been added for this deal.")
    expect(container.textContent).toContain("Evidence Lite does not replace required Investor Shield evidence.")
    expect(container.querySelector("form")).toBeNull()
  })

  it("loads and renders canonical evidence records", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        evidence: [
          makeEvidenceRecord({
            id: "evidence-1",
            linkedGate: "SOLICITOR_REVIEW",
            title: "Title pack",
            note: "Controlled QA evidence only; not substantive due diligence evidence.",
            reviewed: false,
            status: "MISSING",
          }),
          makeEvidenceRecord({
            id: "evidence-2",
            linkedGate: "SOLICITOR_REVIEW",
            evidenceType: "SOLICITOR_REVIEW",
            title: "Solicitor Review note",
            note: "Signed locally",
            reviewed: true,
            reviewerNote: "Follow up with the conveyancer.",
            status: "REVIEWED",
            createdAt: "2026-06-27T00:00:00.000Z",
            updatedAt: "2026-06-27T01:00:00.000Z",
          }),
        ],
      })
    )

    const container = await renderPanel(fetchMock)
    const articles = getRecordArticles(container)

    expect(articles).toHaveLength(2)
    expect(articles[0].textContent).toContain("Title pack")
    expect(articles[0].textContent).toContain("Evidence ID: evidence-1")
    expect(articles[0].textContent).toContain("Evidence type: Title review")
    expect(articles[0].textContent).toContain("Linked gate: Solicitor Review")
    expect(articles[0].textContent).toContain("MISSING")
    expect(articles[0].textContent).toContain("Not reviewed")
    expect(articles[0].textContent).toContain(
      "Controlled QA evidence only; not substantive due diligence evidence."
    )
    expect(articles[0].textContent).toContain("Created 2026-06-26 00:00 UTC")
    expect(articles[0].textContent).toContain("Updated 2026-06-26 00:00 UTC")
    expect(articles[1].textContent).toContain("Solicitor Review note")
    expect(articles[1].textContent).toContain("Evidence ID: evidence-2")
    expect(articles[1].textContent).toContain("Evidence type: Solicitor Review")
    expect(articles[1].textContent).toContain("Linked gate: Solicitor Review")
    expect(articles[1].textContent).toContain("REVIEWED")
    expect(articles[1].textContent).toContain("Reviewed")
    expect(articles[1].textContent).toContain("Signed locally")
    expect(articles[1].textContent).toContain("Reviewer note: Follow up with the conveyancer.")
    expect(articles[1].textContent).toContain("Created 2026-06-27 00:00 UTC")
    expect(articles[1].textContent).toContain("Updated 2026-06-27 01:00 UTC")
    expect(articles[0].textContent).not.toContain("Reviewer note:")
    expect(container.textContent).not.toContain("Gate passed")
  })

  it("shows a safe error message when the evidence request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: false,
          error: "EVIDENCE_LITE_READ_FAILED",
          traceId: "trace-evidence-lite",
        }, { status: 500 })
      )

    const container = await renderPanel(fetchMock)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain(
      "Evidence Lite could not be loaded right now. Investor Shield requirements are unchanged."
    )
    expect(container.textContent).not.toContain("EVIDENCE_LITE_READ_FAILED")
    expect(container.textContent).not.toContain("stack")
    expect(container.textContent).not.toContain("SQL")
    expect(container.textContent).not.toContain("repository")
    expect(container.textContent).not.toContain("token")
  })

  it("loads evidence through the route helper", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        evidence: [
          {
            id: "evidence-1",
            dealId: "deal-1",
            evidenceType: "TITLE_REVIEW",
            linkedGate: "SOLICITOR_REVIEW",
            title: "Title pack",
            note: "Reviewed locally",
            status: "RECORDED",
            reviewed: false,
            reviewerNote: null,
            createdAt: "2026-06-26T00:00:00.000Z",
            updatedAt: "2026-06-26T00:00:00.000Z",
          },
        ],
      })
    )

    const evidence = await loadEvidenceLiteRecords(" deal-1 ", fetchMock as typeof fetch)

    expect(fetchMock).toHaveBeenCalledWith("/api/saved-deals/deal-1/evidence", {
      headers: { accept: "application/json" },
    })
    expect(evidence).toEqual([
      {
        id: "evidence-1",
        dealId: "deal-1",
        evidenceType: "TITLE_REVIEW",
        linkedGate: "SOLICITOR_REVIEW",
        title: "Title pack",
        note: "Reviewed locally",
        status: "RECORDED",
        reviewed: false,
        reviewerNote: null,
        createdAt: "2026-06-26T00:00:00.000Z",
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
    ])
  })

  it("mounts the Evidence Lite panel on the canonical saved-deal detail surface in production mode", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    const requests: string[] = []
    const alphaEvidence = createDeferred<Response>()

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      const path = getRequestPath(input)
      requests.push(`${method} ${path}`)

      if (path === "/api/saved-deals" && method === "GET") {
        return makeJsonResponse({
          success: true,
          deals: [
            {
              id: "deal-alpha",
              address: "10 Alpha Street",
              classification: "MVP",
              pipeline_state: "UNDER_ANALYSIS",
              created_at: "2026-06-26T00:00:00.000Z",
            },
            {
              id: "deal-beta",
              address: "20 Beta Street",
              classification: "Review",
              pipeline_state: "DUE_DILIGENCE",
              created_at: "2026-06-27T00:00:00.000Z",
            },
            {
              id: "deal-gamma",
              address: "30 Gamma Street",
              classification: "Watch",
              pipeline_state: "NEGOTIATING",
              created_at: "2026-06-28T00:00:00.000Z",
            },
          ],
        })
      }

      if (path === "/api/saved-deals/deal-alpha" && method === "GET") {
        return makeJsonResponse({
          success: true,
          deal: {
            id: "deal-alpha",
            address: "10 Alpha Street",
            classification: "MVP",
            governance_state: "REVIEW_REQUIRED",
            capital_protection_state: "BLOCKED",
            pipeline_state: "UNDER_ANALYSIS",
            purchase_price: 250000,
            gdv_realistic: 325000,
            refurb_cost: 45000,
            next_action: "Read evidence records",
            engine_result_json: {},
          },
        })
      }

      if (path === "/api/saved-deals/deal-beta" && method === "GET") {
        return makeJsonResponse({
          success: true,
          deal: {
            id: "deal-beta",
            address: "20 Beta Street",
            classification: "Review",
            governance_state: "REVIEW_REQUIRED",
            capital_protection_state: "CAUTION",
            pipeline_state: "DUE_DILIGENCE",
            purchase_price: 265000,
            gdv_realistic: 340000,
            refurb_cost: 50000,
            next_action: "Check solicitor evidence",
            engine_result_json: {},
          },
        })
      }

      if (path === "/api/saved-deals/deal-gamma" && method === "GET") {
        return makeJsonResponse({
          success: true,
          deal: {
            id: "deal-gamma",
            address: "30 Gamma Street",
            classification: "Watch",
            governance_state: "REVIEW_REQUIRED",
            capital_protection_state: "BLOCKED",
            pipeline_state: "NEGOTIATING",
            purchase_price: 275000,
            gdv_realistic: 350000,
            refurb_cost: 55000,
            next_action: "Resolve missing evidence",
            engine_result_json: {},
          },
        })
      }

      if (path.endsWith("/investor-summary")) {
        return makeJsonResponse(
          {
            success: false,
            error: "INVESTOR_SUMMARY_READ_FAILED",
            traceId: "trace-investor-summary",
          },
          500
        )
      }

      if (path.endsWith("/investor-shield-ui")) {
        return makeJsonResponse(
          {
            success: false,
            error: "INVESTOR_SHIELD_UI_READ_FAILED",
            traceId: "trace-investor-shield",
          },
          500
        )
      }

      if (path.endsWith("/offers") && method === "GET") {
        return makeJsonResponse({ success: true, offers: [] })
      }

      if (path.endsWith("/tasks") && method === "GET") {
        return makeJsonResponse({ success: true, tasks: [] })
      }

      if (path === "/api/saved-deals/deal-alpha/evidence" && method === "GET") {
        return alphaEvidence.promise
      }

      if (path === "/api/saved-deals/deal-beta/evidence" && method === "GET") {
        return makeJsonResponse({
          success: true,
          evidence: [
            makeEvidenceRecord({
              id: "evidence_9f9a344c-ed1c-4510-bb46-c8d3b88fce96",
              dealId: "deal-beta",
              evidenceType: "TITLE_REVIEW",
              linkedGate: "SOLICITOR_REVIEW",
              title: "Controlled QA title review",
              note: "Controlled QA evidence only; not substantive due diligence evidence. Verified via canonical POST and PATCH.",
              reviewed: false,
              status: "MISSING",
            }),
            makeEvidenceRecord({
              id: "evidence-beta-2",
              dealId: "deal-beta",
              evidenceType: "SOLICITOR_REVIEW",
              linkedGate: "SOLICITOR_REVIEW",
              title: "Solicitor Review note",
              note: "Signed locally",
              reviewed: true,
              status: "REVIEWED",
              createdAt: "2026-06-27T00:00:00.000Z",
              updatedAt: "2026-06-27T01:00:00.000Z",
            }),
          ],
        })
      }

      if (path === "/api/saved-deals/deal-gamma/evidence" && method === "GET") {
        return makeJsonResponse(
          {
            success: false,
            error: "EVIDENCE_LITE_READ_FAILED",
            traceId: "trace-evidence-gamma",
          },
          500
        )
      }

      throw new Error(`unexpected request: ${method} ${path}`)
    })

    process.env.NODE_ENV = "production"

    try {
      const container = await renderHome(fetchMock)

      await waitForText(container, "10 Alpha Street")
      expect(requests.filter((request) => request.includes("/evidence"))).toHaveLength(0)
      expect(container.textContent).toContain("Select a saved deal from the list to view read-only detail.")
      expect(container.textContent).toContain("Saved Deal Detail")

      const alphaViewButton = getViewButtonForAddress(container, "10 Alpha Street")
      await clickElement(alphaViewButton)
      await waitForText(container, "Loading Evidence Lite records...")
      expect(requests).toContain("GET /api/saved-deals/deal-alpha/evidence")
      expect(container.textContent).toContain("Saved deal: 10 Alpha Street (deal-alpha)")
      expect(container.textContent).toContain("Loading Evidence Lite records...")
      expect(container.textContent).toContain("Investor Summary")
      expect(container.textContent).toContain("Investor Shield")
      expect(container.textContent).toContain("Operator Command")

      await act(async () => {
        alphaEvidence.resolve(
          makeJsonResponse({
            success: true,
            evidence: [],
          })
        )
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      await waitForText(container, "No Evidence Lite records have been added for this deal.")
      const emptyEvidencePanel = getEvidencePanel(container)
      expect(emptyEvidencePanel.textContent).toContain("No Evidence Lite records have been added for this deal.")
      expect(emptyEvidencePanel.textContent).toContain(
        "Evidence Lite does not replace required Investor Shield evidence."
      )
      expect(emptyEvidencePanel.textContent).not.toContain("Gate passed")
      expect(emptyEvidencePanel.textContent).not.toContain("Blocker cleared")
      expect(emptyEvidencePanel.textContent).not.toContain("Approved")

      const betaViewButton = getViewButtonForAddress(container, "20 Beta Street")
      await clickElement(betaViewButton)
      await waitForText(container, "Controlled QA title review")
      expect(requests).toContain("GET /api/saved-deals/deal-beta/evidence")
      expect(container.textContent).toContain("Saved deal: 20 Beta Street (deal-beta)")

      const populatedEvidencePanel = getEvidencePanel(container)
      expect(populatedEvidencePanel.textContent).toContain("Controlled QA title review")
      expect(populatedEvidencePanel.textContent).toContain(
        "Evidence ID: evidence_9f9a344c-ed1c-4510-bb46-c8d3b88fce96"
      )
      expect(populatedEvidencePanel.textContent).toContain("Evidence type: Title review")
      expect(populatedEvidencePanel.textContent).toContain("Linked gate: Solicitor Review")
      expect(populatedEvidencePanel.textContent).toContain("MISSING")
      expect(populatedEvidencePanel.textContent).toContain("Not reviewed")
      expect(populatedEvidencePanel.textContent).toContain("Reviewed")
      expect(populatedEvidencePanel.textContent).toContain(
        "Controlled QA evidence only; not substantive due diligence evidence. Verified via canonical POST and PATCH."
      )
      expect(populatedEvidencePanel.textContent).toContain("Signed locally")
      expect(populatedEvidencePanel.textContent).not.toContain("Gate passed")
      expect(populatedEvidencePanel.textContent).not.toContain("Blocker cleared")
      expect(populatedEvidencePanel.textContent).not.toContain("Approved")
      expect(populatedEvidencePanel.textContent).not.toContain("Record Evidence")

      const gammaViewButton = getViewButtonForAddress(container, "30 Gamma Street")
      await clickElement(gammaViewButton)
      await waitForText(
        container,
        "Evidence Lite could not be loaded right now. Investor Shield requirements are unchanged."
      )
      expect(requests).toContain("GET /api/saved-deals/deal-gamma/evidence")

      const errorEvidencePanel = getEvidencePanel(container)
      expect(errorEvidencePanel.textContent).toContain(
        "Evidence Lite could not be loaded right now. Investor Shield requirements are unchanged."
      )
      expect(errorEvidencePanel.textContent).not.toContain("EVIDENCE_LITE_READ_FAILED")
      expect(errorEvidencePanel.textContent).not.toContain("SQL")
      expect(errorEvidencePanel.textContent).not.toContain("stack")
      expect(errorEvidencePanel.textContent).not.toContain("repository")

      expect(requests.filter((request) => request.startsWith("POST "))).toHaveLength(0)
      expect(requests.filter((request) => request.startsWith("PATCH "))).toHaveLength(0)
      expect(requests.filter((request) => request.startsWith("PUT "))).toHaveLength(0)
      expect(requests.filter((request) => request.startsWith("DELETE "))).toHaveLength(0)

      for (const forbidden of ["upload", "ocr", "ai", "workflow", "security", "guard"]) {
        expect(requests.join(" ")).not.toContain(forbidden)
      }
    } finally {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it("removes the production gate from the app source while keeping the panel mounted on the saved-deal surface", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/page.tsx"), "utf8")

    expect(appSource).not.toContain('const showEvidenceLitePanel = process.env.NODE_ENV !== "production"')
    expect(appSource).not.toContain("{showEvidenceLitePanel ? (")
    expect(appSource).toContain("<EvidenceLitePanel")
  })
})
