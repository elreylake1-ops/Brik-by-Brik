import { createHash, randomBytes } from "node:crypto"

// Cookie sessions for operators.
//
// The cookie carries only a random 256-bit session id. Nothing else is stored in the browser: no token from the identity
// provider, no role, no operator id. The server stores the SHA-256 of the id (so a database read does not yield usable
// cookies) with the verified subject and bounded lifetimes. Every request re-checks operator membership, so removing an
// operator from the allowlist ends their access immediately, and sign-out/revocation is a server-side row update.

// Visible lifetime policy (milliseconds). Absolute cap + idle timeout; whichever comes first ends the session.
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000
export const SESSION_IDLE_MS = 60 * 60 * 1000
// last_seen is refreshed at most this often, to avoid a write on every request.
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000

export const SESSION_COOKIE_BASE = "brik_session"
export const SECURE_SESSION_COOKIE = `__Host-${SESSION_COOKIE_BASE}`

export type SessionRecord = {
  subject: string
  createdAt: Date
  lastSeenAt: Date
  expiresAt: Date
  revokedAt: Date | null
}

export type SessionStore = {
  create(input: { idHash: string; subject: string; now: Date; expiresAt: Date }): Promise<void>
  find(idHash: string): Promise<SessionRecord | null>
  touch(idHash: string, now: Date): Promise<void>
  revoke(idHash: string, now: Date): Promise<void>
}

const ID_PATTERN = /^[A-Za-z0-9_-]{43}$/ // base64url of 32 bytes

export function hashSessionId(id: string): string {
  return createHash("sha256").update(id).digest("hex")
}

export function newSessionId(): string {
  return randomBytes(32).toString("base64url")
}

export function isHttps(request: Request): boolean {
  if (new URL(request.url).protocol === "https:") return true
  return (request.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim().toLowerCase() === "https"
}

/** `__Host-` prefix (Secure, Path=/, no Domain) over HTTPS; plain name over local http, where Secure cookies cannot be set. */
export function sessionCookieName(secure: boolean): string {
  return secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE_BASE
}

export function readSessionId(request: Request): string | null {
  const header = request.headers.get("cookie")
  if (!header) return null
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    if (name !== SECURE_SESSION_COOKIE && name !== SESSION_COOKIE_BASE) continue
    const value = part.slice(eq + 1).trim()
    return ID_PATTERN.test(value) ? value : null
  }
  return null
}

export function buildSessionCookie(request: Request, id: string, maxAgeSeconds: number): string {
  const secure = isHttps(request)
  return [
    `${sessionCookieName(secure)}=${id}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ")
}

export function buildClearedSessionCookie(request: Request): string {
  const secure = isHttps(request)
  return [`${sessionCookieName(secure)}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0", ...(secure ? ["Secure"] : [])].join("; ")
}

export type SessionCheck = { status: "valid"; subject: string; idHash: string; record: SessionRecord } | { status: "absent" } | { status: "invalid" }

/** Looks up and validates the session named by the request's cookie. Never throws; any failure is "invalid". */
export async function checkSession(request: Request, store: SessionStore, now: Date): Promise<SessionCheck> {
  const id = readSessionId(request)
  if (!id) return { status: "absent" }
  try {
    const idHash = hashSessionId(id)
    const record = await store.find(idHash)
    if (!record) return { status: "invalid" }
    if (record.revokedAt) return { status: "invalid" }
    if (now.getTime() >= record.expiresAt.getTime()) return { status: "invalid" }
    if (now.getTime() - record.lastSeenAt.getTime() >= SESSION_IDLE_MS) return { status: "invalid" }
    if (now.getTime() - record.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) await store.touch(idHash, now)
    return { status: "valid", subject: record.subject, idHash, record }
  } catch {
    return { status: "invalid" }
  }
}

export async function startSession(store: SessionStore, subject: string, now: Date): Promise<{ id: string; maxAgeSeconds: number }> {
  const id = newSessionId()
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS)
  await store.create({ idHash: hashSessionId(id), subject, now, expiresAt })
  return { id, maxAgeSeconds: Math.floor(SESSION_ABSOLUTE_MS / 1000) }
}

export async function endSession(request: Request, store: SessionStore, now: Date): Promise<void> {
  const id = readSessionId(request)
  if (id) await store.revoke(hashSessionId(id), now)
}

// ---- CSRF
// Cookies are ambient, so every state-changing request authenticated by cookie must prove it came from this site:
// the Origin header must be present and match the Host. (Bearer-token requests are not ambient and are not subject to
// this.) SameSite=Lax is a second layer, not the only one.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export function isStateChanging(request: Request): boolean {
  return !SAFE_METHODS.has(request.method.toUpperCase())
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    const host = request.headers.get("host") ?? new URL(request.url).host
    return new URL(origin).host.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}
