import { createRouteHandlerSupabaseClient, createServerSupabaseClient } from "./supabase-server"

export type OperatorIdentityResult =
  | { status: "verified"; subject: string; credential: "bearer" | "cookie"; applyCookies?: <T extends Response>(res: T) => T }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; subject: string }

export type MembershipStore = {
  isActiveOperator(subject: string): Promise<boolean>
}

const SUBJECT_PATTERN = /^[A-Za-z0-9_.:@|-]{1,200}$/

export function createAllowlistMembershipStore(raw: string | undefined): MembershipStore | null {
  const entries = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  if (entries.length === 0 || entries.some((e) => !SUBJECT_PATTERN.test(e))) return null
  const allowed = new Set(entries)
  return { isActiveOperator: async (subject) => allowed.has(subject) }
}

let testOperatorAuth: ((request: Request) => Promise<OperatorIdentityResult>) | null | undefined

export function __setOperatorAuthForTests(fn: ((request: Request) => Promise<OperatorIdentityResult>) | null | undefined) {
  testOperatorAuth = fn
}

/**
 * Resolves and validates operator identity from request (Bearer token or Supabase Auth cookie).
 * Enforces OPERATOR_ALLOWED_SUBJECTS.
 */
export async function resolveOperatorIdentity(
  request: Request,
  env: Record<string, string | undefined> = process.env
): Promise<OperatorIdentityResult> {
  if (testOperatorAuth !== undefined) {
    if (testOperatorAuth === null) return { status: "unauthenticated" }
    return testOperatorAuth(request)
  }

  const membership = createAllowlistMembershipStore(env.OPERATOR_ALLOWED_SUBJECTS)
  if (!membership) {
    // Fail closed if allowlist is missing or invalid
    return { status: "unauthenticated" }
  }

  // 1. Check Bearer JWT first
  const authHeader = request.headers.get("authorization")
  if (authHeader && /^Bearer /i.test(authHeader)) {
    const token = authHeader.replace(/^Bearer /i, "").trim()
    const result = await verifyBearerToken(token, env)
    if (!result) return { status: "unauthenticated" }

    const isAllowed = await membership.isActiveOperator(result.sub)
    if (!isAllowed) {
      return { status: "unauthorized", subject: result.sub }
    }

    return { status: "verified", subject: result.sub, credential: "bearer" }
  }

  // 2. Check Supabase SSR Cookies
  const routeClient = createRouteHandlerSupabaseClient(request, env)
  if (!routeClient) {
    return { status: "unauthenticated" }
  }

  try {
    // getUser() cryptographically validates the JWT against Supabase Auth
    const { data: { user }, error } = await routeClient.supabase.auth.getUser()
    if (error || !user?.id) {
      return { status: "unauthenticated" }
    }

    const isAllowed = await membership.isActiveOperator(user.id)
    if (!isAllowed) {
      return { status: "unauthorized", subject: user.id }
    }

    return {
      status: "verified",
      subject: user.id,
      credential: "cookie",
      applyCookies: routeClient.applyCookies,
    }
  } catch {
    return { status: "unauthenticated" }
  }
}

/**
 * Validates Bearer token directly with Supabase Auth getUser(token)
 */
async function verifyBearerToken(
  token: string,
  env: Record<string, string | undefined>
): Promise<{ sub: string } | null> {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null

  try {
    // Call Supabase Auth /user endpoint directly with bearer token
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return null
    const data = (await res.json()) as { id?: string }
    if (!data?.id) return null
    return { sub: data.id }
  } catch {
    return null
  }
}

/**
 * Server Component Helper: Validates current operator from cookies.
 */
export async function requireServerOperator(
  env: Record<string, string | undefined> = process.env
): Promise<{ ok: true; subject: string } | { ok: false; status: 401 | 403 }> {
  if (testOperatorAuth !== undefined) {
    if (testOperatorAuth === null) return { ok: false, status: 401 }
    const res = await testOperatorAuth(new Request("http://localhost"))
    if (res.status === "verified") return { ok: true, subject: res.subject }
    if (res.status === "unauthorized") return { ok: false, status: 403 }
    return { ok: false, status: 401 }
  }

  const membership = createAllowlistMembershipStore(env.OPERATOR_ALLOWED_SUBJECTS)
  if (!membership) return { ok: false, status: 401 }

  const client = await createServerSupabaseClient(env)
  if (!client) return { ok: false, status: 401 }

  try {
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user?.id) return { ok: false, status: 401 }

    const isAllowed = await membership.isActiveOperator(user.id)
    if (!isAllowed) return { ok: false, status: 403 }

    return { ok: true, subject: user.id }
  } catch {
    return { ok: false, status: 401 }
  }
}

