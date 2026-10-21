import type { TrustedInternalOperatorIdentityResult } from "@/lib/operator-command/trusted-internal-operator-identity"
import { createJwksKeyProvider, type KeyProvider } from "./jwks"
import { verifyJwt } from "./jwt"
import { pgSessionStore } from "./pg-session-store"
import { createSupabasePasswordExchange } from "./password-exchange"
import { checkSession, type SessionStore } from "./session"

// Server-side operator identity boundary, in two independent steps:
//   1. IdentityProvider  - AUTHENTICATION: who is this? (replaceable adapter; Supabase-issued JWT is the first)
//   2. MembershipStore   - AUTHORIZATION: is that person an operator of THIS application?
// A valid token alone never grants access. Supabase Auth is shared by every product in the shared project,
// so "has a valid token" only means "has an account somewhere in that project".
//
// Everything fails closed: missing/invalid configuration, bad token, provider error, or unknown member all
// resolve to "unauthenticated" / "unauthorized". There is no default identity, no static token, no header
// that is trusted (x-user-id, x-role, ... are never read).

export type ProviderResult =
  | { status: "verified"; subject: string }
  | { status: "absent" } // no credentials presented
  | { status: "invalid" } // credentials presented but not acceptable (reason deliberately not exposed)

export type IdentityProvider = { authenticate(request: Request): Promise<ProviderResult> }

export type MembershipStore = { isActiveOperator(subject: string): Promise<boolean> }

// AUTHENTICATION by credentials the user types at sign-in. The provider's tokens are verified and discarded server-side;
// only the verified subject is kept (as a server-side session). Optional: without it, sign-in is unavailable.
export type CredentialExchange = { signIn(email: string, password: string): Promise<ProviderResult> }

export type OperatorAuthDeps = {
  provider: IdentityProvider
  membership: MembershipStore
  sessions?: SessionStore
  credentials?: CredentialExchange
  now?: () => Date
}

// ---- Membership (first slice: owner-managed allowlist in env; DB-backed store is the planned replacement)

const SUBJECT_PATTERN = /^[A-Za-z0-9_.:@|-]{1,200}$/

export function createAllowlistMembershipStore(raw: string | undefined): MembershipStore | null {
  const entries = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  if (entries.length === 0 || entries.some((e) => !SUBJECT_PATTERN.test(e))) return null // invalid => nobody
  const allowed = new Set(entries)
  return { isActiveOperator: async (subject) => allowed.has(subject) }
}

// ---- Supabase-issued JWT adapter

export type SupabaseJwtConfig = { issuer: string; audience: string; jwksUrl: string }

export function createBearerJwtProvider(
  config: SupabaseJwtConfig,
  getKey: KeyProvider,
  nowSeconds: () => number = () => Math.floor(Date.now() / 1000)
): IdentityProvider {
  return {
    async authenticate(request) {
      const header = request.headers.get("authorization")
      if (!header) return { status: "absent" }
      const match = /^Bearer ([A-Za-z0-9._-]+)$/i.exec(header)
      if (!match) return { status: "invalid" }
      const result = await verifyJwt(match[1], {
        issuer: config.issuer,
        audience: config.audience,
        getKey,
        nowSeconds,
      })
      return result.ok ? { status: "verified", subject: result.claims.sub } : { status: "invalid" }
    },
  }
}

/**
 * Reads OPERATOR_AUTH_MODE, OPERATOR_JWT_ISSUER, OPERATOR_JWT_AUDIENCE, OPERATOR_JWKS_URL,
 * OPERATOR_ALLOWED_SUBJECTS. Returns null (=> fail closed) unless ALL are present and valid. The JWKS URL
 * must be https on the issuer's own origin so configuration cannot point key lookup at a third party.
 * There is intentionally no mode that selects a test or static identity.
 */
export function readOperatorAuthDeps(env: Record<string, string | undefined>): OperatorAuthDeps | null {
  if (env.OPERATOR_AUTH_MODE !== "supabase-jwt") return null
  const { OPERATOR_JWT_ISSUER: issuer, OPERATOR_JWT_AUDIENCE: audience, OPERATOR_JWKS_URL: jwksUrl } = env
  if (!issuer || !audience || !jwksUrl) return null
  try {
    const iss = new URL(issuer)
    const jwks = new URL(jwksUrl)
    if (iss.protocol !== "https:" || jwks.protocol !== "https:" || iss.origin !== jwks.origin) return null
    // A loopback issuer is only ever the local test identity simulator. In a hosted environment (Vercel Production or
    // Preview) such configuration is refused outright, so simulator tokens can never be accepted there.
    if ((env.VERCEL || env.VERCEL_ENV) && /^(localhost|127\.|\[?::1\]?$|0\.0\.0\.0)/i.test(iss.hostname)) return null
  } catch {
    return null
  }
  const membership = createAllowlistMembershipStore(env.OPERATOR_ALLOWED_SUBJECTS)
  if (!membership) return null
  const getKey = createJwksKeyProvider({ url: jwksUrl })
  const config = { issuer, audience, jwksUrl }
  return {
    provider: createBearerJwtProvider(config, getKey),
    membership,
    sessions: pgSessionStore,
    credentials: createSupabasePasswordExchange(env, config, getKey) ?? undefined,
  }
}

// ---- Composition

let cachedEnvDeps: { key: string; deps: OperatorAuthDeps | null } | undefined
let testDeps: OperatorAuthDeps | null | undefined

/** Test seam. Refuses to run outside NODE_ENV=test, and there is no env var that reaches it. */
export function __setOperatorAuthDepsForTests(deps: OperatorAuthDeps | null | undefined): void {
  if (process.env.NODE_ENV !== "test") throw new Error("__setOperatorAuthDepsForTests is test-only")
  testDeps = deps
}

function currentDeps(): OperatorAuthDeps | null {
  if (testDeps !== undefined) return testDeps
  const env = process.env as Record<string, string | undefined>
  const key = [
    env.OPERATOR_AUTH_MODE,
    env.OPERATOR_JWT_ISSUER,
    env.OPERATOR_JWT_AUDIENCE,
    env.OPERATOR_JWKS_URL,
    env.OPERATOR_ALLOWED_SUBJECTS,
    env.OPERATOR_PASSWORD_GRANT_URL,
    env.OPERATOR_PASSWORD_GRANT_API_KEY,
  ].join("\u0000")
  if (cachedEnvDeps?.key !== key) cachedEnvDeps = { key, deps: readOperatorAuthDeps(env) }
  return cachedEnvDeps.deps
}

export function getOperatorAuthDeps(): OperatorAuthDeps | null {
  return currentDeps()
}

// Credential precedence: an Authorization header is authoritative (a bad one is NOT rescued by a cookie); the session
// cookie is consulted only when no Authorization header was sent. Membership is re-checked on every request either way.
export async function resolveOperatorIdentity(request: Request): Promise<TrustedInternalOperatorIdentityResult> {
  try {
    const deps = currentDeps()
    if (!deps) return { status: "unauthenticated" }
    let subject: string
    let credential: "bearer" | "session"
    const result = await deps.provider.authenticate(request)
    if (result.status === "verified") {
      subject = result.subject
      credential = "bearer"
    } else if (result.status === "absent" && deps.sessions) {
      const session = await checkSession(request, deps.sessions, (deps.now ?? (() => new Date()))())
      if (session.status !== "valid") return { status: "unauthenticated" }
      subject = session.subject
      credential = "session"
    } else {
      return { status: "unauthenticated" }
    }
    if (!(await deps.membership.isActiveOperator(subject))) return { status: "unauthorized" }
    return { status: "authenticated", principal: { kind: "internal_operator", subject }, credential }
  } catch {
    return { status: "unauthenticated" }
  }
}
