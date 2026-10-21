import { notFound } from "next/navigation"

/**
 * Fixture-driven developer pages call this first. They are served only by `next dev` (and unit tests); any production
 * build, and any hosted environment, answers 404 and renders none of the page. There is no environment variable that
 * re-enables them.
 */
export function isDevelopmentPageAllowed(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL || env.VERCEL_ENV) return false
  return env.NODE_ENV === "development" || env.NODE_ENV === "test"
}

export function developmentOnlyPage(): void {
  if (!isDevelopmentPageAllowed()) notFound()
}
