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

export type FinancialProposalTiming = {
  timeoutMs: number
  elapsedMs: number
  maxStepMs?: number
  safetyMs?: number
}

export function calculateFinancialProposalWaitBudget({ timeoutMs, elapsedMs, maxStepMs = 30_000, safetyMs = 1_000 }: FinancialProposalTiming): number {
  for (const [name, value] of Object.entries({ timeoutMs, elapsedMs, maxStepMs, safetyMs })) {
    if (!Number.isFinite(value)) throw new Error(`Invalid financial proposal timing input: ${name}`)
  }
  if (timeoutMs <= 0 || elapsedMs < 0 || maxStepMs <= 0 || safetyMs < 0) throw new Error("Invalid financial proposal timing range")
  const remaining = timeoutMs - elapsedMs - safetyMs
  if (remaining <= 0) throw new Error("No financial proposal test budget remains")
  return Math.min(maxStepMs, remaining)
}

export type FinancialProposalInteraction<T> = {
  click: (timeoutMs: number) => Promise<void>
  waitForRequest: (timeoutMs: number) => Promise<void>
  waitForResponse: (timeoutMs: number) => Promise<T>
  waitForRequestFailure?: (timeoutMs: number) => Promise<void>
  clickTimeoutMs?: number
  responseTimeoutMs?: number
}

export async function runFinancialProposalInteraction<T>({
  click,
  waitForRequest,
  waitForResponse,
  waitForRequestFailure,
  clickTimeoutMs = 15_000,
  responseTimeoutMs = 15_000,
}: FinancialProposalInteraction<T>): Promise<T> {
  for (const [name, value] of Object.entries({ clickTimeoutMs, responseTimeoutMs })) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid financial proposal ${name}`)
  }
  let clickCompleted = false
  let requestObserved = false
  let requestFailed = false
  let responseObserved = false
  const bounded = <V>(operation: Promise<V>, timeoutMs: number, label: string) => new Promise<V>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs)
    operation.then((value) => { clearTimeout(timer); resolve(value) }, (error) => { clearTimeout(timer); reject(error) })
  })
  const clickPromise = bounded(click(clickTimeoutMs), clickTimeoutMs, "click").then(() => { clickCompleted = true })
  const requestPromise = bounded(waitForRequest(responseTimeoutMs), responseTimeoutMs, "request").then(() => { requestObserved = true })
  const failurePromise = waitForRequestFailure
    ? bounded(waitForRequestFailure(responseTimeoutMs), responseTimeoutMs, "request failure").then(() => { requestFailed = true }).catch(() => {})
    : new Promise<void>((resolve) => setTimeout(resolve, responseTimeoutMs))
  const responsePromise = requestPromise.then(() => bounded(waitForResponse(responseTimeoutMs), responseTimeoutMs, "response").then((response) => { responseObserved = true; return response }))
  try {
    return await Promise.race([
      responsePromise,
      failurePromise.then(() => { throw new Error("Financial proposal request failed") }),
      clickPromise.then(() => responsePromise),
    ]).then((result) => result as T)
  } catch (error) {
    const category = requestFailed ? "request-failed" : !clickCompleted ? "click-not-completed" : !requestObserved ? "request-not-observed" : !responseObserved ? "response-timeout" : "response-validation"
    throw new Error(`Financial proposal diagnostic: category=${category}; clickCompleted=${clickCompleted}; requestObserved=${requestObserved}; responseObserved=${responseObserved}; ${error instanceof Error ? error.message : "unknown failure"}`)
  } finally {
    // All watchers have rejection handlers and finite deadlines; do not hold a
    // successful response open waiting for the optional failure watcher.
    await Promise.allSettled([clickPromise, requestPromise, responsePromise])
  }
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
