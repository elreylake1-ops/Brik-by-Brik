import { pgViewingAssessmentRepository as repo } from "@/lib/viewing-assessment/pg-viewing-assessment-repository"
import { parseRunRequest } from "@/lib/viewing-assessment/request-validation"
import {
  assessmentNotFound,
  authorize,
  invalidInput,
  json,
  readJsonBody,
  serverError,
  type RouteContext,
} from "@/lib/viewing-assessment/route-support"
import { runProviderAnalysis } from "@/lib/viewing-assessment/ai/run-analysis"
import { selectAnalysisProvider } from "@/lib/viewing-assessment/ai/select-provider"
import { getBlobStore } from "@/lib/viewing-assessment/storage/get-blob-store"

// GET  .../analysis-runs  processing status of every run
// POST .../analysis-runs  analyse the registered evidence with the configured provider. By default that is the
// free, SIMULATED fixture provider; a paid provider is used only if every gate in select-provider.ts is met.
// Idempotent on idempotencyKey: a replay returns the stored run and never calls the provider again.
// Execution is synchronous within the request (see docs: no reliance on work after the response).

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const runs = await repo.listRuns(auth.dealId, auth.assessmentId as string)
    if (!runs) return assessmentNotFound()
    return json({ success: true, runs }, 200)
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.runs", error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await authorize(request, context, { assessment: true })
    if (!auth.ok) return auth.response
    const body = await readJsonBody(request)
    if (!body.ok) return body.response
    const parsed = parseRunRequest(body.body)
    if (!parsed.ok) return invalidInput(parsed.errors)

    const selection = selectAnalysisProvider()
    if (!selection.ok) {
      // Names of unmet requirements only; never values.
      return json({ success: false, error: "AI_UNAVAILABLE", reasons: selection.reasons }, 503)
    }
    const outcome = await runProviderAnalysis(
      repo,
      {
        dealId: auth.dealId,
        assessmentId: auth.assessmentId as string,
        idempotencyKey: parsed.value.idempotencyKey,
        actor: auth.actor,
      },
      { provider: selection.provider, blobStore: getBlobStore() }
    )
    switch (outcome.status) {
      case "not_found":
        return assessmentNotFound()
      case "no_evidence":
        return json({ success: false, error: "NO_EVIDENCE_REGISTERED" }, 409)
      case "lease_lost":
        return json({ success: false, error: "ANALYSIS_SUPERSEDED" }, 409)
      case "in_progress":
        return json({ success: false, error: "ANALYSIS_IN_PROGRESS", run: outcome.run }, 409)
      case "ok":
        return json(
          { success: true, run: outcome.run, replayed: outcome.replayed, analysisSource: outcome.run.provider === "claude" ? "LIVE" : "SIMULATED" },
          outcome.replayed ? 200 : 201
        )
    }
  } catch (error) {
    return serverError("saved-deals.viewing-assessments.runs.create", error)
  }
}
