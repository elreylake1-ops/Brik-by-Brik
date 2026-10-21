import { getOperatorAuthDeps } from "./operator-auth"
import { buildClearedSessionCookie, buildSessionCookie, endSession, isSameOrigin, startSession } from "./session"

// Sign-in / sign-out orchestration, kept free of Next so it is directly testable.
// Failures never say WHY (unknown account, wrong password, not an operator, provider down all look the same), so the
// endpoint cannot be used to discover who has an account or who is an operator.

export type AuthResponse = { status: number; body: Record<string, unknown>; setCookie?: string }

const GENERIC_FAILURE: AuthResponse = { status: 401, body: { success: false, error: "SIGN_IN_FAILED" } }
const MAX_BODY_CHARS = 2000

// Bounded in-memory throttle: 5 failures per key per 15 minutes. ponytail: per-instance only; a shared limiter is
// needed if the app ever runs on several instances (the identity provider also rate-limits password grants).
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
const MAX_KEYS = 5000
const failures = new Map<string, number[]>()

function throttleKey(request: Request, email: string): string {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local"
  return `${ip}|${email.toLowerCase()}`
}

function isThrottled(key: string, nowMs: number): boolean {
  const recent = (failures.get(key) ?? []).filter((t) => nowMs - t < WINDOW_MS)
  failures.set(key, recent)
  return recent.length >= MAX_FAILURES
}

function recordFailure(key: string, nowMs: number) {
  if (failures.size >= MAX_KEYS) failures.clear()
  failures.set(key, [...(failures.get(key) ?? []), nowMs])
}

export function __resetSignInThrottleForTests() {
  if (process.env.NODE_ENV !== "test") throw new Error("test-only")
  failures.clear()
}

/** Only same-site relative paths; anything else becomes "/". Prevents open redirects after sign-in. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/"
  return value.length > 500 ? "/" : value
}

export async function signInRequest(request: Request): Promise<AuthResponse> {
  if (!isSameOrigin(request)) return { status: 403, body: { success: false, error: "CROSS_ORIGIN_REJECTED" } }
  const deps = getOperatorAuthDeps()
  if (!deps?.sessions || !deps.credentials) return { status: 503, body: { success: false, error: "SIGN_IN_UNAVAILABLE" } }

  let email: unknown
  let password: unknown
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_CHARS) return { status: 413, body: { success: false, error: "Request body too large." } }
    ;({ email, password } = JSON.parse(raw))
  } catch {
    return { status: 400, body: { success: false, error: "Malformed JSON." } }
  }
  if (typeof email !== "string" || typeof password !== "string" || !email || !password || email.length > 320 || password.length > 1000) {
    return { status: 400, body: { success: false, error: "Email and password are required." } }
  }

  const now = (deps.now ?? (() => new Date()))()
  const key = throttleKey(request, email)
  if (isThrottled(key, now.getTime())) return { status: 429, body: { success: false, error: "TOO_MANY_ATTEMPTS" } }

  try {
    const result = await deps.credentials.signIn(email, password)
    // Authentication alone is not enough: the shared identity project has accounts that are not operators of this app.
    if (result.status !== "verified" || !(await deps.membership.isActiveOperator(result.subject))) {
      recordFailure(key, now.getTime())
      return GENERIC_FAILURE
    }
    await endSession(request, deps.sessions, now) // never reuse a pre-existing session id (session fixation)
    const session = await startSession(deps.sessions, result.subject, now)
    return { status: 200, body: { success: true }, setCookie: buildSessionCookie(request, session.id, session.maxAgeSeconds) }
  } catch {
    return GENERIC_FAILURE
  }
}

export async function signOutRequest(request: Request): Promise<AuthResponse> {
  if (!isSameOrigin(request)) return { status: 403, body: { success: false, error: "CROSS_ORIGIN_REJECTED" } }
  const deps = getOperatorAuthDeps()
  try {
    if (deps?.sessions) await endSession(request, deps.sessions, (deps.now ?? (() => new Date()))())
  } catch {
    // the cookie is cleared regardless; a store failure must not leave the browser believing it is signed in
  }
  return { status: 200, body: { success: true }, setCookie: buildClearedSessionCookie(request) }
}
