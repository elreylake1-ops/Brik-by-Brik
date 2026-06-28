// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import path from "node:path"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
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

  it("keeps the production gate in the app source and only renders the panel in non-production", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/page.tsx"), "utf8")

    expect(appSource).toContain('const showEvidenceLitePanel = process.env.NODE_ENV !== "production"')
    expect(appSource).toContain("<EvidenceLitePanel")
  })
})
