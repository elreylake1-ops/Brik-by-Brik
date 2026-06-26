import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import EvidenceLitePanel, {
  loadEvidenceLiteRecords,
  submitEvidenceLiteRecord,
} from "@/components/evidence-lite/EvidenceLitePanel"

function makeJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  })
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

  it("returns a safe helper error for failed loads", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeJsonResponse(
        {
          success: false,
          error: "Saved deal not found.",
        },
        { status: 404 }
      )
    )

    await expect(loadEvidenceLiteRecords("deal-1", fetchMock as typeof fetch)).rejects.toThrow(
      "Saved deal not found."
    )
  })

  it("keeps the production gate in the app source and only renders the panel in non-production", () => {
    const appSource = readFileSync(path.resolve(process.cwd(), "app/page.tsx"), "utf8")

    expect(appSource).toContain("const showEvidenceLitePanel = process.env.NODE_ENV !== \"production\"")
    expect(appSource).toContain("<EvidenceLitePanel")
  })
})
