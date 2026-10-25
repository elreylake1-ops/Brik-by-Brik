import { describe, expect, it } from "vitest"
import { financialProposalFailureCategory, validateFinancialProposalResponse } from "../e2e/financial-proposal-response"

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

  it.each([
    [{ success: true, proposal: { id: "fprop-1", dealId: "deal-2", assessmentId: "assessment-1" } }, /ownership/],
    [{ success: true, proposal: { id: "fprop-1", dealId: "deal-1" } }, /identifiers/],
    [{ success: true, proposal: { id: "fprop-1", dealId: "deal-1", assessmentId: "assessment-2" } }, /ownership/],
  ])("rejects invalid ownership payloads", (payload, error) => {
    expect(() => validateFinancialProposalResponse(url, 201, payload, url, "deal-1", "assessment-1")).toThrow(error)
  })
})
