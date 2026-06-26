// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import path from "node:path"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import EvidenceLitePanel, {
  loadEvidenceLiteRecords,
  submitEvidenceLiteRecord,
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
    mountedRoot?.render(
      <EvidenceLitePanel savedDealId={props.savedDealId} dealAddress={props.dealAddress} />
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  await flushEffects()
  return mountedContainer
}

function getRecordArticles(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll("article"))
}

function getRecordArticleByTitle(container: HTMLElement, title: string): HTMLElement {
  const article = getRecordArticles(container).find((candidate) =>
    (candidate.textContent ?? "").includes(title)
  )

  if (!article) {
    throw new Error(`record article not found for title: ${title}`)
  }

  return article
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

function getEditForm(article: HTMLElement): HTMLFormElement {
  const form = article.querySelector("form")
  if (!form) {
    throw new Error("edit form not found")
  }

  return form as HTMLFormElement
}

describe("EvidenceLitePanel", () => {
  it("renders the local-only review surface and keeps forbidden alias values out of the UI", () => {
    const html = renderToStaticMarkup(
      <EvidenceLitePanel savedDealId="deal-1" dealAddress="10 Brik Street" />
    )

    expect(html).toContain("Evidence Lite")
    expect(html).toContain("Development-only review panel")
    expect(html).toContain(
      "Evidence supports review only. Adding evidence does not satisfy or waive an Investor Shield gate."
    )
    expect(html).toContain("Record a note")
    expect(html).toContain("Recorded evidence")
    expect(html).toContain("Loading Evidence Lite notes...")
    expect(html).toContain("Saved deal: 10 Brik Street")
    expect(html).toContain("Record Evidence")
    expect(html).toContain("Sold comparables")
    expect(html).toContain("Planning / building control")
    expect(html).toContain("Builder proposal / contract")
    expect(html).not.toContain("SOLICITOR_FEEDBACK")
    expect(html).not.toContain("GENERAL")
    expect(html).not.toContain("Investor Shield gate satisfaction")
  })

  it("loads evidence for the requested saved deal through the route helper", async () => {
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

  it("submits canonical evidence through the local route helper", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          evidence: {
            id: "evidence-2",
            dealId: "deal-1",
            evidenceType: "TITLE_REVIEW",
            linkedGate: "SOLICITOR_REVIEW",
            title: "Title pack",
            note: "Checked locally",
            status: "RECORDED",
            reviewed: true,
            createdAt: "2026-06-26T00:00:00.000Z",
            updatedAt: "2026-06-26T00:00:00.000Z",
          },
        })
      )

    const evidence = await submitEvidenceLiteRecord(
      "deal-1",
      {
        evidenceType: "TITLE_REVIEW",
        linkedGate: "SOLICITOR_REVIEW",
        title: "Title pack",
        note: "Checked locally",
        status: "RECORDED",
        reviewed: true,
      },
      fetchMock as typeof fetch
    )

    expect(fetchMock).toHaveBeenCalledWith("/api/saved-deals/deal-1/evidence", {
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
        status: "RECORDED",
        reviewed: true,
      }),
    })
    expect(evidence).toEqual({
      id: "evidence-2",
      dealId: "deal-1",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      title: "Title pack",
      note: "Checked locally",
      status: "RECORDED",
      reviewed: true,
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z",
    })
  })

  it("lets reviewers edit a record inline and sends only the changed fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          evidence: [
            makeEvidenceRecord({
              id: "evidence-1",
              title: "Title pack",
              note: "Reviewed locally",
              reviewed: false,
            }),
            makeEvidenceRecord({
              id: "evidence-2",
              title: "Secondary diligence",
              note: "Secondary record",
              linkedGate: "LEASEHOLD",
              evidenceType: "LEASEHOLD_REVIEW",
              reviewed: true,
            }),
          ],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          evidence: {
            ...makeEvidenceRecord({
              id: "evidence-1",
              title: "Updated title",
              note: "Updated note",
              reviewed: true,
            }),
          },
        })
      )

    const container = await renderPanel(fetchMock)
    const firstArticle = getRecordArticleByTitle(container, "Title pack")
    await clickElement(getButtonByText(firstArticle, "Edit"))
    await flushEffects()

    const editForm = getEditForm(firstArticle)
    const editSelects = Array.from(editForm.querySelectorAll("select"))
    const optionsText = Array.from(editForm.querySelectorAll("option"))
      .map((option) => option.textContent ?? "")
      .join(" ")

    expect(editSelects).toHaveLength(2)
    expect(optionsText).toContain("Solicitor review")
    expect(optionsText).not.toContain("SOLICITOR_FEEDBACK")
    expect(optionsText).not.toContain("GENERAL")
    expect(optionsText).not.toContain("RECEIVED")

    await setFieldValue(getControlByLabel(editForm, "Title"), "Updated title")
    await setFieldValue(getControlByLabel(editForm, "Note"), "Updated note")
    await setCheckboxValue(getControlByLabel(editForm, "Mark as reviewed") as HTMLInputElement, true)
    await clickElement(getButtonByText(editForm, "Save"))
    await flushEffects()

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/saved-deals/deal-1/evidence/evidence-1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        title: "Updated title",
        note: "Updated note",
        reviewed: true,
      }),
    })

    const articles = getRecordArticles(container)
    expect(articles).toHaveLength(2)
    expect(articles[0].textContent).toContain("Updated title")
    expect(articles[0].textContent).toContain("Updated note")
    expect(articles[0].textContent).toContain("Reviewed: Yes")
    expect(articles[1].textContent).toContain("Secondary diligence")
    expect(articles[1].textContent).not.toContain("Updated title")
    expect(container.textContent).toContain("Evidence note updated for local review only.")
  })

  it("saves a no-op edit without calling PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        evidence: [makeEvidenceRecord()],
      })
    )

    const container = await renderPanel(fetchMock)
    const article = getRecordArticleByTitle(container, "Title pack")

    await clickElement(getButtonByText(article, "Edit"))
    await flushEffects()
    await clickElement(getButtonByText(getEditForm(article), "Save"))
    await flushEffects()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain("No changes to save.")
    expect(container.textContent).not.toContain("Editing evidence note")
  })

  it("cancels inline editing without sending PATCH and restores canonical values", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        evidence: [makeEvidenceRecord()],
      })
    )

    const container = await renderPanel(fetchMock)
    const article = getRecordArticleByTitle(container, "Title pack")

    await clickElement(getButtonByText(article, "Edit"))
    await flushEffects()

    const editForm = getEditForm(article)
    await setFieldValue(getControlByLabel(editForm, "Title"), "Temporary title")
    await setFieldValue(getControlByLabel(editForm, "Note"), "Temporary note")
    await clickElement(getButtonByText(editForm, "Cancel"))
    await flushEffects()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(container.textContent).not.toContain("Temporary title")
    expect(container.textContent).not.toContain("Temporary note")

    await clickElement(getButtonByText(article, "Edit"))
    await flushEffects()

    const reopenedForm = getEditForm(article)
    expect((getControlByLabel(reopenedForm, "Title") as HTMLInputElement).value).toBe("Title pack")
    expect((getControlByLabel(reopenedForm, "Note") as HTMLTextAreaElement).value).toBe(
      "Reviewed locally"
    )
  })

  it("keeps inline edit values after a failed PATCH response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          evidence: [makeEvidenceRecord()],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse(
          {
            success: false,
            error: "Update failed.",
          },
          { status: 400 }
        )
      )

    const container = await renderPanel(fetchMock)
    const article = getRecordArticleByTitle(container, "Title pack")

    await clickElement(getButtonByText(article, "Edit"))
    await flushEffects()

    const editForm = getEditForm(article)
    await setFieldValue(getControlByLabel(editForm, "Title"), "Broken title")
    await clickElement(getButtonByText(editForm, "Save"))
    await flushEffects()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain("Update failed.")
    expect((getControlByLabel(editForm, "Title") as HTMLInputElement).value).toBe("Broken title")
    expect(container.textContent).toContain("Editing evidence note")
  })

  it("keeps the production gate in the app source and only renders the panel in non-production", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/page.tsx"), "utf8")

    expect(appSource).toContain("const showEvidenceLitePanel = process.env.NODE_ENV !== \"production\"")
    expect(appSource).toContain("<EvidenceLitePanel")
  })
})
