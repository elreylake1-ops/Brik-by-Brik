import { NextResponse } from "next/server"
import { requireSavedDealReadAccess } from "@/lib/operator-command/require-saved-deal-read-access"

// Single entry point for the original (pre-viewing) Saved Deals API routes. Every handler calls this FIRST.
//
// Enforcement is on by default everywhere. The only way off is the explicit, visible local-development opt-in
// SAVED_DEALS_AUTH_ENFORCEMENT=development-open, honoured ONLY when NODE_ENV is "development" and no deployment marker
// is present. In tests, production builds and any hosted environment it is ignored, so it cannot open a deployed app.
// It exists so the existing UI stays usable on a developer machine until a sign-in provider is configured.

export type GuardResult = { ok: true; actor: string | null } | { ok: false; response: NextResponse }

export function isDevelopmentOpen(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.SAVED_DEALS_AUTH_ENFORCEMENT === "development-open" &&
    env.NODE_ENV === "development" &&
    !env.VERCEL &&
    !env.VERCEL_ENV &&
    !env.CI
  )
}

export async function guardSavedDealApi(request: Request, dealId?: string): Promise<GuardResult> {
  if (isDevelopmentOpen()) {
    console.warn("SAVED_DEALS_AUTH_ENFORCEMENT=development-open: Saved Deals API is NOT authenticated (local development only).")
    return { ok: true, actor: null }
  }
  const access = await requireSavedDealReadAccess(request, dealId)
  if (!access.allowed) {
    return { ok: false, response: NextResponse.json({ success: false, error: access.code }, { status: access.status, headers: { "cache-control": "no-store" } }) }
  }
  return { ok: true, actor: access.principal.subject }
}
