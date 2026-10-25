import { describe, expect, it } from "vitest"
import { calculateFinancialProposalWaitBudget, financialProposalFailureCategory, runFinancialProposalInteraction, validateFinancialProposalResponse } from "../e2e/financial-proposal-response"

const url = "http://127.0.0.1:55123/api/saved-deals/deal-1/viewing-assessments/assessment-1/financial-proposal"
const proposal = { id: "fprop-1", dealId: "deal-1", assessmentId: "assessment-1" }

describe("financial proposal response contract", () => {
  it.each([200, 201])("accepts successful status %s", (status) => {
    expect(validateFinancialProposalResponse(url, status, { success: true, replayed: status === 200, proposal }, url, "deal-1", "assessment-1").proposal).toEqual(proposal)
  })

  it("rejects non-success statuses and unrelated endpoints", () => {
    expect(() => validateFinancialProposalResponse(url, 409, { success: false }, url, "deal-1", "assessment-1")).toThrow(/unexpected status/)
    expect(() => validateFinancialProposalResponse(`${url}/other`, 201, { success: true, proposal }, url, "deal-1", "assessment-1")).toThrow(/unexpected endpoint/)
  })

  it.each([
    [false, false, "request-not-observed"],
    [true, false, "response-timeout"],
    [true, true, "response-validation"],
  ])("classifies bounded diagnostic state", (requestObserved, responseObserved, expected) => {
    expect(financialProposalFailureCategory(requestObserved, responseObserved)).toBe(expected)
  })

  it("calculates a finite budget inside the overall deadline", () => {
    expect(calculateFinancialProposalWaitBudget({ timeoutMs: 180_000, elapsedMs: 120_000 })).toBe(30_000)
    expect(calculateFinancialProposalWaitBudget({ timeoutMs: 10_000, elapsedMs: 2_000 })).toBe(7_000)
  })

  it("runs exactly one click and accepts a completed response", async () => {
    let clicks = 0
    const result = await runFinancialProposalInteraction({
      click: async (timeout) => { expect(timeout).toBe(5_000); clicks++ },
      waitForRequest: async () => {},
      waitForResponse: async () => "ok",
      waitForRequestFailure: async () => new Promise<void>(() => {}),
      clickTimeoutMs: 5_000,
    })
    expect(result).toBe("ok")
    expect(clicks).toBe(1)
  })

  it("reports click, missing response, and request-failed paths", async () => {
    await expect(runFinancialProposalInteraction({
      click: () => new Promise<void>(() => {}),
      waitForRequest: async () => {},
      waitForResponse: () => new Promise<string>(() => {}),
      clickTimeoutMs: 5,
      responseTimeoutMs: 5,
    })).rejects.toThrow(/click-not-completed/)
    await expect(runFinancialProposalInteraction({
      click: async () => {},
      waitForRequest: () => new Promise<void>(() => {}),
      waitForResponse: () => new Promise<string>(() => {}),
      clickTimeoutMs: 5,
      responseTimeoutMs: 5,
    })).rejects.toThrow(/response-timeout|request-not-observed/)
    await expect(runFinancialProposalInteraction({
      click: async () => {},
      waitForRequest: async () => {},
      waitForResponse: () => new Promise<string>(() => {}),
      waitForRequestFailure: async () => {},
      clickTimeoutMs: 5,
      responseTimeoutMs: 5,
    })).rejects.toThrow(/request-failed|network/)
  })

  it.each([
    [{ timeoutMs: Number.NaN, elapsedMs: 1 }, /timeoutMs/],
    [{ timeoutMs: 10, elapsedMs: Number.POSITIVE_INFINITY }, /elapsedMs/],
    [{ timeoutMs: 1_000, elapsedMs: 1_000 }, /No financial proposal test budget/],
  ])("rejects invalid or expired timing", (timing, error) => {
    expect(() => calculateFinancialProposalWaitBudget(timing)).toThrow(error)
  })

  it.each([
    [{ success: true, proposal: { id: "fprop-1", dealId: "deal-2", assessmentId: "assessment-1" } }, /ownership/],
    [{ success: true, proposal: { id: "fprop-1", dealId: "deal-1" } }, /identifiers/],
    [{ success: true, proposal: { id: "fprop-1", dealId: "deal-1", assessmentId: "assessment-2" } }, /ownership/],
  ])("rejects invalid ownership payloads", (payload, error) => {
    expect(() => validateFinancialProposalResponse(url, 201, payload, url, "deal-1", "assessment-1")).toThrow(error)
  })
})
