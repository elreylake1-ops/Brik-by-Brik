export type FinancialProposalResponse = {
  success: true
  replayed?: boolean
  proposal: {
    id: string
    dealId: string
    assessmentId: string
  }
}

export function financialProposalFailureCategory(requestObserved: boolean, responseObserved: boolean): string {
  return requestObserved ? (responseObserved ? "response-validation" : "response-timeout") : "request-not-observed"
}

export function validateFinancialProposalResponse(
  url: string,
  status: number,
  payload: unknown,
  expectedUrl: string,
  expectedDealId: string,
  expectedAssessmentId: string,
): FinancialProposalResponse {
  if (url !== expectedUrl) throw new Error("Financial proposal response came from an unexpected endpoint")
  if (status !== 200 && status !== 201) throw new Error(`Financial proposal returned unexpected status ${status}`)
  if (!payload || typeof payload !== "object") throw new Error("Financial proposal response was not an object")
  const body = payload as { success?: unknown; replayed?: unknown; proposal?: unknown }
  if (body.success !== true || !body.proposal || typeof body.proposal !== "object") {
    throw new Error("Financial proposal response did not contain a successful proposal")
  }
  const proposal = body.proposal as { id?: unknown; dealId?: unknown; assessmentId?: unknown }
  if (typeof proposal.id !== "string" || typeof proposal.dealId !== "string" || typeof proposal.assessmentId !== "string") {
    throw new Error("Financial proposal response omitted authoritative ownership identifiers")
  }
  if (proposal.dealId !== expectedDealId || proposal.assessmentId !== expectedAssessmentId) {
    throw new Error("Financial proposal response ownership did not match the rehearsal fixture")
  }
  return { success: true, replayed: body.replayed === true, proposal: { id: proposal.id, dealId: proposal.dealId, assessmentId: proposal.assessmentId } }
}
