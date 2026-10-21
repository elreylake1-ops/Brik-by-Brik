import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { requireSavedDealReadAccess } from "@/lib/operator-command/require-saved-deal-read-access"
import { isDevelopmentOpen } from "@/lib/operator-command/guard-saved-deal-api"

/**
 * Server-rendered pages call this before loading any data. Unauthenticated visitors are redirected to the sign-in page
 * (returning to `returnTo` afterwards); signed-in non-operators get a 404. Same guard and same development-only
 * opt-in as the API routes.
 */
export async function requireOperatorPage(returnTo: string, dealId?: string): Promise<void> {
  if (isDevelopmentOpen()) return
  const request = new Request("http://internal/page", { headers: await headers() })
  const access = await requireSavedDealReadAccess(request, dealId)
  if (access.allowed) return
  if (access.reason === "unauthenticated") redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`)
  notFound()
}
