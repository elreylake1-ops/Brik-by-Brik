// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import EvidenceLitePanel from "@/components/evidence-lite/EvidenceLitePanel"
import type {
  EvidenceCommandBlockerImpact,
  EvidenceCommandProfessionalGate,
  EvidenceCommandReviewState,
  EvidenceCommandStatus,
  EvidenceCommandStrength,
  EvidenceCommandType,
  EvidenceLiteRecord,
} from "@/types/evidence-lite"
import type { InvestorShieldGateKey } from "@/types/investor-shield"

type EvidenceLitePanelRecord = EvidenceLiteRecord & {
  linkedInvestorShieldGate?: InvestorShieldGateKey | null
  linkedProfessionalGate?: EvidenceCommandProfessionalGate | null
  evidenceCommandType?: EvidenceCommandType | null
  evidenceSummary?: string | null
  evidenceStatus?: EvidenceCommandStatus | null
  evidenceStrength?: EvidenceCommandStrength | null
  reviewState?: EvidenceCommandReviewState | null
  blockerImpact?: EvidenceCommandBlockerImpact | null
  recommendedNextAction?: string | null
  expiryOrUpdateDate?: string | null
  source?: string | null
  mobileCaptureNote?: string | null
}

function makeJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  })
}

function makeEvidenceRecord(overrides: Partial<EvidenceLitePanelRecord> = {}): EvidenceLitePanelRecord {
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
    linkedInvestorShieldGate: "TITLE",
    linkedProfessionalGate: "NONE",
    evidenceCommandType: "TITLE_LEGAL",
    evidenceSummary: "Reviewed locally",
    evidenceStatus: "RECEIVED",
    evidenceStrength: "MODERATE",
    reviewState: "REVIEWED_BY_OPERATOR",
    blockerImpact: "DOES_NOT_BLOCK",
    recommendedNextAction: null,
    expiryOrUpdateDate: null,
    source: null,
    mobileCaptureNote: null,
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
  props: { savedDealId: string; dealAddress?: string } = {
    savedDealId: "deal-1",
    dealAddress: "10 Brik Street",
  }
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

function getRequestPath(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return new URL(input, "http://localhost").pathname
  }

  if (input instanceof URL) {
    return input.pathname
  }

  return new URL(input.url).pathname
}

function getRecordArticles(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll("article"))
}

function setNativeValue(
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
): void {
  const prototype = Object.getPrototypeOf(control) as {
    value?: string
  }
  const descriptor =
    Object.getOwnPropertyDescriptor(prototype, "value") ??
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value") ??
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value") ??
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")

  descriptor?.set?.call(control, value)
}

async function setTextControl(
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string
): Promise<void> {
  await act(async () => {
    setNativeValue(control, value)
    control.dispatchEvent(new Event("input", { bubbles: true }))
    control.dispatchEvent(new Event("change", { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function setSelectControl(control: HTMLSelectElement, value: string): Promise<void> {
  await act(async () => {
    setNativeValue(control, value)
    control.dispatchEvent(new Event("change", { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function submitForm(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function getFieldControl<T extends Element>(container: HTMLElement, testId: string): T {
  const element = container.querySelector(`[data-testid="${testId}"]`)
  if (!element) {
    throw new Error(`Missing test id: ${testId}`)
  }

  return element as T
}

function getButtonNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("button"))
    .map((button) => button.textContent?.trim() ?? "")
    .filter((value) => value.length > 0)
}

async function waitForText(container: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (container.textContent?.includes(text)) {
      return
    }

    await flushEffects()
  }

  throw new Error(`text not found: ${text}`)
}

describe("EvidenceLitePanel", () => {
  it("renders the stacked capture form with stable test ids and no prohibited controls", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        evidence: [],
      })
    )

    const container = await renderPanel(fetchMock)

    await waitForText(container, "No evidence captured yet.")

    expect(container.textContent).toContain("Evidence Command")
    expect(container.textContent).toContain(
      "Evidence supports review but does not automatically satisfy Investor Shield hard gates, waive requirements, approve progression, or replace professional confirmation."
    )
    expect(container.textContent).toContain("Capture evidence")
    expect(container.textContent).toContain("Photo evidence")
    expect(container.textContent).toContain("Video evidence")

    const fieldTestIds = Array.from(container.querySelectorAll('[data-testid^="evidence-field-"]'))
      .map((element) => element.getAttribute("data-testid") ?? "")
      .filter((value) => !value.endsWith("-control"))

    expect(fieldTestIds).toEqual([
      "evidence-field-evidence-type",
      "evidence-field-linked-investor-shield-gate",
      "evidence-field-linked-professional-gate",
      "evidence-field-title",
      "evidence-field-evidence-summary",
      "evidence-field-evidence-status",
      "evidence-field-evidence-strength",
      "evidence-field-review-state",
      "evidence-field-blocker-impact",
      "evidence-field-recommended-next-action",
      "evidence-field-expiry-update-date",
      "evidence-field-source",
      "evidence-field-mobile-capture-note",
    ])

    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(getButtonNames(container)).toEqual(["Save evidence"])
    expect(container.querySelector('option[value="PHOTO_EVIDENCE"]')).not.toBeNull()
    expect(container.querySelector('option[value="VIDEO_EVIDENCE"]')).not.toBeNull()
  })

  it("renders structured evidence records with blocker, caution, and manual-review visibility", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        evidence: [
          makeEvidenceRecord({
            id: "evidence-blocking",
            title: "Title pack",
            evidenceType: "TITLE_REVIEW",
            evidenceCommandType: "TITLE_LEGAL",
            linkedGate: "TITLE",
            linkedInvestorShieldGate: "TITLE",
            linkedProfessionalGate: "SURVEYOR_REPORT",
            evidenceStatus: "INSUFFICIENT",
            evidenceStrength: "WEAK",
            reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
            blockerImpact: "BLOCKS_PROGRESSION",
            evidenceSummary: "Title paperwork is still missing the signed transfer.",
            recommendedNextAction: "Request the signed transfer from the solicitor.",
            expiryOrUpdateDate: "2026-07-15",
            source: "Solicitor email",
            mobileCaptureNote: "Captured during the evening review.",
          }),
          makeEvidenceRecord({
            id: "evidence-caution",
            title: "Roof photo",
            evidenceType: "OTHER",
            evidenceCommandType: "PHOTO_EVIDENCE",
            linkedGate: "DAMP_STRUCTURAL",
            linkedInvestorShieldGate: "DAMP_STRUCTURAL",
            linkedProfessionalGate: "NONE",
            evidenceStatus: "RECEIVED",
            evidenceStrength: "MODERATE",
            reviewState: "REVIEWED_BY_OPERATOR",
            blockerImpact: "CAUTION_ONLY",
            evidenceSummary: "Photo shows a slipped slate near the ridge line.",
            recommendedNextAction: "Ask the surveyor to confirm the roof condition.",
            source: "Site visit",
            mobileCaptureNote: "Taken on the street side of the property.",
          }),
          makeEvidenceRecord({
            id: "evidence-manual-review",
            title: "Walkthrough video",
            evidenceType: "OTHER",
            evidenceCommandType: "VIDEO_EVIDENCE",
            linkedGate: "PLANNING_BUILDING_CONTROL",
            linkedInvestorShieldGate: "PLANNING_BUILDING_CONTROL",
            linkedProfessionalGate: "SPECIALIST_REPORT",
            evidenceStatus: "SUFFICIENT",
            evidenceStrength: "STRONG",
            reviewState: "PROFESSIONAL_CONFIRMED",
            blockerImpact: "REQUIRES_MANUAL_REVIEW",
            evidenceSummary: "Video captures the rear extension and remaining finish work.",
            recommendedNextAction: "Review with the professional before progression.",
            source: "Mobile walkthrough",
            mobileCaptureNote: "Shot while moving between rooms.",
          }),
        ],
      })
    )

    const container = await renderPanel(fetchMock)
    await waitForText(container, "Title pack")

    const articles = getRecordArticles(container)
    expect(articles).toHaveLength(3)

    expect(articles[0].textContent).toContain("Title pack")
    expect(articles[0].textContent).toContain("Evidence type")
    expect(articles[0].textContent).toContain("Title / legal")
    expect(articles[0].textContent).toContain("Linked Investor Shield gate")
    expect(articles[0].textContent).toContain("Title")
    expect(articles[0].textContent).toContain("Professional gate")
    expect(articles[0].textContent).toContain("Surveyor report")
    expect(articles[0].textContent).toContain("Status")
    expect(articles[0].textContent).toContain("Insufficient")
    expect(articles[0].textContent).toContain("Strength")
    expect(articles[0].textContent).toContain("Weak")
    expect(articles[0].textContent).toContain("Review state")
    expect(articles[0].textContent).toContain("Professional review required")
    expect(articles[0].textContent).toContain("Blocker impact")
    expect(articles[0].textContent).toContain("Blocks progression")
    expect(articles[0].textContent).toContain("Evidence summary")
    expect(articles[0].textContent).toContain("Title paperwork is still missing the signed transfer.")
    expect(articles[0].textContent).toContain("Recommended next action")
    expect(articles[0].textContent).toContain("Request the signed transfer from the solicitor.")
    expect(articles[0].textContent).toContain("Expiry / update date")
    expect(articles[0].textContent).toContain("2026-07-15")
    expect(articles[0].textContent).toContain("Source")
    expect(articles[0].textContent).toContain("Solicitor email")
    expect(articles[0].textContent).toContain("Mobile capture note")
    expect(articles[0].textContent).toContain("Captured during the evening review.")

    expect(articles[1].textContent).toContain("Roof photo")
    expect(articles[1].textContent).toContain("Photo evidence")
    expect(articles[1].textContent).toContain("Damp / structural")
    expect(articles[1].textContent).toContain("None")
    expect(articles[1].textContent).toContain("Received")
    expect(articles[1].textContent).toContain("Moderate")
    expect(articles[1].textContent).toContain("Reviewed by operator")
    expect(articles[1].textContent).toContain("Caution only")
    expect(articles[1].textContent).toContain("Photo shows a slipped slate near the ridge line.")
    expect(articles[1].textContent).toContain("Ask the surveyor to confirm the roof condition.")
    expect(articles[1].textContent).toContain("Site visit")
    expect(articles[1].textContent).toContain("Taken on the street side of the property.")

    expect(articles[2].textContent).toContain("Walkthrough video")
    expect(articles[2].textContent).toContain("Video evidence")
    expect(articles[2].textContent).toContain("Planning / building control")
    expect(articles[2].textContent).toContain("Specialist report")
    expect(articles[2].textContent).toContain("Sufficient")
    expect(articles[2].textContent).toContain("Strong")
    expect(articles[2].textContent).toContain("Professional confirmed")
    expect(articles[2].textContent).toContain("Requires manual review")
    expect(articles[2].textContent).toContain("Video captures the rear extension and remaining finish work.")
    expect(articles[2].textContent).toContain("Review with the professional before progression.")
    expect(articles[2].textContent).toContain("Mobile walkthrough")
    expect(articles[2].textContent).toContain("Shot while moving between rooms.")
  })

  it("submits structured evidence through the mocked API path and prepends the created record", async () => {
    const requests: Array<{ method: string; path: string; body?: string }> = []

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET"
      const path = getRequestPath(input)
      const body = typeof init?.body === "string" ? init.body : undefined
      requests.push({ method, path, body })

      if (method === "GET" && path === "/api/saved-deals/deal-1/evidence") {
        return makeJsonResponse({
          success: true,
          evidence: [],
        })
      }

      if (method === "POST" && path === "/api/saved-deals/deal-1/evidence") {
        const parsed = body ? (JSON.parse(body) as Record<string, unknown>) : {}

        expect(parsed.dealId).toBeUndefined()
        expect(parsed.evidenceType).toBe("PHOTO_EVIDENCE")
        expect(parsed.linkedInvestorShieldGate).toBe("DAMP_STRUCTURAL")
        expect(parsed.linkedProfessionalGate).toBe("SPECIALIST_REPORT")
        expect(parsed.title).toBe("Mobile roof photo")
        expect(parsed.evidenceSummary).toBe(
          "Photo captured on site showing slipped slate near the ridge."
        )
        expect(parsed.evidenceStatus).toBe("RECEIVED")
        expect(parsed.evidenceStrength).toBe("MODERATE")
        expect(parsed.reviewState).toBe("PROFESSIONAL_REVIEW_REQUIRED")
        expect(parsed.blockerImpact).toBe("CAUTION_ONLY")
        expect(parsed.recommendedNextAction).toBe("Ask the surveyor to confirm the roof condition.")
        expect(parsed.expiryOrUpdateDate).toBe("2026-07-07")
        expect(parsed.source).toBe("Site visit")
        expect(parsed.mobileCaptureNote).toBe("Taken on the street-side approach.")

        return makeJsonResponse({
          success: true,
          evidence: makeEvidenceRecord({
            id: "evidence-created",
            title: "Mobile roof photo",
            evidenceType: "OTHER",
            evidenceCommandType: "PHOTO_EVIDENCE",
            linkedGate: "DAMP_STRUCTURAL",
            linkedInvestorShieldGate: "DAMP_STRUCTURAL",
            linkedProfessionalGate: "SPECIALIST_REPORT",
            evidenceStatus: "RECEIVED",
            evidenceStrength: "MODERATE",
            reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
            blockerImpact: "CAUTION_ONLY",
            evidenceSummary: "Photo captured on site showing slipped slate near the ridge.",
            recommendedNextAction: "Ask the surveyor to confirm the roof condition.",
            expiryOrUpdateDate: "2026-07-07",
            source: "Site visit",
            mobileCaptureNote: "Taken on the street-side approach.",
            reviewed: false,
            createdAt: "2026-07-07T09:00:00.000Z",
            updatedAt: "2026-07-07T09:00:00.000Z",
          }),
        })
      }

      throw new Error(`unexpected request: ${method} ${path}`)
    })

    const container = await renderPanel(fetchMock)
    await waitForText(container, "No evidence captured yet.")

    await setSelectControl(
      getFieldControl<HTMLSelectElement>(container, "evidence-field-evidence-type-control"),
      "PHOTO_EVIDENCE"
    )
    await setSelectControl(
      getFieldControl<HTMLSelectElement>(
        container,
        "evidence-field-linked-investor-shield-gate-control"
      ),
      "DAMP_STRUCTURAL"
    )
    await setSelectControl(
      getFieldControl<HTMLSelectElement>(container, "evidence-field-linked-professional-gate-control"),
      "SPECIALIST_REPORT"
    )
    await setTextControl(
      getFieldControl<HTMLInputElement>(container, "evidence-field-title-control"),
      "Mobile roof photo"
    )
    await setTextControl(
      getFieldControl<HTMLTextAreaElement>(container, "evidence-field-evidence-summary-control"),
      "Photo captured on site showing slipped slate near the ridge."
    )
    await setSelectControl(
      getFieldControl<HTMLSelectElement>(container, "evidence-field-evidence-status-control"),
      "RECEIVED"
    )
    await setSelectControl(
      getFieldControl<HTMLSelectElement>(container, "evidence-field-evidence-strength-control"),
      "MODERATE"
    )
    await setSelectControl(
      getFieldControl<HTMLSelectElement>(container, "evidence-field-review-state-control"),
      "PROFESSIONAL_REVIEW_REQUIRED"
    )
    await setSelectControl(
      getFieldControl<HTMLSelectElement>(container, "evidence-field-blocker-impact-control"),
      "CAUTION_ONLY"
    )
    await setTextControl(
      getFieldControl<HTMLInputElement>(container, "evidence-field-recommended-next-action-control"),
      "Ask the surveyor to confirm the roof condition."
    )
    await setTextControl(
      getFieldControl<HTMLInputElement>(container, "evidence-field-expiry-update-date-control"),
      "2026-07-07"
    )
    await setTextControl(
      getFieldControl<HTMLInputElement>(container, "evidence-field-source-control"),
      "Site visit"
    )
    await setTextControl(
      getFieldControl<HTMLTextAreaElement>(container, "evidence-field-mobile-capture-note-control"),
      "Taken on the street-side approach."
    )

    await submitForm(getFieldControl<HTMLFormElement>(container, "evidence-command-form"))

    await waitForText(container, "Evidence Command saved and added to the panel.")
    await waitForText(container, "Mobile roof photo")

    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      "GET /api/saved-deals/deal-1/evidence",
      "POST /api/saved-deals/deal-1/evidence",
    ])

    expect(container.textContent).toContain("Mobile roof photo")
    expect(container.textContent).toContain("Photo evidence")
    expect(container.textContent).toContain("Damp / structural")
    expect(container.textContent).toContain("Specialist report")
    expect(container.textContent).toContain("Received")
    expect(container.textContent).toContain("Moderate")
    expect(container.textContent).toContain("Professional review required")
    expect(container.textContent).toContain("Caution only")
    expect(container.textContent).toContain("Ask the surveyor to confirm the roof condition.")
    expect(container.textContent).toContain("2026-07-07")
    expect(container.textContent).toContain("Site visit")
    expect(container.textContent).toContain("Taken on the street-side approach.")
  })
})
