import { NextResponse } from "next/server"
import { resolveOperatorIdentity } from "@/lib/auth/operator-auth"
import { isSameOrigin, isStateChanging } from "@/lib/auth/session"

export type GuardResult =
  | { ok: true; actor: string; applyCookies?: <T extends Response>(res: T) => T }
  | { ok: false; response: NextResponse }

export function isDevelopmentOpen(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.SAVED_DEALS_AUTH_ENFORCEMENT === "development-open" &&
    env.NODE_ENV === "development" &&
    env.APP_ENV !== "production" &&
    !env.VERCEL &&
    !env.VERCEL_ENV &&
    !env.NEXT_PUBLIC_VERCEL_ENV &&
    !env.CI
  )
}

/**
 * Universal security guard for Saved Deals API routes.
 * Enforces:
 * 1. 401 on unauthenticated requests.
 * 2. 403 on valid users not in OPERATOR_ALLOWED_SUBJECTS.
 * 3. 403 on cookie-authenticated cross-origin mutations (CSRF).
 * 4. Pass-through for authorized internal operators with shared company-deal access.
 */
export async function guardSavedDealApi(request: Request, dealId?: string): Promise<GuardResult> {
  // Authorization policy: Every approved operator has shared access to company deals.
  void dealId

  if (isDevelopmentOpen()) {
    console.warn("SAVED_DEALS_AUTH_ENFORCEMENT=development-open: Saved Deals API is NOT authenticated (local development only).")
    return { ok: true, actor: "local-dev-operator" }
  }

  const identity = await resolveOperatorIdentity(request)

  if (identity.status === "unauthenticated") {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "AUTHENTICATION_REQUIRED" },
        { status: 401, headers: { "cache-control": "no-store" } }
      ),
    }
  }

  if (identity.status === "unauthorized") {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "UNAUTHORIZED_OPERATOR" },
        { status: 403, headers: { "cache-control": "no-store" } }
      ),
    }
  }

  // Identity verified: Check CSRF on ambient credentials (cookies) for mutations
  if (identity.credential === "cookie" && isStateChanging(request) && !isSameOrigin(request)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "CROSS_ORIGIN_REJECTED" },
        { status: 403, headers: { "cache-control": "no-store" } }
      ),
    }
  }

  return {
    ok: true,
    actor: identity.subject,
    applyCookies: identity.applyCookies,
  }
}

