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

function getControlByLabel(
  scope: ParentNode,
  labelText: string
): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  const label = Array.from(scope.querySelectorAll("label")).find((candidate) => {
    const span = candidate.querySelector("span")
    if (span?.textContent?.trim() === labelText) {
      return true
    }

    return candidate.textContent?.trim() === labelText
  })

  if (!label) {
    throw new Error(`label not found: ${labelText}`)
  }

  const control = label.querySelector("input, select, textarea")
  if (!control) {
    throw new Error(`control not found for label: ${labelText}`)
  }

  return control as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
}

async function setFieldValue(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string
): Promise<void> {
  await act(async () => {
    const prototype = Object.getPrototypeOf(field)
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
    valueSetter?.call(field, value)
    field.dispatchEvent(new Event("input", { bubbles: true }))
    field.dispatchEvent(new Event("change", { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function setCheckboxValue(field: HTMLInputElement, checked: boolean): Promise<void> {
  await act(async () => {
    if (field.checked !== checked) {
      field.click()
    } else {
      field.dispatchEvent(new Event("change", { bubbles: true }))
    }
    field.dispatchEvent(new Event("change", { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function clickElement(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function getButtonByText(scope: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === text
  )

  if (!button) {
    throw new Error(`button not found: ${text}`)
  }

  return button as HTMLButtonElement
}

function getSelectOptionTexts(scope: ParentNode, labelText: string): string[] {
  const control = getControlByLabel(scope, labelText)
  if (!(control instanceof HTMLSelectElement)) {
    throw new Error(`expected select for label: ${labelText}`)
  }

  return Array.from(control.options).map((option) => option.textContent ?? "")
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
    return text.includes("Evidence Lite") && text.includes("Recorded evidence") && text.includes("Record evidence")
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
  it("renders the development-only shell and excludes gate-satisfaction wording", () => {
    const html = renderToStaticMarkup(
      <EvidenceLitePanel savedDealId="deal-1" dealAddress="10 Brik Street" />
    )

    expect(html).toContain("Evidence Lite")
    expect(html).toContain("Development-only review panel")
    expect(html).toContain("Evidence is for review only and does not change gate state.")
    expect(html).toContain("Recorded evidence")
    expect(html).toContain("Record evidence")
    expect(html).toContain("Loading evidence records...")
    expect(html).toContain("Sold comparables")
    expect(html).toContain("Planning / building control")
    expect(html).toContain("Builder proposal / contract")
    expect(html).toContain("Solicitor review")
    expect(html).not.toContain("SOLICITOR_FEEDBACK")
    expect(html).not.toContain("GENERAL")
    expect(html).not.toContain("Edit")
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
    expect(container.textContent).toContain("No evidence records yet.")
    expect(container.textContent).not.toContain("No Evidence Lite records yet.")

    const form = container.querySelector("form")
    if (!form) {
      throw new Error("create form not found")
    }

    const linkedGateOptions = getSelectOptionTexts(form, "Linked Gate")
    const evidenceTypeOptions = getSelectOptionTexts(form, "Evidence Type")

    expect(linkedGateOptions).toContain("Solicitor review")
    expect(linkedGateOptions).not.toContain("SOLICITOR_FEEDBACK")
    expect(evidenceTypeOptions).toContain("Title review")
    expect(evidenceTypeOptions).not.toContain("GENERAL")
  })

  it("loads and renders canonical evidence records", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        evidence: [
          makeEvidenceRecord({
            id: "evidence-1",
            linkedGate: "TITLE",
            title: "Title pack",
            note: "Reviewed locally",
            reviewed: false,
          }),
          makeEvidenceRecord({
            id: "evidence-2",
            linkedGate: "SOLICITOR_REVIEW",
            evidenceType: "SOLICITOR_REVIEW",
            title: "Solicitor review note",
            note: "Signed locally",
            reviewed: true,
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
    expect(articles[0].textContent).toContain("Title review / Title")
    expect(articles[0].textContent).toContain("Not reviewed")
    expect(articles[0].textContent).toContain("Reviewed locally")
    expect(articles[0].textContent).toContain("Created 2026-06-26 00:00 UTC")
    expect(articles[0].textContent).toContain("Updated 2026-06-26 00:00 UTC")
    expect(articles[1].textContent).toContain("Solicitor review note")
    expect(articles[1].textContent).toContain("Solicitor review / Solicitor review")
    expect(articles[1].textContent).toContain("Reviewed")
    expect(articles[1].textContent).toContain("Signed locally")
    expect(articles[1].textContent).toContain("Created 2026-06-27 00:00 UTC")
    expect(articles[1].textContent).toContain("Updated 2026-06-27 01:00 UTC")
    expect(container.textContent).not.toContain("Gate passed")
  })

  it("submits a minimal evidence record and refreshes the list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          evidence: [],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          evidence: makeEvidenceRecord({
            id: "evidence-3",
            evidenceType: "TITLE_REVIEW",
            linkedGate: "SOLICITOR_REVIEW",
            title: "Title pack",
            note: "Checked locally",
            reviewed: true,
            status: "RECORDED",
          }),
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          evidence: [
            makeEvidenceRecord({
              id: "evidence-3",
              evidenceType: "TITLE_REVIEW",
              linkedGate: "SOLICITOR_REVIEW",
              title: "Title pack",
              note: "Checked locally",
              reviewed: true,
              status: "RECORDED",
            }),
          ],
        })
      )

    const container = await renderPanel(fetchMock)
    const form = container.querySelector("form")

    if (!form) {
      throw new Error("create form not found")
    }

    await setFieldValue(getControlByLabel(form, "Evidence Type"), "TITLE_REVIEW")
    await setFieldValue(getControlByLabel(form, "Linked Gate"), "SOLICITOR_REVIEW")
    await setFieldValue(getControlByLabel(form, "Title"), "Title pack")
    await setFieldValue(getControlByLabel(form, "Note"), "Checked locally")
    await setCheckboxValue(getControlByLabel(form, "Mark as reviewed") as HTMLInputElement, true)
    await clickElement(getButtonByText(form, "Record Evidence"))
    await flushEffects()

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/saved-deals/deal-1/evidence", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        evidenceType: "TITLE_REVIEW",
        linkedGate: "SOLICITOR_REVIEW",
        title: "Title pack",
        note: "Checked locally",
        reviewed: true,
        status: "MISSING",
      }),
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(container.textContent).toContain("Evidence record created for local review only.")
    expect(getRecordArticles(container)).toHaveLength(1)
    expect(container.textContent).toContain("Title pack")
    expect(container.textContent).toContain("Reviewed")
    expect(container.textContent).not.toContain("SOLICITOR_FEEDBACK")
  })

  it("shows a validation error from a failed create request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          evidence: [],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse(
          {
            success: false,
            error: "Invalid evidence input.",
            validation: {
              errors: [{ field: "note", message: "note must be a non-empty string" }],
            },
          },
          { status: 400 }
        )
      )

    const container = await renderPanel(fetchMock)
    const form = container.querySelector("form")

    if (!form) {
      throw new Error("create form not found")
    }

    await setFieldValue(getControlByLabel(form, "Title"), "Broken title")
    await setFieldValue(getControlByLabel(form, "Note"), "Broken note")
    await clickElement(getButtonByText(form, "Record Evidence"))
    await flushEffects()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain("note must be a non-empty string")
    expect(container.textContent).not.toContain("stack")
    expect(container.textContent).not.toContain("SQL")
    expect(container.textContent).not.toContain("repository")
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
        createdAt: "2026-06-26T00:00:00.000Z",
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
    ])
  })

  it("mounts the Evidence Lite panel on the canonical saved-deal detail surface", async () => {
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
              id: "evidence-beta-1",
              dealId: "deal-beta",
              evidenceType: "TITLE_REVIEW",
              linkedGate: "TITLE",
              title: "Title pack",
              note: "Reviewed locally",
              reviewed: false,
            }),
            makeEvidenceRecord({
              id: "evidence-beta-2",
              dealId: "deal-beta",
              evidenceType: "SOLICITOR_REVIEW",
              linkedGate: "SOLICITOR_REVIEW",
              title: "Solicitor review note",
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

    const container = await renderHome(fetchMock)

    await waitForText(container, "10 Alpha Street")
    expect(requests.filter((request) => request.includes("/evidence"))).toHaveLength(0)
    expect(container.textContent).toContain("Select a saved deal from the list to view read-only detail.")
    expect(container.textContent).toContain("Saved Deal Detail")

    const alphaViewButton = getViewButtonForAddress(container, "10 Alpha Street")
    await clickElement(alphaViewButton)
    await waitForText(container, "Loading evidence records...")
    expect(requests).toContain("GET /api/saved-deals/deal-alpha/evidence")
    expect(container.textContent).toContain("Saved deal: 10 Alpha Street (deal-alpha)")
    expect(container.textContent).toContain("Loading evidence records...")
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

    await waitForText(container, "No evidence records yet.")
    const emptyEvidencePanel = getEvidencePanel(container)
    expect(emptyEvidencePanel.textContent).toContain("No evidence records yet.")
    expect(emptyEvidencePanel.textContent).not.toContain("Gate passed")
    expect(emptyEvidencePanel.textContent).not.toContain("Blocker cleared")
    expect(emptyEvidencePanel.textContent).not.toContain("Approved")

    const betaViewButton = getViewButtonForAddress(container, "20 Beta Street")
    await clickElement(betaViewButton)
    await waitForText(container, "Title pack")
    expect(requests).toContain("GET /api/saved-deals/deal-beta/evidence")
    expect(container.textContent).toContain("Saved deal: 20 Beta Street (deal-beta)")

    const populatedEvidencePanel = getEvidencePanel(container)
    expect(populatedEvidencePanel.textContent).toContain("Title pack")
    expect(populatedEvidencePanel.textContent).toContain("Title review / Title")
    expect(populatedEvidencePanel.textContent).toContain("Not reviewed")
    expect(populatedEvidencePanel.textContent).toContain("Reviewed")
    expect(populatedEvidencePanel.textContent).toContain("Reviewed locally")
    expect(populatedEvidencePanel.textContent).toContain("Signed locally")
    expect(populatedEvidencePanel.textContent).not.toContain("Gate passed")
    expect(populatedEvidencePanel.textContent).not.toContain("Blocker cleared")
    expect(populatedEvidencePanel.textContent).not.toContain("Approved")

    const gammaViewButton = getViewButtonForAddress(container, "30 Gamma Street")
    await clickElement(gammaViewButton)
    await waitForText(container, "EVIDENCE_LITE_READ_FAILED")
    expect(requests).toContain("GET /api/saved-deals/deal-gamma/evidence")

    const errorEvidencePanel = getEvidencePanel(container)
    expect(errorEvidencePanel.textContent).toContain("EVIDENCE_LITE_READ_FAILED")
    expect(errorEvidencePanel.textContent).not.toContain("SQL")
    expect(errorEvidencePanel.textContent).not.toContain("stack")
    expect(errorEvidencePanel.textContent).not.toContain("repository")

    for (const forbidden of ["upload", "ocr", "ai", "workflow", "security", "guard"]) {
      expect(requests.join(" ")).not.toContain(forbidden)
    }
  })

  it("keeps the production gate in the app source and only renders the panel in non-production", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/page.tsx"), "utf8")

    expect(appSource).toContain('const showEvidenceLitePanel = process.env.NODE_ENV !== "production"')
    expect(appSource).toContain("<EvidenceLitePanel")
  })
})
