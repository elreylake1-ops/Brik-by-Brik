import { NextResponse } from "next/server"
import { createSafeRouteErrorDiagnostic } from "@/lib/http/safe-route-error"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"
import { requireSavedDealReadAccess } from "@/lib/operator-command/require-saved-deal-read-access"
import { MAX_BODY_BYTES } from "./request-validation"

// Shared route plumbing for the viewing-assessment endpoints.
// Order: validate ids -> authenticate (existing fail-closed guard) -> saved deal exists.
// `actor` is always the server-side principal subject; nothing identity-related is read from the body.

export type RouteParams = { id?: string; assessmentId?: string; proposalId?: string; evidenceId?: string; jobId?: string }
export type RouteContext = { params: Promise<RouteParams> | RouteParams }

const ID_PATTERN = /^[A-Za-z0-9:_.-]{1,150}$/

export const json = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status })

export type Authorized = {
  ok: true
  dealId: string
  assessmentId?: string
  proposalId?: string
  evidenceId?: string
  jobId?: string
  actor: string
}

export async function authorize(
  request: Request,
  context: RouteContext,
  require: { assessment?: boolean; proposal?: boolean; evidence?: boolean; job?: boolean } = {}
): Promise<Authorized | { ok: false; response: NextResponse }> {
  const params = await context.params
  const ids = {
    dealId: params?.id,
    assessmentId: params?.assessmentId,
    proposalId: params?.proposalId,
    evidenceId: params?.evidenceId,
    jobId: params?.jobId,
  }
  const required = [
    ids.dealId,
    require.assessment ? ids.assessmentId : "x",
    require.proposal ? ids.proposalId : "x",
    require.evidence ? ids.evidenceId : "x",
    require.job ? ids.jobId : "x",
  ]
  if (required.some((v) => typeof v !== "string" || !ID_PATTERN.test(v))) {
    return { ok: false, response: json({ success: false, error: "Invalid identifier." }, 400) }
  }

  const access = await requireSavedDealReadAccess(request, ids.dealId)
  if (!access.allowed) {
    return { ok: false, response: json({ success: false, error: access.code }, access.status) }
  }

  const deal = await getSavedDealById(ids.dealId as string)
  if (!deal) return { ok: false, response: json({ success: false, error: "SAVED_DEAL_NOT_FOUND" }, 404) }

  return { ok: true, ...(ids as { dealId: string }), actor: access.principal.subject }
}

// State-changing requests only. Browsers always send Origin on cross-site POSTs, so a mismatching or
// opaque ("null") Origin is rejected; requests with no Origin (curl, server-to-server) are not browser
// CSRF vectors and fall through to authentication. Needed before any cookie-based identity is enabled.
function isCrossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    return new URL(origin).host !== (request.headers.get("host") ?? new URL(request.url).host)
  } catch {
    return true
  }
}

export async function readJsonBody(
  request: Request
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  if (isCrossOrigin(request)) {
    return { ok: false, response: json({ success: false, error: "CROSS_ORIGIN_REJECTED" }, 403) }
  }
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, response: json({ success: false, error: "Request body too large." }, 413) }
  }
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return { ok: false, response: json({ success: false, error: "Request body too large." }, 413) }
  }
  try {
    return { ok: true, body: JSON.parse(raw) }
  } catch {
    return { ok: false, response: json({ success: false, error: "Malformed JSON." }, 400) }
  }
}

// Raw binary request body (frame images). Same-origin and size rules as readJsonBody, plus an exact
// Content-Type match: parameters are ignored, but the media type must be the one the route accepts.
export async function readBinaryBody(
  request: Request,
  options: { contentType: string; maxBytes: number }
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; response: NextResponse }> {
  if (isCrossOrigin(request)) {
    return { ok: false, response: json({ success: false, error: "CROSS_ORIGIN_REJECTED" }, 403) }
  }
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  if (type !== options.contentType) {
    return { ok: false, response: json({ success: false, error: "UNSUPPORTED_MEDIA_TYPE" }, 415) }
  }
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > options.maxBytes) {
    return { ok: false, response: json({ success: false, error: "Request body too large." }, 413) }
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length > options.maxBytes) {
    return { ok: false, response: json({ success: false, error: "Request body too large." }, 413) }
  }
  return { ok: true, bytes }
}

export const invalidInput = (errors: string[]) =>
  json({ success: false, error: "Invalid input.", validation: { errors } }, 400)

export const assessmentNotFound = () => json({ success: false, error: "ASSESSMENT_NOT_FOUND" }, 404)

export function serverError(routeName: string, error: unknown) {
  const diagnostic = createSafeRouteErrorDiagnostic(routeName, error)
  console.error("Viewing assessment route failed.", diagnostic)
  return json({ success: false, error: "VIEWING_ASSESSMENT_FAILED", traceId: diagnostic.traceId }, 500)
}
