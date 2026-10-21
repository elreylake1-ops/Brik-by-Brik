// @vitest-environment jsdom

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

import ViewingAssessmentPanel from "@/components/viewing-assessment/ViewingAssessmentPanel"
import type { FeedbackEntry, ProposalWithReview, StoredReview, ViewingAssessmentDetail } from "@/types/viewing-assessment"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Ids only: this file deliberately contains no third-party checklist wording.
const IDS = [...Array.from({ length: 45 }, (_, i) => `C${String(i + 1).padStart(2, "0")}`), ...Array.from({ length: 13 }, (_, i) => `V${String(i + 1).padStart(2, "0")}`)]
const CHECKS = IDS.map((id) => ({ id }))

const assessment = { id: "asmt-1", dealId: "deal-1", checklistVersion: "viewing-checklist-v1", createdBy: "op", createdAt: "2026-10-20T10:00:00.000Z" }
const evidence = [
  { id: "frame-1", assetId: "asset-1", clipFilename: "mock-viewing-clip.mp4", timestampSeconds: 72, room: "Kitchen" },
  { id: "frame-2", assetId: "asset-1", clipFilename: "mock-viewing-clip.mp4", timestampSeconds: 12.5 },
]

let seq = 0
const review = (over: Partial<StoredReview> & { proposalId: string }): StoredReview => ({
  id: `r${++seq}`, revision: 1, disposition: "ACCEPTED", editedStatus: null, editedObservation: null, reason: null,
  reviewerId: "operator-1", reviewedAt: "2026-10-20T10:05:00.000Z", ...over,
})

function suggestion(checkId = "C08", status: "OBSERVED" | "CONCERN" | "SPECIALIST_REVIEW" = "CONCERN", reviews: Partial<StoredReview>[] = [], over: Record<string, unknown> = {}): ProposalWithReview {
  const id = `run-1:P${++seq}`
  const history = reviews.map((r, i) => review({ proposalId: id, revision: i + 1, ...r }))
  return {
    proposal: { id, assessmentId: "asmt-1", runId: "run-1", createdAt: "2026-10-20T10:01:00.000Z", checkId, status, observation: "Render appears cracked.", evidenceIds: ["frame-1", "frame-2"], confidence: "low", modelVersion: "fixture-frame-analysis-v1", verification: "UNVERIFIED", disposition: "PENDING", ...over },
    currentReview: history[history.length - 1] ?? null,
    reviewHistory: history,
  }
}

const detail = (proposals: ProposalWithReview[], over: Partial<ViewingAssessmentDetail> = {}, frames = 2): ViewingAssessmentDetail => ({
  assessment, assets: [], evidence: frames ? evidence : [], blobs: [], feedback: [], runs: [], proposals,
  summary: { analysisSource: "SIMULATED", proposalCount: proposals.length, awaitingReview: proposals.filter((p) => !p.currentReview).length, accepted: 0, edited: 0, rejected: 0, evidenceFrameCount: frames, checklistTotal: 58, checksWithoutReviewedFinding: 58, specialistChecks: 0, checksAwaitingReview: 0 },
  ...over,
})

let container: HTMLDivElement
let root: Root
const fetchMock = vi.fn()

const render = (ui: React.ReactElement) => act(() => root.render(ui))
const panel = (d: ViewingAssessmentDetail | null, extra: Partial<React.ComponentProps<typeof ViewingAssessmentPanel>> = {}) =>
  render(<ViewingAssessmentPanel dealId="deal-1" assessments={[assessment]} detail={d} checks={CHECKS} {...extra} />)
const q = <T extends Element>(sel: string) => container.querySelector(sel) as T | null
const qa = (sel: string) => [...container.querySelectorAll(sel)]
const row = (id: string) => q<HTMLDetailsElement>(`[data-check-id=${id}]`)!
const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(label)) as HTMLButtonElement
const click = async (el: Element) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })) }) }
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
async function open(id: string) {
  await act(async () => {
    row(id).open = true
    row(id).dispatchEvent(new Event("toggle"))
  })
}
async function setValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value)
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }))
  })
}
const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, body: JSON.parse(init.body as string) }
}

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 201 }))
  vi.stubGlobal("fetch", fetchMock)
  refresh.mockReset()
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe("the 58-check list", () => {
  it("lists every check, in order, each NOT ASSESSED by default", () => {
    panel(detail([]))
    const rows = qa("[data-testid=check-row]")
    expect(rows).toHaveLength(58)
    expect(rows.map((r) => r.getAttribute("data-check-id"))).toEqual(IDS)
    expect(rows.every((r) => r.getAttribute("data-state") === "NOT_ASSESSED")).toBe(true)
    expect(qa("[data-testid=check-state]").every((s) => s.textContent === "NOT ASSESSED")).toBe(true)
    expect(q("[data-testid=checklist-summary]")?.textContent).toContain("58 not assessed")
    expect(q("[data-testid=summary]")?.textContent).toContain("58 of 58")
  })

  it("shows an unreviewed AI suggestion beside its check WITHOUT changing the check's state", () => {
    panel(detail([suggestion("C08", "SPECIALIST_REVIEW")]))
    expect(row("C08").getAttribute("data-state")).toBe("NOT_ASSESSED")
    expect(row("C08").querySelector("[data-testid=check-pending]")?.textContent).toBe("AI suggestion awaiting review (1)")
    expect(q("[data-testid=checklist-summary]")?.textContent).toContain("1 with an AI suggestion awaiting review")
    expect(q("[data-testid=checklist-summary]")?.textContent).toContain("0 needing specialist inspection")
  })

  it("states a check only once a person has accepted or edited a suggestion, and labels each explicitly", () => {
    panel(detail([
      suggestion("C08", "CONCERN", [{ disposition: "ACCEPTED" }]),
      suggestion("C09", "OBSERVED", [{ disposition: "ACCEPTED" }]),
      suggestion("C10", "SPECIALIST_REVIEW", [{ disposition: "ACCEPTED" }]),
      suggestion("C11", "CONCERN", [{ disposition: "EDITED", editedStatus: "NOT_ACCESSIBLE", editedObservation: "Could not get to it." }]),
      suggestion("C12", "CONCERN", [{ disposition: "REJECTED", reason: "shadow" }]),
    ]))
    const label = (id: string) => row(id).querySelector("[data-testid=check-state]")?.textContent
    expect(label("C08")).toBe("CONCERN (reviewed)")
    expect(label("C09")).toBe("OBSERVED (reviewed): not a pass")
    expect(label("C10")).toBe("SPECIALIST INSPECTION RECOMMENDED")
    expect(label("C11")).toBe("NOT ACCESSIBLE")
    expect(label("C12")).toBe("NOT ASSESSED") // rejected: nothing changes
    expect(q("[data-testid=checklist-summary]")?.textContent).toContain("1 needing specialist inspection")
    expect(q("[data-testid=checklist]")?.textContent).not.toMatch(/\bPASS(ED)?\b|\bSAFE\b|\bCOMPLIANT\b|\bAPPROVED\b|\bCERTIFIED\b/)
  })

  it("filters the list for the review workflow", async () => {
    panel(detail([suggestion("C08"), suggestion("C09", "CONCERN", [{ disposition: "ACCEPTED" }]), suggestion("C10", "SPECIALIST_REVIEW", [{ disposition: "ACCEPTED" }])]))
    const filter = q<HTMLSelectElement>("[data-testid=checklist-filter]")!
    const ids = () => qa("[data-testid=check-row]").map((r) => r.getAttribute("data-check-id"))
    await setValue(filter, "needs_review")
    expect(ids()).toEqual(["C08"])
    await setValue(filter, "specialist")
    expect(ids()).toEqual(["C10"])
    await setValue(filter, "reviewed")
    expect(ids()).toEqual(["C09", "C10"])
    await setValue(filter, "not_assessed")
    expect(ids()).toHaveLength(56)
    await setValue(filter, "all")
    expect(ids()).toHaveLength(58)
  })

  it("explains that no suggestion is not a clean result", async () => {
    panel(detail([]))
    await open("C01")
    expect(row("C01").querySelector("[data-testid=check-empty]")?.textContent).toMatch(/stays NOT ASSESSED until a person assesses it; absence of a suggestion is not a clean result/)
  })

  it("loads rows lazily: suggestion cards (and their images) are not rendered until a row is opened", async () => {
    panel(detail([suggestion("C08")]))
    expect(qa("[data-testid=proposal]")).toHaveLength(0)
    await open("C08")
    expect(qa("[data-testid=proposal]")).toHaveLength(1)
  })
})

describe("checklist wording is withheld unless the server supplies it", () => {
  it("shows ids only by default, and titles and group headings only when provided", () => {
    panel(detail([]))
    expect(q("[data-testid=checklist]")?.textContent).not.toContain("Placeholder")
    panel(detail([]), { checks: [{ id: "C01", title: "Placeholder check title", group: "Placeholder group" }, { id: "C02", title: "Second placeholder", group: "Placeholder group" }] })
    expect(row("C01").textContent).toContain("C01 Placeholder check title")
    expect(qa("h4").map((h) => h.textContent)).toEqual(["Placeholder group"]) // one heading for consecutive checks in a group
  })

  it("no UI component imports the checklist module, so its wording cannot reach the client bundle by default", () => {
    const dir = path.resolve(__dirname, "../components/viewing-assessment")
    for (const file of readdirSync(dir)) expect(readFileSync(path.join(dir, file), "utf8"), file).not.toMatch(/checklist-v1/)
  })
})

describe("a suggestion, opened", () => {
  it("shows the original prediction, the cited frames with their ACTUAL recorded times, and the conditional next step", async () => {
    panel(detail([suggestion("C08", "CONCERN", [], { suggestedWork: "Have a surveyor inspect." })]))
    await open("C08")
    expect(q("[data-testid=original-prediction]")?.textContent).toContain("AI proposed (CONCERN, low confidence): Render appears cracked.")
    expect(q("[data-testid=suggested-work]")?.textContent).toContain("conditional, not a quote")
    const times = qa("[data-testid=frame-time]")
    expect(times.map((t) => t.textContent)).toEqual(["1:12 · Kitchen", "0:12"])
    expect(times[0].getAttribute("title")).toBe("72.00 s into mock-viewing-clip.mp4") // exact recorded time on hover
    expect(times[1].getAttribute("title")).toBe("12.50 s into mock-viewing-clip.mp4")
    expect(q("[data-testid=proposal]")?.textContent).toContain("UNVERIFIED AI DRAFT (simulated)")
  })

  it("flags a suggested specialist inspection explicitly", async () => {
    panel(detail([suggestion("C10", "SPECIALIST_REVIEW")]))
    await open("C10")
    expect(q("[data-testid=proposal]")?.textContent).toContain("Specialist inspection suggested")
  })

  it("states that accepting neither certifies condition nor changes Investor Shield or governance", async () => {
    panel(detail([suggestion()]))
    await open("C08")
    const notice = q("[data-testid=accept-notice]")?.textContent ?? ""
    expect(notice).toMatch(/does not certify the property's condition/)
    expect(notice).toMatch(/does not change any Investor Shield or governance decision/)
  })

  it("flags a citation of a frame that does not exist instead of hiding it", async () => {
    panel(detail([suggestion("C08", "CONCERN", [], { evidenceIds: ["frame-1", "ghost"] })]))
    await open("C08")
    expect(q("[data-testid=proposal-frames]")?.textContent).toContain("missing frame reference")
  })

  it("renders model text as text, never HTML", async () => {
    panel(detail([suggestion("C08", "CONCERN", [], { observation: "<img src=x onerror=alert(1)>" })]))
    await open("C08")
    expect(q("[data-testid=original-prediction]")?.textContent).toContain("<img src=x onerror=alert(1)>")
    expect(container.querySelector("img")).toBeNull()
  })
})

describe("frame thumbnails", () => {
  const imageUrl = "/api/saved-deals/deal-1/viewing-assessments/asmt-1/evidence/frame-1/image"
  beforeEach(() => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:test/1"), revokeObjectURL: vi.fn() }))
  })
  const withImages = (d: ViewingAssessmentDetail) => ({ ...d, blobs: [{ evidenceId: "frame-1", sha256: "a".repeat(64), sizeBytes: 10, mimeType: "image/jpeg" as const }] })

  it("loads a stored image with credentials, and shows it with its time", async () => {
    const fetchImpl = vi.fn(async () => new Response(new Blob(["x"], { type: "image/jpeg" }), { status: 200 }))
    panel(withImages(detail([suggestion()])), { fetchImpl: fetchImpl as unknown as typeof fetch, headers: () => ({ authorization: "Bearer t" }) })
    await open("C08")
    await flush(); await flush()
    expect(fetchImpl).toHaveBeenCalledWith(imageUrl, expect.objectContaining({ credentials: "same-origin", headers: { authorization: "Bearer t" } }))
    expect(q("[data-testid=frame-thumb] img")?.getAttribute("src")).toBe("blob:test/1")
    expect(q("[data-testid=frame-thumb] img")?.getAttribute("alt")).toBe("Frame at 1:12 · Kitchen")
  })

  it("says so plainly when the image needs a sign-in, and still shows the time (no public fallback)", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "AUTHENTICATION_REQUIRED" }), { status: 401 }))
    panel(withImages(detail([suggestion()])), { fetchImpl: fetchImpl as unknown as typeof fetch })
    await open("C08")
    await flush(); await flush()
    expect(q("[data-testid=frame-pending]")?.textContent).toBe("sign in to view the image")
    expect(q("[data-testid=frame-time]")?.textContent).toBe("1:12 · Kitchen")
    expect(container.querySelector("img")).toBeNull()
  })

  it("reports a purged or missing image, and a frame that never had one", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 410 }))
    panel(withImages(detail([suggestion()])), { fetchImpl: fetchImpl as unknown as typeof fetch })
    await open("C08")
    await flush(); await flush()
    expect(q("[data-testid=frame-pending]")?.textContent).toBe("image no longer stored")
    expect(qa("[data-testid=frame-no-image]")).toHaveLength(1) // frame-2 was metadata only
    expect(fetchImpl).toHaveBeenCalledTimes(1) // no request for a frame without an image
  })
})

describe("human review", () => {
  it("accepts with the current revision and never sends reviewer identity or time", async () => {
    panel(detail([suggestion()]))
    await open("C08")
    await click(button("Accept"))
    const { url, body } = lastCall()
    expect(url).toMatch(/\/proposals\/run-1%3AP\d+\/review$/)
    expect(body).toEqual({ expectedRevision: 0, disposition: "ACCEPTED" })
    expect(refresh).toHaveBeenCalled()
  })

  it("edits with a chosen status, including specialist inspection and not accessible", async () => {
    panel(detail([suggestion()]))
    await open("C08")
    await click(button("Edit"))
    const select = q<HTMLSelectElement>("[data-testid=proposal-form] select")!
    expect([...select.options].map((o) => o.value)).toEqual(["NOT_ASSESSED", "OBSERVED", "CONCERN", "SPECIALIST_REVIEW", "NOT_ACCESSIBLE", "NOT_APPLICABLE"])
    await setValue(select, "SPECIALIST_REVIEW")
    await setValue(q<HTMLTextAreaElement>("[data-testid=proposal-form] textarea")!, "Needs a structural engineer.")
    await act(async () => { q("[data-testid=proposal-form]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    expect(lastCall().body).toEqual({ expectedRevision: 0, disposition: "EDITED", status: "SPECIALIST_REVIEW", observation: "Needs a structural engineer." })
  })

  it("rejects with a reason", async () => {
    panel(detail([suggestion()]))
    await open("C08")
    await click(button("Reject"))
    await setValue(q<HTMLTextAreaElement>("[data-testid=proposal-form] textarea")!, "That is a shadow.")
    await act(async () => { q("[data-testid=proposal-form]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    expect(lastCall().body).toEqual({ expectedRevision: 0, disposition: "REJECTED", reason: "That is a shadow." })
  })

  it("keeps the original AI prediction, the reviewer's correction, and the revision history separate", async () => {
    panel(detail([suggestion("C08", "CONCERN", [
      { disposition: "EDITED", editedStatus: "SPECIALIST_REVIEW", editedObservation: "Structural crack." },
      { disposition: "REJECTED", reason: "On reflection it is a shadow." },
    ])]))
    await open("C08")
    expect(q("[data-testid=original-prediction]")?.textContent).toContain("Render appears cracked.") // untouched by either review
    const history = q("[data-testid=review-history]")!.textContent ?? ""
    expect(history).toContain("Rev 1: EDITED by operator-1")
    expect(history).toContain("SPECIALIST REVIEW: Structural crack.")
    expect(history).toContain("Rev 2: REJECTED by operator-1")
    expect(history).toContain("On reflection it is a shadow.")
    expect(q("[data-testid=proposal]")?.textContent).toContain("UNVERIFIED AI DRAFT") // still unverified after any review
  })

  it("sends the next revision number when re-reviewing", async () => {
    panel(detail([suggestion("C08", "CONCERN", [{ disposition: "ACCEPTED" }])]))
    await open("C08")
    await click(button("Reject"))
    await setValue(q<HTMLTextAreaElement>("[data-testid=proposal-form] textarea")!, "Changed my mind.")
    await act(async () => { q("[data-testid=proposal-form]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    expect(lastCall().body.expectedRevision).toBe(1)
  })

  it("surfaces API errors without refreshing", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, error: "STALE_REVISION" }), { status: 409 }))
    panel(detail([suggestion()]))
    await open("C08")
    await click(button("Accept"))
    expect(q("[role=alert]")?.textContent).toBe("STALE_REVISION")
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe("recording what actually turned out", () => {
  it("posts a structured outcome, with no identity, time or financial field", async () => {
    panel(detail([suggestion()]))
    await open("C08")
    await click(button("Record what actually turned out"))
    const selects = qa("[data-testid=proposal-form] select") as HTMLSelectElement[]
    await setValue(selects[0], "NOT_CONFIRMED")
    await setValue(selects[1], "WORKS_COMPLETED")
    await setValue(selects[2], "OBSERVED")
    await setValue(q<HTMLTextAreaElement>("[data-testid=proposal-form] textarea")!, "Opened up during works: no defect.")
    await act(async () => { q("[data-testid=proposal-form]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
    const { url, body } = lastCall()
    expect(url).toMatch(/\/proposals\/run-1%3AP\d+\/outcome$/)
    expect(body).toEqual({ result: "NOT_CONFIRMED", source: "WORKS_COMPLETED", observedStatus: "OBSERVED", note: "Opened up during works: no defect." })
  })

  it("shows recorded outcomes beneath the suggestion they relate to", async () => {
    const p = suggestion()
    const entry: FeedbackEntry = {
      id: "fb-1", kind: "ACTUAL_OUTCOME", proposalId: p.proposal.id, assessmentId: "asmt-1", checkId: "C08", modelVersion: "m",
      original: { status: "CONCERN", observation: "Render appears cracked.", confidence: "low" }, disposition: null, humanCorrection: null,
      reviewerId: "operator-1", reviewedAt: "2026-10-21T09:00:00.000Z",
      actualOutcome: { recordedAt: "2026-10-21T09:00:00.000Z", result: "CONFIRMED", source: "SURVEY", observedStatus: "SPECIALIST_REVIEW", note: "Surveyor confirmed movement." },
    }
    panel(detail([p], { feedback: [entry] }))
    await open("C08")
    expect(q("[data-testid=outcome-history]")?.textContent).toContain("Actual outcome: CONFIRMED (SURVEY; found: SPECIALIST REVIEW)")
    expect(q("[data-testid=outcome-history]")?.textContent).toContain("Surveyor confirmed movement.")
  })
})

describe("assessment-level behaviour", () => {
  it("labels simulated analysis honestly, and a live provider as live", async () => {
    panel(detail([suggestion()]))
    expect(q("[data-testid=mock-banner]")?.textContent).toMatch(/not real AI video analysis/i)
    const run = (provider: "fixture" | "claude") => ({ id: "run-1", assessmentId: "asmt-1", provider, modelVersion: "m-1", status: "READY_FOR_REVIEW" as const, attemptCount: 1, proposalsCount: 1, rejectedCount: 0, errorCode: null, createdAt: "t", updatedAt: "t" })
    panel(detail([suggestion()], { runs: [run("claude")] }))
    expect(q("[data-testid=runs]")?.textContent).toContain("live provider")
    await open("C08")
    expect(q("[data-testid=proposal]")?.textContent).not.toContain("(simulated)")
    panel(detail([suggestion()], { runs: [run("fixture")] }))
    expect(q("[data-testid=runs]")?.textContent).toContain("simulated")
  })

  it("shows the analysis source from the summary", () => {
    panel(detail([], { summary: { ...detail([]).summary, analysisSource: "NONE" } }))
    expect(q("[data-testid=summary]")?.textContent).toContain("NONE")
  })

  it("offers to create an assessment when none exists, using a client idempotency key only", async () => {
    panel(null, { assessments: [] })
    await click(button("Create viewing assessment"))
    const { url, body } = lastCall()
    expect(url).toBe("/api/saved-deals/deal-1/viewing-assessments")
    expect(Object.keys(body)).toEqual(["idempotencyKey"])
  })

  it("explains missing evidence and offers video capture inside the assessment", () => {
    panel(detail([], {}, 0))
    expect(container.textContent).toMatch(/No evidence registered/)
    expect(button("Run analysis").disabled).toBe(true)
    expect(q("[data-testid=video-capture]")).not.toBeNull()
  })

  it("says which evidence frames have a stored image and which are metadata only", () => {
    panel(detail([], { blobs: [{ evidenceId: "frame-1", sha256: "a".repeat(64), sizeBytes: 100, mimeType: "image/jpeg" }] }))
    expect(q("[data-testid=evidence-list]")?.textContent).toContain("1 with a stored image")
    expect(q("[data-testid=evidence-list]")?.textContent).toContain("image stored privately")
    expect(q("[data-testid=evidence-list]")?.textContent).toContain("no image (metadata only)")
  })

  it("shows a failed run's reason code, and why analysis is unavailable, without values", async () => {
    const failed = { id: "run-1", assessmentId: "asmt-1", provider: "claude" as const, modelVersion: "m-1", status: "FAILED" as const, attemptCount: 1, proposalsCount: 0, rejectedCount: 0, errorCode: "PROVIDER_REFUSAL", createdAt: "t", updatedAt: "t" }
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, error: "AI_UNAVAILABLE", reasons: ["VIEWING_AI_ENABLED is not true"] }), { status: 503 }))
    panel(detail([], { runs: [failed] }))
    expect(q("[data-testid=runs]")?.textContent).toContain("FAILED (PROVIDER_REFUSAL)")
    await click(button("Run analysis"))
    expect(q("[role=alert]")?.textContent).toBe("AI_UNAVAILABLE: VIEWING_AI_ENABLED is not true")
  })
})
